import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { getLocalDateString } from '@/lib/dateUtils';
import { encryptSensitiveField } from '@/lib/crypto-envelope';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

interface SyncMoodItem {
  clientMutationId?: string;
  mood?: string;
  moodScore?: number;
  recordedAt?: string;
}

interface SyncGameItem {
  clientMutationId?: string;
  gameType?: string;
  domain?: string;
  moves?: number;
  errors?: number;
  avgTimePerMove?: number;
  difficultyLevel?: number;
  score?: number;
  accuracy?: number;
  playedAt?: string;
}

interface SyncHydrationItem {
  clientMutationId?: string;
  amountMl?: number;
  timestamp?: string;
}

interface SyncWellbeingItem {
  clientMutationId?: string;
  date?: string;
  timestamp?: string;
  source?: string;
  mood?: number;
  sleepQuality?: number;
  confusionLevel?: number;
  energyLevel?: number;
  painLevel?: number;
  overallWellbeing?: number;
  notes?: string;
}

interface SyncVitalItem {
  clientMutationId?: string;
  weight?: number;
  sysBp?: number;
  diaBp?: number;
  heartRate?: number;
  recordedAt?: string;
}

interface SyncCaregiverReportItem {
  clientMutationId?: string;
  reportType?: string;
  appetite?: string;
  sleep?: string;
  notes?: string;
  createdAt?: string;
}

interface SyncRoutineOccurrenceItem {
  clientMutationId?: string;
  routineId?: string;
  date?: string;
  status?: string;
  completedAt?: string;
  completedBy?: string;
}

interface SyncMedicationEventItem {
  clientMutationId?: string;
  medicationId?: string;
  action?: string;
  scheduledTime?: string;
  actualTime?: string;
  source?: string;
}

interface SyncLocationPingItem {
  clientMutationId?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  status?: string;
  insideZoneId?: string;
  recordedAt?: string;
}

const MOOD_TEXT_TO_SCORE: Record<string, number> = {
  happy: 5,
  calm: 4,
  okay: 3,
  anxious: 2,
  confused: 1,
};

function clampScale(val: unknown, fallback = 3, min = 1, max = 5): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseDateOrNow(raw: unknown): Date {
  if (typeof raw === 'string' && !Number.isNaN(Date.parse(raw))) {
    return new Date(raw);
  }
  return new Date();
}

function deterministicMutationId(prefix: string, payload: unknown): string {
  const hash = crypto.createHash('sha256').update(`${prefix}:${JSON.stringify(payload)}`).digest('hex').slice(0, 24);
  return `${prefix}_${hash}`;
}

/**
 * Delta Pull Synchronization (SMRITI v1.0 Section 12.3):
 * Returns patient preferences, routines, medications, hydration, and authorized memories updated since timestamp.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedPatientId = searchParams.get('patientId') || undefined;
    const { patientId } = await RBAC.requirePatientAccess(
      requestedPatientId,
      ['PATIENT', 'CAREGIVER', 'CLINICIAN'],
      'view_routines'
    );

    if (!patientId) {
      throw new BadRequestError('An active patient profile is required for delta sync');
    }

    const sinceParam = searchParams.get('since');
    const sinceDate = sinceParam && !Number.isNaN(Date.parse(sinceParam)) ? new Date(sinceParam) : null;
    const today = getLocalDateString();

    const [
      patient,
      preferences,
      hydrationTarget,
      routines,
      occurrences,
      medications,
      scrapbookEntries,
      familyAssets,
      consents,
    ] = await Promise.all([
      prisma.patientProfile.findUnique({
        where: { id: patientId },
        select: { id: true, fullName: true, preferredLanguage: true, retentionDays: true },
      }),
      prisma.patientPreference.findUnique({ where: { patientId } }),
      prisma.hydrationTarget.findFirst({
        where: { patientId },
        orderBy: { effectiveFrom: 'desc' },
      }),
      prisma.dailyRoutine.findMany({
        where: { patientId, isActive: true, ...(sinceDate ? { updatedAt: { gte: sinceDate } } : {}) },
        orderBy: { time: 'asc' },
      }),
      prisma.routineOccurrence.findMany({
        where: { patientId, date: today },
      }),
      prisma.medication.findMany({
        where: { patientId, status: 'ACTIVE' },
        include: {
          events: {
            where: { status: 'ACTIVE', scheduledTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.scrapbookEntry.findMany({
        where: { patientId, visibilityScope: { not: 'HIDDEN' } },
        orderBy: { dateAdded: 'desc' },
        take: 40,
      }),
      prisma.familyAsset.findMany({
        where: { patientId, isActive: true, visibilityScope: { not: 'HIDDEN' } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.consentRecord.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return NextResponse.json({
      success: true,
      serverTimestamp: new Date().toISOString(),
      patient: patient
        ? {
            ...patient,
            emergencyContact: undefined,
          }
        : null,
      preferences: preferences || {
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
      },
      hydrationTargetMl: hydrationTarget?.targetMl || 2000,
      routines,
      occurrences,
      medications,
      scrapbookEntries,
      familyAssets,
      consents,
    });
  } catch (error) {
    return handleApiError(error, 'Sync Delta GET');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestedPatientId = typeof body.patientId === 'string' ? body.patientId : undefined;
    const { user, patientId } = await RBAC.requirePatientAccess(
      requestedPatientId,
      ['PATIENT', 'CAREGIVER'],
      'view_routines'
    );

    if (!patientId) {
      throw new BadRequestError('An active patient profile is required for synchronization');
    }

    const deviceId = typeof body.deviceId === 'string' && body.deviceId.trim()
      ? body.deviceId.trim().slice(0, 80)
      : 'unknown-device';

    const moods: SyncMoodItem[] = Array.isArray(body.moods) ? body.moods.slice(0, 50) : [];
    const gameLogs: SyncGameItem[] = Array.isArray(body.gameLogs) ? body.gameLogs.slice(0, 50) : [];
    const hydrationEvents: SyncHydrationItem[] = Array.isArray(body.hydrationEvents) ? body.hydrationEvents.slice(0, 50) : [];
    const wellbeingEntries: SyncWellbeingItem[] = Array.isArray(body.wellbeingEntries) ? body.wellbeingEntries.slice(0, 50) : [];
    const vitalLogs: SyncVitalItem[] = Array.isArray(body.vitalLogs) ? body.vitalLogs.slice(0, 50) : [];
    const caregiverReports: SyncCaregiverReportItem[] = Array.isArray(body.caregiverReports) ? body.caregiverReports.slice(0, 50) : [];
    const routineOccurrences: SyncRoutineOccurrenceItem[] = Array.isArray(body.routineOccurrences) ? body.routineOccurrences.slice(0, 50) : [];
    const medicationEvents: SyncMedicationEventItem[] = Array.isArray(body.medicationEvents) ? body.medicationEvents.slice(0, 50) : [];
    const locationPings: SyncLocationPingItem[] = Array.isArray(body.locationPings) ? body.locationPings.slice(0, 50) : [];

    const validRoutineIds = new Set<string>();
    if (routineOccurrences.length > 0) {
      const existingRoutines = await prisma.dailyRoutine.findMany({
        where: { patientId },
        select: { id: true },
      });
      existingRoutines.forEach((r) => validRoutineIds.add(r.id));
    }

    const validMedIds = new Set<string>();
    if (medicationEvents.length > 0) {
      const meds = await prisma.medication.findMany({
        where: { patientId, status: 'ACTIVE' },
        select: { id: true },
      });
      meds.forEach((m) => validMedIds.add(m.id));
    }

    const counts = await prisma.$transaction(async (tx) => {
      let moodCount = 0;
      let gameCount = 0;
      let hydrationCount = 0;
      let wellbeingCount = 0;
      let vitalCount = 0;
      let reportCount = 0;
      let routineCount = 0;
      let medicationCount = 0;
      let pingCount = 0;
      let deduplicatedCount = 0;
      let conflictsCount = 0;

      const claimMutation = async (
        explicitId: string | undefined,
        fallbackPrefix: string,
        rawItem: unknown,
        recordType: string,
        clientDate?: Date
      ): Promise<{ apply: boolean; mutationKey: string }> => {
        const mutationKey =
          typeof explicitId === 'string' && explicitId.trim()
            ? explicitId.trim().slice(0, 80)
            : deterministicMutationId(fallbackPrefix, rawItem);

        const existing = await tx.syncMutation.findUnique({
          where: {
            patientId_clientMutationId: {
              patientId,
              clientMutationId: mutationKey,
            },
          },
          select: { id: true },
        });

        if (existing) {
          deduplicatedCount += 1;
          return { apply: false, mutationKey };
        }

        await tx.syncMutation.create({
          data: {
            patientId,
            clientMutationId: mutationKey,
            deviceId,
            recordType,
            status: 'APPLIED',
            clientCreatedAt: clientDate || new Date(),
          },
        });
        return { apply: true, mutationKey };
      };

      const markMutationMeta = async (mutationKey: string, entityId: string, status = 'APPLIED', conflictDetail?: string) => {
        await tx.syncMutation.update({
          where: { patientId_clientMutationId: { patientId, clientMutationId: mutationKey } },
          data: { entityId, status, ...(conflictDetail ? { conflictDetail } : {}) },
        });
      };

      for (const m of moods) {
        const recDate = parseDateOrNow(m.recordedAt);
        const claim = await claimMutation(m.clientMutationId, 'mood', m, 'MOOD', recDate);
        if (!claim.apply) continue;
        const mappedScore =
          typeof m.moodScore === 'number'
            ? clampScale(m.moodScore, 3)
            : MOOD_TEXT_TO_SCORE[(m.mood || '').toLowerCase()] ?? 3;
        const created = await tx.moodRecord.create({
          data: {
            patientId,
            moodScore: mappedScore,
            note: m.mood ? `Mood: ${String(m.mood).slice(0, 80)}` : null,
            clientMutationId: claim.mutationKey,
            deviceId,
            recordedAt: recDate,
          },
        });
        await markMutationMeta(claim.mutationKey, created.id);
        moodCount += 1;
      }

      for (const g of gameLogs) {
        const playedAt = parseDateOrNow(g.playedAt);
        const claim = await claimMutation(g.clientMutationId, 'game', g, 'COGNITIVE_SESSION', playedAt);
        if (!claim.apply) continue;
        const errors = Math.max(0, Math.round(Number(g.errors) || 0));
        const moves = Math.max(1, Math.round(Number(g.moves) || 1));
        const computedAcc = Math.max(0, Math.min(1, 1 - errors / (moves + errors)));
        const accuracy = typeof g.accuracy === 'number' && Number.isFinite(g.accuracy)
          ? Math.max(0, Math.min(1, g.accuracy))
          : computedAcc;
        const difficultyLevel = Math.min(10, Math.max(1, Math.round(Number(g.difficultyLevel) || 1)));
        const reactionTimeMs = g.avgTimePerMove ? Math.round(Number(g.avgTimePerMove) * 1000) : null;
        const score = typeof g.score === 'number' && Number.isFinite(g.score)
          ? Math.min(100, Math.max(0, Math.round(g.score)))
          : Math.round(accuracy * 100);

        const created = await tx.cognitiveSession.create({
          data: {
            patientId,
            gameId: typeof g.gameType === 'string' && g.gameType.trim() ? g.gameType.trim().slice(0, 60) : 'unknown_game',
            domain: typeof g.domain === 'string' && g.domain.trim() ? g.domain.trim().slice(0, 30) : 'MEMORY',
            difficultyLevel,
            score,
            accuracy,
            reactionTimeMs,
            errors,
            clientMutationId: claim.mutationKey,
            deviceId,
            completedAt: playedAt,
          },
        });
        await markMutationMeta(claim.mutationKey, created.id);
        gameCount += 1;
      }

      for (const h of hydrationEvents) {
        const ts = parseDateOrNow(h.timestamp);
        const amountMl = Math.round(Number(h.amountMl) || 0);
        if (amountMl < 10 || amountMl > 2500) continue;
        const claim = await claimMutation(h.clientMutationId, 'hyd', h, 'HYDRATION', ts);
        if (!claim.apply) continue;

        const created = await tx.hydrationEvent.create({
          data: {
            patientId,
            amountMl,
            timestamp: ts,
            clientMutationId: claim.mutationKey,
            deviceId,
            status: 'ACTIVE',
          },
        });
        await markMutationMeta(claim.mutationKey, created.id);
        hydrationCount += 1;
      }

      for (const w of wellbeingEntries) {
        const ts = parseDateOrNow(w.timestamp);
        const claim = await claimMutation(w.clientMutationId, 'wb', w, 'WELLBEING', ts);
        if (!claim.apply) continue;
        const date = typeof w.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.date)
          ? w.date
          : getLocalDateString(ts);
        const rawNotes = typeof w.notes === 'string' && w.notes.trim() ? w.notes.trim().slice(0, 500) : null;
        const created = await tx.wellbeingEntry.create({
          data: {
            patientId,
            date,
            timestamp: ts,
            recordedBy: user.id,
            source: user.role === 'CAREGIVER' ? 'CAREGIVER_OBSERVED' : 'PATIENT_REPORTED',
            mood: clampScale(w.mood, 0, -1, 3),
            sleepQuality: clampScale(w.sleepQuality, 0, -1, 3),
            confusionLevel: clampScale(w.confusionLevel, 0, -1, 3),
            energyLevel: clampScale(w.energyLevel, 0, -1, 3),
            painLevel: clampScale(w.painLevel, 0, -1, 3),
            overallWellbeing: clampScale(w.overallWellbeing, 0, -1, 3),
            notes: rawNotes ? encryptSensitiveField(rawNotes, patientId) : null,
            clientMutationId: claim.mutationKey,
            deviceId,
          },
        });
        await markMutationMeta(claim.mutationKey, created.id);
        wellbeingCount += 1;
      }

      for (const v of vitalLogs) {
        const recAt = parseDateOrNow(v.recordedAt);
        const weight = Number.isFinite(Number(v.weight)) && Number(v.weight) >= 20 && Number(v.weight) <= 300
          ? Number(v.weight)
          : null;
        const sysBp = Number.isFinite(Number(v.sysBp)) && Number(v.sysBp) >= 50 && Number(v.sysBp) <= 260
          ? Math.round(Number(v.sysBp))
          : null;
        const diaBp = Number.isFinite(Number(v.diaBp)) && Number(v.diaBp) >= 30 && Number(v.diaBp) <= 160
          ? Math.round(Number(v.diaBp))
          : null;
        const heartRate = Number.isFinite(Number(v.heartRate)) && Number(v.heartRate) >= 25 && Number(v.heartRate) <= 240
          ? Math.round(Number(v.heartRate))
          : null;

        if (weight === null && sysBp === null && diaBp === null && heartRate === null) continue;
        const claim = await claimMutation(v.clientMutationId, 'vit', v, 'VITAL', recAt);
        if (!claim.apply) continue;

        const created = await tx.vitalLog.create({
          data: {
            patientId,
            weight,
            sysBp,
            diaBp,
            heartRate,
            clientMutationId: claim.mutationKey,
            deviceId,
            recordedAt: recAt,
          },
        });
        await markMutationMeta(claim.mutationKey, created.id);
        vitalCount += 1;
      }

      if (user.role === 'CAREGIVER' && user.profileId) {
        for (const r of caregiverReports) {
          if (!r.notes && !r.appetite && !r.sleep) continue;
          const crAt = parseDateOrNow(r.createdAt);
          const claim = await claimMutation(r.clientMutationId, 'rep', r, 'CAREGIVER_REPORT', crAt);
          if (!claim.apply) continue;
          const rawNotes = typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim().slice(0, 1000) : null;
          const created = await tx.caregiverReport.create({
            data: {
              patientId,
              caregiverId: user.profileId,
              reportType: typeof r.reportType === 'string' ? r.reportType.slice(0, 60) : 'DAILY_OBSERVATION',
              appetite: typeof r.appetite === 'string' ? r.appetite.slice(0, 40) : null,
              sleep: typeof r.sleep === 'string' ? r.sleep.slice(0, 40) : null,
              notes: rawNotes ? encryptSensitiveField(rawNotes, patientId) : null,
              clientMutationId: claim.mutationKey,
              deviceId,
              createdAt: crAt,
            },
          });
          await markMutationMeta(claim.mutationKey, created.id);
          reportCount += 1;
        }
      }

      // Routine reconciliation: preserve caregiver-confirmed completed occurrences against older snoozed/pending offline writes
      for (const occ of routineOccurrences) {
        const routineId = typeof occ.routineId === 'string' ? occ.routineId : '';
        const date = typeof occ.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(occ.date)
          ? occ.date
          : getLocalDateString();
        const status = typeof occ.status === 'string' ? occ.status.toLowerCase() : 'completed';

        if (!routineId || !validRoutineIds.has(routineId) || !['pending', 'completed', 'snoozed', 'missed'].includes(status)) {
          continue;
        }

        const compAt = parseDateOrNow(occ.completedAt);
        const claim = await claimMutation(occ.clientMutationId, 'rt', occ, 'ROUTINE_OCCURRENCE', compAt);
        if (!claim.apply) continue;

        const existingOcc = await tx.routineOccurrence.findUnique({
          where: { routineId_date: { routineId, date } },
        });

        if (existingOcc && existingOcc.status === 'completed' && status !== 'completed' && user.role === 'PATIENT') {
          await markMutationMeta(
            claim.mutationKey,
            existingOcc.id,
            'CONFLICT_RESOLVED',
            `Preserved completed server status (${existingOcc.completedBy || 'caregiver'}) over offline ${status}`
          );
          conflictsCount += 1;
          continue;
        }

        const upserted = await tx.routineOccurrence.upsert({
          where: { routineId_date: { routineId, date } },
          update: {
            status,
            completedAt: status === 'completed' ? compAt : null,
            completedBy: typeof occ.completedBy === 'string' ? occ.completedBy.slice(0, 80) : (user.name || user.role),
          },
          create: {
            routineId,
            patientId,
            date,
            status,
            completedAt: status === 'completed' ? compAt : null,
            completedBy: typeof occ.completedBy === 'string' ? occ.completedBy.slice(0, 80) : (user.name || user.role),
          },
        });
        await markMutationMeta(claim.mutationKey, upserted.id);
        routineCount += 1;
      }

      // Medication event sync: preserve source & detect conflicts against caregiver/clinician-confirmed doses
      for (const me of medicationEvents) {
        const medId = typeof me.medicationId === 'string' ? me.medicationId : '';
        const action = typeof me.action === 'string' ? me.action.toUpperCase() : '';
        if (!medId || !validMedIds.has(medId) || !['TAKEN', 'SKIPPED', 'SNOOZED', 'MISSED'].includes(action)) {
          continue;
        }
        const sched = parseDateOrNow(me.scheduledTime);
        const act = parseDateOrNow(me.actualTime);
        const claim = await claimMutation(me.clientMutationId, 'med', me, 'MEDICATION_EVENT', act);
        if (!claim.apply) continue;

        const eventSource = user.role === 'CAREGIVER' ? 'CAREGIVER_CONFIRMED' : 'PATIENT_REPORTED';

        // Check if caregiver already confirmed same day/med dose
        const dayStart = new Date(sched);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(sched);
        dayEnd.setHours(23, 59, 59, 999);
        const caregiverConfirmed = await tx.medicationEvent.findFirst({
          where: {
            patientId,
            medicationId: medId,
            status: 'ACTIVE',
            source: 'CAREGIVER_CONFIRMED',
            scheduledTime: { gte: dayStart, lte: dayEnd },
          },
        });

        if (caregiverConfirmed && eventSource === 'PATIENT_REPORTED' && action !== caregiverConfirmed.action) {
          await markMutationMeta(
            claim.mutationKey,
            caregiverConfirmed.id,
            'CONFLICT_RESOLVED',
            `Preserved CAREGIVER_CONFIRMED=${caregiverConfirmed.action} against offline PATIENT_REPORTED=${action}`
          );
          conflictsCount += 1;
          continue;
        }

        const created = await tx.medicationEvent.create({
          data: {
            patientId,
            medicationId: medId,
            scheduledTime: sched,
            actualTime: act,
            action,
            recordedByUserId: user.id,
            source: eventSource,
            clientMutationId: claim.mutationKey,
            deviceId,
            status: 'ACTIVE',
          },
        });
        await markMutationMeta(claim.mutationKey, created.id);
        medicationCount += 1;
      }

      for (const p of locationPings) {
        const lat = Number(p.lat);
        const lng = Number(p.lng);
        const accuracy = Number(p.accuracy);
        const status = typeof p.status === 'string' ? p.status.toUpperCase() : 'UNAVAILABLE';
        if (
          !Number.isFinite(lat) || lat < -90 || lat > 90 ||
          !Number.isFinite(lng) || lng < -180 || lng > 180 ||
          !Number.isFinite(accuracy) || accuracy < 0 ||
          !['INSIDE', 'OUTSIDE', 'UNAVAILABLE', 'STALE'].includes(status)
        ) {
          continue;
        }
        const recAt = parseDateOrNow(p.recordedAt);
        const claim = await claimMutation(p.clientMutationId, 'loc', p, 'LOCATION_PING', recAt);
        if (!claim.apply) continue;

        const created = await tx.locationPing.create({
          data: {
            patientId,
            lat,
            lng,
            accuracy,
            status,
            insideZoneId: typeof p.insideZoneId === 'string' ? p.insideZoneId : null,
            clientMutationId: claim.mutationKey,
            deviceId,
            recordedAt: recAt,
          },
        });
        await markMutationMeta(claim.mutationKey, created.id);
        pingCount += 1;
      }

      return {
        moodCount,
        gameCount,
        hydrationCount,
        wellbeingCount,
        vitalCount,
        reportCount,
        routineCount,
        medicationCount,
        pingCount,
        deduplicatedCount,
        conflictsCount,
      };
    });

    await AuditService.log({
      userId: user.id,
      action: 'BATCH_SYNC',
      resource: 'PatientProfile',
      resourceId: patientId,
      newValue: JSON.stringify(counts),
    });

    return NextResponse.json({
      success: true,
      synced: counts,
      serverTimestamp: new Date().toISOString(),
      message: 'Offline records synchronized idempotently with patient profile',
    });
  } catch (error) {
    return handleApiError(error, 'Sync POST');
  }
}
