'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FadeIn } from '@/components/ui';
import { useI18n } from '@/contexts/I18nProvider';
import { CaregiverPatientBar } from '@/components/caregiver/CaregiverPatientBar';
import { useActivePatient } from '@/hooks/useActivePatient';
import { usePatientPreferences } from '@/hooks/usePatientPreferences';
import { useSync } from '@/hooks/useSync';
import { compressImageFileToDataUrl } from '@/lib/media-compress';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import {
  CloudOff,
  CloudSun,
  Upload,
  ClipboardList,
  Users,
  CheckCircle2,
  Droplets,
  Pill,
  Settings,
  Camera,
  Bell,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CareCircleMemberSummary {
  id: string;
  role: string;
  caregiver?: { fullName?: string | null } | null;
  clinician?: { fullName?: string | null } | null;
}

interface CognitiveSessionSummary {
  id: string;
  gameId: string;
  accuracy: number;
  score: number;
  completedAt: string;
}

interface CareMedicationItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  time?: string | null;
  status: string;
  imageUrl?: string | null;
  events?: Array<{
    id: string;
    action: string;
    source?: string | null;
    scheduledTime: string;
  }>;
}

function Dashboard() {
  const { t } = useI18n();
  const { patientId, patients, setActivePatientId, isLoading } = useActivePatient();
  const { preferences: prefs } = usePatientPreferences(patientId);
  const { syncNow } = useSync(patientId || undefined);

  const [careCircle, setCareCircle] = useState<CareCircleMemberSummary[]>([]);
  const [hydrationMl, setHydrationMl] = useState(0);
  const [medsTakenCount, setMedsTakenCount] = useState(0);
  const [medications, setMedications] = useState<CareMedicationItem[]>([]);
  const [latestCheckInSource, setLatestCheckInSource] = useState<string | null>(null);
  const [cognitiveSessions, setCognitiveSessions] = useState<CognitiveSessionSummary[]>([]);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [confirmingMedId, setConfirmingMedId] = useState<string | null>(null);
  const [uploadingPhotoMedId, setUploadingPhotoMedId] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');

  const [weight, setWeight] = useState('');
  const [sysBp, setSysBp] = useState('');
  const [diaBp, setDiaBp] = useState('');
  const [hr, setHr] = useState('');
  const [appetite, setAppetite] = useState('NORMAL');
  const [sleep, setSleep] = useState('NORMAL');
  const [notes, setNotes] = useState('');

  const loadPatientOverview = useCallback(async () => {
    if (!patientId) {
      setCareCircle([]);
      setHydrationMl(0);
      setMedsTakenCount(0);
      setMedications([]);
      setLatestCheckInSource(null);
      setCognitiveSessions([]);
      return;
    }

    try {
      const [circleRes, hydRes, medRes, cogRes, wbRes] = await Promise.all([
        fetch(`/api/care-circle?patientId=${encodeURIComponent(patientId)}`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/hydration`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/medications`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/cognitive?limit=14`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/wellbeing?limit=1`, { cache: 'no-store' }),
      ]);

      if (circleRes.ok) {
        const d = await circleRes.json();
        setCareCircle(Array.isArray(d.careCircle) ? d.careCircle : []);
      }
      if (hydRes.ok) {
        const d = await hydRes.json();
        setHydrationMl(Number(d.totalMl || 0));
      }
      if (medRes.ok) {
        const d = await medRes.json();
        const meds = Array.isArray(d.medications) ? d.medications : [];
        setMedications(meds);
        const todayStr = new Date().toISOString().split('T')[0];
        let count = 0;
        for (const m of meds) {
          const evs = Array.isArray(m.events) ? m.events : [];
          if (evs.some((e: { action?: string; scheduledTime?: string }) => e.action === 'TAKEN' && String(e.scheduledTime).startsWith(todayStr))) {
            count++;
          }
        }
        setMedsTakenCount(count);
      }
      if (cogRes.ok) {
        const d = await cogRes.json();
        setCognitiveSessions(Array.isArray(d.history) ? d.history : []);
      }
      if (wbRes.ok) {
        const d = await wbRes.json();
        const first = Array.isArray(d.entries) ? d.entries[0] : null;
        setLatestCheckInSource(first?.source || null);
      }
    } catch {
      // Offline fallback uses Dexie below
    }
  }, [patientId]);

  useEffect(() => {
    loadPatientOverview();
  }, [loadPatientOverview]);

  const rawLocalGameLogs = useLiveQuery(() => db.gameLogs.toArray());
  const localGameLogs = React.useMemo(() => rawLocalGameLogs || [], [rawLocalGameLogs]);

  const unsyncedCount =
    useLiveQuery(async () => {
      const [games, moods, vitals, reports, hydrations, meds, wb] = await Promise.all([
        db.gameLogs.filter((r) => !r.synced).count(),
        db.moods.filter((r) => !r.synced).count(),
        db.vitalLogs.filter((r) => !r.synced).count(),
        db.caregiverReports.filter((r) => !r.synced).count(),
        db.hydrationEvents.filter((r) => !r.synced).count(),
        db.medicationEvents.filter((r) => !r.synced).count(),
        db.wellbeingEntries.filter((r) => !r.synced).count(),
      ]);
      return games + moods + vitals + reports + hydrations + meds + wb;
    }, []) || 0;

  const notify = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => setFeedbackBanner((prev) => (prev === msg ? null : prev)), 4000);
  };

  const handleSync = async () => {
    if (!patientId) return;
    setIsSyncing(true);
    await syncNow();
    await loadPatientOverview();
    setIsSyncing(false);
    notify('Offline records synchronized.');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !patientId) return;

    const base64String = await compressImageFileToDataUrl(file);
    const title = uploadTitle.trim() || 'Family Memory';
    const description = uploadDesc.trim() || 'Shared by caregiver';

    let synced = false;
    try {
      const res = await fetch(`/api/patients/${patientId}/scrapbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, imageBase64: base64String }),
      });
      synced = res.ok;
    } catch {
      synced = false;
    }

    await db.scrapbook.add({
      title,
      description,
      imageBase64: base64String,
      dateAdded: new Date().toISOString(),
      synced,
    });

    setUploadTitle('');
    setUploadDesc('');
    e.target.value = '';
    notify(synced ? 'Memory photo saved to patient scrapbook.' : 'Photo cached locally offline.');
  };

  const handleConfirmMedication = async (med: CareMedicationItem) => {
    if (!patientId) return;
    setConfirmingMedId(med.id);
    try {
      const res = await fetch(`/api/patients/${patientId}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicationId: med.id,
          action: 'TAKEN',
          scheduledTime: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        notify(`Confirmed ${med.name} as Caregiver-confirmed.`);
        await loadPatientOverview();
      } else {
        notify('Could not record medication confirmation.');
      }
    } catch {
      notify('Network unavailable while confirming medication.');
    } finally {
      setConfirmingMedId(null);
    }
  };

  const handleAttachMedPhoto = async (medId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !patientId) return;
    setUploadingPhotoMedId(medId);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      const res = await fetch(`/api/patients/${patientId}/medications/photo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationId: medId, imageBase64: compressed }),
      });
      if (res.ok) {
        notify('Pill photograph saved for elder confirmation.');
        await loadPatientOverview();
      } else {
        notify('Failed to attach medication photo.');
      }
    } catch {
      notify('Could not compress or upload medication photograph.');
    } finally {
      setUploadingPhotoMedId(null);
      e.target.value = '';
    }
  };

  const handleSubmitHealthUpdate = async () => {
    if (!patientId) return;
    const today = new Date().toISOString();

    let savedServer = false;
    try {
      const calls: Promise<Response>[] = [];
      if (weight || sysBp || diaBp || hr) {
        calls.push(
          fetch(`/api/patients/${patientId}/vitals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'VITAL',
              weight: weight ? parseFloat(weight) : undefined,
              sysBp: sysBp ? parseInt(sysBp, 10) : undefined,
              diaBp: diaBp ? parseInt(diaBp, 10) : undefined,
              heartRate: hr ? parseInt(hr, 10) : undefined,
            }),
          })
        );
      }

      calls.push(
        fetch(`/api/patients/${patientId}/vitals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'REPORT',
            reportType: '30_DAY_UPDATE',
            appetite,
            sleep,
            notes: notes.trim() || `Appetite: ${appetite}, Sleep: ${sleep}`,
          }),
        })
      );

      const responses = await Promise.all(calls);
      savedServer = responses.every((r) => r.ok);
    } catch {
      savedServer = false;
    }

    if (weight || sysBp || diaBp || hr) {
      await db.vitalLogs.add({
        patientId,
        date: today,
        weight: weight ? parseFloat(weight) : undefined,
        sysBp: sysBp ? parseInt(sysBp, 10) : undefined,
        diaBp: diaBp ? parseInt(diaBp, 10) : undefined,
        heartRate: hr ? parseInt(hr, 10) : undefined,
        synced: savedServer,
      });
    }

    await db.caregiverReports.add({
      patientId,
      date: today,
      reportType: '30_DAY_UPDATE',
      symptoms: '',
      appetite,
      sleep,
      notes: notes.trim() || `Appetite: ${appetite}, Sleep: ${sleep}`,
      synced: savedServer,
    });

    setWeight('');
    setSysBp('');
    setDiaBp('');
    setHr('');
    setNotes('');
    notify(savedServer ? 'Health update saved to clinical timeline.' : 'Health update cached locally; sync when online.');
  };

  const cognitiveData = React.useMemo(() => {
    if (cognitiveSessions.length > 0) {
      return [...cognitiveSessions]
        .slice(0, 7)
        .reverse()
        .map((s, idx) => ({
          day: `S${idx + 1}`,
          accuracy: Math.round((s.accuracy ?? 0) * 100),
        }));
    }
    if (localGameLogs.length > 0) {
      return localGameLogs.slice(-7).map((log, i) => ({
        day: `Game ${i + 1}`,
        accuracy: Math.max(0, 100 - log.errors * 10),
      }));
    }
    return [];
  }, [cognitiveSessions, localGameLogs]);

  return (
    <div className="min-h-screen bg-flo-bg pb-32 sm:pb-28">
      {/* Top Banner */}
      <div className="bg-bubble-lavender pt-6 sm:pt-12 pb-6 sm:pb-8 px-4 sm:px-6 text-slate-900 rounded-b-[36px] shadow-soft border-b border-white/50">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/caregiver/settings"
              aria-label="Caregiver settings"
              className="flex items-center justify-center w-11 h-11 bg-white/80 rounded-full shadow-sm text-slate-700 hover:bg-white transition-colors"
            >
              <Settings size={22} />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {t.caregiverDashboard || 'Caregiver Dashboard'}
              </h1>
              <p className="text-slate-700 font-medium text-sm">
                {t.pairedPatients ? t.pairedPatients(patients.length) : `${patients.length} Paired Patients`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing || !patientId}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 font-black text-xs uppercase tracking-wider transition-all shadow-sm ${
              unsyncedCount > 0 ? 'bg-white border-rose-300 text-rose-700 hover:bg-rose-50' : 'bg-white border-mint-300 text-mint-800'
            }`}
          >
            {isSyncing ? <CloudSun className="animate-pulse" size={18} /> : <CloudOff size={18} />}
            <span>{unsyncedCount > 0 ? `${unsyncedCount} Pending Sync` : 'Sync All'}</span>
          </button>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-6 max-w-5xl mx-auto">
        {feedbackBanner && (
          <div className="bg-mint-50 border border-mint-300 text-mint-900 px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2">
            <CheckCircle2 size={18} /> {feedbackBanner}
          </div>
        )}

        <CaregiverPatientBar
          patientId={patientId}
          patients={patients}
          onSelectPatient={setActivePatientId}
          isLoading={isLoading}
        />

        {patientId && (
          <>
            {/* Today's Real Activity */}
            <FadeIn delay={0.04}>
              <div className="bg-white p-6 rounded-[28px] shadow-plush border-2 border-white space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-extrabold text-lg text-slate-900 tracking-tight">
                    {t.patientsToday || "Patient's Today"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold bg-indigo-50 text-indigo-800 px-3 py-1 rounded-full border border-indigo-200">
                      Mode: {prefs.complexityMode}
                    </span>
                    {latestCheckInSource && (
                      <span className="text-[11px] font-bold bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200">
                        Check-in: {latestCheckInSource.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-sky-50 rounded-2xl p-4 border border-sky-200">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div>
                        <span className="text-xs font-black text-sky-700 uppercase tracking-widest block mb-1">
                          {t.hydration || 'Hydration Goal Progress'}
                        </span>
                        <span className="text-2xl font-black text-slate-900">
                          {hydrationMl} <span className="text-sm font-bold text-slate-600">/ {prefs.hydrationTargetMl} ml</span>
                        </span>
                      </div>
                      <Droplets size={28} className="text-sky-600" />
                    </div>
                    <div className="w-full h-2.5 bg-sky-100 rounded-full overflow-hidden mt-3">
                      <div
                        className="h-full bg-sky-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.round((hydrationMl / Math.max(1, prefs.hydrationTargetMl)) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-mint-50 rounded-2xl p-4 border border-mint-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-mint-700 uppercase tracking-widest block mb-1">
                        {t.medsTaken || 'Meds Taken Today'}
                      </span>
                      <span className="text-2xl font-black text-slate-900">
                        {medsTakenCount} <span className="text-sm font-bold text-slate-600">/ {medications.length} active</span>
                      </span>
                    </div>
                    <Pill size={28} className="text-mint-700" />
                  </div>
                </div>

                {/* Medications Attribution & Pill Photo Feed */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                      Today&apos;s Care Medications &amp; Pill Photos
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Prescriptions managed by Doctor · Photo &amp; intake logged by Caregiver
                    </span>
                  </div>
                  {medications.length === 0 ? (
                    <p className="text-xs font-medium text-slate-500 bg-slate-50 rounded-xl p-3">
                      No active clinician prescriptions recorded yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {medications.map((med) => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const todayEv = (med.events || []).find((ev) => String(ev.scheduledTime).startsWith(todayStr));
                        const sourceLabel =
                          todayEv?.source === 'CAREGIVER_CONFIRMED'
                            ? 'Caregiver-confirmed'
                            : todayEv?.source === 'PATIENT_REPORTED'
                            ? 'Patient-reported'
                            : todayEv?.source === 'CLINICIAN_RECORDED'
                            ? 'Clinician-recorded'
                            : null;
                        return (
                          <div key={med.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              {med.imageUrl ? (
                                <img
                                  src={med.imageUrl}
                                  alt={`${med.name} pill`}
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-300 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                                  <Pill size={20} />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-extrabold text-sm text-slate-900 truncate">
                                  {med.name} <span className="font-bold text-slate-600">({med.dosage})</span>
                                </p>
                                <p className="text-xs font-semibold text-slate-500">
                                  {med.frequency} {med.time ? `· ${med.time}` : ''}
                                </p>
                                {todayEv ? (
                                  <span
                                    className={`inline-block mt-1.5 text-[10px] font-black px-2 py-0.5 rounded-full ${
                                      todayEv.source === 'CAREGIVER_CONFIRMED'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {todayEv.action} · {sourceLabel || 'Recorded'}
                                  </span>
                                ) : (
                                  <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                    Pending today
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-row sm:flex-col gap-2 sm:gap-1.5 w-full sm:w-auto flex-shrink-0">
                              <button
                                type="button"
                                disabled={confirmingMedId === med.id}
                                onClick={() => handleConfirmMedication(med)}
                                className="flex-1 sm:flex-none px-3 py-2 sm:px-2.5 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-[11px] font-black rounded-lg text-center"
                              >
                                {confirmingMedId === med.id ? '...' : 'Confirm Taken'}
                              </button>
                              <label className="flex-1 sm:flex-none px-3 py-2 sm:px-2.5 sm:py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs sm:text-[11px] font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1">
                                <Camera size={12} />
                                <span>{uploadingPhotoMedId === med.id ? '...' : med.imageUrl ? 'Update Photo' : 'Pill Photo'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleAttachMedPhoto(med.id, e)}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Bell size={15} className="text-indigo-600 flex-shrink-0" />
                  <span>
                    In-app alerts &amp; SOS dispatch require configured SMS/Push credentials; local testing displays exact delivery status honestly.
                  </span>
                </div>
              </div>
            </FadeIn>

            {/* Quick Portal Navigation Grid (Responsive Multi-Column) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Link href="/caregiver/routines" className="bg-white p-5 rounded-[28px] shadow-plush border-2 border-white hover:border-sky-200 transition-colors">
                <span className="text-2xl block mb-2">📅</span>
                <h3 className="font-extrabold text-lg text-slate-900">{t.dailyPlanner || 'Daily Planner'}</h3>
                <p className="text-sm text-slate-600 font-medium mt-1">Configure routines & daily schedule</p>
              </Link>

              <Link href="/caregiver/wellbeing" className="bg-white p-5 rounded-[28px] shadow-plush border-2 border-white hover:border-orange-200 transition-colors">
                <span className="text-2xl block mb-2">📊</span>
                <h3 className="font-extrabold text-lg text-slate-900">{t.symptomsWellbeing || 'Wellbeing & Symptoms'}</h3>
                <p className="text-sm text-slate-600 font-medium mt-1">Log observations & export reports</p>
              </Link>

              <Link href="/caregiver/circle" className="bg-white p-5 rounded-[28px] shadow-plush border-2 border-white hover:border-indigo-200 transition-colors">
                <span className="text-2xl block mb-2">🤝</span>
                <h3 className="font-extrabold text-lg text-slate-900">{t.careCircle || 'Care Circle'}</h3>
                <p className="text-sm text-slate-600 font-medium mt-1">Invite family members & post updates</p>
              </Link>

              <Link href="/caregiver/safety" className="bg-white p-5 rounded-[28px] shadow-plush border-2 border-white hover:border-mint-200 transition-colors">
                <span className="text-2xl block mb-2">🛡️</span>
                <h3 className="font-extrabold text-lg text-slate-900">{t.locationSafety || 'Location & Safety'}</h3>
                <p className="text-sm text-slate-600 font-medium mt-1">Safe zones & live geolocation alerts</p>
              </Link>

              <Link href="/caregiver/voice" className="bg-white p-5 rounded-[28px] shadow-plush border-2 border-white hover:border-rose-200 transition-colors">
                <span className="text-2xl block mb-2">🎙️</span>
                <h3 className="font-extrabold text-lg text-slate-900">{t.familyVoice || 'Family Voice Reminders'}</h3>
                <p className="text-sm text-slate-600 font-medium mt-1">Record warm personal voice prompts</p>
              </Link>

              <Link href="/caregiver/family" className="bg-white p-5 rounded-[28px] shadow-plush border-2 border-white hover:border-lavender-200 transition-colors">
                <span className="text-2xl block mb-2">👪</span>
                <h3 className="font-extrabold text-lg text-slate-900">{t.familyAssets || 'Family Assets'}</h3>
                <p className="text-sm text-slate-600 font-medium mt-1">Photos & voices for memory games</p>
              </Link>

              <Link href="/caregiver/resources" className="bg-white p-5 rounded-[28px] shadow-plush border-2 border-white hover:border-emerald-200 transition-colors">
                <span className="text-2xl block mb-2">🏥</span>
                <h3 className="font-extrabold text-lg text-slate-900">{t.localResources || 'Local Resources'}</h3>
                <p className="text-sm text-slate-600 font-medium mt-1">Find doctors, hospitals & helplines</p>
              </Link>

              <Link href="/caregiver/settings" className="bg-white p-5 rounded-[28px] shadow-plush border-2 border-white hover:border-slate-300 transition-colors">
                <span className="text-2xl block mb-2">⚙️</span>
                <h3 className="font-extrabold text-lg text-slate-900">Caregiver Settings</h3>
                <p className="text-sm text-slate-600 font-medium mt-1">Contacts, export JSON data & account</p>
              </Link>
            </div>

            {/* Care Circle Snapshot & Forms Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Care Circle Snapshot */}
              <div className="bg-white p-6 rounded-[28px] shadow-plush border-2 border-white">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2 text-sky-700">
                    <Users size={22} />
                    <h3 className="font-extrabold text-lg text-slate-900">Care Circle</h3>
                  </div>
                  <Link href="/caregiver/circle" className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full">
                    Manage
                  </Link>
                </div>

                {careCircle.length === 0 ? (
                  <p className="text-sm text-slate-600 font-medium py-3">No extra circle members added yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {careCircle.map((member) => (
                      <div key={member.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div>
                          <p className="text-sm font-extrabold text-slate-800">
                            {member.caregiver?.fullName || member.clinician?.fullName || 'Member'}
                          </p>
                          <p className="text-xs font-bold text-slate-600 uppercase">{member.role.replace(/_/g, ' ')}</p>
                        </div>
                        <span className="text-xs font-black px-2.5 py-1 bg-mint-100 text-mint-800 rounded-full uppercase">Active</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cognitive Engagement Chart */}
              <div className="bg-white p-6 rounded-[28px] shadow-plush border-2 border-white">
                <h3 className="font-extrabold text-lg text-slate-900 mb-4">{t.cognitiveTrends || 'Cognitive Activity Accuracy'}</h3>
                {cognitiveData.length === 0 ? (
                  <div className="h-[180px] flex items-center justify-center text-sm font-medium text-slate-600 bg-slate-50 rounded-2xl border border-slate-200">
                    No game sessions logged yet for this patient.
                  </div>
                ) : (
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cognitiveData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#475569' }} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tick={{ fill: '#475569' }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="accuracy" stroke="#6d28d9" strokeWidth={3} dot={{ r: 4, fill: '#6d28d9' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* 30-Day Observation & Vitals Form */}
              <div className="bg-white p-6 rounded-[28px] shadow-plush border-2 border-white">
                <div className="flex items-center gap-3 mb-3 text-sky-700">
                  <ClipboardList size={22} />
                  <h3 className="font-extrabold text-lg text-slate-900">{t.healthUpdate30Day || 'Health & Vitals Update'}</h3>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="Weight (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium" />
                    <input type="number" placeholder="Heart Rate (bpm)" value={hr} onChange={(e) => setHr(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium" />
                    <input type="number" placeholder="Systolic BP" value={sysBp} onChange={(e) => setSysBp(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium" />
                    <input type="number" placeholder="Diastolic BP" value={diaBp} onChange={(e) => setDiaBp(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={appetite} onChange={(e) => setAppetite(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800">
                      <option value="NORMAL">Appetite: Normal</option>
                      <option value="INCREASED">Appetite: Increased</option>
                      <option value="DECREASED">Appetite: Decreased</option>
                    </select>
                    <select value={sleep} onChange={(e) => setSleep(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800">
                      <option value="NORMAL">Sleep: Normal</option>
                      <option value="DISTURBED">Sleep: Disturbed</option>
                      <option value="EXCESSIVE">Sleep: Excessive</option>
                    </select>
                  </div>
                  <textarea
                    placeholder="Caregiver behavioral observations..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium h-20 resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitHealthUpdate}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3.5 rounded-2xl font-black uppercase text-sm tracking-wider transition-colors"
                  >
                    {t.saveHealthUpdate || 'Save Health Update'}
                  </button>
                </div>
              </div>

              {/* Memory Scrapbook Upload */}
              <div className="bg-white p-6 rounded-[28px] shadow-plush border-2 border-white">
                <div className="flex items-center gap-3 mb-3 text-indigo-700">
                  <Upload size={22} />
                  <h3 className="font-extrabold text-lg text-slate-900">Add to Memory Scrapbook</h3>
                </div>
                <p className="text-sm text-slate-600 font-medium mb-4">Share family photos for memory prompts.</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Photo Title (e.g., Bihu Gathering)"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium"
                  />
                  <input
                    type="text"
                    placeholder="Question or Story Prompt"
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium"
                  />
                  <label className="flex items-center justify-center w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-800 py-3.5 rounded-2xl cursor-pointer transition-colors font-bold text-sm border-2 border-indigo-200 border-dashed">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <span>+ Upload Photo to Scrapbook</span>
                  </label>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CaregiverPage() {
  const { role, status } = useActivePatient();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && role !== 'CAREGIVER') {
      router.push(role === 'CLINICIAN' ? '/doctor' : '/');
    }
  }, [status, role, router]);

  if (status === 'loading' || status === 'unauthenticated' || role !== 'CAREGIVER') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-bold text-slate-600 gap-4">
        <span className="animate-pulse">Loading Dashboard...</span>
        <Link href="/login" className="px-6 py-2.5 bg-white rounded-full shadow-sm border border-slate-200 text-slate-700 text-sm">
          Go to Login
        </Link>
      </div>
    );
  }

  return <Dashboard />;
}
