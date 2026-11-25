import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { BadRequestError, NotFoundError, handleApiError } from '@/lib/api-errors';

export async function GET(_request: Request, { params }: { params: { patientId: string } }) {
  try {
    const user = await RBAC.verifyPatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN']);

    const [updates, careCircle, pairings, pendingInvites] = await Promise.all([
      prisma.careUpdate.findMany({
        where: { patientId: params.patientId },
        orderBy: { timestamp: 'desc' },
        take: 60,
      }),
      prisma.careCircleMember.findMany({
        where: { patientId: params.patientId, status: 'ACTIVE' },
        include: {
          caregiver: { select: { id: true, fullName: true, phoneNumber: true } },
          clinician: { select: { id: true, fullName: true, specialization: true, hospital: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.patientCaregiver.findMany({
        where: { patientId: params.patientId, status: 'ACTIVE' },
        include: {
          caregiver: { select: { id: true, fullName: true, phoneNumber: true } },
        },
      }),
      user.role === 'CAREGIVER' && user.profileId
        ? prisma.pairingInvitation.findMany({
            where: {
              caregiverId: user.profileId,
              status: 'PENDING',
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      updates,
      careCircle,
      primaryCaregivers: pairings,
      pendingInvites,
    });
  } catch (error) {
    return handleApiError(error, 'Care Updates GET');
  }
}

export async function POST(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN']);
    const body = await request.json();

    const content = typeof body.content === 'string' ? body.content.trim().slice(0, 1000) : '';
    const type = typeof body.type === 'string' ? body.type.toUpperCase() : 'TEXT';
    if (!content) {
      throw new BadRequestError('Update content is required');
    }
    if (!['TEXT', 'VOICE', 'ALERT'].includes(type)) {
      throw new BadRequestError('Invalid update type');
    }

    const update = await prisma.careUpdate.create({
      data: {
        patientId: params.patientId,
        authorId: user.id,
        authorName: user.name || user.role,
        content,
        type,
      },
    });

    await AuditService.log({
      userId: user.id,
      action: 'CREATE_CARE_UPDATE',
      resource: 'CareUpdate',
      resourceId: update.id,
      newValue: type,
    });

    return NextResponse.json({ success: true, update }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Care Updates POST');
  }
}

export async function PATCH(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['CAREGIVER']);
    const body = await request.json();

    const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';
    if (!memberId) {
      throw new BadRequestError('memberId is required');
    }

    const existing = await prisma.careCircleMember.findFirst({
      where: { id: memberId, patientId: params.patientId },
    });
    if (!existing) {
      throw new NotFoundError('Care circle member not found');
    }

    const data: { role?: string; permissions?: string; status?: string } = {};

    if (typeof body.role === 'string') {
      const normalizedRole = body.role.toUpperCase();
      if (!['PRIMARY_CAREGIVER', 'SECONDARY', 'FAMILY', 'CLINICIAN'].includes(normalizedRole)) {
        throw new BadRequestError('Invalid care circle role');
      }
      data.role = normalizedRole;
    }

    if (Array.isArray(body.permissions)) {
      const cleanPerms = body.permissions
        .filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0)
        .slice(0, 12);
      data.permissions = JSON.stringify(cleanPerms);
    }

    if (typeof body.status === 'string') {
      const normalizedStatus = body.status.toUpperCase();
      if (!['ACTIVE', 'REVOKED'].includes(normalizedStatus)) {
        throw new BadRequestError('Status must be ACTIVE or REVOKED');
      }
      if (normalizedStatus === 'REVOKED' && existing.caregiverId === user.profileId) {
        throw new BadRequestError('You cannot revoke your own active care access');
      }
      data.status = normalizedStatus;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestError('No valid fields supplied to update');
    }

    const member = await prisma.careCircleMember.update({
      where: { id: existing.id },
      data,
      include: {
        caregiver: { select: { id: true, fullName: true, phoneNumber: true } },
        clinician: { select: { id: true, fullName: true, specialization: true, hospital: true } },
      },
    });

    await AuditService.log({
      userId: user.id,
      action: 'UPDATE_CARE_CIRCLE_MEMBER',
      resource: 'CareCircleMember',
      resourceId: member.id,
      prevValue: `${existing.role}:${existing.status}`,
      newValue: `${member.role}:${member.status}`,
    });

    return NextResponse.json({ success: true, member });
  } catch (error) {
    return handleApiError(error, 'Care Updates PATCH');
  }
}
