'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GameContainer } from '@/components/games/GameContainer';
import { FadeIn } from '@/components/ui';
import { useActivePatient } from '@/hooks/useActivePatient';
import { logCognitiveSession } from '@/lib/cognitive-logger';
import { playClickSound, playSuccessSound } from '@/lib/sound';

const COLORS = [
  { id: 'red', label: 'Red', bg: 'bg-rose-400', active: 'bg-rose-600', shadow: 'shadow-rose-400' },
  { id: 'blue', label: 'Blue', bg: 'bg-blue-400', active: 'bg-blue-600', shadow: 'shadow-blue-400' },
  { id: 'green', label: 'Green', bg: 'bg-emerald-400', active: 'bg-emerald-600', shadow: 'shadow-emerald-400' },
  { id: 'yellow', label: 'Yellow', bg: 'bg-amber-400', active: 'bg-amber-500', shadow: 'shadow-amber-400' },
];

export default function ColorSequence() {
  const { patientId } = useActivePatient();
  const [sequence, setSequence] = useState<string[]>([]);
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [isWon, setIsWon] = useState(false);
  const [level, setLevel] = useState(1);
  const [error, setError] = useState(false);

  const sessionStartTime = useRef<number>(0);
  const totalReactionTime = useRef<number>(0);
  const taps = useRef<number>(0);
  const errorCount = useRef<number>(0);
  const isMountedRef = useRef(true);

  const playSequence = useCallback(async (seq: string[]) => {
    setIsPlaying(true);
    for (let i = 0; i < seq.length; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (!isMountedRef.current) return;
      setActiveColor(seq[i]);
      playClickSound();
      await new Promise((r) => setTimeout(r, 400));
      if (!isMountedRef.current) return;
      setActiveColor(null);
    }
    setIsPlaying(false);
    sessionStartTime.current = Date.now();
  }, []);

  const resetGame = useCallback(() => {
    setIsWon(false);
    setLevel(1);
    setUserSequence([]);
    setError(false);
    errorCount.current = 0;
    totalReactionTime.current = 0;
    taps.current = 0;

    const first = COLORS[Math.floor(Math.random() * COLORS.length)].id;
    const second = COLORS[Math.floor(Math.random() * COLORS.length)].id;
    const initialSeq = [first, second];
    setSequence(initialSeq);
    setTimeout(() => {
      if (isMountedRef.current) playSequence(initialSeq);
    }, 350);
  }, [playSequence]);

  useEffect(() => {
    isMountedRef.current = true;
    resetGame();
    return () => {
      isMountedRef.current = false;
    };
  }, [resetGame]);

  const handleTap = async (id: string) => {
    if (isPlaying || isWon || sequence.length === 0) return;

    playClickSound();
    if (sessionStartTime.current > 0) {
      totalReactionTime.current += Date.now() - sessionStartTime.current;
    }
    taps.current += 1;
    sessionStartTime.current = Date.now();

    setActiveColor(id);
    setTimeout(() => setActiveColor(null), 200);

    const newUserSeq = [...userSequence, id];
    setUserSequence(newUserSeq);

    if (newUserSeq[newUserSeq.length - 1] !== sequence[newUserSeq.length - 1]) {
      setError(true);
      errorCount.current += 1;
      setUserSequence([]);
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setError(false);
        playSequence(sequence);
      }, 900);
      return;
    }

    if (newUserSeq.length === sequence.length) {
      playSuccessSound();
      if (level >= 3) {
        const avgRtSec = taps.current > 0 ? totalReactionTime.current / taps.current / 1000 : 0;
        const accuracy = Math.max(0, Math.min(1, 1 - errorCount.current / (taps.current + errorCount.current)));
        await logCognitiveSession({
          patientId,
          gameId: 'color-sequence',
          domain: 'MEMORY',
          moves: taps.current,
          errors: errorCount.current,
          avgTimePerMoveSec: avgRtSec,
          difficultyLevel: level,
          accuracy,
        });
        setTimeout(() => {
          if (isMountedRef.current) setIsWon(true);
        }, 450);
      } else {
        const nextLevel = level + 1;
        const nextColor = COLORS[Math.floor(Math.random() * COLORS.length)].id;
        const nextSeq = [...sequence, nextColor];
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setLevel(nextLevel);
          setSequence(nextSeq);
          setUserSequence([]);
          sessionStartTime.current = 0;
          playSequence(nextSeq);
        }, 850);
      }
    }
  };

  return (
    <GameContainer
      title="Color Sequence"
      subtitle={isPlaying ? 'Watch carefully...' : 'Your turn! Repeat the glowing order'}
      isWon={isWon}
      onRestart={resetGame}
      skipAutoLog
    >
      <FadeIn>
        <div className="text-center mb-6">
          <span className="text-sm font-black text-slate-600 uppercase tracking-widest">Level {level} of 3</span>
        </div>
        <motion.div
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          className="grid grid-cols-2 gap-4 max-w-[260px] mx-auto"
        >
          {COLORS.map((color) => {
            const isActive = activeColor === color.id;
            return (
              <motion.button
                key={color.id}
                type="button"
                aria-label={`${color.label} button`}
                whileTap={!isPlaying ? { scale: 0.92 } : {}}
                onClick={() => handleTap(color.id)}
                className={`aspect-square rounded-full transition-all duration-200 border-4 border-white shadow-md ${
                  isActive ? `${color.active} scale-105 shadow-[0_0_30px_rgba(0,0,0,0.3)] ${color.shadow}` : `${color.bg}`
                }`}
              />
            );
          })}
        </motion.div>
        {error && (
          <p className="text-center text-rose-600 font-bold mt-6">Let&apos;s watch that pattern one more time...</p>
        )}
      </FadeIn>
    </GameContainer>
  );
}
