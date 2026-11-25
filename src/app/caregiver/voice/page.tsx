'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useActivePatient } from '@/hooks/useActivePatient';
import { CaregiverPatientBar } from '@/components/caregiver/CaregiverPatientBar';
import { db } from '@/lib/db';
import { saveOfflinePhraseRecording, type CorePhraseKey } from '@/lib/offline-voice';
import { Mic, Square, Play, Trash2, ChevronLeft, Save, CheckCircle2, Volume2 } from 'lucide-react';
import Link from 'next/link';

const CORE_PHRASES: Array<{ key: CorePhraseKey; label: string }> = [
  { key: 'drink_water', label: 'Drink Water Reminder' },
  { key: 'take_medicine', label: 'Take Medicine Reminder' },
  { key: 'good_morning', label: 'Good Morning Greeting' },
  { key: 'call_family', label: 'Call Family Prompt' },
  { key: 'open_games', label: 'Memory Games Prompt' },
];

interface VoiceReminderItem {
  id: string;
  routineType: string;
  title: string;
  time: string;
  speakerName: string;
  audioBase64: string;
}

export default function VoiceReminderRecorder() {
  const { patientId, patients, setActivePatientId, isLoading, user } = useActivePatient();

  const [routineType, setRoutineType] = useState('medication');
  const [title, setTitle] = useState('Morning Medicine');
  const [time, setTime] = useState('08:00');
  const [speakerName, setSpeakerName] = useState('Family Caregiver');

  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [savedReminders, setSavedReminders] = useState<VoiceReminderItem[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (user?.name) setSpeakerName(user.name);
  }, [user?.name]);

  const loadReminders = useCallback(async () => {
    if (!patientId) {
      setSavedReminders([]);
      return;
    }
    try {
      const res = await fetch(`/api/patients/${patientId}/routines`, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setSavedReminders(Array.isArray(d.voiceReminders) ? d.voiceReminders : []);
      }
    } catch {
      // Offline non-fatal
    }
  }, [patientId]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const startRecording = async () => {
    setErrorMsg(null);
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMsg('Audio recording is not supported in this browser.');
      return;
    }
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
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setErrorMsg('Could not access microphone. Please allow microphone permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const playPreview = () => {
    if (audioBase64 && audioRef.current) {
      audioRef.current.src = audioBase64;
      audioRef.current.play().catch(() => {});
    }
  };

  const saveReminder = async () => {
    if (!patientId || !audioBase64 || !title.trim()) {
      setErrorMsg('Record an audio clip and enter a reminder title first.');
      return;
    }
    setErrorMsg(null);

    let synced = false;
    try {
      const res = await fetch(`/api/patients/${patientId}/routines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'VOICE_REMINDER',
          routineType,
          title: title.trim(),
          time,
          speakerName: speakerName.trim() || 'Caregiver',
          audioBase64,
        }),
      });
      synced = res.ok;
    } catch {
      synced = false;
    }

    await db.voiceReminders.add({
      patientId,
      routineType,
      title: title.trim(),
      time,
      speakerName: speakerName.trim() || 'Caregiver',
      audioBase64,
      isActive: true,
      synced,
    });

    setAudioBase64(null);
    setFeedback(synced ? 'Family voice reminder saved!' : 'Voice reminder cached locally.');
    setTimeout(() => setFeedback(null), 4000);
    await loadReminders();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32 sm:pb-28 font-sans">
      <div className="bg-white pt-6 sm:pt-12 pb-4 sm:pb-5 px-4 sm:px-6 shadow-sm border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center gap-3 sm:gap-4">
          <Link href="/caregiver" aria-label="Back to Caregiver Dashboard" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-200 shrink-0">
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Family Voice Reminders</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Record warm voice prompts in your loved one&apos;s home language</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-3xl mx-auto">
        <CaregiverPatientBar patientId={patientId} patients={patients} onSelectPatient={setActivePatientId} isLoading={isLoading} />

        {feedback && (
          <div className="bg-mint-50 border border-mint-300 text-mint-900 px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2">
            <CheckCircle2 size={18} /> {feedback}
          </div>
        )}
        {errorMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl font-bold text-sm">{errorMsg}</div>}

        {patientId && (
          <>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Routine Type</label>
                  <select value={routineType} onChange={(e) => setRoutineType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white">
                    <option value="medication">Medication</option>
                    <option value="hydration">Hydration</option>
                    <option value="meal">Meal</option>
                    <option value="exercise">Exercise</option>
                    <option value="custom">Personal Message</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Reminder Time</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Reminder Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Speaker Label</label>
                  <input type="text" value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800" />
                </div>
              </div>

              <div className="pt-4 flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  aria-label={isRecording ? 'Stop recording voice reminder' : 'Record voice reminder'}
                  className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg border-4 transition-all ${
                    isRecording ? 'bg-rose-600 border-rose-200 text-white animate-pulse' : 'bg-rose-50 border-white text-rose-600 hover:bg-rose-100'
                  }`}
                >
                  {isRecording ? <Square size={32} /> : <Mic size={36} />}
                </button>
                <p className="text-sm font-bold text-slate-700">
                  {isRecording ? 'Recording... Tap to stop' : audioBase64 ? 'Voice clip captured ✓' : 'Tap to record voice prompt'}
                </p>

                {audioBase64 && (
                  <div className="flex gap-3">
                    <audio ref={audioRef} className="hidden" />
                    <button type="button" onClick={playPreview} className="px-4 py-2.5 bg-sky-50 border border-sky-200 text-sky-800 font-bold text-sm rounded-xl flex items-center gap-2">
                      <Play size={16} /> Preview
                    </button>
                    <button type="button" onClick={() => setAudioBase64(null)} className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl flex items-center gap-2">
                      <Trash2 size={16} /> Clear
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!audioBase64 || !title.trim()}
                onClick={saveReminder}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-black rounded-2xl flex items-center justify-center gap-2"
              >
                <Save size={18} /> Save Voice Reminder
              </button>
            </div>

            {/* Offline Core Phrase Pack Cache */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-200 space-y-3">
              <div className="flex items-center gap-2 text-indigo-800">
                <Volume2 size={20} />
                <h2 className="font-extrabold text-base">Offline Native-Speaker / Caregiver Phrase Pack</h2>
              </div>
              <p className="text-xs font-medium text-slate-600">
                Record the currently captured audio clip above as an offline core phrase in your loved one&apos;s home dialect. Offline voice playback checks these local clips before Web Speech synthesis.
              </p>
              <div className="flex flex-wrap gap-2">
                {CORE_PHRASES.map((cp) => (
                  <button
                    key={cp.key}
                    type="button"
                    disabled={!audioBase64}
                    onClick={async () => {
                      if (!patientId || !audioBase64) return;
                      await saveOfflinePhraseRecording({
                        patientId,
                        phraseKey: cp.key,
                        speakerName: speakerName.trim() || 'Caregiver',
                        audioBase64,
                      });
                      setFeedback(`Cached offline core phrase "${cp.label}".`);
                      setTimeout(() => setFeedback(null), 4000);
                    }}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 border border-indigo-200 text-indigo-900 font-bold text-xs rounded-xl"
                  >
                    Save as &ldquo;{cp.label}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {savedReminders.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-extrabold text-lg text-slate-900">Active Voice Reminders ({savedReminders.length})</h2>
                {savedReminders.map((vr) => (
                  <div key={vr.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900">{vr.title}</h3>
                      <p className="text-xs font-bold text-slate-600">
                        {vr.time} • From {vr.speakerName} ({vr.routineType})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => new Audio(vr.audioBase64).play().catch(() => {})}
                      className="px-4 py-2 bg-sky-50 border border-sky-200 text-sky-800 font-bold text-xs rounded-xl flex items-center gap-1.5"
                    >
                      <Play size={14} /> Play
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
