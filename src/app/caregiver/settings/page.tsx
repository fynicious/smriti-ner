'use client';

import { useState, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { db } from '@/lib/db';
import { clearOfflineEncryptionKey } from '@/lib/offline-crypto';
import { useActivePatient } from '@/hooks/useActivePatient';
import {
  usePatientPreferences,
  type ComplexityMode,
  type AiInteractionStyle,
} from '@/hooks/usePatientPreferences';
import { CaregiverPatientBar } from '@/components/caregiver/CaregiverPatientBar';
import { useI18n } from '@/contexts/I18nProvider';
import { NER_REGIONAL_PACKS } from '@/lib/regional-content';
import {
  User,
  Phone,
  Globe,
  Database,
  ChevronLeft,
  ShieldCheck,
  LogOut,
  Download,
  Trash2,
  CheckCircle2,
  Save,
  Sliders,
  KeyRound,
  QrCode,
  Copy,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

const CONSENT_SCOPES = [
  { id: 'LOCATION_SHARING', label: 'Location Sharing & Safe Zones' },
  { id: 'AI_COMPANION', label: 'Voice & AI Companion Processing' },
  { id: 'FAMILY_SHARING', label: 'Family Care Circle Updates & Media' },
  { id: 'CLINICIAN_ACCESS', label: 'Authorized Clinician Portal Sync' },
  { id: 'DATA_SYNC', label: 'Encrypted Cloud Sync & Backup' },
  { id: 'VOICE_RECORDING', label: 'Voice Reminders & Recordings' },
] as const;

interface ConsentStateItem {
  granted: boolean;
  authorityType: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { patientId, activePatient, patients, setActivePatientId, isLoading, refreshPatients } = useActivePatient();
  const { preferences, refreshPreferences } = usePatientPreferences(patientId);
  const { lang, setLang, scriptPreference, setScriptPreference, languages } = useI18n();

  const [caregiverName, setCaregiverName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmClearCache, setConfirmClearCache] = useState(false);

  // Patient Preferences controlled by Caregiver
  const [complexityMode, setComplexityMode] = useState<ComplexityMode>('GUIDED');
  const [culturalPackId, setCulturalPackId] = useState('ner-as-01');
  const [hydrationTargetMl, setHydrationTargetMl] = useState(2000);
  const [textScale, setTextScale] = useState(1.0);
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceRate, setVoiceRate] = useState(0.85);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiInteractionStyle, setAiInteractionStyle] = useState<AiInteractionStyle>('BALANCED');
  const [caregiverLockEnabled, setCaregiverLockEnabled] = useState(false);
  const [caregiverLockPin, setCaregiverLockPin] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Patient Onboarding / PIN / QR Reset
  const [newPatientPin, setNewPatientPin] = useState('');
  const [qrResult, setQrResult] = useState<{ loginCode: string; qrUrlPath: string } | null>(null);
  const [copiedQr, setCopiedQr] = useState(false);

  // Consents
  const [consents, setConsents] = useState<Record<string, ConsentStateItem>>({});

  // Deletion
  const [deleteTarget, setDeleteTarget] = useState<'PATIENT' | 'SELF' | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const cp = data.user?.caregiverProfile;
        if (cp) {
          setCaregiverName(cp.fullName || '');
          setPhoneNumber(cp.phoneNumber || '');
        }
      }
    } catch {
      // Offline non-fatal
    }
  }, []);

  const loadConsents = useCallback(async () => {
    if (!patientId) {
      setConsents({});
      return;
    }
    try {
      const res = await fetch(`/api/patients/${patientId}/consents`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setConsents(data.latestByScope || {});
      }
    } catch {
      // Offline non-fatal
    }
  }, [patientId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadConsents();
  }, [loadConsents]);

  useEffect(() => {
    const active = patients.find((p) => p.id === patientId);
    setEmergencyContact(active?.emergencyContact || '');
  }, [patientId, patients]);

  useEffect(() => {
    setComplexityMode(preferences.complexityMode);
    setCulturalPackId(preferences.culturalPackId);
    setHydrationTargetMl(preferences.hydrationTargetMl);
    setTextScale(preferences.textScale);
    setHighContrast(preferences.highContrast);
    setReducedMotion(preferences.reducedMotion);
    setVoiceEnabled(preferences.voiceEnabled);
    setVoiceRate(preferences.voiceRate);
    setAiEnabled(preferences.aiEnabled);
    setAiInteractionStyle(preferences.aiInteractionStyle);
    setCaregiverLockEnabled(preferences.caregiverLockEnabled);
    if (preferences.scriptPreference === 'meetei_mayek' || preferences.scriptPreference === 'mymk') {
      setScriptPreference('meetei_mayek');
    } else if (preferences.scriptPreference === 'bengali' || preferences.scriptPreference === 'beng') {
      setScriptPreference('bengali');
    }
  }, [preferences, setScriptPreference]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback((cur) => (cur === msg ? null : cur)), 4500);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: caregiverName,
        phoneNumber,
        patientId: patientId || undefined,
        emergencyContact: patientId ? emergencyContact : undefined,
        preferredLanguage: patientId ? lang : undefined,
      }),
    });
    if (res.ok) {
      await refreshPatients();
      showToast('Caregiver & emergency settings saved.');
    }
  };

  const handleSavePatientExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    setSavingPrefs(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complexityMode,
          scriptPreference: lang.startsWith('mni') ? scriptPreference : null,
          culturalPackId,
          hydrationTargetMl,
          textScale,
          highContrast,
          reducedMotion,
          voiceEnabled,
          voiceRate,
          aiEnabled,
          aiInteractionStyle,
          caregiverLockEnabled,
          caregiverLockPin: caregiverLockPin.trim() || undefined,
          preferredLanguage: lang,
        }),
      });
      if (res.ok) {
        setCaregiverLockPin('');
        await refreshPreferences();
        showToast('Patient experience, accessibility & AI settings saved.');
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Could not update patient settings.');
      }
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleResetPinOrQr = async () => {
    if (!patientId) return;
    if (newPatientPin.trim() && !/^\d{4,6}$/.test(newPatientPin.trim())) {
      showToast('New Patient PIN must be 4 to 6 numeric digits.');
      return;
    }
    const res = await fetch(`/api/caregiver/patients/${patientId}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newPin: newPatientPin.trim() || undefined,
        generateQr: true,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setNewPatientPin('');
      setQrResult({
        loginCode: d.loginCode || activePatient?.loginCode || '',
        qrUrlPath: d.onboarding?.qrUrlPath || '',
      });
      await refreshPatients();
      showToast('Generated new single-use 24h device pairing link.');
    } else {
      showToast(d.error || 'Could not update onboarding credentials.');
    }
  };

  const handleToggleConsent = async (scope: string, nextGranted: boolean) => {
    if (!patientId) return;
    const res = await fetch(`/api/patients/${patientId}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope,
        granted: nextGranted,
        authorityType: 'CAREGIVER_REPRESENTATIVE',
        notes: nextGranted ? 'Enabled via Caregiver Settings' : 'Withdrawn via Caregiver Settings',
      }),
    });
    if (res.ok) {
      await loadConsents();
      showToast(`${scope.replace(/_/g, ' ')} ${nextGranted ? 'enabled' : 'withdrawn'}.`);
    }
  };

  const handleExportPatientJson = async () => {
    if (!patientId) return;
    const [timelineRes, vitalsRes, wbRes, medsRes] = await Promise.all([
      fetch(`/api/patients/${patientId}/timeline`),
      fetch(`/api/patients/${patientId}/vitals`),
      fetch(`/api/patients/${patientId}/wellbeing`),
      fetch(`/api/patients/${patientId}/medications`),
    ]);

    const bundle = {
      exportedAt: new Date().toISOString(),
      patientId,
      timeline: timelineRes.ok ? await timelineRes.json() : null,
      vitals: vitalsRes.ok ? await vitalsRes.json() : null,
      wellbeing: wbRes.ok ? await wbRes.json() : null,
      medications: medsRes.ok ? await medsRes.json() : null,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smriti-patient-export-${patientId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported patient record bundle (JSON).');
  };

  const handleClearLocalCache = async () => {
    clearOfflineEncryptionKey();
    await Promise.all(db.tables.map((table) => table.clear()));
    setConfirmClearCache(false);
    showToast('Encrypted session key and offline IndexedDB cache cleared on this browser.');
  };

  const handlePermanentDelete = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: 'DELETE',
          patientId: deleteTarget === 'PATIENT' ? patientId : undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(d.error || 'Deletion failed.');
        return;
      }

      clearOfflineEncryptionKey();
      await Promise.all(db.tables.map((t) => t.clear()));

      if (deleteTarget === 'SELF') {
        await signOut({ callbackUrl: '/login' });
        return;
      }

      setDeleteTarget(null);
      setDeleteConfirmText('');
      await refreshPatients();
      showToast('Patient account & encrypted media permanently removed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-flo-bg pb-32 sm:pb-28">
      <div className="bg-bubble-lavender pt-6 sm:pt-12 pb-6 sm:pb-8 px-4 sm:px-6 text-slate-900 rounded-b-[36px] shadow-soft mb-5 sm:mb-6 border-b border-white/50">
        <div className="max-w-3xl mx-auto flex items-center gap-3 sm:gap-4">
          <Link href="/caregiver" aria-label="Back to Caregiver Dashboard" className="w-10 h-10 bg-white/70 rounded-full flex items-center justify-center text-slate-700 hover:bg-white transition-colors shrink-0">
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Settings &amp; Governance</h1>
            <p className="text-slate-700 font-medium text-xs sm:text-sm mt-0.5">Manage patient experience modes, PIN/QR, consents &amp; offline data</p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 space-y-5 sm:space-y-6 max-w-3xl mx-auto">
        {feedback && (
          <div className="bg-mint-50 border border-mint-300 text-mint-900 px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2">
            <CheckCircle2 size={18} /> {feedback}
          </div>
        )}

        <CaregiverPatientBar patientId={patientId} patients={patients} onSelectPatient={setActivePatientId} isLoading={isLoading} />

        {/* Patient Complexity, Accessibility, NER Pack & AI Controls */}
        {patientId && (
          <form onSubmit={handleSavePatientExperience} className="bg-white rounded-[28px] p-4 sm:p-6 shadow-plush border-2 border-white space-y-5">
            <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <Sliders size={20} className="text-indigo-600" /> Patient Mode, Accessibility &amp; NER Regional Pack
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Interface Complexity Mode</label>
                <select
                  value={complexityMode}
                  onChange={(e) => setComplexityMode(e.target.value as ComplexityMode)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white"
                >
                  <option value="SIMPLE">Simple (Single 1-Tap Now Card &amp; SOS)</option>
                  <option value="GUIDED">Guided (Routine Cards, Water &amp; Check-in)</option>
                  <option value="FULL">Full (Games, Scrapbook, Voice AI, Planner)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">NER State Cultural Pack</label>
                <select
                  value={culturalPackId}
                  onChange={(e) => setCulturalPackId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white"
                >
                  {NER_REGIONAL_PACKS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.state} — {p.regionName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Daily Hydration Goal (ml)</label>
                <input
                  type="number"
                  min={500}
                  max={5000}
                  step={100}
                  value={hydrationTargetMl}
                  onChange={(e) => setHydrationTargetMl(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Text Size Scale ({textScale}x)</label>
                <select
                  value={String(textScale)}
                  onChange={(e) => setTextScale(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white"
                >
                  <option value="1">1.0x (Standard Large)</option>
                  <option value="1.15">1.15x (Larger)</option>
                  <option value="1.3">1.30x (Extra Large)</option>
                  <option value="1.45">1.45x (Maximum)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Voice Pace ({voiceRate}x)</label>
                <select
                  value={String(voiceRate)}
                  onChange={(e) => setVoiceRate(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white"
                >
                  <option value="0.7">0.70x (Very Gentle &amp; Slow)</option>
                  <option value="0.85">0.85x (Calm Standard)</option>
                  <option value="1">1.00x (Normal)</option>
                </select>
              </div>
            </div>

            {(lang.startsWith('mni') || culturalPackId === 'ner-mn-01') && (
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Manipuri Script Preference</label>
                <select
                  value={scriptPreference || 'bengali'}
                  onChange={(e) => setScriptPreference(e.target.value as 'bengali' | 'meetei_mayek')}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white"
                >
                  <option value="bengali">Bengali Script (বাংলা)</option>
                  <option value="meetei_mayek">Meetei Mayek (ꯃꯩꯇꯩ ꯃꯌꯦꯛ)</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">AI Companion Interaction Style</label>
                <select
                  value={aiInteractionStyle}
                  onChange={(e) => setAiInteractionStyle(e.target.value as AiInteractionStyle)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white"
                >
                  <option value="BALANCED">Balanced (Warm conversation + action execution)</option>
                  <option value="TASK_FOCUSED">Task-Focused (Concise 1-sentence guidance)</option>
                  <option value="CONVERSATIONAL">Conversational (Warm unhurried chat)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Caregiver Mode Lock PIN (optional reset)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={preferences.hasCaregiverLockPin ? '•••• (leave blank to keep)' : 'Set 4-6 digit lock PIN'}
                  value={caregiverLockPin}
                  onChange={(e) => setCaregiverLockPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold tracking-widest text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} className="rounded" />
                High Contrast
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} className="rounded" />
                Reduced Motion
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} className="rounded" />
                Voice Companion
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} className="rounded" />
                AI Assistance
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer col-span-2">
                <input type="checkbox" checked={caregiverLockEnabled} onChange={(e) => setCaregiverLockEnabled(e.target.checked)} className="rounded" />
                Require Caregiver PIN to change patient mode from Home screen
              </label>
            </div>

            <button
              type="submit"
              disabled={savingPrefs}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2"
            >
              <Save size={18} /> {savingPrefs ? 'Saving...' : 'Save Patient Experience & Mode'}
            </button>
          </form>
        )}

        {/* Patient Onboarding: PIN Reset & Single-Use QR Link */}
        {patientId && (
          <div className="bg-white rounded-[28px] p-4 sm:p-6 shadow-plush border-2 border-white space-y-4">
            <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <QrCode size={20} className="text-emerald-600" /> Elder PIN &amp; Device Pairing Link
            </h2>
            <p className="text-sm text-slate-600 font-medium">
              Login Code: <strong className="font-mono text-indigo-700">{activePatient?.loginCode || 'Generated on reset'}</strong> · Generate a fresh 24-hour single-use QR setup link or update your loved one&apos;s numeric PIN.
            </p>
            <div className="flex flex-wrap gap-3">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Optional new 4–6 digit PIN"
                value={newPatientPin}
                onChange={(e) => setNewPatientPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full sm:w-auto sm:flex-1 sm:min-w-[200px] px-4 py-2.5 rounded-xl border border-slate-300 font-bold tracking-widest"
              />
              <button
                type="button"
                onClick={handleResetPinOrQr}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2"
              >
                <KeyRound size={16} /> Generate QR Pairing Link {newPatientPin ? '& Update PIN' : ''}
              </button>
            </div>
            {qrResult?.qrUrlPath && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-emerald-900">Single-Use Device Link (24h)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const full = typeof window !== 'undefined' ? `${window.location.origin}${qrResult.qrUrlPath}` : qrResult.qrUrlPath;
                      navigator.clipboard?.writeText(full);
                      setCopiedQr(true);
                      setTimeout(() => setCopiedQr(false), 2000);
                    }}
                    className="px-3 py-1 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-1"
                  >
                    <Copy size={13} /> {copiedQr ? 'Copied' : 'Copy Link'}
                  </button>
                </div>
                <p className="text-xs font-mono break-all text-emerald-900">{qrResult.qrUrlPath}</p>
              </div>
            )}
          </div>
        )}

        {/* Consent Management */}
        {patientId && (
          <div className="bg-white rounded-[28px] p-6 shadow-plush border-2 border-white space-y-4">
            <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <FileCheck2 size={20} className="text-sky-600" /> Representative Consents &amp; Data Scopes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONSENT_SCOPES.map((c) => {
                const state = consents[c.id];
                const isGranted = state ? state.granted : true;
                return (
                  <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-slate-900">{c.label}</p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {state ? `${state.authorityType.replace(/_/g, ' ')} · ${new Date(state.createdAt).toLocaleDateString()}` : 'Default enabled (tap to record explicit withdrawal)'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleConsent(c.id, !isGranted)}
                      className={`px-3 py-1.5 rounded-full text-xs font-black ${
                        isGranted ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isGranted ? 'Granted' : 'Withdrawn'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="bg-white rounded-[28px] p-6 shadow-plush border-2 border-white space-y-4">
          <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <User size={20} className="text-lavender-700" /> Caregiver Profile &amp; Emergency Contact
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Caregiver Full Name</label>
              <input
                type="text"
                required
                value={caregiverName}
                onChange={(e) => setCaregiverName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Caregiver Phone</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
              />
            </div>
          </div>

          {patientId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                  <Phone size={13} /> Patient Emergency Phone
                </label>
                <input
                  type="tel"
                  placeholder="+91 ..."
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                  <Globe size={13} /> Interface Language
                </label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800 bg-white"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName} ({l.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button type="submit" className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl flex items-center justify-center gap-2">
            <Save size={18} /> Save Caregiver Contact
          </button>
        </form>

        {/* Data & Security */}
        <div className="bg-white rounded-[28px] p-6 shadow-plush border-2 border-white space-y-4">
          <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <ShieldCheck size={20} className="text-emerald-600" /> Access, Export &amp; Account Deletion
          </h2>
          <p className="text-sm text-slate-600 font-medium">
            Server sensitive fields use authenticated AES-256-GCM envelope encryption, media binaries are stored privately via authenticated RBAC routes, and local browser session caches use ephemeral WebCrypto keys. Regulatory HIPAA/DISHA compliance requires formal production KMS and infrastructure auditing.
          </p>

          <div className="flex flex-wrap gap-3">
            {patientId && (
              <button
                type="button"
                onClick={handleExportPatientJson}
                className="px-5 py-3 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-sm rounded-2xl flex items-center gap-2"
              >
                <Download size={18} /> Export Patient Records (JSON)
              </button>
            )}

            {!confirmClearCache ? (
              <button
                type="button"
                onClick={() => setConfirmClearCache(true)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl flex items-center gap-2"
              >
                <Database size={18} /> Clear Local Browser Cache
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 px-4 py-2 rounded-2xl border border-rose-200">
                <span className="text-xs font-bold text-rose-800">Clear offline cache?</span>
                <button
                  type="button"
                  onClick={handleClearLocalCache}
                  className="px-3 py-1 bg-rose-600 text-white text-xs font-black rounded-lg flex items-center gap-1"
                >
                  <Trash2 size={14} /> Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearCache(false)}
                  className="px-3 py-1 bg-white text-slate-700 text-xs font-bold rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap gap-3">
              {patientId && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget('PATIENT');
                    setDeleteConfirmText('');
                  }}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <AlertTriangle size={15} /> Permanently Delete Active Patient Data
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget('SELF');
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <Trash2 size={15} /> Delete My Caregiver Account
              </button>
            </div>

            {deleteTarget && (
              <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl space-y-3">
                <p className="text-xs font-black text-rose-900">
                  {deleteTarget === 'PATIENT'
                    ? `Permanent removal of ${activePatient?.fullName || 'patient'} account, encrypted media, and clinical history.`
                    : 'Permanent removal of your Caregiver account and credentials.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Type DELETE to confirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full sm:w-auto sm:flex-1 sm:min-w-[180px] px-3.5 py-2 bg-white border border-rose-300 rounded-xl text-xs font-black"
                  />
                  <button
                    type="button"
                    disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deleting}
                    onClick={handlePermanentDelete}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-black rounded-xl"
                  >
                    {deleting ? 'Deleting...' : 'Confirm Permanent Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="px-3 py-2 bg-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sign Out */}
        <button
          type="button"
          onClick={() => {
            clearOfflineEncryptionKey();
            signOut({ callbackUrl: '/login' });
          }}
          className="w-full bg-white rounded-[28px] p-4 shadow-plush border-2 border-rose-100 flex items-center justify-center gap-3 text-rose-600 hover:bg-rose-50 transition-colors font-black uppercase tracking-wider"
        >
          <LogOut size={20} /> Sign Out
        </button>
      </div>
    </div>
  );
}
