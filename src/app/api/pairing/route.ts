import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PairingService } from '@/services/pairing.service';
import { AuditService } from '@/services/audit.service';
import { BadRequestError, ForbiddenError, handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await RBAC.requireSession(['PATIENT', 'CAREGIVER', 'CLINICIAN']);
    if (!user.profileId) {
      return NextResponse.json({ pairings: [], invitations: [] });
    }

    if (user.role === 'CAREGIVER') {
      const [patients, invitations] = await Promise.all([
        PairingService.getAuthorizedPatients(user.profileId),
        prisma.pairingInvitation.findMany({
          where: { caregiverId: user.profileId, status: 'PENDING', expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      return NextResponse.json({ pairings: patients, invitations });
    }

    if (user.role === 'PATIENT') {
      const caregivers = await PairingService.getAuthorizedCaregivers(user.profileId);
      return NextResponse.json({ pairings: caregivers, invitations: [] });
    }

    const assigned = await prisma.careCircleMember.findMany({
      where: { clinicianId: user.profileId, status: 'ACTIVE' },
      include: { patient: true },
    });
    return NextResponse.json({ pairings: assigned, invitations: [] });
  } catch (error) {
    return handleApiError(error, 'Pairing GET');
  }
}

export async function POST(request: Request) {
  try {
    const user = await RBAC.requireSession(['PATIENT', 'CAREGIVER']);
    if (!user.profileId) {
      throw new BadRequestError('Profile not initialized');
    }

    const body = await request.json().catch(() => ({}));

    if (user.role === 'CAREGIVER') {
      const invitation = await PairingService.generatePairingCode(user.profileId);
      await AuditService.log({
        userId: user.id,
        action: 'PAIRING_CODE_GENERATED',
        resource: 'PairingInvitation',
        resourceId: invitation.id,
      });
      return NextResponse.json({
        success: true,
        code: invitation.code,
        expiresAt: invitation.expiresAt,
      }, { status: 201 });
    }

    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestError('Please enter a valid 6-digit pairing code');
    }

    const relationship = await PairingService.acceptPairing(user.profileId, code);
    return NextResponse.json({
      success: true,
      message: 'Paired with caregiver successfully',
      relationship,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('Invalid pairing code') ||
      error.message.includes('already been used') ||
      error.message.includes('expired')
    )) {
      return NextResponse.json({ error: error.message, code: 'BAD_REQUEST' }, { status: 400 });
    }
    return handleApiError(error, 'Pairing POST');
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await RBAC.requireSession(['PATIENT', 'CAREGIVER']);
    const { searchParams } = new URL(request.url);
    const pairingId = searchParams.get('pairingId');
    if (!pairingId || !user.profileId) {
      throw new BadRequestError('pairingId is required');
    }

    const existing = await prisma.patientCaregiver.findUnique({ where: { id: pairingId } });
    if (!existing) {
      throw new BadRequestError('Pairing record not found');
    }

    const owns =
      (user.role === 'PATIENT' && existing.patientId === user.profileId) ||
      (user.role === 'CAREGIVER' && existing.caregiverId === user.profileId);

    if (!owns) {
      throw new ForbiddenError('Not authorized to revoke this pairing');
    }

    await prisma.patientCaregiver.update({
      where: { id: pairingId },
      data: { status: 'REVOKED' },
    });

    await AuditService.log({
      userId: user.id,
      action: 'PAIRING_REVOKED',
      resource: 'PatientCaregiver',
      resourceId: pairingId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Pairing DELETE');
  }
}
