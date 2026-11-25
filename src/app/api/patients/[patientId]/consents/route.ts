import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

const VALID_SCOPES = [
  'LOCATION_SHARING',
  'AI_COMPANION',
  'FAMILY_SHARING',
  'CLINICIAN_ACCESS',
  'DATA_SYNC',
  'VOICE_RECORDING',
] as const;

const VALID_AUTHORITIES = ['PATIENT_ASSENT', 'CAREGIVER_REPRESENTATIVE', 'JOINT'] as const;

export async function GET(_request: Request, { params }: { params: { patientId: string } }) {
  try {
    await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_clinical');
    const records = await prisma.consentRecord.findMany({
      where: { patientId: params.patientId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const latestByScope: Record<string, (typeof records)[number]> = {};
    for (const r of records) {
      if (!latestByScope[r.scope]) {
        latestByScope[r.scope] = r;
      }
    }

    return NextResponse.json({
      success: true,
      latestByScope,
      history: records,
    });
  } catch (error) {
    return handleApiError(error, 'Consents GET');
  }
}

export async function POST(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER'], 'manage_settings');
    const body = await request.json();

    const scope = typeof body.scope === 'string' ? body.scope.trim().toUpperCase() : '';
    const granted = Boolean(body.granted);
    const authorityRaw = typeof body.authorityType === 'string'
      ? body.authorityType.trim().toUpperCase()
      : user.role === 'PATIENT'
      ? 'PATIENT_ASSENT'
      : 'CAREGIVER_REPRESENTATIVE';
    const authorityType = VALID_AUTHORITIES.includes(authorityRaw as (typeof VALID_AUTHORITIES)[number])
      ? authorityRaw
      : 'CAREGIVER_REPRESENTATIVE';

    if (!VALID_SCOPES.includes(scope as (typeof VALID_SCOPES)[number])) {
      throw new BadRequestError(`Consent scope must be one of: ${VALID_SCOPES.join(', ')}`);
    }

    const record = await prisma.consentRecord.create({
      data: {
        patientId: params.patientId,
        grantedByUserId: user.id,
        scope,
        granted,
        authorityType,
        version: '1.0',
        notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 300) : null,
      },
    });

    await AuditService.log({
      userId: user.id,
      action: granted ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN',
      resource: 'ConsentRecord',
      resourceId: record.id,
      newValue: JSON.stringify({ scope, authorityType, granted }),
    });

    return NextResponse.json({ success: true, consent: record }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Consents POST');
  }
}
