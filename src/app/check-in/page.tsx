'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, generateClientMutationId, getOrCreateDeviceId } from '@/lib/db';
import { getLocalDateString } from '@/lib/dateUtils';
import { useActivePatient } from '@/hooks/useActivePatient';
import { usePatientPreferences } from '@/hooks/usePatientPreferences';
import { useSync } from '@/hooks/useSync';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronLeft, Volume2, SkipForward } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nProvider';

function playTTS(text: string, rate = 0.85, speechCode = 'en-IN') {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.lang = speechCode;
    window.speechSynthesis.speak(utterance);
  }
}

const QUESTIONS = [
  {
    id: 'mood',
    title: 'How are you feeling today?',
    options: [
      { value: 0, label: 'GOOD', emoji: '🙂', color: 'bg-mint-100 text-mint-900 border-mint-400' },
      { value: 1, label: 'OKAY', emoji: '😐', color: 'bg-amber-100 text-amber-900 border-amber-400' },
      { value: 2, label: 'NOT GOOD', emoji: '🙁', color: 'bg-rose-100 text-rose-900 border-rose-400' },
    ],
  },
  {
    id: 'sleepQuality',
    title: 'How did you sleep last night?',
    options: [
      { value: 0, label: 'WELL', emoji: '😴', color: 'bg-mint-100 text-mint-900 border-mint-400' },
      { value: 1, label: 'OKAY', emoji: '😐', color: 'bg-amber-100 text-amber-900 border-amber-400' },
      { value: 2, label: 'POORLY', emoji: '😟', color: 'bg-rose-100 text-rose-900 border-rose-400' },
    ],
  },
  {
    id: 'confusionLevel',
    title: 'How clear does your mind feel?',
    options: [
      { value: 0, label: 'CLEAR', emoji: '🟢', color: 'bg-mint-100 text-mint-900 border-mint-400' },
      { value: 1, label: 'A LITTLE CONFUSED', emoji: '🟡', color: 'bg-amber-100 text-amber-900 border-amber-400' },
      { value: 2, label: 'VERY CONFUSED', emoji: '🔴', color: 'bg-rose-100 text-rose-900 border-rose-400' },
    ],
  },
  {
    id: 'energyLevel',
    title: 'How is your energy?',
    options: [
      { value: 0, label: 'GOOD', emoji: '⚡', color: 'bg-mint-100 text-mint-900 border-mint-400' },
      { value: 1, label: 'LOW', emoji: '🔋', color: 'bg-amber-100 text-amber-900 border-amber-400' },
      { value: 2, label: 'VERY LOW', emoji: '🪫', color: 'bg-rose-100 text-rose-900 border-rose-400' },
    ],
  },
  {
    id: 'painLevel',
    title: 'Are you in any pain?',
    options: [
      { value: 0, label: 'NO PAIN', emoji: '🟢', color: 'bg-mint-100 text-mint-900 border-mint-400' },
      { value: 1, label: 'MILD PAIN', emoji: '🟡', color: 'bg-amber-100 text-amber-900 border-amber-400' },
      { value: 2, label: 'SEVERE PAIN', emoji: '🔴', color: 'bg-rose-100 text-rose-900 border-rose-400' },
    ],
  },
  {
    id: 'overallWellbeing',
    title: 'Overall, how is your day?',
    options: [
      { value: 0, label: 'GOOD', emoji: '🌟', color: 'bg-mint-100 text-mint-900 border-mint-400' },
      { value: 1, label: 'OKAY', emoji: '🌤️', color: 'bg-amber-100 text-amber-900 border-amber-400' },
      { value: 2, label: 'NOT GOOD', emoji: '🌧️', color: 'bg-rose-100 text-rose-900 border-rose-400' },
    ],
  },
];

export default function DailyCheckInPage() {
  const router = useRouter();
  const { t, lang, languages } = useI18n();
  const { patientId, status } = useActivePatient();
  const { preferences } = usePatientPreferences(patientId);
  useSync(patientId || undefined);

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const speechCode = languages.find((l) => l.code === lang)?.speechCode || 'en-IN';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const saveCheckIn = async (finalAnswers: Record<string, number>) => {
    if (!patientId) return;
    const today = getLocalDateString();
    const mutId = generateClientMutationId('wb');
    const deviceId = getOrCreateDeviceId();

    const payload = {
      date: today,
      mood: finalAnswers['mood'] ?? -1,
      sleepQuality: finalAnswers['sleepQuality'] ?? -1,
      confusionLevel: finalAnswers['confusionLevel'] ?? -1,
      energyLevel: finalAnswers['energyLevel'] ?? -1,
      painLevel: finalAnswers['painLevel'] ?? -1,
      overallWellbeing: finalAnswers['overallWellbeing'] ?? -1,
      clientMutationId: mutId,
      deviceId,
    };

    let synced = false;
    try {
      const res = await fetch(`/api/patients/${patientId}/wellbeing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      synced = res.ok;
    } catch {
      synced = false;
    }

    await db.wellbeingEntries.add({
      patientId,
      ...payload,
      timestamp: new Date().toISOString(),
      recordedBy: patientId,
      source: 'PATIENT_REPORTED',
      synced,
    });
  };

  const advanceOrFinish = async (nextAnswers: Record<string, number>, finishImmediately = false) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (!finishImmediately && currentStep < QUESTIONS.length - 1) {
      setTimeout(() => setCurrentStep((prev) => prev + 1), 180);
    } else {
      setIsSaving(true);
      await saveCheckIn(nextAnswers);
      setIsSaving(false);
      setIsDone(true);
    }
  };

  const handleSelect = async (value: number) => {
    if (isSaving) return;
    const questionId = QUESTIONS[currentStep].id;
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    await advanceOrFinish(newAnswers, false);
  };

  const handleSkipQuestion = async () => {
    if (isSaving) return;
    const questionId = QUESTIONS[currentStep].id;
    const newAnswers = { ...answers, [questionId]: -1 };
    setAnswers(newAnswers);
    await advanceOrFinish(newAnswers, false);
  };

  const getQuestionTitle = (q: (typeof QUESTIONS)[number]) => {
    switch (q.id) {
      case 'mood':
        return t.howAreYouFeeling || q.title;
      case 'sleepQuality':
        return t.howDidYouSleep || q.title;
      case 'painLevel':
        return t.areYouInPain || q.title;
      default:
        return q.title;
    }
  };

  if (status === 'loading') {
    return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center font-bold text-slate-600">Loading check-in...</div>;
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-mint-50 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-10 rounded-[40px] shadow-lg border-4 border-mint-200 max-w-md w-full"
        >
          <CheckCircle2 size={72} className="text-emerald-600 mx-auto mb-5" />
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Thank You</h1>
          <p className="text-lg font-bold text-slate-700 mt-2 mb-6">
            Your check-in has been shared as patient-reported wellbeing.
          </p>
          <Link
            href="/"
            className="flex items-center justify-center w-full min-h-[60px] bg-emerald-600 text-white font-black rounded-2xl text-xl shadow-sm"
          >
            Back Home
          </Link>
        </motion.div>
      </div>
    );
  }

  const currentQ = QUESTIONS[currentStep];
  const questionLabel = getQuestionTitle(currentQ);

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col font-sans pb-32 sm:pb-16">
      <div className="pt-6 sm:pt-10 pb-3 sm:pb-4 px-4 sm:px-6 flex items-center justify-between gap-2 max-w-lg mx-auto w-full">
        <Link
          href="/"
          aria-label="Back to home"
          className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-800 active:scale-95 transition-transform border-2 border-slate-200"
        >
          <ChevronLeft size={28} />
        </Link>
        <div className="text-center">
          <span className="text-xs font-black uppercase tracking-widest text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
            Optional • Patient Reported
          </span>
          <div className="flex gap-2 justify-center mt-2" aria-label={`Question ${currentStep + 1} of ${QUESTIONS.length}`}>
            {QUESTIONS.map((_, idx) => (
              <div
                key={idx}
                className={`h-3 rounded-full transition-all ${
                  idx === currentStep ? 'w-8 bg-sky-700' : idx < currentStep ? 'w-4 bg-sky-400' : 'w-4 bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => advanceOrFinish(answers, true)}
          className="min-h-[48px] px-3 text-xs font-bold text-slate-600 hover:text-slate-900 underline"
        >
          Finish Now
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.18 }}
            className="w-full text-center"
          >
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight mb-4 sm:mb-5">{questionLabel}</h1>

            <button
              type="button"
              onClick={() => playTTS(questionLabel, preferences.voiceRate, speechCode)}
              className="mx-auto mb-5 sm:mb-8 flex items-center gap-3 bg-white px-7 min-h-[56px] rounded-full text-sky-800 font-bold shadow-sm active:scale-95 transition-all border-2 border-slate-200 text-lg"
            >
              <Volume2 size={24} />
              {t.listen || 'Listen'}
            </button>

            <div className="space-y-4">
              {currentQ.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full min-h-[64px] sm:min-h-[72px] p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border-4 flex items-center justify-center gap-3 sm:gap-4 active:scale-[0.98] disabled:opacity-50 transition-transform ${opt.color} shadow-sm`}
                >
                  <span className="text-4xl">{opt.emoji}</span>
                  <span className="text-xl sm:text-2xl font-black tracking-wide">{opt.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSkipQuestion}
              className="mt-6 w-full min-h-[56px] rounded-2xl border-2 border-slate-200 bg-white text-slate-700 font-bold text-base flex items-center justify-center gap-2 hover:bg-slate-50"
            >
              <SkipForward size={18} /> Skip this question
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
