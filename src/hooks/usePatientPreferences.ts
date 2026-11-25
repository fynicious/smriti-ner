'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db';

export type ComplexityMode = 'SIMPLE' | 'GUIDED' | 'FULL';
export type AiInteractionStyle = 'CONVERSATIONAL' | 'TASK_FOCUSED' | 'BALANCED';

export interface PatientPreferencesState {
  complexityMode: ComplexityMode;
  scriptPreference: string | null;
  culturalPackId: string;
  reducedMotion: boolean;
  highContrast: boolean;
  textScale: number;
  voiceEnabled: boolean;
  voiceRate: number;
  aiEnabled: boolean;
  aiInteractionStyle: AiInteractionStyle;
  caregiverLockEnabled: boolean;
  hasCaregiverLockPin?: boolean;
  preferredLanguage: string;
  hydrationTargetMl: number;
}

export const DEFAULT_PATIENT_PREFERENCES: PatientPreferencesState = {
  complexityMode: 'GUIDED',
  scriptPreference: null,
  culturalPackId: 'ner-as-01',
  reducedMotion: false,
  highContrast: false,
  textScale: 1.0,
  voiceEnabled: true,
  voiceRate: 0.85,
  aiEnabled: true,
  aiInteractionStyle: 'BALANCED',
  caregiverLockEnabled: false,
  hasCaregiverLockPin: false,
  preferredLanguage: 'en',
  hydrationTargetMl: 2000,
};

export function usePatientPreferences(patientId?: string | null) {
  const [preferences, setPreferences] = useState<PatientPreferencesState>(DEFAULT_PATIENT_PREFERENCES);
  const [loading, setLoading] = useState(false);

  const loadPreferences = useCallback(async () => {
    if (!patientId) {
      setPreferences(DEFAULT_PATIENT_PREFERENCES);
      return;
    }

    setLoading(true);
    try {
      // Load local Dexie cache first for instant offline startup
      const cached = await db.patientPreferences.where('patientId').equals(patientId).first();
      if (cached) {
        setPreferences({
          complexityMode: cached.complexityMode || 'GUIDED',
          scriptPreference: cached.scriptPreference ?? null,
          culturalPackId: cached.culturalPackId || 'ner-as-01',
          reducedMotion: Boolean(cached.reducedMotion),
          highContrast: Boolean(cached.highContrast),
          textScale: Number(cached.textScale) || 1.0,
          voiceEnabled: cached.voiceEnabled !== false,
          voiceRate: Number(cached.voiceRate) || 0.85,
          aiEnabled: cached.aiEnabled !== false,
          aiInteractionStyle: cached.aiInteractionStyle || 'BALANCED',
          caregiverLockEnabled: Boolean(cached.caregiverLockEnabled),
          preferredLanguage: cached.preferredLanguage || 'en',
          hydrationTargetMl: Number(cached.hydrationTargetMl) || 2000,
        });
      }

      if (typeof window !== 'undefined' && navigator.onLine) {
        const res = await fetch(`/api/patients/${patientId}/preferences`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.preferences) {
            const p = data.preferences;
            const nextState: PatientPreferencesState = {
              complexityMode: (['SIMPLE', 'GUIDED', 'FULL'].includes(p.complexityMode)
                ? p.complexityMode
                : 'GUIDED') as ComplexityMode,
              scriptPreference: p.scriptPreference ?? null,
              culturalPackId: p.culturalPackId || 'ner-as-01',
              reducedMotion: Boolean(p.reducedMotion),
              highContrast: Boolean(p.highContrast),
              textScale: Number(p.textScale) || 1.0,
              voiceEnabled: p.voiceEnabled !== false,
              voiceRate: Number(p.voiceRate) || 0.85,
              aiEnabled: p.aiEnabled !== false,
              aiInteractionStyle: (['CONVERSATIONAL', 'TASK_FOCUSED', 'BALANCED'].includes(p.aiInteractionStyle)
                ? p.aiInteractionStyle
                : 'BALANCED') as AiInteractionStyle,
              caregiverLockEnabled: Boolean(p.caregiverLockEnabled),
              hasCaregiverLockPin: Boolean(p.hasCaregiverLockPin),
              preferredLanguage: p.preferredLanguage || 'en',
              hydrationTargetMl: Number(p.hydrationTargetMl) || 2000,
            };
            setPreferences(nextState);

            const record = {
              patientId,
              complexityMode: nextState.complexityMode,
              scriptPreference: nextState.scriptPreference,
              culturalPackId: nextState.culturalPackId,
              reducedMotion: nextState.reducedMotion,
              highContrast: nextState.highContrast,
              textScale: nextState.textScale,
              voiceEnabled: nextState.voiceEnabled,
              voiceRate: nextState.voiceRate,
              aiEnabled: nextState.aiEnabled,
              aiInteractionStyle: nextState.aiInteractionStyle,
              caregiverLockEnabled: nextState.caregiverLockEnabled,
              hydrationTargetMl: nextState.hydrationTargetMl,
              preferredLanguage: nextState.preferredLanguage,
              updatedAt: new Date().toISOString(),
            };
            if (cached?.id) {
              await db.patientPreferences.update(cached.id, record);
            } else {
              await db.patientPreferences.add(record);
            }
          }
        }
      }
    } catch {
      // Preserve offline preference state silently
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return { preferences, loading, refreshPreferences: loadPreferences };
}
