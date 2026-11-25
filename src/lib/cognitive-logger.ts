'use client';

import { db } from '@/lib/db';

const GAME_DOMAIN_MAP: Record<string, string> = {
  'guess-faces': 'MEMORY',
  'recognize-voices': 'MEMORY',
  'memory-match': 'MEMORY',
  'color-sequence': 'MEMORY',
  'pattern-weave': 'MEMORY',
  'find-the-item': 'ATTENTION',
  'odd-one-out': 'ATTENTION',
  'shadow-match': 'VISUOSPATIAL',
  'daily-routine': 'EXECUTIVE',
  'sorting-game': 'EXECUTIVE',
  'object-recognition': 'LANGUAGE',
  'word-association': 'LANGUAGE',
  'word-garden': 'LANGUAGE',
  'emotion-recognition': 'SOCIAL',
};

export function getDomainForGame(gameId: string): string {
  const key = gameId.replace(/_/g, '-').toLowerCase();
  return GAME_DOMAIN_MAP[key] || 'MEMORY';
}

export async function logCognitiveSession(params: {
  patientId?: string | null;
  gameId: string;
  domain?: string;
  moves?: number;
  errors?: number;
  avgTimePerMoveSec?: number;
  difficultyLevel?: number;
  gridSize?: string;
  accuracy?: number;
  score?: number;
}) {
  const moves = Math.max(1, Math.round(params.moves ?? 1));
  const errors = Math.max(0, Math.round(params.errors ?? 0));
  const computedAccuracy =
    params.accuracy !== undefined
      ? Math.max(0, Math.min(1, params.accuracy))
      : Math.max(0, Math.min(1, 1 - errors / (moves + errors)));
  const difficultyLevel = Math.min(10, Math.max(1, Math.round(params.difficultyLevel ?? 1)));
  const avgTimePerMoveSec = Math.max(0, Number(params.avgTimePerMoveSec ?? 0));
  const score =
    params.score !== undefined
      ? Math.max(0, Math.round(params.score))
      : Math.round(computedAccuracy * 100);
  const domain = params.domain || getDomainForGame(params.gameId);

  let localLogId: number | undefined;
  try {
    localLogId = await db.gameLogs.add({
      gameType: params.gameId,
      gridSize: params.gridSize || 'Standard',
      moves,
      errors,
      avgTimePerMove: avgTimePerMoveSec,
      difficultyLevel,
      playedAt: new Date().toISOString(),
      synced: false,
    });
  } catch (e) {
    console.error('[CognitiveLogger] Failed to write local game log:', e);
  }

  if (params.patientId && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const res = await fetch(`/api/patients/${params.patientId}/cognitive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: params.gameId,
          domain,
          score,
          accuracy: computedAccuracy,
          reactionTimeMs: avgTimePerMoveSec > 0 ? Math.round(avgTimePerMoveSec * 1000) : undefined,
          errors,
          difficultyLevel,
        }),
      });
      if (res.ok && localLogId !== undefined) {
        await db.gameLogs.update(localLogId, { synced: true });
      }
    } catch {
      // Offline record stays unsynced for background sync
    }
  }
}
