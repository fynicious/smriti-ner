import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const VALID_MODES = ['SIMPLE', 'GUIDED', 'FULL'] as const;
const VALID_AI_STYLES = ['CONVERSATIONAL', 'TASK_FOCUSED', 'BALANCED'] as const;

export async function GET(_request: Request, { params }: { params: { patientId: string } }) {
  try {
    await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_routines');

    const [patient, pref, target] = await Promise.all([
      prisma.patientProfile.findUnique({
        where: { id: params.patientId },
        select: { preferredLanguage: true, retentionDays: true },
      }),
      prisma.patientPreference.findUnique({ where: { patientId: params.patientId } }),
      prisma.hydrationTarget.findFirst({
        where: { patientId: params.patientId },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      preferences: {
        complexityMode: pref?.complexityMode || 'GUIDED',
        scriptPreference: pref?.scriptPreference || null,
        culturalPackId: pref?.culturalPackId || 'ner-as-01',
        reducedMotion: pref?.reducedMotion ?? false,
        highContrast: pref?.highContrast ?? false,
        textScale: pref?.textScale ?? 1.0,
        voiceEnabled: pref?.voiceEnabled ?? true,
        voiceRate: pref?.voiceRate ?? 0.85,
        aiEnabled: pref?.aiEnabled ?? true,
        aiInteractionStyle: pref?.aiInteractionStyle || 'BALANCED',
        caregiverLockEnabled: pref?.caregiverLockEnabled ?? false,
        hasCaregiverLockPin: Boolean(pref?.caregiverLockPinHash),
        preferredLanguage: patient?.preferredLanguage || 'en',
        hydrationTargetMl: target?.targetMl || 2000,
        retentionDays: patient?.retentionDays ?? 730,
      },
    });
  } catch (error) {
    return handleApiError(error, 'Patient Preferences GET');
  }
}

export async function PATCH(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER'], 'view_routines');
    const body = await request.json();

    // Only caregivers manage structural settings, complexity mode, hydration target, and caregiver lock (Sec. 2 & 4.1)
    if (user.role === 'PATIENT') {
      // If verifying caregiver lock PIN to temporarily unlock settings or adjust display accessibility only
      if (typeof body.verifyCaregiverLockPin === 'string') {
        const pref = await prisma.patientPreference.findUnique({ where: { patientId: params.patientId } });
        if (!pref?.caregiverLockPinHash) {
          return NextResponse.json({ success: true, unlocked: true });
        }
        const ok = await bcrypt.compare(body.verifyCaregiverLockPin.trim(), pref.caregiverLockPinHash);
        if (!ok) {
          return NextResponse.json({ success: false, unlocked: false, error: 'Incorrect caregiver lock PIN' }, { status: 403 });
        }
        return NextResponse.json({ success: true, unlocked: true });
      }
      await RBAC.verifyPatientAccess(params.patientId, ['CAREGIVER'], 'manage_settings');
    }

    await RBAC.verifyPatientAccess(params.patientId, ['CAREGIVER'], 'manage_settings');

    const updateData: Record<string, unknown> = {
      updatedByUserId: user.id,
    };

    if (typeof body.complexityMode === 'string') {
      const mode = body.complexityMode.trim().toUpperCase();
      if (!VALID_MODES.includes(mode as (typeof VALID_MODES)[number])) {
        throw new BadRequestError('complexityMode must be SIMPLE, GUIDED, or FULL');
      }
      updateData.complexityMode = mode;
    }

    if (body.scriptPreference !== undefined) {
      updateData.scriptPreference =
        typeof body.scriptPreference === 'string' && body.scriptPreference.trim()
          ? body.scriptPreference.trim().slice(0, 30)
          : null;
    }

    if (typeof body.culturalPackId === 'string' && body.culturalPackId.trim()) {
      updateData.culturalPackId = body.culturalPackId.trim().slice(0, 40);
    }

    if (typeof body.reducedMotion === 'boolean') updateData.reducedMotion = body.reducedMotion;
    if (typeof body.highContrast === 'boolean') updateData.highContrast = body.highContrast;
    if (typeof body.voiceEnabled === 'boolean') updateData.voiceEnabled = body.voiceEnabled;
    if (typeof body.aiEnabled === 'boolean') updateData.aiEnabled = body.aiEnabled;
    if (typeof body.caregiverLockEnabled === 'boolean') updateData.caregiverLockEnabled = body.caregiverLockEnabled;

    if (body.textScale !== undefined) {
      const scale = Number(body.textScale);
      if (!Number.isFinite(scale) || scale < 0.9 || scale > 1.5) {
        throw new BadRequestError('textScale must be between 0.9 and 1.5');
      }
      updateData.textScale = scale;
    }

    if (body.voiceRate !== undefined) {
      const rate = Number(body.voiceRate);
      if (!Number.isFinite(rate) || rate < 0.6 || rate > 1.2) {
        throw new BadRequestError('voiceRate must be between 0.6 and 1.2');
      }
      updateData.voiceRate = rate;
    }

    if (typeof body.aiInteractionStyle === 'string') {
      const style = body.aiInteractionStyle.trim().toUpperCase();
      if (!VALID_AI_STYLES.includes(style as (typeof VALID_AI_STYLES)[number])) {
        throw new BadRequestError('aiInteractionStyle must be CONVERSATIONAL, TASK_FOCUSED, or BALANCED');
      }
      updateData.aiInteractionStyle = style;
    }

    if (typeof body.caregiverLockPin === 'string' && body.caregiverLockPin.trim()) {
      const lockPin = body.caregiverLockPin.trim();
      if (!/^\d{4,6}$/.test(lockPin)) {
        throw new BadRequestError('Caregiver lock PIN must be 4 to 6 digits');
      }
      updateData.caregiverLockPinHash = await bcrypt.hash(lockPin, 12);
    }

    const updatedPref = await prisma.patientPreference.upsert({
      where: { patientId: params.patientId },
      update: updateData,
      create: {
        patientId: params.patientId,
        ...(updateData as Record<string, never>),
      },
    });

    if (typeof body.preferredLanguage === 'string' && body.preferredLanguage.trim()) {
      await prisma.patientProfile.update({
        where: { id: params.patientId },
        data: { preferredLanguage: body.preferredLanguage.trim().slice(0, 12) },
      });
    }

    if (body.hydrationTargetMl !== undefined) {
      const ml = Math.round(Number(body.hydrationTargetMl));
      if (!Number.isFinite(ml) || ml < 500 || ml > 5000) {
        throw new BadRequestError('hydrationTargetMl must be between 500 and 5000');
      }
      await prisma.hydrationTarget.create({
        data: { patientId: params.patientId, targetMl: ml },
      });
    }

    if (body.retentionDays !== undefined) {
      const days = Math.round(Number(body.retentionDays));
      if (!Number.isFinite(days) || days < 30 || days > 3650) {
        throw new BadRequestError('retentionDays must be between 30 and 3650');
      }
      await prisma.patientProfile.update({
        where: { id: params.patientId },
        data: { retentionDays: days },
      });
    }

    await AuditService.log({
      userId: user.id,
      action: 'PATIENT_PREFERENCES_UPDATED',
      resource: 'PatientPreference',
      resourceId: updatedPref.id,
      newValue: JSON.stringify({
        complexityMode: updatedPref.complexityMode,
        scriptPreference: updatedPref.scriptPreference,
        culturalPackId: updatedPref.culturalPackId,
      }),
    });

    return NextResponse.json({ success: true, preferences: updatedPref });
  } catch (error) {
    return handleApiError(error, 'Patient Preferences PATCH');
  }
}
