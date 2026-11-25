'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameContainer } from '@/components/games/GameContainer';
import { FadeIn } from '@/components/ui';
import { NER_ASSAM_PACK, RegionalObject } from '@/lib/regional-content';

export default function ObjectRecognition() {
  const [target, setTarget] = useState<RegionalObject>(NER_ASSAM_PACK.cognitiveObjects[0]);
  const [options, setOptions] = useState<RegionalObject[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [wrongId, setWrongId] = useState<string | null>(null);

  const startRound = () => {
    setIsWon(false);
    setWrongId(null);
    const shuffled = [...NER_ASSAM_PACK.cognitiveObjects].sort(() => 0.5 - Math.random());
    const selectedOptions = shuffled.slice(0, 4);
    setOptions(selectedOptions);
    const newTarget = selectedOptions[Math.floor(Math.random() * selectedOptions.length)];
    setTarget(newTarget);
    
    if (window.speechSynthesis) {
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(`What is this object?`);
        utterance.lang = 'en-IN';
        window.speechSynthesis.speak(utterance);
      }, 500);
    }
  };

  useEffect(() => {
    startRound();
  }, []);

  const handleGuess = (id: string) => {
    if (id === target.id) {
      setIsWon(true);
      if (window.speechSynthesis) {
         const utterance = new SpeechSynthesisUtterance(`Correct! It is ${target.label}.`);
         utterance.lang = 'en-IN';
         window.speechSynthesis.speak(utterance);
      }
    } else {
      setWrongId(id);
      setTimeout(() => setWrongId(null), 500);
    }
  };

  return (
    <GameContainer title="What is This?" subtitle="Tap the matching name" isWon={isWon} onRestart={startRound}>
      <FadeIn>
        <div className="flex justify-center mb-10 mt-8">
          <div className="w-48 h-48 bg-white rounded-[3rem] shadow-md flex items-center justify-center border-4 border-mint-100 overflow-hidden">
            <img src={target.imageUrl} alt="Object" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          {options.map((opt) => (
            <motion.button
              key={opt.id}
              whileTap={{ scale: 0.95 }}
              animate={wrongId === opt.id ? { x: [-5, 5, -5, 5, 0] } : {}}
              onClick={() => handleGuess(opt.id)}
              className={`py-6 px-4 rounded-3xl text-xl font-bold transition-colors ${
                wrongId === opt.id ? 'bg-red-100 text-red-600' : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
      </FadeIn>
    </GameContainer>
  );
}
