'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GameContainer } from '@/components/games/GameContainer';
import { FadeIn } from '@/components/ui';
import { useGameAdaptation } from '@/hooks/useGameAdaptation';
import { NER_ASSAM_PACK, RegionalObject } from '@/lib/regional-content';

export default function FindTheItem() {
  const { difficultyLevel, recordMove, recordGameEnd } = useGameAdaptation('find-the-item', 'ATTENTION');
  const [target, setTarget] = useState<RegionalObject>(NER_ASSAM_PACK.cognitiveObjects[0]);
  const [grid, setGrid] = useState<{ id: number; obj: RegionalObject; isTarget: boolean }[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [wrongId, setWrongId] = useState<number | null>(null);
  const startTime = useRef(Date.now());
  const movesCount = useRef(0);

  const startRound = useCallback(() => {
    setIsWon(false);
    setWrongId(null);
    movesCount.current = 0;
    startTime.current = Date.now();

    const targetIdx = Math.floor(Math.random() * NER_ASSAM_PACK.cognitiveObjects.length);
    const newTarget = NER_ASSAM_PACK.cognitiveObjects[targetIdx];
    setTarget(newTarget);

    const totalItems = difficultyLevel <= 2 ? 4 : difficultyLevel <= 4 ? 9 : 16;

    const items = Array.from({ length: totalItems - 1 }).map((_, i) => {
      let distractorIdx: number;
      do {
        distractorIdx = Math.floor(Math.random() * NER_ASSAM_PACK.cognitiveObjects.length);
      } while (distractorIdx === targetIdx);

      return {
        id: i,
        obj: NER_ASSAM_PACK.cognitiveObjects[distractorIdx],
        isTarget: false,
      };
    });

    items.push({ id: totalItems - 1, obj: newTarget, isTarget: true });
    setGrid(items.sort(() => 0.5 - Math.random()));

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(`Find the ${newTarget.label}`);
        utterance.lang = 'en-IN';
        window.speechSynthesis.speak(utterance);
      }, 450);
    }
  }, [difficultyLevel]);

  useEffect(() => {
    startRound();
  }, [startRound]);

  const handleTap = (item: { id: number; isTarget: boolean }) => {
    if (isWon) return;

    movesCount.current++;
    const timeTaken = (Date.now() - startTime.current) / 1000;
    recordMove(timeTaken, item.isTarget);

    if (item.isTarget) {
      setIsWon(true);
      recordGameEnd(movesCount.current);
    } else {
      setWrongId(item.id);
      setTimeout(() => setWrongId(null), 500);
    }
  };

  const gridColsClass = grid.length === 4 ? 'grid-cols-2' : grid.length === 9 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <GameContainer
      title="Find It"
      subtitle={`Find the ${target.label} hidden here!`}
      isWon={isWon}
      onRestart={startRound}
      skipAutoLog
    >
      <FadeIn>
        <div className="bg-white p-4 sm:p-6 rounded-[28px] sm:rounded-[2.5rem] shadow-sm border border-slate-100 max-w-sm sm:max-w-md mx-auto mt-2 sm:mt-4">
          <div className="flex items-center justify-center gap-3 mb-4 sm:mb-6">
            <img src={target.imageUrl} alt={target.label} className="w-12 h-12 rounded-xl object-contain bg-slate-50 p-1" />
            <span className="text-lg font-black text-slate-800">{target.label}</span>
          </div>
          <div className={`grid ${gridColsClass} gap-2 sm:gap-3`}>
            {grid.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                aria-label={item.obj.label}
                animate={wrongId === item.id ? { x: [-6, 6, -6, 6, 0] } : {}}
                onClick={() => handleTap(item)}
                className="aspect-square rounded-2xl bg-slate-50 border-2 border-slate-100 p-1.5 sm:p-2 min-h-[56px] flex items-center justify-center hover:border-mint-300 active:scale-95 transition-all"
              >
                <img src={item.obj.imageUrl} alt={item.obj.label} className="w-full h-full object-contain" />
              </motion.button>
            ))}
          </div>
        </div>
      </FadeIn>
    </GameContainer>
  );
}
