export type VoiceIntentType =
  | 'NEXT_ACTIVITY'
  | 'MEDICATION_STATUS'
  | 'HYDRATION_STATUS'
  | 'LOG_WATER'
  | 'SHOW_FAMILY'
  | 'PLAY_GAME'
  | 'CALL_FAMILY'
  | 'OPEN_CHECK_IN'
  | 'READ_ROUTINE'
  | 'NONE';

export interface ParsedVoiceIntent {
  intent: VoiceIntentType;
  actionLabel?: string;
  targetRoute?: string;
  requiresConfirmation?: boolean;
}

const INTENT_RULES: Array<{
  intent: VoiceIntentType;
  patterns: RegExp[];
  actionLabel?: string;
  targetRoute?: string;
  requiresConfirmation?: boolean;
}> = [
  {
    intent: 'CALL_FAMILY',
    patterns: [/\b(call|phone|ring|dial|sos|help)\b.*\b(daughter|son|family|caregiver|doctor|help)\b/i, /\bcall my\b/i, /\bemergency\b/i],
    actionLabel: 'Open Family Speed-Dial',
    requiresConfirmation: true,
  },
  {
    intent: 'SHOW_FAMILY',
    patterns: [/\b(show|open|see|view)\b.*\b(family|memor|scrapbook|photo)\b/i, /\bfamily photos?\b/i],
    actionLabel: 'Open Family Memories',
    targetRoute: '/scrapbook',
  },
  {
    intent: 'PLAY_GAME',
    patterns: [/\b(play|start|open)\b.*\b(game|memory|puzzle|activity)\b/i, /\bplay a memory game\b/i],
    actionLabel: 'Open Brain Games',
    targetRoute: '/games',
  },
  {
    intent: 'OPEN_CHECK_IN',
    patterns: [/\b(check[- ]?in|how am i feeling|share my mood)\b/i],
    actionLabel: 'Open Check-In',
    targetRoute: '/check-in',
  },
  {
    intent: 'LOG_WATER',
    patterns: [/\b(log|add|drank|had|drink)\b.*\b(water|glass)\b/i],
    actionLabel: 'Log +1 Glass of Water',
  },
  {
    intent: 'MEDICATION_STATUS',
    patterns: [/\b(med|medicine|medication|pill|tablet|dose)\b/i],
  },
  {
    intent: 'HYDRATION_STATUS',
    patterns: [/\b(water|hydration|thirst|ml|glasses)\b/i],
  },
  {
    intent: 'READ_ROUTINE',
    patterns: [/\b(read|show|tell)\b.*\broutine\b/i, /\btoday'?s schedule\b/i],
  },
  {
    intent: 'NEXT_ACTIVITY',
    patterns: [/\bwhat\b.*\bnext\b/i, /\bwhat do i do next\b/i, /\bnext task\b/i],
  },
];

export function parseVoiceIntent(utterance: string): ParsedVoiceIntent {
  const clean = utterance.trim();
  if (!clean) return { intent: 'NONE' };

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((rx) => rx.test(clean))) {
      return {
        intent: rule.intent,
        actionLabel: rule.actionLabel,
        targetRoute: rule.targetRoute,
        requiresConfirmation: rule.requiresConfirmation,
      };
    }
  }

  return { intent: 'NONE' };
}
