import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { encryptSensitiveField, decryptSensitiveField } from '@/lib/crypto-envelope';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await RBAC.requireSession(['PATIENT', 'CAREGIVER', 'CLINICIAN']);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        loginCode: true,
        role: true,
        createdAt: true,
        patientProfile: {
          include: { preferences: true },
        },
        caregiverProfile: {
          include: {
            patients: {
              where: { status: 'ACTIVE' },
              include: {
                patient: {
                  include: { preferences: true },
                },
              },
            },
          },
        },
        clinicianProfile: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ success: true, user: null });
    }

    const sanitizedUser = {
      ...dbUser,
      patientProfile: dbUser.patientProfile
        ? {
            ...dbUser.patientProfile,
            emergencyContact: decryptSensitiveField(dbUser.patientProfile.emergencyContact, dbUser.patientProfile.id),
            allergies: decryptSensitiveField(dbUser.patientProfile.allergies, dbUser.patientProfile.id),
            diagnoses: decryptSensitiveField(dbUser.patientProfile.diagnoses, dbUser.patientProfile.id),
          }
        : null,
      caregiverProfile: dbUser.caregiverProfile
        ? {
            ...dbUser.caregiverProfile,
            patients: dbUser.caregiverProfile.patients.map((rel) => ({
              ...rel,
              patient: {
                ...rel.patient,
                emergencyContact: decryptSensitiveField(rel.patient.emergencyContact, rel.patient.id),
                allergies: decryptSensitiveField(rel.patient.allergies, rel.patient.id),
                diagnoses: decryptSensitiveField(rel.patient.diagnoses, rel.patient.id),
              },
            })),
          }
        : null,
    };

    return NextResponse.json({ success: true, user: sanitizedUser });
  } catch (error) {
    return handleApiError(error, 'Profile GET');
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await RBAC.requireSession(['PATIENT', 'CAREGIVER', 'CLINICIAN']);
    if (!user.profileId) {
      throw new BadRequestError('Profile not initialized');
    }

    const body = await request.json();
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : undefined;
    if (fullName !== undefined && fullName.length < 2) {
      throw new BadRequestError('Full name must be at least 2 characters');
    }

    if (user.role === 'PATIENT') {
      const pid = user.profileId;
      const updated = await prisma.patientProfile.update({
        where: { id: pid },
        data: {
          ...(fullName ? { fullName } : {}),
          ...(typeof body.bloodGroup === 'string' ? { bloodGroup: body.bloodGroup.trim().slice(0, 10) } : {}),
          ...(typeof body.emergencyContact === 'string'
            ? { emergencyContact: encryptSensitiveField(body.emergencyContact.trim().slice(0, 40), pid) }
            : {}),
          ...(typeof body.preferredLanguage === 'string'
            ? { preferredLanguage: body.preferredLanguage.trim().slice(0, 12) }
            : {}),
          ...(typeof body.allergies === 'string'
            ? { allergies: encryptSensitiveField(body.allergies.trim().slice(0, 200), pid) }
            : {}),
          ...(typeof body.diagnoses === 'string'
            ? { diagnoses: encryptSensitiveField(body.diagnoses.trim().slice(0, 300), pid) }
            : {}),
        },
      });
      await AuditService.log({
        userId: user.id,
        action: 'PROFILE_UPDATED',
        resource: 'PatientProfile',
        resourceId: updated.id,
      });
      return NextResponse.json({
        success: true,
        profile: {
          ...updated,
          emergencyContact: decryptSensitiveField(updated.emergencyContact, pid),
          allergies: decryptSensitiveField(updated.allergies, pid),
          diagnoses: decryptSensitiveField(updated.diagnoses, pid),
        },
      });
    }

    if (user.role === 'CAREGIVER') {
      const updated = await prisma.caregiverProfile.update({
        where: { id: user.profileId },
        data: {
          ...(fullName ? { fullName } : {}),
          ...(typeof body.phoneNumber === 'string' ? { phoneNumber: body.phoneNumber.trim().slice(0, 30) } : {}),
        },
      });

      if (
        typeof body.patientId === 'string' &&
        body.patientId &&
        (typeof body.emergencyContact === 'string' || typeof body.preferredLanguage === 'string')
      ) {
        const pid = body.patientId;
        await RBAC.verifyPatientAccess(pid, ['CAREGIVER'], 'manage_settings');
        await prisma.patientProfile.update({
          where: { id: pid },
          data: {
            ...(typeof body.emergencyContact === 'string'
              ? { emergencyContact: encryptSensitiveField(body.emergencyContact.trim().slice(0, 40), pid) }
              : {}),
            ...(typeof body.preferredLanguage === 'string'
              ? { preferredLanguage: body.preferredLanguage.trim().slice(0, 12) }
              : {}),
          },
        });
      }

      await AuditService.log({
        userId: user.id,
        action: 'PROFILE_UPDATED',
        resource: 'CaregiverProfile',
        resourceId: updated.id,
      });
      return NextResponse.json({ success: true, profile: updated });
    }

    const updated = await prisma.clinicianProfile.update({
      where: { id: user.profileId },
      data: {
        ...(fullName ? { fullName } : {}),
        ...(typeof body.specialization === 'string' ? { specialization: body.specialization.trim().slice(0, 80) } : {}),
        ...(typeof body.hospital === 'string' ? { hospital: body.hospital.trim().slice(0, 100) } : {}),
      },
    });
    await AuditService.log({
      userId: user.id,
      action: 'PROFILE_UPDATED',
      resource: 'ClinicianProfile',
      resourceId: updated.id,
    });
    return NextResponse.json({ success: true, profile: updated });
  } catch (error) {
    return handleApiError(error, 'Profile PATCH');
  }
}
