'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameContainer } from '@/components/games/GameContainer';
import { FadeIn } from '@/components/ui';

const ITEMS = [
  { id: '1', emoji: '🐘' },
  { id: '2', emoji: '🦏' },
  { id: '3', emoji: '🐅' },
  { id: '4', emoji: '🦚' },
  { id: '5', emoji: '🐄' },
];

export default function ShadowMatch() {
  const [target, setTarget] = useState(ITEMS[0]);
  const [options, setOptions] = useState(ITEMS.slice(0, 4));
  const [isWon, setIsWon] = useState(false);
  const [wrongId, setWrongId] = useState<string | null>(null);

  const startRound = () => {
    setIsWon(false);
    setWrongId(null);
    const shuffled = [...ITEMS].sort(() => 0.5 - Math.random());
    const selectedOptions = shuffled.slice(0, 4);
    setOptions(selectedOptions);
    setTarget(selectedOptions[Math.floor(Math.random() * selectedOptions.length)]);
  };

  useEffect(() => {
    startRound();
  }, []);

  const handleTap = (id: string) => {
    if (id === target.id) {
      setIsWon(true);
    } else {
      setWrongId(id);
      setTimeout(() => setWrongId(null), 500);
    }
  };

  return (
    <GameContainer title="Shadow Match" subtitle="Whose shadow is this?" isWon={isWon} onRestart={startRound}>
      <FadeIn>
        <div className="flex justify-center mb-10 mt-8">
          <div className="w-48 h-48 bg-slate-200 rounded-[3rem] shadow-inner flex items-center justify-center">
            {/* The trick for shadow: brightness(0) */}
            <span className="text-8xl" style={{ filter: 'brightness(0)' }}>{target.emoji}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          {options.map((opt) => (
            <motion.button
              key={opt.id}
              whileTap={{ scale: 0.95 }}
              animate={wrongId === opt.id ? { x: [-5, 5, -5, 5, 0] } : {}}
              onClick={() => handleTap(opt.id)}
              className={`py-6 px-4 rounded-3xl text-6xl transition-colors shadow-sm bg-white hover:shadow-md ${
                wrongId === opt.id ? 'bg-red-50' : ''
              }`}
            >
              {opt.emoji}
            </motion.button>
          ))}
        </div>
      </FadeIn>
    </GameContainer>
  );
}
