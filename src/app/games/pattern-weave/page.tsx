'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn, Button } from '@/components/ui';
import { playClickSound, playSuccessSound, playFanfareSound } from '@/lib/sound';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useActivePatient } from '@/hooks/useActivePatient';
import { logCognitiveSession } from '@/lib/cognitive-logger';

interface PatternItem {
  id: string;
  emoji: string;
  name: string;
  color: string;
}

const PATTERN_ITEMS: PatternItem[] = [
  { id: 'red', emoji: '🧶', name: 'Red Yarn', color: 'bg-rose-100 border-rose-300 text-rose-600' },
  { id: 'yellow', emoji: '🌾', name: 'Golden Rice', color: 'bg-amber-100 border-amber-300 text-amber-600' },
  { id: 'green', emoji: '🎋', name: 'Green Bamboo', color: 'bg-emerald-100 border-emerald-300 text-emerald-600' },
  { id: 'blue', emoji: '🍵', name: 'Blue Tea Pot', color: 'bg-sky-100 border-sky-300 text-sky-600' },
];

export default function PatternWeaveGame() {
  const { patientId } = useActivePatient();
  const [level, setLevel] = useState(1);
  const [sequence, setSequence] = useState<PatternItem[]>([]);
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [isShowingPattern, setIsShowingPattern] = useState(false);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState<number | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [gameWon, setGameWon] = useState(false);
  const [score, setScore] = useState(0);

  // Generate sequence for given level
  const replayPattern = useCallback((targetSeq: PatternItem[]) => {
    setUserSequence([]);
    setIsShowingPattern(true);
    let step = 0;
    const interval = setInterval(() => {
      if (step < targetSeq.length) {
        setActiveHighlightIndex(step);
        playClickSound();
        step++;
      } else {
        setActiveHighlightIndex(null);
        setIsShowingPattern(false);
        clearInterval(interval);
      }
    }, 850);
  }, []);

  const startLevel = useCallback((lvl: number) => {
    const sequenceLength = lvl + 2; // Level 1 = 3 items, Level 2 = 4 items...
    const newSeq: PatternItem[] = [];
    for (let i = 0; i < sequenceLength; i++) {
      const randomItem = PATTERN_ITEMS[Math.floor(Math.random() * PATTERN_ITEMS.length)];
      newSeq.push(randomItem);
    }
    setSequence(newSeq);
    setRetryMessage(null);
    setIsGameOver(false);
    setGameWon(false);
    replayPattern(newSeq);
  }, [replayPattern]);

  useEffect(() => {
    startLevel(1);
  }, [startLevel]);

  const handleItemTap = (itemId: string) => {
    if (isShowingPattern || isGameOver || gameWon) return;

    playClickSound();
    const newUserSeq = [...userSequence, itemId];
    setUserSequence(newUserSeq);

    const currentIndex = newUserSeq.length - 1;
    if (sequence[currentIndex].id !== itemId) {
      // Gentle supportive retry: replay current pattern instead of immediate fail
      setRetryMessage('Let us watch the pattern one more time...');
      setTimeout(() => {
        setRetryMessage(null);
        replayPattern(sequence);
      }, 900);
      return;
    }

    // Correct step
    if (newUserSeq.length === sequence.length) {
      // Completed level!
      playSuccessSound();
      setScore((s) => s + level * 100);

      if (level >= 5) {
        // Win game
        playFanfareSound();
        setGameWon(true);
        logCognitiveSession({
          patientId,
          gameId: 'pattern-weave',
          domain: 'MEMORY',
          moves: Math.max(1, level * 3),
          errors: 0,
          accuracy: 1,
          difficultyLevel: level,
          gridSize: `Level ${level}`,
          score: score + 100,
        });
      } else {
        setTimeout(() => {
          setLevel((l) => l + 1);
          startLevel(level + 1);
        }, 1000);
      }
    }
  };

  const restartGame = () => {
    playClickSound();
    setLevel(1);
    setScore(0);
    startLevel(1);
  };

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto flex flex-col justify-between pb-24">
      <div>
        {/* Header navigation */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/games" className="p-2.5 rounded-full bg-white shadow-soft text-slate-600 hover:bg-slate-50">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">Pattern Weave</h1>
          <button onClick={restartGame} className="p-2.5 rounded-full bg-white shadow-soft text-slate-600 hover:bg-slate-50">
            <RotateCcw size={18} />
          </button>
        </div>

        <FadeIn>
          <div className="text-center mb-6">
            <p className="text-slate-500 text-sm">
              Watch the pattern sequence, then tap the items in the same order!
            </p>
            <div className="flex justify-center gap-6 mt-3">
              <span className="text-sm font-semibold text-slate-700 bg-white px-3 py-1 rounded-full shadow-xs border">
                Level: <strong>{level} / 5</strong>
              </span>
              <span className="text-sm font-semibold text-slate-700 bg-white px-3 py-1 rounded-full shadow-xs border">
                Score: <strong>{score}</strong>
              </span>
            </div>
          </div>
        </FadeIn>

        {/* Pattern Demonstration Banner */}
        <div className="bg-white rounded-3xl p-6 shadow-soft mb-6 text-center border border-slate-100">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">
            {isShowingPattern ? '👀 Watch Carefully...' : '👉 Now Tap The Pattern!'}
          </p>

          <div className="flex justify-center gap-3 min-h-[64px] items-center flex-wrap">
            {sequence.map((item, idx) => {
              const isHighlighted = activeHighlightIndex === idx;
              const isUserStepDone = userSequence.length > idx && userSequence[idx] === item.id;

              return (
                <motion.div
                  key={idx}
                  animate={isHighlighted ? { scale: [1, 1.25, 1] } : {}}
                  className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl transition-all ${
                    isHighlighted
                      ? 'border-peach-500 bg-peach-100 shadow-lg ring-4 ring-peach-300'
                      : isUserStepDone
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-600 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {isShowingPattern ? (isHighlighted ? item.emoji : '❓') : (isUserStepDone ? item.emoji : '❓')}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Interactive Weaving Options */}
        {retryMessage && (
          <p className="text-center text-amber-800 font-bold mb-3 text-sm">{retryMessage}</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          {PATTERN_ITEMS.map((item) => (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.93 }}
              disabled={isShowingPattern || isGameOver || gameWon}
              onClick={() => handleItemTap(item.id)}
              className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 shadow-soft hover:shadow-md transition-all ${item.color} ${
                isShowingPattern ? 'opacity-60 cursor-not-allowed' : 'active:opacity-80'
              }`}
            >
              <span className="text-4xl">{item.emoji}</span>
              <span className="text-sm font-bold">{item.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Game Over / Win Modals */}
      <AnimatePresence>
        {(isGameOver || gameWon) && (
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
              <div className="text-6xl mb-4">{gameWon ? '🎉' : '🌱'}</div>
              <h2 className="text-2xl font-extrabold text-slate-800 mb-2">
                {gameWon ? 'Pattern Master!' : 'Great Effort!'}
              </h2>
              <p className="text-slate-500 mb-6 text-sm">
                {gameWon
                  ? `You completed all pattern weaving levels with a total score of ${score}!`
                  : `You reached Level ${level}. Keep practicing to strengthen memory pattern recall!`}
              </p>
              <Button variant="peach" size="lg" className="w-full" onClick={restartGame}>
                Try Again
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
