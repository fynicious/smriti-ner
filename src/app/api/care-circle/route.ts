import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PairingService } from '@/services/pairing.service';
import { AuditService } from '@/services/audit.service';
import { BadRequestError, ForbiddenError, NotFoundError, handleApiError } from '@/lib/api-errors';

const VALID_MEMBER_ROLES = ['PRIMARY_CAREGIVER', 'SECONDARY', 'FAMILY', 'CLINICIAN'] as const;

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  FAMILY: ['contribute_memories', 'view_memories', 'view_updates'],
  SECONDARY: ['view_routines', 'edit_routines', 'contribute_memories', 'view_memories', 'view_updates'],
  PRIMARY_CAREGIVER: [
    'view_clinical',
    'view_routines',
    'edit_routines',
    'view_location',
    'contribute_memories',
    'view_memories',
    'view_updates',
    'manage_settings',
  ],
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedPatientId = searchParams.get('patientId') || undefined;
    const { patientId } = await RBAC.requirePatientAccess(
      requestedPatientId,
      ['CAREGIVER', 'PATIENT', 'CLINICIAN'],
      'view_updates'
    );

    if (!patientId) {
      return NextResponse.json({ success: true, careCircle: [] });
    }

    const careCircle = await prisma.careCircleMember.findMany({
      where: { patientId, status: 'ACTIVE' },
      include: {
        caregiver: { select: { id: true, fullName: true, phoneNumber: true } },
        clinician: { select: { id: true, fullName: true, specialization: true, hospital: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, patientId, careCircle });
  } catch (error) {
    return handleApiError(error, 'Care Circle GET');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestedPatientId = typeof body.patientId === 'string' ? body.patientId : undefined;
    const { user, patientId } = await RBAC.requirePatientAccess(requestedPatientId, ['CAREGIVER', 'PATIENT']);

    if (user.role === 'CAREGIVER') {
      if (!user.profileId) {
        throw new BadRequestError('Caregiver profile not initialized');
      }

      // Option 1: Direct scoped Care Circle grant if memberCaregiverEmail & role supplied
      if (typeof body.memberEmail === 'string' && body.memberEmail.trim() && patientId) {
        await RBAC.verifyPatientAccess(patientId, ['CAREGIVER'], 'manage_settings');
        const targetEmail = body.memberEmail.trim().toLowerCase();
        const roleRaw = typeof body.role === 'string' ? body.role.trim().toUpperCase() : 'FAMILY';
        const role = VALID_MEMBER_ROLES.includes(roleRaw as (typeof VALID_MEMBER_ROLES)[number]) ? roleRaw : 'FAMILY';

        const targetUser = await prisma.user.findUnique({
          where: { email: targetEmail },
          include: { caregiverProfile: true },
        });
        if (!targetUser?.caregiverProfile) {
          throw new BadRequestError('Registered family/caregiver account not found for that email');
        }

        const perms = Array.isArray(body.permissions)
          ? body.permissions.map(String)
          : ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.FAMILY;

        const member = await prisma.careCircleMember.create({
          data: {
            patientId,
            caregiverId: targetUser.caregiverProfile.id,
            role,
            permissions: JSON.stringify(perms),
            status: 'ACTIVE',
          },
          include: {
            caregiver: { select: { id: true, fullName: true, phoneNumber: true } },
          },
        });

        await AuditService.log({
          userId: user.id,
          action: 'ADD_CARE_CIRCLE_MEMBER',
          resource: 'CareCircleMember',
          resourceId: member.id,
          newValue: JSON.stringify({ role, permissions: perms }),
        });

        return NextResponse.json({ success: true, member }, { status: 201 });
      }

      const invitation = await PairingService.generatePairingCode(user.profileId);
      return NextResponse.json(
        {
          success: true,
          message: 'Pairing invitation code generated',
          invitationCode: invitation.code,
          expiresAt: invitation.expiresAt,
        },
        { status: 201 }
      );
    }

    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!code || !user.profileId) {
      throw new ForbiddenError('Valid pairing code is required for patient linking');
    }

    const relationship = await PairingService.acceptPairing(user.profileId, code);
    return NextResponse.json({ success: true, message: 'Caregiver paired successfully', relationship }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Care Circle POST');
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';
    const requestedPatientId = typeof body.patientId === 'string' ? body.patientId.trim() : undefined;
    const { user, patientId } = await RBAC.requirePatientAccess(requestedPatientId, ['CAREGIVER'], 'manage_settings');

    if (!memberId || !patientId) {
      throw new BadRequestError('memberId and active patientId are required');
    }

    const existing = await prisma.careCircleMember.findFirst({
      where: { id: memberId, patientId, status: 'ACTIVE' },
    });
    if (!existing) {
      throw new NotFoundError('Active Care Circle member not found');
    }

    const roleRaw = typeof body.role === 'string' ? body.role.trim().toUpperCase() : existing.role;
    const role = VALID_MEMBER_ROLES.includes(roleRaw as (typeof VALID_MEMBER_ROLES)[number]) ? roleRaw : existing.role;
    const permissions = Array.isArray(body.permissions)
      ? body.permissions.map(String)
      : ROLE_DEFAULT_PERMISSIONS[role] || JSON.parse(existing.permissions || '[]');

    const updated = await prisma.careCircleMember.update({
      where: { id: existing.id },
      data: { role, permissions: JSON.stringify(permissions) },
    });

    await AuditService.log({
      userId: user.id,
      action: 'UPDATE_CARE_CIRCLE_PERMISSIONS',
      resource: 'CareCircleMember',
      resourceId: existing.id,
      prevValue: existing.permissions,
      newValue: updated.permissions,
    });

    return NextResponse.json({ success: true, member: updated });
  } catch (error) {
    return handleApiError(error, 'Care Circle PATCH');
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const requestedPatientId = searchParams.get('patientId') || undefined;
    const { user, patientId } = await RBAC.requirePatientAccess(requestedPatientId, ['CAREGIVER'], 'manage_settings');

    if (!memberId || !patientId) {
      throw new BadRequestError('memberId and patientId are required');
    }

    const result = await prisma.careCircleMember.updateMany({
      where: { id: memberId, patientId, status: 'ACTIVE' },
      data: { status: 'REVOKED' },
    });
    if (result.count === 0) {
      throw new NotFoundError('Care Circle member not found');
    }

    await AuditService.log({
      userId: user.id,
      action: 'REVOKE_CARE_CIRCLE_MEMBER',
      resource: 'CareCircleMember',
      resourceId: memberId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Care Circle DELETE');
  }
}
