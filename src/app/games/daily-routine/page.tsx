'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameContainer } from '@/components/games/GameContainer';
import { FadeIn } from '@/components/ui';

const ROUTINE = [
  { id: 'wake', emoji: '🛏️', text: 'Wake Up' },
  { id: 'brush', emoji: '🪥', text: 'Brush Teeth' },
  { id: 'eat', emoji: '🍳', text: 'Eat Breakfast' },
];

export default function DailyRoutine() {
  const [items, setItems] = useState([...ROUTINE].sort(() => 0.5 - Math.random()));
  const [selected, setSelected] = useState<string[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [errorIndex, setErrorIndex] = useState<number | null>(null);

  const startRound = () => {
    setIsWon(false);
    setSelected([]);
    setItems([...ROUTINE].sort(() => 0.5 - Math.random()));
  };

  useEffect(() => {
    startRound();
  }, []);

  const handleTap = (id: string) => {
    if (selected.includes(id)) return;
    
    const expectedId = ROUTINE[selected.length].id;
    if (id === expectedId) {
      const newSelected = [...selected, id];
      setSelected(newSelected);
      if (newSelected.length === ROUTINE.length) {
        setTimeout(() => setIsWon(true), 400);
      }
    } else {
      const itemIndex = items.findIndex(i => i.id === id);
      setErrorIndex(itemIndex);
      setTimeout(() => setErrorIndex(null), 500);
    }
  };

  return (
    <GameContainer title="Daily Routine" subtitle="Tap the tasks in the correct order" isWon={isWon} onRestart={startRound}>
      <FadeIn>
        {/* Progress slots */}
        <div className="flex justify-center gap-3 mb-10 mt-6">
          {ROUTINE.map((task, i) => {
            const isFilled = i < selected.length;
            const item = ROUTINE.find(r => r.id === selected[i]);
            return (
              <div key={i} className={`w-20 h-24 rounded-2xl border-4 flex flex-col items-center justify-center transition-all ${isFilled ? 'bg-orange-100 border-orange-200' : 'bg-transparent border-dashed border-slate-300'}`}>
                {isFilled && <span className="text-3xl filter drop-shadow-sm">{item?.emoji}</span>}
              </div>
            );
          })}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-4 max-w-sm mx-auto">
          {items.map((item, index) => {
            const isSelected = selected.includes(item.id);
            if (isSelected) return <div key={item.id} className="h-20" />; // Empty placeholder
            
            return (
              <motion.button
                key={item.id}
                layoutId={`card-${item.id}`}
                whileTap={{ scale: 0.95 }}
                animate={errorIndex === index ? { x: [-5, 5, -5, 5, 0] } : {}}
                onClick={() => handleTap(item.id)}
                className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 text-left hover:shadow-md"
              >
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                  {item.emoji}
                </div>
                <span className="text-xl font-bold text-slate-700">{item.text}</span>
              </motion.button>
            );
          })}
        </div>
      </FadeIn>
    </GameContainer>
  );
}
