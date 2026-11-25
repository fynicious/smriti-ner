import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const CIPHER_PREFIX = 'enc:v1:';
const IV_BYTES = 12;

function loadEnvLocalKey() {
  if (process.env.ENCRYPTION_MASTER_KEY) return process.env.ENCRYPTION_MASTER_KEY;
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return null;
  const raw = fs.readFileSync(envPath, 'utf8');
  const match = raw.match(/^ENCRYPTION_MASTER_KEY=(.+)$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

function resolveKeyBuffer() {
  const raw = loadEnvLocalKey();
  if (!raw) {
    throw new Error('ENCRYPTION_MASTER_KEY is required in env or .env.local');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const b64 = Buffer.from(raw, 'base64');
  if (b64.length === 32) return b64;
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function isEncrypted(val) {
  return typeof val === 'string' && val.startsWith(CIPHER_PREFIX);
}

function encryptEnvelope(plaintext, aadContext, keyBuf) {
  if (!plaintext || isEncrypted(plaintext)) return plaintext;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  if (aadContext) cipher.setAAD(Buffer.from(aadContext, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CIPHER_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dbArgIdx = args.indexOf('--db');
  const customDbPath = dbArgIdx >= 0 && args[dbArgIdx + 1] ? path.resolve(args[dbArgIdx + 1]) : null;

  const targetDbPath = customDbPath || path.join(process.cwd(), 'prisma', 'dev.db');
  if (!fs.existsSync(targetDbPath)) {
    throw new Error(`Target SQLite file not found: ${targetDbPath}`);
  }

  const keyBuf = resolveKeyBuffer();
  const dbUrl = `file:${targetDbPath.replace(/\\/g, '/')}`;
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    const [profiles, reports, wellbeing] = await Promise.all([
      prisma.patientProfile.findMany({
        select: { id: true, emergencyContact: true, allergies: true, diagnoses: true },
      }),
      prisma.caregiverReport.findMany({
        select: { id: true, patientId: true, notes: true },
      }),
      prisma.wellbeingEntry.findMany({
        select: { id: true, patientId: true, notes: true },
      }),
    ]);

    const profileUpdates = [];
    for (const p of profiles) {
      const data = {};
      if (p.emergencyContact && !isEncrypted(p.emergencyContact)) {
        data.emergencyContact = encryptEnvelope(p.emergencyContact, p.id, keyBuf);
      }
      if (p.allergies && !isEncrypted(p.allergies)) {
        data.allergies = encryptEnvelope(p.allergies, p.id, keyBuf);
      }
      if (p.diagnoses && !isEncrypted(p.diagnoses)) {
        data.diagnoses = encryptEnvelope(p.diagnoses, p.id, keyBuf);
      }
      if (Object.keys(data).length > 0) {
        profileUpdates.push({ id: p.id, data });
      }
    }

    const reportUpdates = reports
      .filter((r) => r.notes && !isEncrypted(r.notes))
      .map((r) => ({ id: r.id, notes: encryptEnvelope(r.notes, r.patientId, keyBuf) }));

    const wellbeingUpdates = wellbeing
      .filter((w) => w.notes && !isEncrypted(w.notes))
      .map((w) => ({ id: w.id, notes: encryptEnvelope(w.notes, w.patientId, keyBuf) }));

    const summary = {
      mode: apply ? 'APPLY' : 'DRY_RUN',
      database: targetDbPath,
      scanned: {
        patientProfiles: profiles.length,
        caregiverReports: reports.length,
        wellbeingEntries: wellbeing.length,
      },
      pendingEncryption: {
        patientProfiles: profileUpdates.length,
        caregiverReports: reportUpdates.length,
        wellbeingEntries: wellbeingUpdates.length,
      },
    };

    if (!apply) {
      console.log(JSON.stringify({ ...summary, message: 'Dry run complete. Re-run with --apply to write ciphertext.' }, null, 2));
      return;
    }

    const backupPath = `${targetDbPath}.db-backup-${Date.now()}`;
    fs.copyFileSync(targetDbPath, backupPath);

    await prisma.$transaction(async (tx) => {
      for (const u of profileUpdates) {
        await tx.patientProfile.update({ where: { id: u.id }, data: u.data });
      }
      for (const r of reportUpdates) {
        await tx.caregiverReport.update({ where: { id: r.id }, data: { notes: r.notes } });
      }
      for (const w of wellbeingUpdates) {
        await tx.wellbeingEntry.update({ where: { id: w.id }, data: { notes: w.notes } });
      }
    });

    console.log(
      JSON.stringify(
        {
          ...summary,
          backupCreated: backupPath,
          applied: true,
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
  console.error('[encrypt-existing-fields] Error:', err);
  process.exit(1);
});
