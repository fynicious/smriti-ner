'use client';
import { useEffect, useCallback, useRef } from 'react';
import { db, runSyncEngine, getOrCreateDeviceId } from '@/lib/db';

async function resolveSessionPatientId(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session');
    if (!res.ok) return null;
    const session = await res.json();
    const user = session?.user;
    if (!user) return null;
    if (user.role === 'PATIENT' && user.profileId) {
      return String(user.profileId);
    }
    if (user.role === 'CAREGIVER' && Array.isArray(user.patients) && user.patients[0]?.id) {
      return String(user.patients[0].id);
    }
    return null;
  } catch {
    return null;
  }
}

async function pullDeltaToCache(patientId: string) {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  try {
    const res = await fetch(`/api/sync?patientId=${encodeURIComponent(patientId)}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    const existing = await db.patientPreferences.where('patientId').equals(patientId).first();
    const prefPayload = {
      patientId,
      complexityMode: (data.preferences?.complexityMode || 'GUIDED') as 'SIMPLE' | 'GUIDED' | 'FULL',
      scriptPreference: data.preferences?.scriptPreference || null,
      culturalPackId: data.preferences?.culturalPackId || 'ner-as-01',
      reducedMotion: Boolean(data.preferences?.reducedMotion),
      highContrast: Boolean(data.preferences?.highContrast),
      textScale: Number(data.preferences?.textScale) || 1.0,
      voiceEnabled: data.preferences?.voiceEnabled !== false,
      voiceRate: Number(data.preferences?.voiceRate) || 0.85,
      aiEnabled: data.preferences?.aiEnabled !== false,
      aiInteractionStyle: (data.preferences?.aiInteractionStyle || 'BALANCED') as 'CONVERSATIONAL' | 'TASK_FOCUSED' | 'BALANCED',
      caregiverLockEnabled: Boolean(data.preferences?.caregiverLockEnabled),
      hydrationTargetMl: Number(data.hydrationTargetMl) || 2000,
      preferredLanguage: data.patient?.preferredLanguage || 'en',
      updatedAt: data.serverTimestamp || new Date().toISOString(),
    };

    if (existing?.id) {
      await db.patientPreferences.update(existing.id, prefPayload);
    } else {
      await db.patientPreferences.add(prefPayload);
    }
  } catch {
    // Non-fatal offline delta pull
  }
}

async function syncToServer(explicitPatientId?: string) {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  const deviceId = getOrCreateDeviceId();

  const [
    unsyncedGames,
    unsyncedMoods,
    unsyncedWellbeing,
    unsyncedVitals,
    unsyncedReports,
    unsyncedLocations,
  ] = await Promise.all([
    db.gameLogs.filter((g) => !g.synced).toArray(),
    db.moods.filter((m) => !m.synced).toArray(),
    db.wellbeingEntries.filter((w) => !w.synced).toArray(),
    db.vitalLogs.filter((v) => !v.synced).toArray(),
    db.caregiverReports.filter((r) => !r.synced).toArray(),
    db.currentLocation.filter((p) => !p.synced).toArray(),
  ]);

  const patientId = explicitPatientId || (await resolveSessionPatientId());
  if (!patientId) {
    return;
  }

  await runSyncEngine(patientId);

  const totalUnsynced =
    unsyncedGames.length +
    unsyncedMoods.length +
    unsyncedWellbeing.length +
    unsyncedVitals.length +
    unsyncedReports.length +
    unsyncedLocations.length;

  if (totalUnsynced > 0) {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          deviceId,
          gameLogs: unsyncedGames.map((g) => ({
            ...g,
            clientMutationId: `game_${deviceId}_${g.id || '0'}_${g.playedAt}`,
          })),
          moods: unsyncedMoods.map((m) => ({
            ...m,
            clientMutationId: `mood_${deviceId}_${m.id || '0'}_${m.recordedAt}`,
          })),
          wellbeingEntries: unsyncedWellbeing.map((w) => ({
            clientMutationId: w.clientMutationId || `wb_${deviceId}_${w.id || '0'}_${w.timestamp}`,
            date: w.date,
            timestamp: w.timestamp,
            source: w.source,
            mood: w.mood,
            sleepQuality: w.sleepQuality,
            confusionLevel: w.confusionLevel,
            energyLevel: w.energyLevel,
            painLevel: w.painLevel,
            overallWellbeing: w.overallWellbeing,
            notes: w.notes,
          })),
          vitalLogs: unsyncedVitals.map((v) => ({
            clientMutationId: `vit_${deviceId}_${v.id || '0'}_${v.date}`,
            weight: v.weight,
            sysBp: v.sysBp,
            diaBp: v.diaBp,
            heartRate: v.heartRate,
            recordedAt: v.date,
          })),
          caregiverReports: unsyncedReports.map((r) => ({
            clientMutationId: `rep_${deviceId}_${r.id || '0'}_${r.date}`,
            reportType: r.reportType,
            appetite: r.appetite,
            sleep: r.sleep,
            notes: r.notes,
            createdAt: r.date,
          })),
          locationPings: unsyncedLocations.map((p) => ({
            clientMutationId: `loc_${deviceId}_${p.id || '0'}_${p.timestamp}`,
            lat: p.lat,
            lng: p.lng,
            accuracy: p.accuracy,
            status: p.status,
            insideZoneId: p.insideZoneId,
            recordedAt: p.timestamp,
          })),
        }),
      });

      if (response.ok) {
        const gameIds = unsyncedGames.map((g) => g.id!).filter(Boolean);
        const moodIds = unsyncedMoods.map((m) => m.id!).filter(Boolean);
        const wellbeingIds = unsyncedWellbeing.map((w) => w.id!).filter(Boolean);
        const vitalIds = unsyncedVitals.map((v) => v.id!).filter(Boolean);
        const reportIds = unsyncedReports.map((r) => r.id!).filter(Boolean);
        const locationIds = unsyncedLocations.map((p) => p.id!).filter(Boolean);

        await db.transaction(
          'rw',
          [db.gameLogs, db.moods, db.wellbeingEntries, db.vitalLogs, db.caregiverReports, db.currentLocation],
          async () => {
            if (gameIds.length) await db.gameLogs.where('id').anyOf(gameIds).modify({ synced: true });
            if (moodIds.length) await db.moods.where('id').anyOf(moodIds).modify({ synced: true });
            if (wellbeingIds.length) await db.wellbeingEntries.where('id').anyOf(wellbeingIds).modify({ synced: true });
            if (vitalIds.length) await db.vitalLogs.where('id').anyOf(vitalIds).modify({ synced: true });
            if (reportIds.length) await db.caregiverReports.where('id').anyOf(reportIds).modify({ synced: true });
            if (locationIds.length) await db.currentLocation.where('id').anyOf(locationIds).modify({ synced: true });
          }
        );
      }
    } catch (error) {
      console.warn('[Sync] Push failed, preserving local records:', error);
    }
  }

  await pullDeltaToCache(patientId);
}

export function useSync(patientId?: string) {
  const isSyncing = useRef(false);

  const handleSync = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    try {
      await syncToServer(patientId);
    } finally {
      isSyncing.current = false;
    }
  }, [patientId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (navigator.onLine) {
      handleSync();
    }

    window.addEventListener('online', handleSync);
    return () => {
      window.removeEventListener('online', handleSync);
    };
  }, [handleSync]);

  return { syncNow: handleSync };
}
