'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FadeIn } from '@/components/ui';
import { useI18n } from '@/contexts/I18nProvider';
import { useActivePatient } from '@/hooks/useActivePatient';
import { signOut } from 'next-auth/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import {
  AlertTriangle,
  Stethoscope,
  BrainCircuit,
  Activity,
  Droplets,
  Pill,
  UserRound,
  ClipboardList,
  Download,
  Printer,
  UserPlus,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DoctorTimelineEvent {
  id: string;
  type: string;
  date: string;
  title: string;
  description: string;
}

interface ServerVitalLog {
  id: string;
  recordedAt: string;
  weight?: number | null;
  sysBp?: number | null;
  diaBp?: number | null;
  heartRate?: number | null;
}

interface ServerCaregiverReport {
  id: string;
  reportType: string;
  appetite?: string | null;
  sleep?: string | null;
  notes?: string | null;
  createdAt: string;
  caregiver?: { fullName?: string | null } | null;
}

interface ServerMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  time?: string | null;
  instructions?: string | null;
  status: string;
  imageUrl?: string | null;
  createdAt: string;
  clinician?: { fullName?: string | null } | null;
}

interface ServerCognitiveSession {
  id: string;
  gameId: string;
  domain: string;
  score: number;
  accuracy: number;
  errors: number;
  completedAt: string;
}

interface DoctorIndicatorResponse {
  riskScore: number | null;
  riskLevel: string;
  explanations: string[];
  disclaimer?: string;
}

type DoctorTab = 'overview' | 'vitals' | 'rx' | 'timeline' | 'cognitive';

function Dashboard() {
  const { t } = useI18n();
  const { patientId, activePatient, patients, setActivePatientId, refreshPatients, isLoading, user } =
    useActivePatient();

  const [activeTab, setActiveTab] = useState<DoctorTab>('overview');
  const [timeline, setTimeline] = useState<DoctorTimelineEvent[]>([]);
  const [vitals, setVitals] = useState<ServerVitalLog[]>([]);
  const [caregiverReports, setCaregiverReports] = useState<ServerCaregiverReport[]>([]);
  const [medications, setMedications] = useState<ServerMedication[]>([]);
  const [cognitiveSessions, setCognitiveSessions] = useState<ServerCognitiveSession[]>([]);
  const [indicator, setIndicator] = useState<DoctorIndicatorResponse>({
    riskScore: null,
    riskLevel: 'Insufficient Data',
    explanations: [],
  });
  const [isPredicting, setIsPredicting] = useState(false);

  // Patient assignment state
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignEmail, setAssignEmail] = useState('');
  const [assignCode, setAssignCode] = useState('');
  const [assignFeedback, setAssignFeedback] = useState<string | null>(null);

  // Rx form state
  const [showAddRx, setShowAddRx] = useState(false);
  const [rxName, setRxName] = useState('');
  const [rxDosage, setRxDosage] = useState('');
  const [rxFreq, setRxFreq] = useState('Once daily');
  const [rxTime, setRxTime] = useState('09:00');
  const [rxInstructions, setRxInstructions] = useState('');

  const loadClinicalRecord = useCallback(async () => {
    if (!patientId) {
      setTimeline([]);
      setVitals([]);
      setCaregiverReports([]);
      setMedications([]);
      setCognitiveSessions([]);
      setIndicator({ riskScore: null, riskLevel: 'Insufficient Data', explanations: [] });
      return;
    }

    setIsPredicting(true);
    try {
      const [tlRes, vitRes, medRes, cogRes, predRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/timeline`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/vitals`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/medications?includeDiscontinued=true`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/cognitive?limit=30`, { cache: 'no-store' }),
        fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId }),
        }),
      ]);

      if (tlRes.ok) {
        const d = await tlRes.json();
        setTimeline(Array.isArray(d.timeline) ? d.timeline : []);
      }
      if (vitRes.ok) {
        const d = await vitRes.json();
        setVitals(Array.isArray(d.vitals) ? d.vitals : []);
        setCaregiverReports(Array.isArray(d.reports) ? d.reports : []);
      }
      if (medRes.ok) {
        const d = await medRes.json();
        setMedications(Array.isArray(d.medications) ? d.medications : []);
      }
      if (cogRes.ok) {
        const d = await cogRes.json();
        setCognitiveSessions(Array.isArray(d.history) ? d.history : []);
      }
      if (predRes.ok) {
        const d = await predRes.json();
        setIndicator(d);
      }
    } catch (err) {
      console.error('[ClinicalPortal] Failed to fetch patient records', err);
    } finally {
      setIsPredicting(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadClinicalRecord();
  }, [loadClinicalRecord]);

  const handleAssignPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignFeedback(null);
    const res = await fetch('/api/clinician/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientEmail: assignEmail.trim(),
        pairingCode: assignCode.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAssignFeedback(data.error || 'Could not assign patient');
      return;
    }
    setAssignEmail('');
    setAssignCode('');
    setShowAssignForm(false);
    await refreshPatients();
    if (data.patient?.id) setActivePatientId(data.patient.id);
    setAssignFeedback('Patient assigned cleanly.');
  };

  const handleAddPrescription = async () => {
    if (!patientId || !rxName.trim() || !rxDosage.trim()) return;
    const res = await fetch(`/api/patients/${patientId}/medications/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: rxName.trim(),
        dosage: rxDosage.trim(),
        frequency: rxFreq.trim() || 'Once daily',
        time: rxTime || undefined,
        instructions: rxInstructions.trim() || undefined,
      }),
    });
    if (res.ok) {
      setRxName('');
      setRxDosage('');
      setRxInstructions('');
      setShowAddRx(false);
      await loadClinicalRecord();
    }
  };

  const togglePrescriptionStatus = async (medId: string, currentStatus: string) => {
    if (!patientId) return;
    const nextStatus = currentStatus === 'ACTIVE' ? 'DISCONTINUED' : 'ACTIVE';
    const res = await fetch(`/api/patients/${patientId}/medications/manage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicationId: medId, status: nextStatus }),
    });
    if (res.ok) {
      await loadClinicalRecord();
    }
  };

  const handleExportCsv = () => {
    if (!activePatient) return;
    const rows = [
      ['Type', 'Date', 'Title', 'Description'],
      ...timeline.map((e) => [
        e.type,
        new Date(e.date).toISOString(),
        `"${e.title.replace(/"/g, '""')}"`,
        `"${e.description.replace(/"/g, '""')}"`,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smriti-clinical-timeline-${activePatient.fullName.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const orderedVitals = useMemo(() => [...vitals].reverse(), [vitals]);
  const weightTrend = useMemo(
    () => orderedVitals.filter((v) => v.weight !== null && v.weight !== undefined).map((v) => ({ date: new Date(v.recordedAt).toLocaleDateString(), weight: v.weight })),
    [orderedVitals]
  );
  const bpTrend = useMemo(
    () =>
      orderedVitals
        .filter((v) => v.sysBp !== null && v.diaBp !== null)
        .map((v) => ({ date: new Date(v.recordedAt).toLocaleDateString(), sys: v.sysBp, dia: v.diaBp })),
    [orderedVitals]
  );
  const cognitiveTrend = useMemo(
    () =>
      [...cognitiveSessions]
        .slice(0, 12)
        .reverse()
        .map((c) => ({
          label: `${c.gameId.slice(0, 8)}`,
          accuracy: Math.round((c.accuracy || 0) * 100),
          domain: c.domain,
        })),
    [cognitiveSessions]
  );

  const latestVital = vitals[0] || null;

  return (
    <div className="min-h-screen pb-32 sm:pb-28 bg-flo-bg font-sans">
      <FadeIn>
        <div className="bg-bubble-mint px-4 sm:px-6 pt-6 sm:pt-10 pb-5 sm:pb-6 rounded-b-[36px] shadow-soft mb-5 sm:mb-6 border-b border-white/50">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3 text-slate-900">
                <Stethoscope size={30} />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {t.clinicalDashboard || 'Clinical Portal'}
                  </h1>
                  <p className="text-slate-700 font-medium text-sm">
                    Signed in as {user?.name || 'Clinician'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => setShowAssignForm((p) => !p)}
                  className="px-4 py-2 bg-white text-slate-800 font-bold text-xs rounded-full shadow-sm border border-slate-200 flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <UserPlus size={15} /> Assign Patient
                </button>
                {patientId && (
                  <>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="px-4 py-2 bg-white text-slate-800 font-bold text-xs rounded-full shadow-sm border border-slate-200 flex items-center gap-1.5 hover:bg-slate-50"
                    >
                      <Download size={15} /> Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-white text-slate-800 font-bold text-xs rounded-full shadow-sm border border-slate-200 flex items-center gap-1.5 hover:bg-slate-50"
                    >
                      <Printer size={15} /> Print Report
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="px-4 py-2 bg-rose-50 text-rose-700 font-bold text-xs rounded-full border border-rose-200 flex items-center gap-1.5 hover:bg-rose-100"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>

            {/* Patient Assignment Card */}
            {showAssignForm && (
              <form onSubmit={handleAssignPatient} className="mb-4 bg-white p-5 rounded-3xl shadow-md border border-slate-200 space-y-3 print:hidden">
                <h2 className="font-black text-slate-900 text-base">Link Authorized Patient</h2>
                <p className="text-xs text-slate-600 font-medium">
                  Enter the patient&apos;s registered email OR Elder Login Code (<code className="font-mono">SMR-XXXXXX</code>) and an active 6-digit pairing code generated by their primary caregiver.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="patient@example.com or SMR-XXXXXX"
                    value={assignEmail}
                    onChange={(e) => setAssignEmail(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="6-digit code"
                    value={assignCode}
                    onChange={(e) => setAssignCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-black tracking-widest"
                  />
                  <button type="submit" className="px-5 py-2.5 bg-slate-900 text-white font-black text-sm rounded-xl hover:bg-slate-800">
                    Link Patient
                  </button>
                </div>
              </form>
            )}

            {assignFeedback && (
              <div className="mb-4 bg-white border border-slate-200 text-slate-800 px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-mint-700" /> {assignFeedback}
              </div>
            )}

            {/* Patient Switcher Banner */}
            {!isLoading && patients.length === 0 ? (
              <div className="bg-white/90 p-5 rounded-3xl border border-slate-200 text-slate-800">
                <h2 className="font-black text-base mb-1">No Assigned Patients Yet</h2>
                <p className="text-sm text-slate-600 font-medium">
                  Use <strong>Assign Patient</strong> above with a caregiver-issued pairing code to authorize clinical access.
                </p>
              </div>
            ) : (
              activePatient && (
                <div className="bg-white/85 p-4 rounded-3xl backdrop-blur-md border border-white flex flex-col gap-3 shadow-sm">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                      <select
                        aria-label="Select assigned patient"
                        value={patientId || ''}
                        onChange={(e) => setActivePatientId(e.target.value)}
                        className="text-lg font-black text-slate-900 bg-transparent border-b-2 border-slate-300 pb-0.5 focus:outline-none focus:border-slate-800"
                      >
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.fullName} {p.loginCode ? `(${p.loginCode})` : ''}
                          </option>
                        ))}
                      </select>
                      {activePatient.loginCode && (
                        <span className="text-[11px] font-black bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-1 rounded-full">
                          Code: {activePatient.loginCode}
                        </span>
                      )}
                    </div>
                    <div className="bg-amber-50 text-amber-900 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-amber-200 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> Indicator: {indicator.riskLevel}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-xs font-semibold text-slate-700">
                    <p>Blood Group: {activePatient.bloodGroup || 'Not logged'}</p>
                    <p>Allergies: {activePatient.allergies || 'None listed'}</p>
                    <p>Emergency: {activePatient.emergencyContact || 'Not logged'}</p>
                    <p>Language: {activePatient.preferredLanguage || 'en'}</p>
                  </div>
                </div>
              )
            )}

            {/* Navigation Tabs */}
            {patientId && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-4 sm:mt-5 print:hidden">
                {[
                  { id: 'overview' as const, icon: UserRound, label: 'Overview' },
                  { id: 'vitals' as const, icon: Activity, label: 'Vitals & Trends' },
                  { id: 'rx' as const, icon: Pill, label: t.prescriptions || 'Prescriptions' },
                  { id: 'timeline' as const, icon: ClipboardList, label: 'Timeline' },
                  { id: 'cognitive' as const, icon: BrainCircuit, label: 'Engagement Analytics' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
                      activeTab === tab.id ? 'bg-slate-900 text-white shadow-md' : 'bg-white/80 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <tab.icon size={16} /> {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      {patientId && (
        <div className="px-4 sm:px-5 space-y-5 sm:space-y-6 max-w-5xl mx-auto">
          {/* Non-diagnostic Clinical Safety Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-950 font-medium">
            <AlertTriangle size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Supportive Care Summary Only:</strong> Smriti tracks daily routines, caregiver observations, and cognitive game engagement. Rule-based indicators do not diagnose, stage, or treat dementia or any medical condition.
            </p>
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <FadeIn>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 text-center">
                  <p className="text-xs font-bold text-slate-600 uppercase mb-1">Latest Weight</p>
                  <p className="text-2xl font-black text-slate-900">
                    {latestVital?.weight ?? '--'} <span className="text-sm font-medium text-slate-600">kg</span>
                  </p>
                </div>
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 text-center">
                  <p className="text-xs font-bold text-slate-600 uppercase mb-1">Blood Pressure</p>
                  <p className="text-2xl font-black text-slate-900">
                    {latestVital?.sysBp ?? '--'}/{latestVital?.diaBp ?? '--'}
                  </p>
                </div>
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 text-center">
                  <p className="text-xs font-bold text-slate-600 uppercase mb-1">Heart Rate</p>
                  <p className="text-2xl font-black text-slate-900">
                    {latestVital?.heartRate ?? '--'} <span className="text-sm font-medium text-slate-600">bpm</span>
                  </p>
                </div>
                <div className="bg-amber-50 rounded-3xl p-5 shadow-sm border border-amber-200 text-center">
                  <p className="text-xs font-bold text-amber-800 uppercase mb-1">Rule Indicator</p>
                  <p className="text-2xl font-black text-amber-950">
                    {indicator.riskScore !== null ? `${indicator.riskScore}/100` : '--'}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-200">
                <h2 className="text-lg font-extrabold text-slate-900 mb-4">Recent Caregiver Observations</h2>
                {caregiverReports.length === 0 ? (
                  <p className="text-sm text-slate-600 font-medium">No caregiver observations recorded yet for this patient.</p>
                ) : (
                  <div className="space-y-3">
                    {caregiverReports.slice(0, 6).map((rep) => (
                      <div key={rep.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1">
                          <span>{rep.caregiver?.fullName || 'Caregiver'} • {rep.reportType}</span>
                          <span>{new Date(rep.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800">
                          {rep.appetite ? `Appetite: ${rep.appetite} • ` : ''}
                          {rep.sleep ? `Sleep: ${rep.sleep} • ` : ''}
                          {rep.notes || 'Routine check logged.'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FadeIn>
          )}

          {/* VITALS TAB */}
          {activeTab === 'vitals' && (
            <FadeIn>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-200">
                  <h2 className="text-lg font-extrabold text-slate-900 mb-1">Weight Trend</h2>
                  <p className="text-xs font-medium text-slate-600 mb-4">Logged vital measurements</p>
                  {weightTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={weightTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" fontSize={11} stroke="#475569" />
                        <YAxis fontSize={11} stroke="#475569" domain={['auto', 'auto']} />
                        <Tooltip />
                        <Area type="monotone" dataKey="weight" stroke="#0284c7" strokeWidth={3} fill="#bae6fd" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-sm font-bold text-slate-600 bg-slate-50 rounded-2xl">
                      No weight records yet
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-200">
                  <h2 className="text-lg font-extrabold text-slate-900 mb-1">Blood Pressure Trend</h2>
                  <p className="text-xs font-medium text-slate-600 mb-4">Systolic & Diastolic (mmHg)</p>
                  {bpTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={bpTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" fontSize={11} stroke="#475569" />
                        <YAxis fontSize={11} stroke="#475569" domain={[50, 190]} />
                        <Tooltip />
                        <Line type="monotone" name="Systolic" dataKey="sys" stroke="#dc2626" strokeWidth={3} />
                        <Line type="monotone" name="Diastolic" dataKey="dia" stroke="#2563eb" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-sm font-bold text-slate-600 bg-slate-50 rounded-2xl">
                      No BP records yet
                    </div>
                  )}
                </div>
              </div>
            </FadeIn>
          )}

          {/* RX TAB */}
          {activeTab === 'rx' && (
            <FadeIn>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-slate-900">Prescriptions & Schedule</h2>
                <button
                  type="button"
                  onClick={() => setShowAddRx(!showAddRx)}
                  className="text-xs font-black uppercase tracking-wider bg-sky-600 text-white px-4 py-2 rounded-full hover:bg-sky-700"
                >
                  {showAddRx ? 'Cancel' : '+ New Prescription'}
                </button>
              </div>

              {showAddRx && (
                <div className="bg-sky-50 border-2 border-sky-200 p-5 rounded-3xl mb-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-900 block mb-1">Medication Name</label>
                      <input type="text" value={rxName} onChange={(e) => setRxName(e.target.value)} placeholder="e.g., Donepezil" className="w-full bg-white border border-sky-200 rounded-xl px-4 py-2.5 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-900 block mb-1">Dosage</label>
                      <input type="text" value={rxDosage} onChange={(e) => setRxDosage(e.target.value)} placeholder="e.g., 5mg" className="w-full bg-white border border-sky-200 rounded-xl px-4 py-2.5 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-900 block mb-1">Frequency</label>
                      <input type="text" value={rxFreq} onChange={(e) => setRxFreq(e.target.value)} className="w-full bg-white border border-sky-200 rounded-xl px-4 py-2.5 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-900 block mb-1">Daily Time (HH:MM)</label>
                      <input type="time" value={rxTime} onChange={(e) => setRxTime(e.target.value)} className="w-full bg-white border border-sky-200 rounded-xl px-4 py-2.5 text-sm font-bold" />
                    </div>
                  </div>
                  <input type="text" value={rxInstructions} onChange={(e) => setRxInstructions(e.target.value)} placeholder="Instructions (e.g., Take after dinner)" className="w-full bg-white border border-sky-200 rounded-xl px-4 py-2.5 text-sm font-medium" />
                  <button
                    type="button"
                    onClick={handleAddPrescription}
                    disabled={!rxName.trim() || !rxDosage.trim()}
                    className="w-full bg-sky-700 text-white font-black uppercase text-xs py-3.5 rounded-xl hover:bg-sky-800 disabled:opacity-50"
                  >
                    Save Prescription to Patient Schedule
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {medications.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-sm font-bold text-slate-600">
                    No medications recorded yet.
                  </div>
                ) : (
                  medications.map((rx) => (
                    <div key={rx.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        {rx.imageUrl && (
                          <img
                            src={rx.imageUrl}
                            alt={`${rx.name} pill`}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                          />
                        )}
                        <div>
                          <h3 className={`font-extrabold text-lg ${rx.status === 'DISCONTINUED' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                            {rx.name} ({rx.dosage})
                          </h3>
                          <p className="text-slate-700 font-semibold text-sm">
                            {rx.frequency} {rx.time ? `• at ${rx.time}` : ''} {rx.instructions ? `• ${rx.instructions}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePrescriptionStatus(rx.id, rx.status)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase ${
                          rx.status === 'ACTIVE' ? 'bg-mint-100 text-mint-800 hover:bg-mint-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {rx.status === 'ACTIVE' ? 'Active (Discontinue)' : 'Discontinued (Resume)'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </FadeIn>
          )}

          {/* TIMELINE TAB */}
          {activeTab === 'timeline' && (
            <FadeIn>
              <h2 className="text-lg font-black text-slate-900 mb-4">Unified Care Timeline</h2>
              {timeline.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center font-bold text-slate-600">
                  No timeline events recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {timeline.map((event) => {
                    const Icon =
                      event.type === 'MEDICATION'
                        ? Pill
                        : event.type === 'HYDRATION'
                        ? Droplets
                        : event.type === 'COGNITIVE_SESSION'
                        ? BrainCircuit
                        : Activity;
                    return (
                      <div key={event.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                          <Icon size={18} />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 text-sm">{event.title}</h3>
                            <span className="text-xs font-bold text-slate-600">
                              {new Date(event.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          </div>
                          <p className="text-slate-700 text-xs font-medium mt-0.5">{event.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </FadeIn>
          )}

          {/* COGNITIVE & ENGAGEMENT ANALYTICS TAB */}
          {activeTab === 'cognitive' && (
            <FadeIn>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-700">
                      <BrainCircuit size={22} />
                      <h2 className="text-lg font-extrabold text-slate-900">Rule-Based Engagement Summary</h2>
                    </div>
                    <span className="text-2xl font-black text-slate-900">
                      {isPredicting ? '...' : indicator.riskScore !== null ? `${indicator.riskScore}/100` : '--'}
                    </span>
                  </div>

                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Status: {indicator.riskLevel}</p>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <h3 className="text-xs font-black uppercase text-slate-600 mb-2">Observed Factors</h3>
                    {indicator.explanations?.length ? (
                      <ul className="space-y-2 text-sm font-medium text-slate-700 list-disc pl-5">
                        {indicator.explanations.map((exp, idx) => (
                          <li key={idx}>{exp}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-600">No session anomalies flagged.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-200">
                  <h2 className="text-lg font-extrabold text-slate-900 mb-1">Recent Cognitive Game Accuracy</h2>
                  <p className="text-xs font-medium text-slate-600 mb-4">Accuracy (%) across recorded activity sessions</p>
                  {cognitiveTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={cognitiveTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="label" fontSize={11} stroke="#475569" />
                        <YAxis fontSize={11} stroke="#475569" domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="accuracy" fill="#6366f1" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-sm font-bold text-slate-600 bg-slate-50 rounded-2xl">
                      No cognitive activity sessions logged yet.
                    </div>
                  )}
                </div>
              </div>
            </FadeIn>
          )}
        </div>
      )}
    </div>
  );
}

export default function DoctorPage() {
  const { role, status } = useActivePatient();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && role !== 'CLINICIAN') {
      router.push(role === 'CAREGIVER' ? '/caregiver' : '/');
    }
  }, [status, role, router]);

  if (status === 'loading' || status === 'unauthenticated' || role !== 'CLINICIAN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-bold text-slate-600 gap-4">
        <span className="animate-pulse">Loading Clinical Portal...</span>
      </div>
    );
  }

  return <Dashboard />;
}
