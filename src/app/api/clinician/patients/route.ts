import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { decryptSensitiveField } from '@/lib/crypto-envelope';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await RBAC.requireSession(['CLINICIAN']);
    if (!user.profileId) {
      return NextResponse.json({ patients: [] });
    }

    const [circleLinks, rxLinks] = await Promise.all([
      prisma.careCircleMember.findMany({
        where: { clinicianId: user.profileId, status: 'ACTIVE' },
        include: {
          patient: {
            include: { user: { select: { loginCode: true } } },
          },
        },
      }),
      prisma.medication.findMany({
        where: { clinicianId: user.profileId },
        include: {
          patient: {
            include: { user: { select: { loginCode: true } } },
          },
        },
        distinct: ['patientId'],
      }),
    ]);

    const patientMap = new Map<string, Record<string, unknown>>();
    const addPatient = (p: typeof circleLinks[number]['patient']) => {
      patientMap.set(p.id, {
        ...p,
        emergencyContact: decryptSensitiveField(p.emergencyContact, p.id),
        allergies: decryptSensitiveField(p.allergies, p.id),
        diagnoses: decryptSensitiveField(p.diagnoses, p.id),
        loginCode: p.user?.loginCode || null,
      });
    };
    circleLinks.forEach((c) => addPatient(c.patient));
    rxLinks.forEach((r) => addPatient(r.patient));

    return NextResponse.json({ patients: Array.from(patientMap.values()) });
  } catch (error) {
    return handleApiError(error, 'Clinician Patients GET');
  }
}

export async function POST(request: Request) {
  try {
    const user = await RBAC.requireSession(['CLINICIAN']);
    if (!user.profileId) {
      throw new BadRequestError('Clinician profile not initialized');
    }

    const body = await request.json();
    const rawIdentifier =
      (typeof body.patientEmail === 'string' && body.patientEmail.trim()) ||
      (typeof body.patientLoginCode === 'string' && body.patientLoginCode.trim()) ||
      (typeof body.patientIdentifier === 'string' && body.patientIdentifier.trim()) ||
      '';
    const pairingCode = typeof body.pairingCode === 'string' ? body.pairingCode.trim() : '';

    if (!rawIdentifier || !/^\d{6}$/.test(pairingCode)) {
      throw new BadRequestError('Patient email or login code (SMR-XXXXXX) and an active caregiver 6-digit pairing code are required');
    }

    const invitation = await prisma.pairingInvitation.findUnique({
      where: { code: pairingCode },
    });

    if (!invitation || invitation.status !== 'PENDING' || new Date() > invitation.expiresAt) {
      throw new BadRequestError('Invalid or expired authorization code');
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: rawIdentifier.toLowerCase() },
          { loginCode: rawIdentifier.toUpperCase() },
        ],
      },
      include: { patientProfile: true },
    });

    if (!targetUser?.patientProfile) {
      throw new BadRequestError('Patient account not found');
    }

    const existing = await prisma.careCircleMember.findFirst({
      where: {
        patientId: targetUser.patientProfile.id,
        clinicianId: user.profileId,
      },
    });

    const member = existing
      ? await prisma.careCircleMember.update({
          where: { id: existing.id },
          data: {
            role: 'CLINICIAN',
            permissions: JSON.stringify(['view_clinical', 'edit_clinical', 'view_routines']),
            status: 'ACTIVE',
          },
        })
      : await prisma.careCircleMember.create({
          data: {
            patientId: targetUser.patientProfile.id,
            clinicianId: user.profileId,
            role: 'CLINICIAN',
            permissions: JSON.stringify(['view_clinical', 'edit_clinical', 'view_routines']),
            status: 'ACTIVE',
          },
        });

    await AuditService.log({
      userId: user.id,
      action: 'CLINICIAN_PATIENT_ASSIGNED',
      resource: 'CareCircleMember',
      resourceId: member.id,
      newValue: targetUser.patientProfile.id,
    });

    return NextResponse.json({ success: true, patient: targetUser.patientProfile }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Clinician Patients POST');
  }
}
