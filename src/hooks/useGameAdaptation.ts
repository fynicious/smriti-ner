'use client';

import { useState, useCallback, useRef } from 'react';
import { calculateNextDifficulty } from '@/lib/ai-difficulty';
import { logCognitiveSession, getDomainForGame } from '@/lib/cognitive-logger';
import { useActivePatient } from '@/hooks/useActivePatient';

export function useGameAdaptation(gameId: string, domain?: string) {
  const { patientId } = useActivePatient();
  const [difficultyLevel, setDifficultyLevel] = useState(2);
  const [showHint, setShowHint] = useState(false);
  const [gridSize, setGridSize] = useState<[number, number]>([2, 3]);
  const [optionsCount, setOptionsCount] = useState(4);

  const moveTimes = useRef<number[]>([]);
  const errorCount = useRef(0);
  const gameStartTime = useRef(Date.now());

  const recordMove = useCallback((timeTaken: number, isMatch: boolean) => {
    moveTimes.current.push(timeTaken);
    if (!isMatch) {
      errorCount.current++;
    }

    if (errorCount.current >= 3 && !isMatch) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 2000);
    }
  }, []);

  const recordGameEnd = useCallback(
    async (totalMoves: number, overrideAccuracy?: number) => {
      const totalTime = (Date.now() - gameStartTime.current) / 1000;
      const avgTime =
        moveTimes.current.length > 0
          ? moveTimes.current.reduce((a, b) => a + b, 0) / moveTimes.current.length
          : 0;
      const errors = errorCount.current;

      const aiResponse = calculateNextDifficulty({
        gameId,
        currentDifficulty: difficultyLevel,
        timeTaken: totalTime,
        errors,
        expectedTimePerLevel: 20 + difficultyLevel * 5,
      });

      await logCognitiveSession({
        patientId,
        gameId,
        domain: domain || getDomainForGame(gameId),
        moves: totalMoves,
        errors,
        avgTimePerMoveSec: avgTime,
        difficultyLevel: aiResponse.newDifficulty,
        gridSize: aiResponse.gridSize ? `${aiResponse.gridSize[0]}x${aiResponse.gridSize[1]}` : 'Standard',
        accuracy: overrideAccuracy,
      });

      setDifficultyLevel(aiResponse.newDifficulty);
      if (aiResponse.gridSize) setGridSize(aiResponse.gridSize);
      if (aiResponse.optionsCount) setOptionsCount(aiResponse.optionsCount);

      moveTimes.current = [];
      errorCount.current = 0;
      gameStartTime.current = Date.now();
    },
    [difficultyLevel, domain, gameId, patientId]
  );

  return {
    difficultyLevel,
    gridSize,
    optionsCount,
    recordMove,
    recordGameEnd,
    showHint,
  };
}
