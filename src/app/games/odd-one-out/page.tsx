'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameContainer } from '@/components/games/GameContainer';
import { FadeIn } from '@/components/ui';
import { NER_ASSAM_PACK, RegionalObject } from '@/lib/regional-content';

export default function OddOneOut() {
  const [items, setItems] = useState<{ id: string; obj: RegionalObject; isOdd: boolean }[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [wrongId, setWrongId] = useState<string | null>(null);

  const startRound = () => {
    setIsWon(false);
    setWrongId(null);
    
    const shuffled = [...NER_ASSAM_PACK.cognitiveObjects].sort(() => 0.5 - Math.random());
    const mainObj = shuffled[0];
    const oddObj = shuffled[1];

    const arr = [
      { id: '1', obj: mainObj, isOdd: false },
      { id: '2', obj: mainObj, isOdd: false },
      { id: '3', obj: mainObj, isOdd: false },
      { id: '4', obj: oddObj, isOdd: true },
    ].sort(() => 0.5 - Math.random());
    
    setItems(arr);
    
    if (window.speechSynthesis) {
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(`Find the picture that is different from the others.`);
        utterance.lang = 'en-IN';
        window.speechSynthesis.speak(utterance);
      }, 500);
    }
  };

  useEffect(() => {
    startRound();
  }, []);

  const handleTap = (item: { id: string; obj: RegionalObject; isOdd: boolean }) => {
    if (item.isOdd) {
      setIsWon(true);
      if (window.speechSynthesis) {
         const utterance = new SpeechSynthesisUtterance(`Correct! The ${item.obj.label} is different.`);
         utterance.lang = 'en-IN';
         window.speechSynthesis.speak(utterance);
      }
    } else {
      setWrongId(item.id);
      setTimeout(() => setWrongId(null), 500);
    }
  };

  return (
    <GameContainer title="Odd One Out" subtitle="Find the one that is different" isWon={isWon} onRestart={startRound}>
      <FadeIn>
        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mt-12">
          {items.map((item) => (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.9 }}
              animate={wrongId === item.id ? { x: [-5, 5, -5, 5, 0] } : {}}
              onClick={() => handleTap(item)}
              className={`aspect-square rounded-[2.5rem] flex items-center justify-center transition-colors shadow-sm border-2 overflow-hidden ${
                wrongId === item.id ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100 hover:shadow-md'
              }`}
            >
              <img src={item.obj.imageUrl} alt={item.obj.label} className="w-full h-full object-cover" loading="lazy" />
            </motion.button>
          ))}
        </div>
      </FadeIn>
    </GameContainer>
  );
}
