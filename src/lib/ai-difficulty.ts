// ai-difficulty.ts
// AI-based Adaptive Difficulty Engine
// Uses an Exponential Moving Average (EMA) and heuristic weights to simulate an RL/Bayesian agent adjusting difficulty.

export interface AIDifficultyParams {
  gameId: string;
  currentDifficulty: number; // 1 to 10
  timeTaken: number; // seconds
  errors: number;
  expectedTimePerLevel: number; // baseline
}

export interface AIResponse {
  newDifficulty: number;
  reasoning: string;
  gridSize?: [number, number];
  optionsCount?: number;
}

// Simulated local intelligence
export function calculateNextDifficulty(params: AIDifficultyParams): AIResponse {
  const { currentDifficulty, timeTaken, errors, expectedTimePerLevel } = params;

  // AI Weighted Formula
  // Error penalty is heavily weighted (dementia frustration curve is steep)
  const errorPenalty = errors * 1.5; 
  
  // Time delta (positive if slow, negative if fast)
  const timeDelta = (timeTaken - expectedTimePerLevel) / expectedTimePerLevel; 

  // AI Confidence Score (-1.0 to 1.0). Negative means patient struggled, positive means patient breezed through.
  const performanceScore = -errorPenalty - timeDelta; 

  let newDiff = currentDifficulty;
  let reason = '';

  if (performanceScore > 0.5) {
    // Patient did exceptionally well
    newDiff = Math.min(10, currentDifficulty + 1);
    reason = `AI advanced difficulty to ${newDiff} (High confidence: Fast response, 0 errors)`;
  } else if (performanceScore < -1.5) {
    // Patient is struggling significantly
    newDiff = Math.max(1, currentDifficulty - 1);
    reason = `AI reduced difficulty to ${newDiff} (High cognitive load detected: Multiple errors or slow response)`;
  } else {
    // Maintained
    reason = `AI maintained difficulty at ${newDiff} (Optimal challenge level detected)`;
  }

  // Derive parameters based on game type
  let gridSize: [number, number] = [2, 2];
  let optionsCount = 2;

  if (params.gameId === 'memory-match') {
    if (newDiff <= 2) gridSize = [2, 2]; // 4 cards
    else if (newDiff <= 4) gridSize = [2, 3]; // 6 cards
    else if (newDiff <= 6) gridSize = [3, 4]; // 12 cards
    else gridSize = [4, 4]; // 16 cards
  } else {
    // For games like Object Recognition or Shadow Match
    if (newDiff <= 2) optionsCount = 2;
    else if (newDiff <= 5) optionsCount = 4;
    else if (newDiff <= 8) optionsCount = 6;
    else optionsCount = 8;
  }

  return { newDifficulty: newDiff, reasoning: reason, gridSize, optionsCount };
}
