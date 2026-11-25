'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn, Button } from '@/components/ui';
import { playClickSound, playSuccessSound, playFanfareSound } from '@/lib/sound';
import { useVoiceAssistant } from '@/contexts/VoiceAssistantProvider';
import { useI18n } from '@/contexts/I18nProvider';
import { ArrowLeft, RotateCcw, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useActivePatient } from '@/hooks/useActivePatient';
import { logCognitiveSession } from '@/lib/cognitive-logger';

interface GardenItem {
  id: string;
  emoji: string;
  wordEn: string;
  wordAs: string;
  wordBn: string;
}

const GARDEN_ITEMS: GardenItem[] = [
  { id: 'tea', emoji: '🍵', wordEn: 'Tea Cup', wordAs: 'চাহ', wordBn: 'চা' },
  { id: 'flower', emoji: '🪷', wordEn: 'Lotus Flower', wordAs: 'পদুম ফুল', wordBn: 'পদ্ম ফুল' },
  { id: 'drum', emoji: '🥁', wordEn: 'Dhol Drum', wordAs: 'ঢোল', wordBn: 'ঢোল' },
  { id: 'rice', emoji: '🌾', wordEn: 'Rice Paddy', wordAs: 'ধান', wordBn: 'ধান' },
  { id: 'bamboo', emoji: '🎋', wordEn: 'Bamboo Tree', wordAs: 'বাঁহ', wordBn: 'বাঁশ' },
  { id: 'sun', emoji: '☀️', wordEn: 'Bright Sun', wordAs: 'বেলিলৈ', wordBn: 'সূর্য' },
];

export default function WordGardenGame() {
  const { patientId } = useActivePatient();
  const { lang } = useI18n();
  const { speak } = useVoiceAssistant();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [gameWon, setGameWon] = useState(false);

  const targetItem = GARDEN_ITEMS[currentIndex];

  const getWord = (item: GardenItem) => {
    if (lang === 'as') return item.wordAs;
    if (lang === 'bn') return item.wordBn;
    return item.wordEn;
  };

  useEffect(() => {
    if (!targetItem) return;
    const correctWord = lang === 'as' ? targetItem.wordAs : lang === 'bn' ? targetItem.wordBn : targetItem.wordEn;
    const otherWords = GARDEN_ITEMS.filter((i) => i.id !== targetItem.id)
      .map((i) => (lang === 'as' ? i.wordAs : lang === 'bn' ? i.wordBn : i.wordEn))
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);

    const allOptions = [correctWord, ...otherWords].sort(() => 0.5 - Math.random());
    setOptions(allOptions);
    setSelectedWord(null);
    setIsCorrect(null);
  }, [currentIndex, lang, targetItem]);

  const handleOptionClick = (word: string) => {
    playClickSound();
    setSelectedWord(word);
    speak(word);

    const correctWord = getWord(targetItem);
    if (word === correctWord) {
      setIsCorrect(true);
      playSuccessSound();
      setScore((s) => s + 10);

      setTimeout(() => {
        if (currentIndex + 1 < GARDEN_ITEMS.length) {
          setCurrentIndex((c) => c + 1);
        } else {
          playFanfareSound();
          setGameWon(true);
          logCognitiveSession({
            patientId,
            gameId: 'word-garden',
            domain: 'LANGUAGE',
            moves: GARDEN_ITEMS.length,
            errors: 0,
            accuracy: 1,
            difficultyLevel: 1,
            gridSize: 'Word Cards',
            score: score + 10,
          });
        }
      }, 1200);
    } else {
      setIsCorrect(false);
    }
  };

  const restartGame = () => {
    playClickSound();
    setCurrentIndex(0);
    setScore(0);
    setGameWon(false);
  };

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto flex flex-col justify-between pb-24">
      <div>
        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/games" className="p-2.5 rounded-full bg-white shadow-soft text-slate-600 hover:bg-slate-50">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">Word Garden</h1>
          <button onClick={restartGame} className="p-2.5 rounded-full bg-white shadow-soft text-slate-600 hover:bg-slate-50">
            <RotateCcw size={18} />
          </button>
        </div>

        <FadeIn>
          <div className="text-center mb-6">
            <p className="text-slate-500 text-sm">
              Look at the picture below and tap the matching word!
            </p>
            <div className="flex justify-center gap-6 mt-3">
              <span className="text-sm font-semibold text-slate-700 bg-white px-3 py-1 rounded-full shadow-xs border">
                Card: <strong>{currentIndex + 1} / {GARDEN_ITEMS.length}</strong>
              </span>
              <span className="text-sm font-semibold text-slate-700 bg-white px-3 py-1 rounded-full shadow-xs border">
                Score: <strong>{score}</strong>
              </span>
            </div>
          </div>
        </FadeIn>

        {/* Garden Picture Display */}
        <FadeIn delay={0.1}>
          <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-soft text-center mb-5 sm:mb-6 border border-slate-100 flex flex-col items-center">
            <motion.div
              key={targetItem.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-7xl sm:text-8xl mb-4 filter drop-shadow-md cursor-pointer"
              onClick={() => speak(getWord(targetItem))}
            >
              {targetItem.emoji}
            </motion.div>
            <button
              onClick={() => speak(getWord(targetItem))}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-mint-100 text-mint-800 text-xs font-bold hover:bg-mint-200 transition-colors"
            >
              <Volume2 size={16} />
              <span>Listen To Pronunciation</span>
            </button>
          </div>
        </FadeIn>

        {/* Word Options */}
        <div className="space-y-3">
          {options.map((word, idx) => {
            const isSelected = selectedWord === word;

            let bgClass = 'bg-white text-slate-700 border-slate-200 hover:border-slate-300';
            if (isSelected) {
              bgClass = isCorrect
                ? 'bg-emerald-500 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                : 'bg-rose-400 text-white border-rose-500 shadow-md';
            }

            return (
              <motion.button
                key={idx}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleOptionClick(word)}
                className={`w-full py-4 px-6 rounded-2xl border-2 font-bold text-lg text-center transition-all flex items-center justify-between shadow-soft ${bgClass}`}
              >
                <span>{word}</span>
                <Volume2 size={18} className="opacity-60" />
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Win Celebration */}
      <AnimatePresence>
        {gameWon && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full"
            >
              <div className="text-6xl mb-4">🌺</div>
              <h2 className="text-2xl font-extrabold text-slate-800 mb-2">
                Garden Bloomed!
              </h2>
              <p className="text-slate-500 mb-6 text-sm">
                Wonderful job matching all garden words! Your score is {score}.
              </p>
              <Button variant="mint" size="lg" className="w-full" onClick={restartGame}>
                Play Again
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
