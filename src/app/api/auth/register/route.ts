import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { safeCompareSecrets } from '@/lib/env';
import { BadRequestError, ForbiddenError, handleApiError } from '@/lib/api-errors';

const ALLOWED_ROLES = ['CAREGIVER', 'CLINICIAN'] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim().toUpperCase() : '';
    const clinicianCode = typeof body.clinicianInviteCode === 'string' ? body.clinicianInviteCode.trim() : '';

    if (!rawEmail || !password || !fullName || !role) {
      throw new BadRequestError('Missing required fields');
    }

    if (!EMAIL_REGEX.test(rawEmail)) {
      throw new BadRequestError('Please enter a valid email address');
    }

    if (fullName.length < 2 || fullName.length > 100) {
      throw new BadRequestError('Full name must be between 2 and 100 characters');
    }

    if (password.length < 8 || password.length > 128) {
      throw new BadRequestError('Password must be at least 8 characters long');
    }

    // SMRITI v1.0 Decision #6: Elderly patient accounts are provisioned by caregivers (PIN + QR)
    if (role === 'PATIENT') {
      throw new ForbiddenError(
        'Patient accounts are created by a family caregiver using PIN/QR onboarding inside the Caregiver portal.'
      );
    }

    if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
      throw new BadRequestError('Invalid role selected');
    }

    // Restrict clinician self-registration unless authorized via invite code
    if (role === 'CLINICIAN') {
      const configuredCode = process.env.CLINICIAN_INVITE_CODE?.trim();
      if (!configuredCode || !clinicianCode || !safeCompareSecrets(clinicianCode, configuredCode)) {
        throw new ForbiddenError('Clinician registration requires a valid clinic verification code');
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email: rawEmail } });
    if (existingUser) {
      throw new BadRequestError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: rawEmail,
          passwordHash,
          role,
        },
      });

      if (role === 'CAREGIVER') {
        await tx.caregiverProfile.create({
          data: { userId: user.id, fullName },
        });
      } else if (role === 'CLINICIAN') {
        await tx.clinicianProfile.create({
          data: { userId: user.id, fullName },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_REGISTERED',
          resource: 'User',
          resourceId: user.id,
          newValue: JSON.stringify({ role }),
        },
      });

      return user;
    });

    return NextResponse.json({ message: 'User created successfully', userId: result.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Register API');
  }
}
