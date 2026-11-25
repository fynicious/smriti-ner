import { motion } from 'framer-motion';
import { PlannerItem } from '@/hooks/useDailyPlanner';
import { db } from '@/lib/db';
import { ListenButton } from '@/components/ui';
import { useRef } from 'react';

interface NowCardProps {
  item: PlannerItem;
  onComplete?: (item: PlannerItem) => Promise<void> | void;
  onSnooze?: (item: PlannerItem) => Promise<void> | void;
  compact?: boolean;
}

export function NowCard({ item, onComplete, onSnooze, compact = false }: NowCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playVoice = () => {
    if (item.voiceReminder?.audioBase64 && audioRef.current) {
      audioRef.current.play().catch((e) => console.error('Audio playback failed', e));
    }
  };

  const markCompleted = async () => {
    if (onComplete) {
      await onComplete(item);
      return;
    }
    if (item.sourceId) {
      if (item.sourceType === 'MEDICATION') {
        await db.medicationEvents.update(item.sourceId, { action: 'taken', completedBy: 'Patient' });
      } else if (item.sourceType === 'ROUTINE') {
        await db.routineOccurrences.update(item.sourceId, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          completedBy: 'Patient',
        });
      }
    }
  };

  const markSnoozed = async () => {
    if (onSnooze) {
      await onSnooze(item);
      return;
    }
    if (item.sourceId) {
      if (item.sourceType === 'MEDICATION') {
        await db.medicationEvents.update(item.sourceId, { action: 'snoozed' });
      } else if (item.sourceType === 'ROUTINE') {
        await db.routineOccurrences.update(item.sourceId, { status: 'snoozed' });
      }
    }
  };

  const bgStyles: Record<string, string> = {
    MEDICATION: 'bg-lavender-50 border-lavender-300 text-slate-900',
    HYDRATION: 'bg-sky-50 border-sky-300 text-slate-900',
    MEAL: 'bg-orange-50 border-orange-300 text-slate-900',
    COGNITIVE: 'bg-peach-50 border-peach-300 text-slate-900',
    PHYSICAL: 'bg-mint-50 border-mint-300 text-slate-900',
    HYGIENE: 'bg-teal-50 border-teal-300 text-slate-900',
    SLEEP: 'bg-indigo-50 border-indigo-300 text-slate-900',
    APPOINTMENT: 'bg-blue-50 border-blue-300 text-slate-900',
    FAMILY: 'bg-rose-50 border-rose-300 text-slate-900',
    CUSTOM: 'bg-slate-50 border-slate-300 text-slate-900',
  };
  const btnStyles: Record<string, string> = {
    MEDICATION: 'bg-emerald-600 hover:bg-emerald-700',
    HYDRATION: 'bg-sky-600 hover:bg-sky-700',
    MEAL: 'bg-orange-600 hover:bg-orange-700',
    COGNITIVE: 'bg-peach-600 hover:bg-peach-700',
    PHYSICAL: 'bg-emerald-600 hover:bg-emerald-700',
    HYGIENE: 'bg-teal-600 hover:bg-teal-700',
    SLEEP: 'bg-indigo-600 hover:bg-indigo-700',
    APPOINTMENT: 'bg-blue-600 hover:bg-blue-700',
    FAMILY: 'bg-rose-600 hover:bg-rose-700',
    CUSTOM: 'bg-slate-800 hover:bg-slate-900',
  };

  const style = bgStyles[item.category] || bgStyles.CUSTOM;
  const btnStyle = btnStyles[item.category] || btnStyles.CUSTOM;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`rounded-[28px] sm:rounded-[36px] ${compact ? 'p-5 sm:p-6' : 'p-5 sm:p-7'} shadow-lg border-4 flex flex-col items-center text-center gap-3 sm:gap-4 relative overflow-hidden ${style}`}
    >
      <div className="w-full flex justify-between items-center text-sm font-black tracking-widest uppercase text-slate-700">
        <span className="px-3 py-1 rounded-full bg-white/90 border border-slate-200">Right Now</span>
        <span className="px-3 py-1 rounded-full bg-white/90 border border-slate-200">{item.time}</span>
      </div>

      {item.imageUrl ? (
        <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-white p-1.5 shadow-md border-2 border-white overflow-hidden">
          <img src={item.imageUrl} alt={`${item.title} visual guide`} className="w-full h-full object-cover rounded-2xl" />
        </div>
      ) : (
        <div className={`${compact ? 'w-24 h-24' : 'w-28 h-28'} rounded-full bg-white/85 shadow-inner flex items-center justify-center border-2 border-white`}>
          <span className={compact ? 'text-5xl' : 'text-6xl'}>{item.iconEmoji}</span>
        </div>
      )}

      <div>
        <h3 className={`${compact ? 'text-2xl sm:text-3xl' : 'text-2xl sm:text-4xl'} font-black tracking-tight text-slate-900`}>
          {item.title}
        </h3>
        <p className="text-base font-bold text-slate-700 mt-1">{item.category.replace('_', ' ')}</p>
      </div>

      <div className="flex flex-col w-full gap-3 mt-2">
        {item.voiceReminder ? (
          <>
            <audio ref={audioRef} src={item.voiceReminder.audioBase64} />
            <button
              type="button"
              onClick={playVoice}
              className="min-h-[56px] px-6 text-lg w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl font-bold shadow-sm border border-slate-200 transition-all"
            >
              <span className="text-2xl">🔊</span> Listen to {item.voiceReminder.speakerName}
            </button>
          </>
        ) : (
          <ListenButton
            textToSpeak={`It is time for ${item.title}.`}
            className="min-h-[56px] px-6 text-lg w-full justify-center bg-white hover:bg-slate-50 text-slate-900 rounded-2xl font-bold shadow-sm border border-slate-200"
          />
        )}

        <button
          type="button"
          onClick={markCompleted}
          className={`min-h-[64px] px-6 ${btnStyle} active:scale-95 text-white font-black text-xl uppercase tracking-wider rounded-[24px] w-full shadow-md transition-all`}
        >
          {item.category === 'MEDICATION' ? 'I Took It' : 'Done'}
        </button>

        <button
          type="button"
          onClick={markSnoozed}
          className="min-h-[56px] px-6 bg-white/80 hover:bg-white active:scale-95 font-bold text-base uppercase tracking-wider rounded-2xl w-full text-slate-800 border border-slate-300 transition-all"
        >
          Remind Me Later
        </button>
      </div>
    </motion.div>
  );
}
