'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameContainer } from '@/components/games/GameContainer';
import { FadeIn } from '@/components/ui';

const PAIRS = [
  { trigger: 'Rain', match: 'Umbrella', emoji: '☔', wrong: ['Sun', 'Snow', 'Wind'] },
  { trigger: 'Tea', match: 'Cup', emoji: '☕', wrong: ['Plate', 'Fork', 'Bowl'] },
  { trigger: 'Shoes', match: 'Socks', emoji: '🧦', wrong: ['Hat', 'Gloves', 'Scarf'] },
  { trigger: 'Sleep', match: 'Bed', emoji: '🛏️', wrong: ['Chair', 'Table', 'Door'] },
];

export default function WordAssociation() {
  const [round, setRound] = useState(PAIRS[0]);
  const [options, setOptions] = useState<{ id: string; text: string; isCorrect: boolean }[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [wrongId, setWrongId] = useState<string | null>(null);

  const startRound = () => {
    setIsWon(false);
    setWrongId(null);
    const selected = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    setRound(selected);
    const arr = [
      { id: '1', text: selected.match, isCorrect: true },
      ...selected.wrong.slice(0, 3).map((w, i) => ({ id: `w${i}`, text: w, isCorrect: false }))
    ].sort(() => 0.5 - Math.random());
    setOptions(arr);
  };

  useEffect(() => {
    startRound();
  }, []);

  const handleTap = (item: { id: string; isCorrect: boolean }) => {
    if (item.isCorrect) {
      setIsWon(true);
    } else {
      setWrongId(item.id);
      setTimeout(() => setWrongId(null), 500);
    }
  };

  return (
    <GameContainer title="Word Link" subtitle="What goes with this word?" isWon={isWon} onRestart={startRound}>
      <FadeIn>
        <div className="flex justify-center mb-10 mt-8">
          <div className="bg-blue-100 text-blue-900 px-10 py-8 rounded-[2.5rem] shadow-sm border border-blue-200">
            <span className="text-4xl font-black">{round.trigger}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          {options.map((opt) => (
            <motion.button
              key={opt.id}
              whileTap={{ scale: 0.95 }}
              animate={wrongId === opt.id ? { x: [-5, 5, -5, 5, 0] } : {}}
              onClick={() => handleTap(opt)}
              className={`py-4 px-6 rounded-2xl text-xl font-bold transition-colors ${
                wrongId === opt.id ? 'bg-red-100 text-red-600' : 'bg-white text-slate-700 shadow-sm border border-slate-100 hover:shadow-md'
              }`}
            >
              {opt.text}
            </motion.button>
          ))}
        </div>
      </FadeIn>
    </GameContainer>
  );
}
