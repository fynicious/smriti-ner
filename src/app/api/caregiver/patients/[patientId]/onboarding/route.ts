import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { hashTokenSha256 } from '@/lib/crypto-envelope';
import { AuditService } from '@/services/audit.service';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

export async function GET(_request: Request, { params }: { params: { patientId: string } }) {
  try {
    await RBAC.requirePatientAccess(params.patientId, ['CAREGIVER'], 'manage_settings');

    const patient = await prisma.patientProfile.findUnique({
      where: { id: params.patientId },
      include: {
        user: { select: { loginCode: true, pinHash: true, pinLockedUntil: true, pinFailedAttempts: true } },
        provisionTokens: {
          where: { usedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, expiresAt: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      loginCode: patient?.user.loginCode || null,
      hasPin: Boolean(patient?.user.pinHash),
      isPinLocked: Boolean(patient?.user.pinLockedUntil && new Date() < patient.user.pinLockedUntil),
      isAccountClaimed: patient?.isAccountClaimed ?? false,
      activeProvisionToken: patient?.provisionTokens[0] || null,
    });
  } catch (error) {
    return handleApiError(error, 'Patient Onboarding GET');
  }
}

export async function POST(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['CAREGIVER'], 'manage_settings');
    const body = await request.json().catch(() => ({}));

    const newPin = typeof body.newPin === 'string' ? body.newPin.trim() : '';
    const generateQr = body.generateQr !== false;

    const patient = await prisma.patientProfile.findUnique({
      where: { id: params.patientId },
      include: { user: { select: { id: true, loginCode: true } } },
    });
    if (!patient) {
      throw new BadRequestError('Patient not found');
    }

    let loginCode = patient.user.loginCode;
    if (!loginCode) {
      loginCode = `SMR-${crypto.randomInt(100000, 999999)}`;
    }

    const userUpdateData: {
      loginCode: string;
      pinHash?: string;
      pinFailedAttempts: number;
      pinLockedUntil: null;
    } = {
      loginCode,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    };

    if (newPin) {
      if (!/^\d{4,6}$/.test(newPin)) {
        throw new BadRequestError('Patient PIN must be 4 to 6 numeric digits');
      }
      userUpdateData.pinHash = await bcrypt.hash(newPin, 12);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: patient.user.id },
        data: userUpdateData,
      }),
      prisma.deviceSession.updateMany({
        where: { userId: patient.user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    let onboarding: { loginCode: string; qrToken: string; qrUrlPath: string; expiresAt: string } | null = null;
    if (generateQr) {
      const rawQrToken = crypto.randomBytes(24).toString('base64url');
      const tokenHash = hashTokenSha256(rawQrToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.patientProvisionToken.create({
        data: {
          patientId: params.patientId,
          caregiverId: user.profileId || user.id,
          tokenHash,
          expiresAt,
        },
      });

      onboarding = {
        loginCode,
        qrToken: rawQrToken,
        qrUrlPath: `/login?qr=${encodeURIComponent(rawQrToken)}`,
        expiresAt: expiresAt.toISOString(),
      };
    }

    await AuditService.log({
      userId: user.id,
      action: 'PATIENT_ONBOARDING_UPDATED',
      resource: 'PatientProfile',
      resourceId: params.patientId,
      newValue: JSON.stringify({ pinUpdated: Boolean(newPin), qrGenerated: Boolean(onboarding) }),
    });

    return NextResponse.json({ success: true, loginCode, onboarding }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Patient Onboarding POST');
  }
}
