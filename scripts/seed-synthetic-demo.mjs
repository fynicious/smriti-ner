import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

/**
 * Seeds strictly SYNTHETIC demonstration accounts & sample data for public ₹0 preview deployments.
 * Guarded against accidental modification of existing pre-seeded databases.
 * Never store real patient identities or clinical histories in synthetic seeds.
 */
async function main() {
  const prisma = new PrismaClient();
  const encryptionKeyRaw = process.env.ENCRYPTION_MASTER_KEY?.trim();

  function resolveKey() {
    if (!encryptionKeyRaw) return null;
    if (/^[0-9a-fA-F]{64}$/.test(encryptionKeyRaw)) return Buffer.from(encryptionKeyRaw, 'hex');
    const b64 = Buffer.from(encryptionKeyRaw, 'base64');
    if (b64.length === 32) return b64;
    if (encryptionKeyRaw.length >= 32) return crypto.createHash('sha256').update(encryptionKeyRaw, 'utf8').digest();
    return null;
  }

  function encryptIfConfigured(val, aad) {
    const key = resolveKey();
    if (!key || !val) return val;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(val, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  try {
    const demoCgEmail = 'demo.caregiver@smriti.local';
    const existingDemo = await prisma.user.findUnique({ where: { email: demoCgEmail } });
    if (existingDemo) {
      console.log('[seed-synthetic-demo] Demo caregiver already exists; skipping duplicate seed.');
      return;
    }

    const cgPassHash = await bcrypt.hash('DemoCare123!', 12);
    const drPassHash = await bcrypt.hash('DemoDoctor123!', 12);
    const elderPinHash = await bcrypt.hash('1234', 12);

    const caregiverUser = await prisma.user.create({
      data: {
        email: demoCgEmail,
        passwordHash: cgPassHash,
        role: 'CAREGIVER',
        caregiverProfile: {
          create: {
            fullName: 'Rina Bora (Demo Caregiver)',
            phoneNumber: '+910000000001',
          },
        },
      },
      include: { caregiverProfile: true },
    });

    const doctorUser = await prisma.user.create({
      data: {
        email: 'demo.doctor@smriti.local',
        passwordHash: drPassHash,
        role: 'CLINICIAN',
        clinicianProfile: {
          create: {
            fullName: 'Dr. Ananya Das (Demo Clinician)',
            specialization: 'Geriatric Support',
            hospital: 'Guwahati Community Clinic (Demo)',
          },
        },
      },
      include: { clinicianProfile: true },
    });

    const patientProfileId = crypto.randomUUID();
    const elderUser = await prisma.user.create({
      data: {
        email: 'smr-demo-elder@smriti.local',
        loginCode: 'SMR-100001',
        passwordHash: elderPinHash,
        pinHash: elderPinHash,
        role: 'PATIENT',
        createdByCaregiverId: caregiverUser.id,
        patientProfile: {
          create: {
            id: patientProfileId,
            fullName: 'Aita Devi (Demo)',
            bloodGroup: 'O+',
            preferredLanguage: 'as',
            emergencyContact: encryptIfConfigured('+910000000001', patientProfileId),
            allergies: encryptIfConfigured('None (Synthetic Demo)', patientProfileId),
            diagnoses: encryptIfConfigured('Mild memory support (Synthetic Demo)', patientProfileId),
            isAccountClaimed: true,
          },
        },
      },
    });

    await prisma.patientPreference.create({
      data: {
        patientId: patientProfileId,
        complexityMode: 'GUIDED',
        culturalPackId: 'ner-as-01',
        voiceEnabled: true,
        aiEnabled: true,
        updatedByUserId: caregiverUser.id,
      },
    });

    await prisma.hydrationTarget.create({
      data: { patientId: patientProfileId, targetMl: 2000 },
    });

    await prisma.patientCaregiver.create({
      data: {
        patientId: patientProfileId,
        caregiverId: caregiverUser.caregiverProfile.id,
        status: 'ACTIVE',
      },
    });

    await prisma.careCircleMember.create({
      data: {
        patientId: patientProfileId,
        clinicianId: doctorUser.clinicianProfile.id,
        role: 'CLINICIAN',
        permissions: JSON.stringify(['view_clinical', 'edit_clinical', 'view_routines']),
        status: 'ACTIVE',
      },
    });

    await prisma.medication.create({
      data: {
        patientId: patientProfileId,
        clinicianId: doctorUser.clinicianProfile.id,
        name: 'Vitamin D3 (Synthetic Demo)',
        dosage: '1000 IU',
        frequency: 'Once daily',
        time: '09:00',
        instructions: 'Take after breakfast',
        status: 'ACTIVE',
      },
    });

    await prisma.dailyRoutine.create({
      data: {
        patientId: patientProfileId,
        category: 'HYDRATION',
        title: 'Morning Warm Water',
        time: '08:00',
        iconEmoji: '💧',
        color: 'bg-sky-500',
        isActive: true,
      },
    });

    await prisma.scrapbookEntry.create({
      data: {
        patientId: patientProfileId,
        title: 'Bihu Courtyard Gathering (Demo)',
        description: 'Warm spring festival tea with grandchildren',
        imageBase64: '/assets/ner/festival.svg',
        contributorUserId: caregiverUser.id,
        contributorName: 'Rina Bora (Demo)',
        eventDateLabel: 'April Demo',
        locationLabel: 'Guwahati, Assam',
        visibilityScope: 'ALL_APPROVED',
      },
    });

    console.log(
      JSON.stringify(
        {
          seeded: true,
          syntheticAccounts: {
            elder: { loginCode: 'SMR-100001', pin: '1234', userId: elderUser.id },
            caregiver: { email: demoCgEmail, password: 'DemoCare123!' },
            clinician: { email: 'demo.doctor@smriti.local', password: 'DemoDoctor123!' },
          },
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-synthetic-demo] Error:', err);
  process.exit(1);
});
