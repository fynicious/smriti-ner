'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameContainer } from '@/components/games/GameContainer';
import { FadeIn } from '@/components/ui';

const EMOTIONS = [
  { emotion: 'Happy', emoji: '😊', wrong: ['Sad', 'Angry', 'Surprised'] },
  { emotion: 'Sad', emoji: '😢', wrong: ['Happy', 'Angry', 'Calm'] },
  { emotion: 'Angry', emoji: '😠', wrong: ['Happy', 'Sad', 'Sleepy'] },
  { emotion: 'Surprised', emoji: '😲', wrong: ['Angry', 'Calm', 'Sad'] },
];

export default function EmotionRecognition() {
  const [round, setRound] = useState(EMOTIONS[0]);
  const [options, setOptions] = useState<{ id: string; text: string; isCorrect: boolean }[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [wrongId, setWrongId] = useState<string | null>(null);

  const startRound = () => {
    setIsWon(false);
    setWrongId(null);
    const selected = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)];
    setRound(selected);
    const arr = [
      { id: '1', text: selected.emotion, isCorrect: true },
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
    <GameContainer title="Feelings" subtitle="How is this person feeling?" isWon={isWon} onRestart={startRound}>
      <FadeIn>
        <div className="flex justify-center mb-10 mt-8">
          <div className="w-48 h-48 bg-white rounded-full shadow-md flex items-center justify-center border-4 border-pink-100">
            <span className="text-8xl">{round.emoji}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          {options.map((opt) => (
            <motion.button
              key={opt.id}
              whileTap={{ scale: 0.95 }}
              animate={wrongId === opt.id ? { x: [-5, 5, -5, 5, 0] } : {}}
              onClick={() => handleTap(opt)}
              className={`py-6 px-4 rounded-3xl text-xl font-bold transition-colors shadow-sm ${
                wrongId === opt.id ? 'bg-red-100 text-red-600' : 'bg-white text-slate-700 hover:shadow-md'
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
