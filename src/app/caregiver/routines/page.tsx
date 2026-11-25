'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { db, type DailyRoutine } from '@/lib/db';
import { useActivePatient } from '@/hooks/useActivePatient';
import { CaregiverPatientBar } from '@/components/caregiver/CaregiverPatientBar';
import { ChevronLeft, Save, Trash2, Calendar, Clock, Mic, Play, Square, Printer } from 'lucide-react';
import Link from 'next/link';

interface ServerRoutineItem {
  id: string;
  category: string;
  title: string;
  time: string;
  iconEmoji: string;
  color: string;
  assignedTo?: string | null;
}

interface CircleMemberOption {
  id: string;
  role: string;
  caregiver?: { fullName: string } | null;
  clinician?: { fullName: string } | null;
}

const CATEGORIES = [
  { id: 'MEDICATION', label: 'Medication', emoji: '💊', color: 'bg-lavender-500' },
  { id: 'MEAL', label: 'Meal', emoji: '🍲', color: 'bg-orange-500' },
  { id: 'HYDRATION', label: 'Hydration', emoji: '💧', color: 'bg-sky-500' },
  { id: 'HYGIENE', label: 'Hygiene', emoji: '🪥', color: 'bg-teal-500' },
  { id: 'COGNITIVE', label: 'Memory', emoji: '🧠', color: 'bg-amber-500' },
  { id: 'PHYSICAL', label: 'Exercise', emoji: '🚶', color: 'bg-mint-500' },
  { id: 'SLEEP', label: 'Sleep', emoji: '🌙', color: 'bg-indigo-500' },
  { id: 'FAMILY', label: 'Family', emoji: '👨‍👩‍👧', color: 'bg-rose-500' },
  { id: 'CUSTOM', label: 'Custom', emoji: '✨', color: 'bg-slate-500' },
] as const;

export default function CaregiverRoutinesPage() {
  const { patientId, patientName, patients, setActivePatientId, isLoading } = useActivePatient();

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('MEAL');
  const [assignedTo, setAssignedTo] = useState('');
  const [routines, setRoutines] = useState<ServerRoutineItem[]>([]);
  const [careCircleMembers, setCareCircleMembers] = useState<CircleMemberOption[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadRoutinesAndMembers = useCallback(async () => {
    if (!patientId) {
      setRoutines([]);
      setCareCircleMembers([]);
      return;
    }
    try {
      const [routRes, circleRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/routines`, { cache: 'no-store' }),
        fetch(`/api/care-circle?patientId=${encodeURIComponent(patientId)}`, { cache: 'no-store' }),
      ]);
      if (routRes.ok) {
        const d = await routRes.json();
        setRoutines(Array.isArray(d.routines) ? d.routines : []);
      }
      if (circleRes.ok) {
        const d = await circleRes.json();
        setCareCircleMembers(Array.isArray(d.careCircle) ? d.careCircle : []);
      }
    } catch {
      const local = await db.dailyRoutines.where('patientId').equals(patientId).toArray();
      setRoutines(
        local.map((r, i) => ({
          id: String(r.id || i),
          category: r.category,
          title: r.title,
          time: r.time,
          iconEmoji: r.iconEmoji,
          color: r.color,
          assignedTo: r.assignedTo,
        }))
      );
    }
  }, [patientId]);

  useEffect(() => {
    loadRoutinesAndMembers();
  }, [loadRoutinesAndMembers]);

  const startRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => setAudioBase64(reader.result as string);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setMicError('Microphone access was denied or is unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !patientId) return;
    const catMeta = CATEGORIES.find((c) => c.id === category);

    let synced = false;
    try {
      const res = await fetch(`/api/patients/${patientId}/routines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim(),
          time,
          iconEmoji: catMeta?.emoji || '✨',
          color: catMeta?.color || 'bg-slate-500',
          assignedTo: assignedTo || undefined,
          audioBase64: audioBase64 || undefined,
        }),
      });
      synced = res.ok;
    } catch {
      synced = false;
    }

    await db.dailyRoutines.add({
      patientId,
      category: category as DailyRoutine['category'],
      title: title.trim(),
      time,
      iconEmoji: catMeta?.emoji || '✨',
      color: catMeta?.color || 'bg-slate-500',
      assignedTo: assignedTo || undefined,
      isActive: true,
      synced,
    });

    setTitle('');
    setAudioBase64(null);
    setAssignedTo('');
    await loadRoutinesAndMembers();
  };

  const handleDeleteRoutine = async (routineId: string) => {
    if (!patientId) return;
    await fetch(`/api/patients/${patientId}/routines?routineId=${encodeURIComponent(routineId)}`, {
      method: 'DELETE',
    });
    setConfirmDeleteId(null);
    await loadRoutinesAndMembers();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32 sm:pb-28 font-sans">
      <div className="bg-white pt-6 sm:pt-12 pb-4 sm:pb-5 px-4 sm:px-6 shadow-sm border-b border-slate-200 sticky top-0 z-30 print:hidden">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-4">
            <Link href="/caregiver" aria-label="Back to Caregiver Dashboard" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors">
              <ChevronLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Daily Routines</h1>
              <p className="text-sm font-medium text-slate-600">Configure schedule for the patient dashboard</p>
            </div>
          </div>
          {patientId && routines.length > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-2xl text-xs font-black flex items-center gap-2 transition-colors"
            >
              <Printer size={16} /> Print Kitchen Wall Schedule
            </button>
          )}
        </div>
      </div>

      {/* Dedicated Printable A4 Wall Schedule */}
      <div className="hidden print:block p-8 bg-white text-slate-900">
        <div className="border-b-4 border-slate-900 pb-4 mb-6 flex justify-between items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">SMRITI Daily Care Plan</p>
            <h1 className="text-3xl font-black mt-1">{patientName || 'Patient'} — Kitchen Wall Schedule</h1>
          </div>
          <p className="text-sm font-bold text-slate-600">Generated {new Date().toLocaleDateString()}</p>
        </div>
        <div className="space-y-4">
          {[...routines]
            .sort((a, b) => a.time.localeCompare(b.time))
            .map((r) => (
              <div key={r.id} className="border-2 border-slate-300 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{r.iconEmoji}</span>
                  <div>
                    <p className="text-xl font-black">{r.title}</p>
                    <p className="text-sm font-bold text-slate-600">
                      {r.category} {r.assignedTo ? `· Helper: ${r.assignedTo}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-black tracking-tight">{r.time}</span>
                  <div className="w-8 h-8 border-2 border-slate-800 rounded-lg" />
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-3xl mx-auto print:hidden">
        <CaregiverPatientBar patientId={patientId} patients={patients} onSelectPatient={setActivePatientId} isLoading={isLoading} />

        {patientId && (
          <>
            {/* Add Routine Form */}
            <div className="bg-white p-4 sm:p-6 rounded-[28px] shadow-sm border border-slate-200 space-y-4">
              <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                <Calendar size={20} className="text-sky-600" /> Add Daily Routine
              </h2>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`py-2 px-2 rounded-xl flex flex-col items-center gap-1 border-2 transition-all ${
                        category === cat.id
                          ? 'bg-sky-50 border-sky-500 text-slate-900'
                          : 'border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-2xl">{cat.emoji}</span>
                      <span className="text-xs font-bold">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Morning Breakfast, Garden Walk"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Time</label>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-300 rounded-xl p-3">
                    <Clock size={20} className="text-slate-500" />
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-transparent text-slate-800 font-bold outline-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Assign To (Optional)</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 font-bold"
                >
                  <option value="">Patient / Any Caregiver</option>
                  {careCircleMembers.map((m) => {
                    const mName = m.caregiver?.fullName || m.clinician?.fullName || 'Member';
                    return (
                      <option key={m.id} value={mName}>
                        {mName} ({m.role})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Optional Voice Note */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Attach Personal Voice Prompt (Optional)</p>
                <div className="flex flex-wrap items-center gap-3">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-sm rounded-xl flex items-center gap-2"
                    >
                      <Mic size={16} /> Record Prompt
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-4 py-2.5 bg-rose-600 text-white font-bold text-sm rounded-xl flex items-center gap-2 animate-pulse"
                    >
                      <Square size={16} /> Stop Recording
                    </button>
                  )}

                  {audioBase64 && (
                    <>
                      <audio ref={audioRef} src={audioBase64} className="hidden" />
                      <button
                        type="button"
                        onClick={() => audioRef.current?.play()}
                        className="px-4 py-2.5 bg-sky-50 border border-sky-200 text-sky-700 font-bold text-sm rounded-xl flex items-center gap-2"
                      >
                        <Play size={16} /> Preview
                      </button>
                    </>
                  )}
                </div>
                {micError && <p className="text-xs font-bold text-rose-600">{micError}</p>}
              </div>

              <button
                type="button"
                disabled={!title.trim()}
                onClick={handleSave}
                className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-black rounded-2xl flex items-center justify-center gap-2"
              >
                <Save size={18} /> Add Routine to Daily Schedule
              </button>
            </div>

            {/* Active Routines List */}
            <div className="space-y-3">
              <h2 className="font-extrabold text-lg text-slate-900">Active Routines ({routines.length})</h2>
              {routines.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-sm font-medium text-slate-600">
                  No daily routines configured yet.
                </div>
              ) : (
                routines.map((r) => (
                  <div key={r.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{r.iconEmoji}</span>
                      <div>
                        <h3 className="font-extrabold text-slate-900">{r.title}</h3>
                        <p className="text-xs font-bold text-slate-600">
                          {r.time} • {r.category}
                          {r.assignedTo ? ` • Assigned: ${r.assignedTo}` : ''}
                        </p>
                      </div>
                    </div>

                    {confirmDeleteId === r.id ? (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleDeleteRoutine(r.id)} className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg">
                          Delete
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Delete routine ${r.title}`}
                        onClick={() => setConfirmDeleteId(r.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
