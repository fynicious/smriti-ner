'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/ui';
import { useGameAdaptation } from '@/hooks/useGameAdaptation';
import { useI18n } from '@/contexts/I18nProvider';
import { GameContainer } from '@/components/games/GameContainer';

import { useActivePatient } from '@/hooks/useActivePatient';
import { usePatientPreferences } from '@/hooks/usePatientPreferences';
import { getCulturalPack } from '@/lib/regional-content';

interface CardData {
  uniqueId: string;
  id: string;
  imageUrl: string;
  label: string;
  isFlipped: boolean;
  isMatched: boolean;
}

function generateBoard(rows: number, cols: number, packId?: string | null): CardData[] {
  const totalPairs = Math.floor((rows * cols) / 2);
  const pack = getCulturalPack(packId);
  const selected = pack.cognitiveObjects.slice(0, totalPairs);
  const pairs = [...selected, ...selected];

  // Shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }

  return pairs.map((obj, index) => ({
    uniqueId: `${obj.id}-${index}`,
    id: obj.id,
    imageUrl: obj.imageUrl,
    label: obj.label,
    isFlipped: false,
    isMatched: false,
  }));
}

export default function MemoryMatchGame() {
  const { gridSize, recordMove, recordGameEnd, showHint } = useGameAdaptation('memory-match');
  const { patientId } = useActivePatient();
  const { preferences } = usePatientPreferences(patientId);
  const { t } = useI18n();
  const [rows, cols] = gridSize;
  const [cards, setCards] = useState<CardData[]>([]);
  const [flippedCards, setFlippedCards] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const moveStartTime = useRef<number>(Date.now());

  const startNewGame = useCallback(() => {
    setCards(generateBoard(rows, cols, preferences.culturalPackId));
    setFlippedCards([]);
    setMoves(0);
    setIsWon(false);
    setIsLocked(false);
    moveStartTime.current = Date.now();
  }, [rows, cols, preferences.culturalPackId]);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  useEffect(() => {
    if (showHint && cards.length > 0) {
      setCards((prev) => prev.map((c) => ({ ...c, isFlipped: true })));
      setIsLocked(true);
      const timer = setTimeout(() => {
        setCards((prev) => prev.map((c) => (c.isMatched ? c : { ...c, isFlipped: false })));
        setIsLocked(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showHint, cards.length]);

  const handleCardClick = (uniqueId: string) => {
    if (isLocked || flippedCards.length >= 2 || flippedCards.includes(uniqueId)) return;
    
    const card = cards.find((c) => c.uniqueId === uniqueId);
    if (!card || card.isFlipped || card.isMatched) return;

    const newFlipped = [...flippedCards, uniqueId];
    setCards((prev) => prev.map((c) => (c.uniqueId === uniqueId ? { ...c, isFlipped: true } : c)));
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setIsLocked(true);
      setMoves((m) => m + 1);

      const timeTaken = (Date.now() - moveStartTime.current) / 1000;
      const first = cards.find((c) => c.uniqueId === newFlipped[0])!;
      const second = cards.find((c) => c.uniqueId === newFlipped[1])!;
      const isMatch = first.id === second.id;

      recordMove(timeTaken, isMatch);

      // AUDIO FEEDBACK (Regional Master Prompt Point 15)
      if (window.speechSynthesis) {
        const text = isMatch ? `Match found: ${second.label}` : second.label;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-IN';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }

      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) =>
            newFlipped.includes(c.uniqueId)
              ? { ...c, isFlipped: isMatch ? true : false, isMatched: isMatch ? true : c.isMatched }
              : c
          )
        );
        setFlippedCards([]);
        setIsLocked(false);
        moveStartTime.current = Date.now();
      }, isMatch ? 600 : 1200);
    } else {
      // Speak the first card flipped
      if (window.speechSynthesis) {
         const utterance = new SpeechSynthesisUtterance(card.label);
         utterance.lang = 'en-IN';
         window.speechSynthesis.speak(utterance);
      }
    }
  };

  useEffect(() => {
    if (cards.length > 0 && cards.every((c) => c.isMatched) && !isWon) {
      setIsWon(true);
      recordGameEnd(moves);
    }
  }, [cards, moves, recordGameEnd, isWon]);

  return (
    <GameContainer title={t.memoryMatch} subtitle={`${t.moves}: ${moves} | Grid: ${rows}x${cols}`} isWon={isWon} onRestart={startNewGame} skipAutoLog>
      <FadeIn delay={0.15}>
        <div
          className="grid gap-2 sm:gap-3 mx-auto mt-4 sm:mt-6 w-full"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, maxWidth: cols * 96 }}
        >
          {cards.map((card) => (
            <motion.button
              key={card.uniqueId}
              layout
              onClick={() => handleCardClick(card.uniqueId)}
              whileTap={!isLocked && !card.isMatched && !card.isFlipped ? { scale: 0.95 } : {}}
              className={`aspect-square rounded-2xl text-4xl flex items-center justify-center transition-colors duration-300 min-h-[70px] ${
                card.isMatched
                  ? 'bg-mint-200 shadow-none'
                  : card.isFlipped
                  ? 'bg-peach-100 shadow-soft'
                  : 'bg-white shadow-soft hover:shadow-md'
              }`}
            >
              <AnimatePresence mode="wait">
                {card.isFlipped || card.isMatched ? (
                  <motion.div
                    key="front"
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full p-2"
                  >
                    <img
                      src={card.imageUrl}
                      alt={card.label}
                      className="w-full h-full object-contain rounded-xl"
                      loading="lazy"
                    />
                  </motion.div>
                ) : (
                  <motion.span
                    key="back"
                    initial={{ rotateY: -90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-slate-600 text-2xl font-bold"
                  >
                    ?
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </FadeIn>
    </GameContainer>
  );
}
