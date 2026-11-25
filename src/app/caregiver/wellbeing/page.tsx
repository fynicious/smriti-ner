'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db';
import { getLocalDateString } from '@/lib/dateUtils';
import { useActivePatient } from '@/hooks/useActivePatient';
import { CaregiverPatientBar } from '@/components/caregiver/CaregiverPatientBar';
import { ChevronLeft, Activity, Plus, Download, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface ServerWellbeingEntry {
  id: string;
  date: string;
  timestamp: string;
  recordedBy: string;
  source: string;
  mood: number;
  sleepQuality: number;
  confusionLevel: number;
  energyLevel: number;
  painLevel: number;
  overallWellbeing: number;
  notes?: string | null;
}

const LABELS = ['GOOD / NONE', 'OKAY / MILD', 'POOR / MODERATE', 'SEVERE'];
const COLORS = ['bg-mint-500', 'bg-amber-400', 'bg-rose-500', 'bg-purple-600'];
const EMOJIS = ['🟢', '🟡', '🔴', '🟣'];

const formatScoreLabel = (val: number) => (val < 0 ? 'SKIPPED' : LABELS[val] || String(val));
const formatScoreEmoji = (val: number) => (val < 0 ? '⚪' : EMOJIS[val] || '⚪');
const getScoreColor = (val: number) => (val < 0 ? 'bg-slate-200' : COLORS[val] || 'bg-slate-200');

export default function CaregiverWellbeingPage() {
  const { patientId, patientName, patients, setActivePatientId, isLoading } = useActivePatient();

  const [entries, setEntries] = useState<ServerWellbeingEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newEntry, setNewEntry] = useState({
    mood: 0,
    sleepQuality: 0,
    confusionLevel: 0,
    energyLevel: 0,
    painLevel: 0,
    overallWellbeing: 0,
    notes: '',
  });

  const loadEntries = useCallback(async () => {
    if (!patientId) {
      setEntries([]);
      return;
    }
    try {
      const res = await fetch(`/api/patients/${patientId}/wellbeing`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        return;
      }
    } catch {
      // Fallback to Dexie
    }
    const local = await db.wellbeingEntries.where('patientId').equals(patientId).reverse().limit(30).toArray();
    setEntries(
      local.map((e, idx) => ({
        id: String(e.id || idx),
        date: e.date,
        timestamp: e.timestamp,
        recordedBy: e.recordedBy,
        source: e.source,
        mood: e.mood,
        sleepQuality: e.sleepQuality,
        confusionLevel: e.confusionLevel,
        energyLevel: e.energyLevel,
        painLevel: e.painLevel,
        overallWellbeing: e.overallWellbeing,
        notes: e.notes,
      }))
    );
  }, [patientId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleSaveObservation = async () => {
    if (!patientId) return;
    setIsSaving(true);
    const today = getLocalDateString();
    let synced = false;
    try {
      const res = await fetch(`/api/patients/${patientId}/wellbeing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newEntry, date: today }),
      });
      synced = res.ok;
    } catch {
      synced = false;
    }

    await db.wellbeingEntries.add({
      patientId,
      date: today,
      timestamp: new Date().toISOString(),
      recordedBy: 'CAREGIVER',
      source: 'CAREGIVER_OBSERVED',
      ...newEntry,
      synced,
    });

    setIsSaving(false);
    setIsAdding(false);
    setNewEntry({ mood: 0, sleepQuality: 0, confusionLevel: 0, energyLevel: 0, painLevel: 0, overallWellbeing: 0, notes: '' });
    await loadEntries();
  };

  const handleDownloadCsv = () => {
    if (entries.length === 0) return;
    const headers = ['Date', 'Source', 'Mood', 'SleepQuality', 'Confusion', 'Energy', 'Pain', 'Overall', 'Notes'];
    const rows = entries.map((e) => [
      e.date,
      e.source,
      formatScoreLabel(e.mood),
      formatScoreLabel(e.sleepQuality),
      formatScoreLabel(e.confusionLevel),
      formatScoreLabel(e.energyLevel),
      formatScoreLabel(e.painLevel),
      formatScoreLabel(e.overallWellbeing),
      `"${String(e.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smriti-wellbeing-${(patientName || 'patient').toLowerCase().replace(/\s+/g, '-')}-${getLocalDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const todayEntry = entries[0] || null;
  const last7 = entries.slice(0, 7).reverse();

  const TrendRow = ({ label, field }: { label: string; field: keyof ServerWellbeingEntry }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 gap-2">
      <span className="text-xs sm:text-sm font-bold text-slate-700 w-20 sm:w-24 shrink-0">{label}</span>
      <div className="flex gap-1 sm:gap-1.5 flex-1 min-w-0">
        {last7.map((e, idx) => {
          const val = Number(e[field] ?? -1);
          const color = getScoreColor(val);
          return (
            <div key={e.id || idx} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-8 rounded-md ${color} opacity-85`} title={`${e.date}: ${formatScoreLabel(val)}`} />
              {idx === last7.length - 1 && <span className="text-[10px] font-black text-slate-600 uppercase">Latest</span>}
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, 7 - last7.length) }).map((_, idx) => (
          <div key={`empty-${idx}`} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-8 rounded-md bg-slate-100" title="No Data" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-32 sm:pb-28 font-sans">
      <div className="bg-white pt-6 sm:pt-12 pb-4 sm:pb-5 px-4 sm:px-6 shadow-sm border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center gap-3 sm:gap-4">
          <Link href="/caregiver" aria-label="Back to Caregiver Dashboard" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors shrink-0">
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Wellbeing & Symptoms</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Track longitudinal observations & check-ins</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-3xl mx-auto">
        <CaregiverPatientBar patientId={patientId} patients={patients} onSelectPatient={setActivePatientId} isLoading={isLoading} />

        <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex gap-3 text-amber-900 text-sm font-medium">
          <AlertTriangle size={20} className="flex-shrink-0 text-amber-700 mt-0.5" />
          <p>
            <strong>Non-Diagnostic Observation Tracker:</strong> This tool records caregiver and patient check-ins for trend visibility. Consult a clinician for medical guidance.
          </p>
        </div>

        {patientId && (
          <>
            {/* Latest Observation */}
            <div className="bg-white p-4 sm:p-6 rounded-[28px] shadow-sm border border-slate-200">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h2 className="font-extrabold text-slate-600 text-sm uppercase tracking-widest">Latest Observation</h2>
                {todayEntry && (
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                    {new Date(todayEntry.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                )}
              </div>

              {todayEntry ? (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-50 p-3.5 rounded-2xl">
                      <p className="text-xs font-bold text-slate-600 uppercase mb-1">Confusion</p>
                      <p className="font-black text-slate-800 text-sm">{formatScoreEmoji(todayEntry.confusionLevel)} {formatScoreLabel(todayEntry.confusionLevel)}</p>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-2xl">
                      <p className="text-xs font-bold text-slate-600 uppercase mb-1">Sleep</p>
                      <p className="font-black text-slate-800 text-sm">{formatScoreEmoji(todayEntry.sleepQuality)} {formatScoreLabel(todayEntry.sleepQuality)}</p>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-2xl">
                      <p className="text-xs font-bold text-slate-600 uppercase mb-1">Mood</p>
                      <p className="font-black text-slate-800 text-sm">{formatScoreEmoji(todayEntry.mood)} {formatScoreLabel(todayEntry.mood)}</p>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-2xl">
                      <p className="text-xs font-bold text-slate-600 uppercase mb-1">Energy</p>
                      <p className="font-black text-slate-800 text-sm">{formatScoreEmoji(todayEntry.energyLevel)} {formatScoreLabel(todayEntry.energyLevel)}</p>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-slate-600">Source: {todayEntry.source.replace(/_/g, ' ')}</p>
                  {todayEntry.notes && (
                    <div className="mt-3 p-3 bg-indigo-50 text-indigo-900 rounded-xl text-sm font-medium border border-indigo-200">
                      <strong>Notes:</strong> {todayEntry.notes}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-600 font-medium">No wellbeing entries recorded yet.</div>
              )}
            </div>

            {/* 7-Day Trend + CSV Download */}
            <div className="bg-white p-4 sm:p-6 rounded-[28px] shadow-sm border border-slate-200">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-5">
                <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                  <Activity size={20} className="text-sky-600" /> Recent Check-In Trend
                </h2>
                <button
                  type="button"
                  disabled={entries.length === 0}
                  onClick={handleDownloadCsv}
                  className="text-sky-700 bg-sky-50 border border-sky-200 disabled:opacity-40 px-4 py-2 rounded-full flex items-center gap-1.5 text-xs font-bold hover:bg-sky-100"
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>

              <div className="space-y-1">
                <TrendRow label="Confusion" field="confusionLevel" />
                <TrendRow label="Sleep" field="sleepQuality" />
                <TrendRow label="Mood" field="mood" />
                <TrendRow label="Energy" field="energyLevel" />
                <TrendRow label="Pain" field="painLevel" />
              </div>
            </div>

            {/* Add Caregiver Observation */}
            <div>
              <button
                type="button"
                onClick={() => setIsAdding(!isAdding)}
                className="w-full py-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} /> {isAdding ? 'Close Observation Form' : 'Add Caregiver Observation'}
              </button>

              {isAdding && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-200 mt-4 space-y-4">
                  <h3 className="font-extrabold text-slate-900">Record Observation</h3>
                  {[
                    { key: 'confusionLevel' as const, label: 'Confusion' },
                    { key: 'sleepQuality' as const, label: 'Sleep' },
                    { key: 'mood' as const, label: 'Mood' },
                    { key: 'energyLevel' as const, label: 'Energy' },
                    { key: 'painLevel' as const, label: 'Pain' },
                  ].map((item) => (
                    <div key={item.key}>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">{item.label}</label>
                      <select
                        value={newEntry[item.key]}
                        onChange={(e) => setNewEntry({ ...newEntry, [item.key]: parseInt(e.target.value, 10) })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 font-bold"
                      >
                        <option value={0}>0 - None / Good</option>
                        <option value={1}>1 - Mild / Okay</option>
                        <option value={2}>2 - Moderate / Poor</option>
                        <option value={3}>3 - Severe / Very Low</option>
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Notes</label>
                    <textarea
                      value={newEntry.notes}
                      onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                      placeholder="e.g., Seemed more rested after afternoon walk."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 font-medium"
                      rows={3}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveObservation}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-xl transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save Observation'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
