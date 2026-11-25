import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { getLocalDateString } from '@/lib/dateUtils';
import { encryptSensitiveField, decryptSensitiveField } from '@/lib/crypto-envelope';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

export async function GET(_request: Request, { params }: { params: { patientId: string } }) {
  try {
    await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_clinical');
    const entries = await prisma.wellbeingEntry.findMany({
      where: { patientId: params.patientId },
      orderBy: { timestamp: 'desc' },
      take: 30,
    });

    const decrypted = entries.map((e) => ({
      ...e,
      notes: decryptSensitiveField(e.notes, params.patientId),
    }));

    return NextResponse.json({ success: true, entries: decrypted });
  } catch (error) {
    return handleApiError(error, 'Wellbeing GET');
  }
}

export async function POST(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_routines');
    const body = await request.json();

    // Allow -1 sentinel for skipped individual questions (Sec. 4.6) and 0..3 for answered questions
    const clampScore = (val: unknown) => {
      if (val === -1 || val === null || val === undefined) return -1;
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0 || n > 3) {
        throw new BadRequestError('Wellbeing rating values must be between 0 and 3 (or -1 when skipped)');
      }
      return Math.round(n);
    };

    const source =
      user.role === 'PATIENT'
        ? 'PATIENT_REPORTED'
        : user.role === 'CLINICIAN'
        ? 'CLINICIAN_ENTERED'
        : 'CAREGIVER_OBSERVED';

    const rawNotes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;

    const entry = await prisma.wellbeingEntry.create({
      data: {
        patientId: params.patientId,
        date: typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
          ? body.date
          : getLocalDateString(),
        recordedBy: user.id,
        source,
        mood: clampScore(body.mood),
        sleepQuality: clampScore(body.sleepQuality),
        confusionLevel: clampScore(body.confusionLevel),
        energyLevel: clampScore(body.energyLevel),
        painLevel: clampScore(body.painLevel),
        overallWellbeing: clampScore(body.overallWellbeing),
        notes: rawNotes ? encryptSensitiveField(rawNotes, params.patientId) : null,
        clientMutationId: typeof body.clientMutationId === 'string' ? body.clientMutationId.slice(0, 80) : null,
        deviceId: typeof body.deviceId === 'string' ? body.deviceId.slice(0, 80) : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        entry: {
          ...entry,
          notes: rawNotes,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'Wellbeing POST');
  }
}
