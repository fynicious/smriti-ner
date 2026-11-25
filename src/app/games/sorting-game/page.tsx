'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameContainer } from '@/components/games/GameContainer';
import { FadeIn } from '@/components/ui';

const CATEGORIES = {
  fruits: { id: 'fruits', name: 'Fruits', items: ['🍎', '🍌', '🍇', '🥭'] },
  clothes: { id: 'clothes', name: 'Clothes', items: ['👕', '👖', '👗', '🧦'] }
};

export default function SortingGame() {
  const [currentItem, setCurrentItem] = useState<{ emoji: string; category: string } | null>(null);
  const [isWon, setIsWon] = useState(false);
  const [error, setError] = useState(false);
  const [score, setScore] = useState(0);

  const pickNextItem = useCallback(() => {
    const isFruit = Math.random() > 0.5;
    const cat = isFruit ? CATEGORIES.fruits : CATEGORIES.clothes;
    const emoji = cat.items[Math.floor(Math.random() * cat.items.length)];
    setCurrentItem({ emoji, category: cat.id });
  }, []);

  const startRound = useCallback(() => {
    setIsWon(false);
    setScore(0);
    setError(false);
    pickNextItem();
  }, [pickNextItem]);

  useEffect(() => {
    startRound();
  }, [startRound]);

  const handleSort = (catId: string) => {
    if (!currentItem) return;
    
    if (currentItem.category === catId) {
      const newScore = score + 1;
      setScore(newScore);
      if (newScore >= 4) {
        setIsWon(true);
      } else {
        pickNextItem();
      }
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };

  return (
    <GameContainer title="Sort It" subtitle="Put the item in the right box" isWon={isWon} onRestart={startRound}>
      <FadeIn>
        <div className="flex justify-between items-center mb-8 px-4 max-w-sm mx-auto mt-6">
          <span className="text-sm font-bold text-slate-600 tracking-wider">SCORE: {score}/4</span>
        </div>

        <div className="flex justify-center h-32 mb-10">
          <AnimatePresence mode="popLayout">
            {currentItem && (
              <motion.div
                key={currentItem.emoji}
                initial={{ scale: 0, y: -50 }}
                animate={error ? { x: [-10, 10, -10, 10, 0], scale: 1 } : { scale: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                className="w-24 h-24 bg-white rounded-[2rem] shadow-md flex items-center justify-center text-6xl border-4 border-slate-100"
              >
                {currentItem.emoji}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSort('fruits')}
            className="bg-orange-100 border-2 border-orange-200 py-8 rounded-[2rem] flex flex-col items-center gap-2 shadow-sm"
          >
            <span className="text-3xl">🧺</span>
            <span className="font-bold text-orange-900">{CATEGORIES.fruits.name}</span>
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSort('clothes')}
            className="bg-blue-100 border-2 border-blue-200 py-8 rounded-[2rem] flex flex-col items-center gap-2 shadow-sm"
          >
            <span className="text-3xl">🧳</span>
            <span className="font-bold text-blue-900">{CATEGORIES.clothes.name}</span>
          </motion.button>
        </div>
      </FadeIn>
    </GameContainer>
  );
}
