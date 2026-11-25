import { prisma } from '@/lib/prisma';
import { decryptSensitiveField } from '@/lib/crypto-envelope';

export interface TimelineItem {
  id: string;
  type: 'MEDICATION' | 'HYDRATION' | 'VITAL_SIGNS' | 'COGNITIVE_SESSION' | 'CAREGIVER_REPORT';
  date: Date;
  title: string;
  description: string;
  source?: string;
  metadata: Record<string, unknown>;
}

export class TimelineService {
  /**
   * Generates a unified chronological timeline for a patient by merging health events,
   * decrypting protected notes and preserving event source attribution.
   */
  static async getUnifiedTimeline(patientId: string, limit = 50): Promise<TimelineItem[]> {
    const [medEvents, hydrationEvents, vitals, cognitive, reports] = await Promise.all([
      prisma.medicationEvent.findMany({
        where: { patientId, status: 'ACTIVE' },
        orderBy: { scheduledTime: 'desc' },
        take: limit,
        include: { medication: true },
      }),
      prisma.hydrationEvent.findMany({
        where: { patientId, status: 'ACTIVE' },
        orderBy: { timestamp: 'desc' },
        take: limit,
      }),
      prisma.vitalLog.findMany({
        where: { patientId },
        orderBy: { recordedAt: 'desc' },
        take: limit,
      }),
      prisma.cognitiveSession.findMany({
        where: { patientId },
        orderBy: { completedAt: 'desc' },
        take: limit,
      }),
      prisma.caregiverReport.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const timeline: TimelineItem[] = [];

    medEvents.forEach((m) => {
      const sourceLabel = m.source === 'CAREGIVER_CONFIRMED'
        ? 'Caregiver confirmed'
        : m.source === 'CLINICIAN_RECORDED'
        ? 'Clinician recorded'
        : 'Patient reported';
      timeline.push({
        id: `med_${m.id}`,
        type: 'MEDICATION',
        date: m.actualTime || m.scheduledTime,
        title: `Medication ${m.action}`,
        description: `${m.medication.name} (${m.medication.dosage}) — ${m.action.toLowerCase()} (${sourceLabel})`,
        source: m.source,
        metadata: { action: m.action, source: m.source },
      });
    });

    hydrationEvents.forEach((h) => {
      timeline.push({
        id: `hyd_${h.id}`,
        type: 'HYDRATION',
        date: h.timestamp,
        title: 'Hydration Logged',
        description: `Consumed ${h.amountMl} ml of fluid`,
        source: 'USER_LOGGED',
        metadata: { amount: h.amountMl },
      });
    });

    vitals.forEach((v) => {
      timeline.push({
        id: `vit_${v.id}`,
        type: 'VITAL_SIGNS',
        date: v.recordedAt,
        title: 'Vitals Recorded',
        description: `Weight: ${v.weight ?? '--'}kg, BP: ${v.sysBp ?? '--'}/${v.diaBp ?? '--'}, HR: ${v.heartRate ?? '--'}bpm`,
        source: 'CLINICAL_VITAL',
        metadata: { weight: v.weight, sysBp: v.sysBp, diaBp: v.diaBp, hr: v.heartRate },
      });
    });

    cognitive.forEach((c) => {
      timeline.push({
        id: `cog_${c.id}`,
        type: 'COGNITIVE_SESSION',
        date: c.completedAt,
        title: `Cognitive Exercise: ${c.domain}`,
        description: `Score: ${c.score} | Accuracy: ${(c.accuracy * 100).toFixed(0)}% | Difficulty: Lvl ${c.difficultyLevel}`,
        source: 'GAME_TELEMETRY',
        metadata: { accuracy: c.accuracy, reactionTimeMs: c.reactionTimeMs },
      });
    });

    reports.forEach((r) => {
      const plainNotes = decryptSensitiveField(r.notes, patientId) || '';
      timeline.push({
        id: `rep_${r.id}`,
        type: 'CAREGIVER_REPORT',
        date: r.createdAt,
        title: `Caregiver Report: ${r.reportType.replace('_', ' ')}`,
        description: `Appetite: ${r.appetite ?? '--'} | Sleep: ${r.sleep ?? '--'} | Notes: ${plainNotes}`,
        source: 'CAREGIVER_OBSERVED',
        metadata: { appetite: r.appetite, sleep: r.sleep },
      });
    });

    return timeline
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
  }
}
