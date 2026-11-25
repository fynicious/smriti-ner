import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { encryptSensitiveField, decryptSensitiveField } from '@/lib/crypto-envelope';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

function parseBoundedInt(val: unknown, min: number, max: number): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function parseBoundedFloat(val: unknown, min: number, max: number): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return Number(num.toFixed(1));
}

export async function GET(request: Request, { params }: { params: { patientId: string } }) {
  try {
    await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_clinical');
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30));

    const [vitals, reports, sleepRecords, activityRecords] = await Promise.all([
      prisma.vitalLog.findMany({
        where: { patientId: params.patientId },
        orderBy: { recordedAt: 'desc' },
        take: limit,
      }),
      prisma.caregiverReport.findMany({
        where: { patientId: params.patientId },
        include: { caregiver: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.sleepRecord.findMany({
        where: { patientId: params.patientId },
        orderBy: { date: 'desc' },
        take: limit,
      }),
      prisma.activityRecord.findMany({
        where: { patientId: params.patientId },
        orderBy: { date: 'desc' },
        take: limit,
      }),
    ]);

    const decryptedReports = reports.map((r) => ({
      ...r,
      notes: decryptSensitiveField(r.notes, params.patientId),
    }));

    return NextResponse.json({
      success: true,
      vitals,
      reports: decryptedReports,
      sleepRecords,
      activityRecords,
    });
  } catch (error) {
    return handleApiError(error, 'Vitals GET');
  }
}

export async function POST(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const body = await request.json();
    const kind = typeof body.kind === 'string' ? body.kind.toUpperCase() : 'VITAL';

    if (kind === 'REPORT') {
      const { user } = await RBAC.requirePatientAccess(params.patientId, ['CAREGIVER'], 'view_clinical');
      if (!user.profileId) {
        throw new BadRequestError('Caregiver profile not initialized');
      }

      const reportType = typeof body.reportType === 'string' && body.reportType.trim()
        ? body.reportType.trim().slice(0, 60)
        : 'DAILY_OBSERVATION';
      const appetite = typeof body.appetite === 'string' ? body.appetite.trim().slice(0, 40) : null;
      const sleep = typeof body.sleep === 'string' ? body.sleep.trim().slice(0, 40) : null;
      const rawNotes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;

      if (!appetite && !sleep && !rawNotes) {
        throw new BadRequestError('At least one caregiver observation field is required');
      }

      const report = await prisma.caregiverReport.create({
        data: {
          patientId: params.patientId,
          caregiverId: user.profileId,
          reportType,
          appetite,
          sleep,
          notes: rawNotes ? encryptSensitiveField(rawNotes, params.patientId) : null,
        },
        include: { caregiver: { select: { id: true, fullName: true } } },
      });

      await AuditService.log({
        userId: user.id,
        action: 'CREATE_CAREGIVER_REPORT',
        resource: 'CaregiverReport',
        resourceId: report.id,
        newValue: reportType,
      });

      return NextResponse.json(
        { success: true, report: { ...report, notes: rawNotes } },
        { status: 201 }
      );
    }

    if (kind === 'SLEEP') {
      const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_clinical');
      const durationMins = parseBoundedInt(body.durationMins, 10, 1440);
      if (durationMins === null) {
        throw new BadRequestError('durationMins (10-1440) is required');
      }
      const interruptions = parseBoundedInt(body.interruptions, 0, 50);
      const qualityScore = parseBoundedInt(body.qualityScore, 1, 5);
      const date = body.date && !Number.isNaN(Date.parse(String(body.date))) ? new Date(body.date) : new Date();

      const sleepRecord = await prisma.sleepRecord.create({
        data: {
          patientId: params.patientId,
          date,
          durationMins,
          interruptions,
          qualityScore,
          source: typeof body.source === 'string' ? body.source.slice(0, 30) : 'MANUAL',
        },
      });

      await AuditService.log({
        userId: user.id,
        action: 'CREATE_SLEEP_RECORD',
        resource: 'SleepRecord',
        resourceId: sleepRecord.id,
      });

      return NextResponse.json({ success: true, sleepRecord }, { status: 201 });
    }

    if (kind === 'ACTIVITY') {
      const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_clinical');
      const activityType = typeof body.activityType === 'string' && body.activityType.trim()
        ? body.activityType.trim().slice(0, 60)
        : 'WALKING';
      const durationMins = parseBoundedInt(body.durationMins, 1, 720);
      if (durationMins === null) {
        throw new BadRequestError('durationMins (1-720) is required');
      }
      const steps = parseBoundedInt(body.steps, 0, 100000);
      const date = body.date && !Number.isNaN(Date.parse(String(body.date))) ? new Date(body.date) : new Date();

      const activityRecord = await prisma.activityRecord.create({
        data: {
          patientId: params.patientId,
          activityType,
          durationMins,
          steps,
          date,
          source: typeof body.source === 'string' ? body.source.slice(0, 30) : 'MANUAL',
        },
      });

      await AuditService.log({
        userId: user.id,
        action: 'CREATE_ACTIVITY_RECORD',
        resource: 'ActivityRecord',
        resourceId: activityRecord.id,
      });

      return NextResponse.json({ success: true, activityRecord }, { status: 201 });
    }

    // Default: VITAL
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_clinical');
    const weight = parseBoundedFloat(body.weight, 20, 300);
    const sysBp = parseBoundedInt(body.sysBp, 50, 260);
    const diaBp = parseBoundedInt(body.diaBp, 30, 160);
    const heartRate = parseBoundedInt(body.heartRate, 25, 240);

    if (weight === null && sysBp === null && diaBp === null && heartRate === null) {
      throw new BadRequestError('Provide at least one valid vital measurement (weight, sysBp, diaBp, or heartRate)');
    }

    const vital = await prisma.vitalLog.create({
      data: {
        patientId: params.patientId,
        weight,
        sysBp,
        diaBp,
        heartRate,
        recordedAt: body.recordedAt && !Number.isNaN(Date.parse(String(body.recordedAt)))
          ? new Date(body.recordedAt)
          : new Date(),
      },
    });

    await AuditService.log({
      userId: user.id,
      action: 'CREATE_VITAL_LOG',
      resource: 'VitalLog',
      resourceId: vital.id,
    });

    return NextResponse.json({ success: true, vital }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Vitals POST');
  }
}
