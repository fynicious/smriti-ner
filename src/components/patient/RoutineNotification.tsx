import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { VoiceReminder } from '@/lib/db';

interface RoutineNotificationProps {
  reminder: VoiceReminder;
  onComplete: () => void;
  onSnooze: () => void;
}

const ICONS: Record<string, string> = {
  medication: '💊',
  hydration: '💧',
  meal: '🍲',
  exercise: '🚶',
  custom: '💬'
};

export function RoutineNotification({ reminder, onComplete, onSnooze }: RoutineNotificationProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playVoice = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        // Browsers may block unmuted autoplay prior to user interaction
      });
    }
  };

  useEffect(() => {
    // Attempt to auto-play when notification mounts
    playVoice();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 50 }}
        className="bg-white rounded-[40px] w-full max-w-sm p-8 shadow-2xl flex flex-col items-center text-center border-4 border-white"
      >
        <div className="w-32 h-32 bg-sky-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <span className="text-7xl filter drop-shadow-md">
            {ICONS[reminder.routineType] || '🔔'}
          </span>
        </div>

        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-widest mb-2">
          {reminder.title}
        </h2>
        
        <p className="text-slate-500 font-bold mb-8 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Message from {reminder.speakerName}
        </p>

        <audio ref={audioRef} src={reminder.audioBase64} />

        <div className="w-full space-y-4">
          <button 
            onClick={onComplete}
            className="w-full py-5 bg-mint-400 hover:bg-mint-500 text-white rounded-[24px] font-black text-xl tracking-wider uppercase shadow-md active:scale-95 transition-all"
          >
            I Took It
          </button>
          
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={onSnooze}
              className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-[20px] font-bold tracking-wider uppercase active:scale-95 transition-all"
            >
              Later
            </button>
            <button 
              onClick={playVoice}
              className="py-4 bg-sky-100 hover:bg-sky-200 text-sky-600 rounded-[20px] font-bold tracking-wider uppercase active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              🔊 Play
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
