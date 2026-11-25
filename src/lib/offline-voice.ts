'use client';

import { db } from '@/lib/db';

export type CorePhraseKey =
  | 'drink_water'
  | 'take_medicine'
  | 'good_morning'
  | 'call_family'
  | 'open_games';

/**
 * Offline Phrase Fallback Strategy (Decision Record #3):
 * Prioritizes caregiver-recorded / native-speaker cached audio clips inside IndexedDB before
 * falling back cleanly to live Web Speech synthesis (without ever silently substituting an unrelated dialect).
 */
export async function saveOfflinePhraseRecording(params: {
  patientId: string;
  phraseKey: CorePhraseKey;
  speakerName: string;
  audioBase64: string;
}) {
  await db.voiceReminders.add({
    patientId: params.patientId,
    routineType: `phrase:${params.phraseKey}`,
    title: params.phraseKey.replace('_', ' '),
    time: '00:00',
    speakerName: params.speakerName,
    audioBase64: params.audioBase64,
    isActive: true,
    synced: false,
  });
}

export async function playRecordedPhraseOrFallback(params: {
  patientId?: string | null;
  phraseKey: CorePhraseKey;
  fallbackText: string;
  speechCode?: string;
  rate?: number;
}): Promise<'RECORDED_AUDIO' | 'SYNTHESIZED_TTS' | 'VISUAL_ONLY'> {
  if (params.patientId) {
    const match = await db.voiceReminders
      .where('patientId')
      .equals(params.patientId)
      .filter((v) => v.isActive && v.routineType === `phrase:${params.phraseKey}`)
      .first();

    if (match?.audioBase64) {
      try {
        const audio = new Audio(match.audioBase64);
        await audio.play();
        return 'RECORDED_AUDIO';
      } catch {
        // Fall through if autoplay restricted
      }
    }
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window && params.speechCode) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(params.fallbackText);
    u.lang = params.speechCode;
    u.rate = params.rate || 0.85;
    window.speechSynthesis.speak(u);
    return 'SYNTHESIZED_TTS';
  }

  return 'VISUAL_ONLY';
}
