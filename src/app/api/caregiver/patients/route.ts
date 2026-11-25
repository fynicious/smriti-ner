import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PairingService } from '@/services/pairing.service';
import { encryptSensitiveField, decryptSensitiveField, hashTokenSha256 } from '@/lib/crypto-envelope';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const VALID_MODES = ['SIMPLE', 'GUIDED', 'FULL'] as const;

export async function GET() {
  try {
    const user = await RBAC.requireSession(['CAREGIVER']);
    if (!user.profileId) {
      return NextResponse.json({ patients: [] });
    }

    const relationships = await PairingService.getAuthorizedPatients(user.profileId);

    const enriched = await Promise.all(
      relationships.map(async (rel) => {
        const p = rel.patient;
        const [patientUser, pref, target] = await Promise.all([
          prisma.user.findUnique({
            where: { id: p.userId },
            select: { loginCode: true, pinHash: true, isActive: true },
          }),
          prisma.patientPreference.findUnique({ where: { patientId: p.id } }),
          prisma.hydrationTarget.findFirst({
            where: { patientId: p.id },
            orderBy: { effectiveFrom: 'desc' },
          }),
        ]);

        return {
          ...rel,
          patient: {
            ...p,
            emergencyContact: decryptSensitiveField(p.emergencyContact, p.id),
            allergies: decryptSensitiveField(p.allergies, p.id),
            diagnoses: decryptSensitiveField(p.diagnoses, p.id),
            loginCode: patientUser?.loginCode || null,
            hasPin: Boolean(patientUser?.pinHash),
            preferences: pref || {
              complexityMode: 'GUIDED',
              scriptPreference: null,
              culturalPackId: 'ner-as-01',
              reducedMotion: false,
              highContrast: false,
              textScale: 1.0,
              voiceEnabled: true,
              voiceRate: 0.85,
              aiEnabled: true,
              aiInteractionStyle: 'BALANCED',
              caregiverLockEnabled: false,
            },
            hydrationTargetMl: target?.targetMl || 2000,
          },
        };
      })
    );

    return NextResponse.json({ patients: enriched });
  } catch (error) {
    return handleApiError(error, 'Caregiver Patients GET');
  }
}

export async function POST(request: Request) {
  try {
    const user = await RBAC.requireSession(['CAREGIVER']);
    if (!user.profileId) {
      throw new BadRequestError('Caregiver profile not initialized');
    }

    const body = await request.json();
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 100) : '';
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    const preferredLanguage = typeof body.preferredLanguage === 'string' && body.preferredLanguage.trim()
      ? body.preferredLanguage.trim().slice(0, 12)
      : 'en';
    const complexityModeRaw = typeof body.complexityMode === 'string' ? body.complexityMode.trim().toUpperCase() : 'GUIDED';
    const complexityMode = VALID_MODES.includes(complexityModeRaw as (typeof VALID_MODES)[number])
      ? complexityModeRaw
      : 'GUIDED';
    const scriptPreference = typeof body.scriptPreference === 'string' && body.scriptPreference.trim()
      ? body.scriptPreference.trim().slice(0, 30)
      : null;

    const hydrationTargetRaw = Number(body.hydrationTargetMl);
    const hydrationTargetMl = Number.isFinite(hydrationTargetRaw)
      ? Math.min(4000, Math.max(500, Math.round(hydrationTargetRaw)))
      : 2000;

    if (fullName.length < 2) {
      throw new BadRequestError('Patient full name must be at least 2 characters');
    }
    if (!/^\d{4,6}$/.test(pin)) {
      throw new BadRequestError('Patient PIN must be 4 to 6 numeric digits');
    }

    const loginCode = `SMR-${crypto.randomInt(100000, 999999)}`;
    const internalAliasEmail = `patient.${crypto.randomBytes(6).toString('hex')}@smriti.local`;
    const unguessablePasswordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const pinHash = await bcrypt.hash(pin, 12);

    const rawQrToken = crypto.randomBytes(24).toString('base64url');
    const tokenHash = hashTokenSha256(rawQrToken);
    const qrExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const bloodGroup = typeof body.bloodGroup === 'string' ? body.bloodGroup.trim().slice(0, 12) || null : null;
    const emergencyRaw = typeof body.emergencyContact === 'string' ? body.emergencyContact.trim().slice(0, 40) : '';
    const allergiesRaw = typeof body.allergies === 'string' ? body.allergies.trim().slice(0, 200) : '';
    const diagnosesRaw = typeof body.diagnoses === 'string' ? body.diagnoses.trim().slice(0, 300) : '';

    const patientProfileId = crypto.randomUUID();

    const created = await prisma.$transaction(async (tx) => {
      const patientUser = await tx.user.create({
        data: {
          email: internalAliasEmail,
          loginCode,
          passwordHash: unguessablePasswordHash,
          pinHash,
          role: 'PATIENT',
          createdByCaregiverId: user.profileId,
          isActive: true,
        },
      });

      const patient = await tx.patientProfile.create({
        data: {
          id: patientProfileId,
          userId: patientUser.id,
          fullName,
          preferredLanguage,
          bloodGroup,
          emergencyContact: emergencyRaw ? encryptSensitiveField(emergencyRaw, patientProfileId) : null,
          allergies: allergiesRaw ? encryptSensitiveField(allergiesRaw, patientProfileId) : null,
          diagnoses: diagnosesRaw ? encryptSensitiveField(diagnosesRaw, patientProfileId) : null,
          isAccountClaimed: false,
        },
      });

      await tx.patientPreference.create({
        data: {
          patientId: patient.id,
          complexityMode,
          scriptPreference,
          updatedByUserId: user.id,
        },
      });

      await tx.hydrationTarget.create({
        data: {
          patientId: patient.id,
          targetMl: hydrationTargetMl,
        },
      });

      await tx.patientCaregiver.create({
        data: {
          patientId: patient.id,
          caregiverId: user.profileId!,
          status: 'ACTIVE',
        },
      });

      await tx.careCircleMember.create({
        data: {
          patientId: patient.id,
          caregiverId: user.profileId!,
          role: 'PRIMARY_CAREGIVER',
          permissions: JSON.stringify([
            'view_clinical',
            'view_routines',
            'edit_routines',
            'view_location',
            'contribute_memories',
            'view_memories',
            'view_updates',
            'manage_settings',
          ]),
          status: 'ACTIVE',
        },
      });

      await tx.patientProvisionToken.create({
        data: {
          patientId: patient.id,
          caregiverId: user.profileId!,
          tokenHash,
          expiresAt: qrExpiresAt,
        },
      });

      await tx.consentRecord.create({
        data: {
          patientId: patient.id,
          grantedByUserId: user.id,
          scope: 'DATA_SYNC',
          granted: true,
          authorityType: 'CAREGIVER_REPRESENTATIVE',
          version: '1.0',
          notes: 'Initial caregiver-provisioned patient account setup',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CAREGIVER_PROVISIONED_PATIENT',
          resource: 'PatientProfile',
          resourceId: patient.id,
          newValue: JSON.stringify({ complexityMode, preferredLanguage, hydrationTargetMl }),
        },
      });

      return patient;
    });

    return NextResponse.json(
      {
        success: true,
        patient: {
          id: created.id,
          fullName: created.fullName,
          preferredLanguage: created.preferredLanguage,
          loginCode,
        },
        onboarding: {
          loginCode,
          qrToken: rawQrToken,
          qrUrlPath: `/login?qr=${encodeURIComponent(rawQrToken)}`,
          expiresAt: qrExpiresAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'Caregiver Patients POST');
  }
}
