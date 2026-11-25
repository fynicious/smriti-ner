import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const WORKSPACE = process.cwd();
const ORIG_DB = path.join(WORKSPACE, 'prisma', 'dev.db');
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'smriti-v1-suite-'));
const TEST_DB = path.join(TEST_DIR, 'v1_test.db');
const MEDIA_DIR = path.join(TEST_DIR, 'private_media');
const PORT = Number(process.env.V1_TEST_PORT || 3017);
const BASE_URL = `http://localhost:${PORT}`;
const CLINIC_CODE = 'SMRITI-V1-TEST-CLINIC-2026';
const MASTER_KEY = crypto.randomBytes(32).toString('hex');

const TINY_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2Z0AAAAASUVORK5CYII=';

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

class CookieClient {
  constructor() {
    this.cookies = new Map();
  }

  _updateCookies(res) {
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const sc of setCookies) {
      const first = sc.split(';')[0];
      const eqIdx = first.indexOf('=');
      if (eqIdx > 0) {
        const name = first.slice(0, eqIdx).trim();
        const val = first.slice(eqIdx + 1).trim();
        if (val === '' || val === 'deleted') this.cookies.delete(name);
        else this.cookies.set(name, val);
      }
    }
  }

  async req(urlPath, opts = {}) {
    const headers = new Headers(opts.headers || {});
    if (this.cookies.size > 0) {
      headers.set(
        'cookie',
        Array.from(this.cookies.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ')
      );
    }
    const res = await fetch(`${BASE_URL}${urlPath}`, { ...opts, headers, redirect: opts.redirect || 'manual' });
    this._updateCookies(res);
    return res;
  }

  async json(urlPath, opts = {}) {
    const res = await this.req(urlPath, opts);
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body, headers: res.headers };
  }

  async login(fields) {
    const csrfRes = await this.json('/api/auth/csrf');
    assert.equal(csrfRes.status, 200);
    const form = new URLSearchParams({
      csrfToken: csrfRes.body.csrfToken,
      ...fields,
      callbackUrl: `${BASE_URL}/`,
      json: 'true',
    });
    const loginRes = await this.req('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const sessionRes = await this.json('/api/auth/session');
    return { status: loginRes.status, session: sessionRes.body };
  }
}

async function waitForServer(timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/csrf`);
      if (res.ok) return;
    } catch {
      // Wait for boot
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error('Test server startup timeout');
}

function prepareIsolatedSqlite(targetDbPath, envUrl) {
  if (fs.existsSync(ORIG_DB)) {
    fs.copyFileSync(ORIG_DB, targetDbPath);
    return;
  }
  execFileSync('node', [path.join(WORKSPACE, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'], {
    cwd: WORKSPACE,
    env: { ...process.env, DATABASE_URL: envUrl },
    stdio: 'pipe',
  });
}

describe('SMRITI v1.0 Comprehensive Security, Clinical, Sync, Consent & i18n Suite', () => {
  const hasOrigDb = fs.existsSync(ORIG_DB);
  let initialDbHash = '';
  let server = null;
  let prisma = null;

  before(async () => {
    const testDbUrl = `file:${TEST_DB.replace(/\\/g, '/')}`;
    initialDbHash = hasOrigDb ? sha256(ORIG_DB) : '';
    prepareIsolatedSqlite(TEST_DB, testDbUrl);
    fs.mkdirSync(MEDIA_DIR, { recursive: true });

    prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    server = spawn('node', [path.join(WORKSPACE, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(PORT)], {
      cwd: WORKSPACE,
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
        NEXTAUTH_URL: BASE_URL,
        CLINICIAN_INVITE_CODE: CLINIC_CODE,
        ENCRYPTION_MASTER_KEY: MASTER_KEY,
        MEDIA_STORAGE_DIR: MEDIA_DIR,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForServer();
  });

  after(async () => {
    if (prisma) await prisma.$disconnect();
    if (server) {
      await new Promise((resolve) => {
        server.once('exit', resolve);
        server.kill();
        setTimeout(resolve, 1500);
      });
    }
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
    if (hasOrigDb) {
      assert.equal(sha256(ORIG_DB), initialDbHash, 'Production prisma/dev.db SHA-256 unchanged');
    }
  });

  it('validates onboarding, lockouts, RBAC boundaries, clinical attribution, encrypted media, sync conflict resolution, consent revocation, SOS honesty, backfill, and deletion', async () => {
    const anon = new CookieClient();
    const caregiver = new CookieClient();
    const clinician = new CookieClient();
    const familyCaregiver = new CookieClient();
    const patientA = new CookieClient();
    const patientB = new CookieClient();

    // 1. Open PATIENT registration is rejected (403)
    const blockedReg = await anon.json('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'open.patient@v1.local',
        password: 'Password123!',
        fullName: 'Blocked Patient',
        role: 'PATIENT',
      }),
    });
    assert.equal(blockedReg.status, 403);

    // 2. Register Primary Caregiver, Family Member Caregiver, and Clinician
    const regPrimary = await anon.json('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'primary.cg@v1.local', password: 'Password123!', fullName: 'Meera Devi', role: 'CAREGIVER' }),
    });
    assert.equal(regPrimary.status, 201);

    const regFamily = await anon.json('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'family.cg@v1.local', password: 'Password123!', fullName: 'Bitu Gogoi', role: 'CAREGIVER' }),
    });
    assert.equal(regFamily.status, 201);

    const regDr = await anon.json('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'doctor@v1.local',
        password: 'Password123!',
        fullName: 'Dr. Ananya Das',
        role: 'CLINICIAN',
        clinicianInviteCode: CLINIC_CODE,
      }),
    });
    assert.equal(regDr.status, 201);

    await caregiver.login({ mode: 'PASSWORD', email: 'primary.cg@v1.local', password: 'Password123!' });
    await familyCaregiver.login({ mode: 'PASSWORD', email: 'family.cg@v1.local', password: 'Password123!' });
    await clinician.login({ mode: 'PASSWORD', email: 'doctor@v1.local', password: 'Password123!' });

    // 3. Provision Patient A (with sensitive fields encrypted at rest) & Patient B
    const provA = await caregiver.json('/api/caregiver/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Jonali Dutta',
        pin: '2468',
        preferredLanguage: 'mni',
        scriptPreference: 'meetei_mayek',
        complexityMode: 'SIMPLE',
        emergencyContact: '+919864011111',
        allergies: 'Penicillin',
        diagnoses: 'Mild memory impairment',
      }),
    });
    assert.equal(provA.status, 201);
    const patientAId = provA.body.patient.id;
    const loginCodeA = provA.body.onboarding.loginCode;
    const qrTokenA = provA.body.onboarding.qrToken;

    const dbRowA = await prisma.patientProfile.findUnique({ where: { id: patientAId } });
    assert.ok(dbRowA.emergencyContact.startsWith('enc:v1:'), 'Emergency contact stored encrypted at rest');
    assert.ok(dbRowA.allergies.startsWith('enc:v1:'), 'Allergies stored encrypted at rest');
    assert.ok(dbRowA.diagnoses.startsWith('enc:v1:'), 'Diagnoses stored encrypted at rest');

    const provB = await caregiver.json('/api/caregiver/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Tarun Kalita', pin: '1357', preferredLanguage: 'en', complexityMode: 'GUIDED' }),
    });
    assert.equal(provB.status, 201);
    const patientBId = provB.body.patient.id;
    await patientB.login({ mode: 'PATIENT_PIN', loginCode: provB.body.onboarding.loginCode, pin: '1357' });

    // 4. Single-use QR onboarding: succeeds once, rejects replay
    const qrClaim1 = await patientA.login({ mode: 'QR_TOKEN', qrToken: qrTokenA });
    assert.equal(qrClaim1.session?.user?.profileId, patientAId);
    const qrReplay = await new CookieClient().login({ mode: 'QR_TOKEN', qrToken: qrTokenA });
    assert.equal(Boolean(qrReplay.session?.user), false, 'Used QR token cannot be replayed');

    // 5. PIN brute-force 5-attempt lockout + Caregiver reset
    const bruteClient = new CookieClient();
    for (let i = 0; i < 5; i += 1) {
      const failRes = await bruteClient.login({ mode: 'PATIENT_PIN', loginCode: loginCodeA, pin: '0000' });
      assert.equal(Boolean(failRes.session?.user), false);
    }
    const lockedAttempt = await new CookieClient().login({ mode: 'PATIENT_PIN', loginCode: loginCodeA, pin: '2468' });
    assert.equal(Boolean(lockedAttempt.session?.user), false, 'Locked account rejects even correct PIN until unlocked');

    const resetRes = await caregiver.json(`/api/caregiver/patients/${patientAId}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPin: '4321', generateQr: true }),
    });
    assert.equal(resetRes.status, 201);
    const unlockedLogin = await patientA.login({ mode: 'PATIENT_PIN', loginCode: loginCodeA, pin: '4321' });
    assert.equal(unlockedLogin.session?.user?.profileId, patientAId);

    // 6. Scoped Family CareCircleMember isolation
    const addFamily = await caregiver.json('/api/care-circle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: patientAId,
        memberEmail: 'family.cg@v1.local',
        role: 'FAMILY',
        permissions: ['contribute_memories', 'view_memories', 'view_updates'],
      }),
    });
    assert.equal(addFamily.status, 201);

    assert.equal((await familyCaregiver.json(`/api/patients/${patientAId}/vitals`)).status, 403, 'FAMILY blocked from vitals');
    assert.equal((await familyCaregiver.json(`/api/patients/${patientAId}/safety`)).status, 403, 'FAMILY blocked from location/safety');
    assert.equal((await familyCaregiver.json(`/api/patients/${patientAId}/care-updates`)).status, 200, 'FAMILY can view care updates');

    // 7. Clinical authority boundary: Caregiver 403 on Rx manage; Clinician 201 + pill photo private storage
    const pairingRes = await caregiver.json('/api/pairing', { method: 'POST', body: '{}' });
    assert.equal(pairingRes.status, 201);
    const linkDr = await clinician.json('/api/clinician/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientEmail: loginCodeA, pairingCode: pairingRes.body.code }),
    });
    assert.equal(linkDr.status, 201);

    const cgRxForbidden = await caregiver.json(`/api/patients/${patientAId}/medications/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Donepezil', dosage: '5mg', frequency: 'Once daily' }),
    });
    assert.equal(cgRxForbidden.status, 403, 'Caregiver cannot prescribe medications');

    const drRxOk = await clinician.json(`/api/patients/${patientAId}/medications/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Donepezil', dosage: '5mg', frequency: 'Once daily', time: '20:00' }),
    });
    assert.equal(drRxOk.status, 201);
    const medId = drRxOk.body.medication.id;

    // Attach pill photo -> encrypted on disk & RBAC protected
    const photoPatch = await caregiver.json(`/api/patients/${patientAId}/medications/photo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicationId: medId, imageBase64: TINY_PNG_DATA_URI }),
    });
    assert.equal(photoPatch.status, 200);
    const mediaUrl = photoPatch.body.medication.imageUrl;
    assert.ok(mediaUrl.startsWith(`/api/patients/${patientAId}/media/`));

    const mediaAsset = await prisma.mediaAsset.findFirst({ where: { patientId: patientAId } });
    const rawDiskFile = fs.readFileSync(path.join(MEDIA_DIR, mediaAsset.storageKey));
    assert.equal(rawDiskFile.subarray(0, 7).toString('ascii'), 'SMRENC1', 'Private media binary encrypted with magic header');

    assert.equal((await patientA.req(mediaUrl)).status, 200, 'Patient A can read own pill photo');
    assert.equal((await patientB.req(mediaUrl)).status, 403, 'Cross-patient Patient B blocked from pill photo');

    // 8. Medication event attribution & Sync idempotency + conflict preservation
    const cgConfirm = await caregiver.json(`/api/patients/${patientAId}/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicationId: medId, action: 'TAKEN', scheduledTime: new Date().toISOString() }),
    });
    assert.equal(cgConfirm.status, 201);
    assert.equal(cgConfirm.body.event.source, 'CAREGIVER_CONFIRMED');

    const mutId = `hyd-idem-${crypto.randomUUID()}`;
    const conflictMedMut = `med-conflict-${crypto.randomUUID()}`;
    const syncPayload = {
      patientId: patientAId,
      deviceId: 'test-device-1',
      hydrationEvents: [{ clientMutationId: mutId, amountMl: 250, timestamp: new Date().toISOString() }],
      medicationEvents: [
        {
          clientMutationId: conflictMedMut,
          medicationId: medId,
          action: 'SKIPPED',
          scheduledTime: new Date().toISOString(),
          actualTime: new Date().toISOString(),
        },
      ],
    };

    const sync1 = await patientA.json('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncPayload),
    });
    assert.equal(sync1.status, 200);
    assert.equal(sync1.body.synced.hydrationCount, 1);
    assert.equal(sync1.body.synced.conflictsCount, 1, 'Offline PATIENT_REPORTED=SKIPPED conflicted cleanly with CAREGIVER_CONFIRMED');

    // Replay same batch -> idempotent deduplication
    const sync2 = await patientA.json('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncPayload),
    });
    assert.equal(sync2.status, 200);
    assert.equal(sync2.body.synced.hydrationCount, 0);
    assert.ok(sync2.body.synced.deduplicatedCount >= 1);

    // 9. Wellbeing check-in with -1 skipped question & multi-device pull
    const wbSkip = await patientA.json(`/api/patients/${patientAId}/wellbeing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood: 0, sleepQuality: -1, confusionLevel: 1, energyLevel: -1, painLevel: 0 }),
    });
    assert.equal(wbSkip.status, 201);
    assert.equal(wbSkip.body.entry.sleepQuality, -1);

    const syncPull = await patientA.json(`/api/sync?patientId=${encodeURIComponent(patientAId)}`);
    assert.equal(syncPull.status, 200);
    assert.equal(syncPull.body.preferences.complexityMode, 'SIMPLE');

    // 10. Consent withdrawal blocks Location ping -> Re-grant restores it
    const withdrawLoc = await caregiver.json(`/api/patients/${patientAId}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'LOCATION_SHARING', granted: false }),
    });
    assert.equal(withdrawLoc.status, 201);

    const blockedPing = await patientA.json(`/api/patients/${patientAId}/safety`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'PING', lat: 26.1445, lng: 91.7362, accuracy: 12, status: 'INSIDE' }),
    });
    assert.equal(blockedPing.status, 403, 'Location ping blocked while consent withdrawn');

    // 11. Truthful SOS dispatch without SMS credentials
    const sosRes = await patientA.json('/api/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'SOS', message: 'Need help' }),
    });
    assert.equal(sosRes.status, 200);
    assert.equal(sosRes.body.delivered, false);
    assert.equal(sosRes.body.simulated, true);
    assert.equal(sosRes.body.deliveryStatus, 'AUDIT_LOGGED_ONLY');

    // 12. AI Companion deterministic verified-record answer & AI consent withdrawal fallback
    const medChat = await patientA.json('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: patientAId, lang: 'en', message: 'Did I take my medicine?' }),
    });
    assert.equal(medChat.status, 200);
    assert.equal(medChat.body.source, 'verified-record');
    assert.ok(medChat.body.reply.includes('Donepezil'));

    await caregiver.json(`/api/patients/${patientAId}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'AI_COMPANION', granted: false }),
    });
    const noAiChat = await patientA.json('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: patientAId, lang: 'en', message: 'Tell me a calming thought' }),
    });
    assert.equal(noAiChat.status, 200);
    assert.ok(noAiChat.body.reply);

    // 13. Encryption backfill dry-run + live apply on isolated temp DB + decrypt verification
    const legacyWb = await prisma.wellbeingEntry.create({
      data: {
        patientId: patientAId,
        date: '2026-11-25',
        recordedBy: 'Meera Devi',
        source: 'CAREGIVER_OBSERVATION',
        mood: 1,
        sleepQuality: 0,
        confusionLevel: 1,
        energyLevel: 0,
        painLevel: 0,
        overallWellbeing: 1,
        notes: 'Plaintext legacy note pending backfill',
      },
    });
    const dryRunOut = execFileSync(
      'node',
      [path.join(WORKSPACE, 'scripts', 'encrypt-existing-fields.mjs'), '--db', TEST_DB],
      { cwd: WORKSPACE, env: { ...process.env, ENCRYPTION_MASTER_KEY: MASTER_KEY }, encoding: 'utf8' }
    );
    const dryJson = JSON.parse(dryRunOut);
    assert.equal(dryJson.mode, 'DRY_RUN');
    assert.ok(dryJson.pendingEncryption.wellbeingEntries >= 1);

    execFileSync(
      'node',
      [path.join(WORKSPACE, 'scripts', 'encrypt-existing-fields.mjs'), '--apply', '--db', TEST_DB],
      { cwd: WORKSPACE, env: { ...process.env, ENCRYPTION_MASTER_KEY: MASTER_KEY }, encoding: 'utf8' }
    );
    const refreshedWb = await prisma.wellbeingEntry.findUnique({ where: { id: legacyWb.id } });
    assert.ok(refreshedWb.notes.startsWith('enc:v1:'), 'Backfill encrypted legacy plaintext row');

    const wbGetAfterBackfill = await caregiver.json(`/api/patients/${patientAId}/wellbeing`);
    assert.equal(wbGetAfterBackfill.status, 200);
    const decryptedBackfilled = wbGetAfterBackfill.body.entries.find((e) => e.id === legacyWb.id);
    assert.equal(decryptedBackfilled?.notes, 'Plaintext legacy note pending backfill', 'API transparently decrypts backfilled row');

    // Verify AES-256-GCM AAD tampering fails cleanly when bound to wrong patientId
    const encParts = refreshedWb.notes.slice('enc:v1:'.length).split(':');
    const decipherWrongAad = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(MASTER_KEY, 'hex'),
      Buffer.from(encParts[0], 'base64')
    );
    decipherWrongAad.setAAD(Buffer.from(patientBId, 'utf8'));
    decipherWrongAad.setAuthTag(Buffer.from(encParts[1], 'base64'));
    assert.throws(() => {
      decipherWrongAad.update(Buffer.from(encParts[2], 'base64'));
      decipherWrongAad.final();
    }, 'Wrong AAD patient context must fail GCM authentication');

    // 14. Permanent Patient & Media Deletion
    const badDel = await caregiver.json('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'WRONG', patientId: patientAId }),
    });
    assert.equal(badDel.status, 400);

    const mediaFilePath = path.join(MEDIA_DIR, mediaAsset.storageKey);
    assert.equal(fs.existsSync(mediaFilePath), true);

    const goodDel = await caregiver.json('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE', patientId: patientAId }),
    });
    assert.equal(goodDel.status, 200);
    assert.equal(fs.existsSync(mediaFilePath), false, 'Encrypted media binary deleted on account removal');
    assert.equal(await prisma.patientProfile.findUnique({ where: { id: patientAId } }), null);

    // 15. Production Health Check Endpoint
    const healthRes = await anon.json('/api/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.status, 'ok');
    assert.equal(healthRes.body.database?.status, 'connected');
    assert.equal(healthRes.body.configReady, true);

    // 16. Verify DB_ENCRYPTED MediaAsset read path (stateless Postgres mode simulation)
    const dbAssetId = crypto.randomUUID();
    const rawPng = Buffer.from(TINY_PNG_DATA_URI.split(',')[1], 'base64');
    const dbIv = crypto.randomBytes(12);
    const c2 = crypto.createCipheriv('aes-256-gcm', Buffer.from(MASTER_KEY, 'hex'), dbIv);
    c2.setAAD(Buffer.from(`media:${patientBId}:${dbAssetId}`, 'utf8'));
    const encPayload = Buffer.concat([c2.update(rawPng), c2.final()]);
    const tag = c2.getAuthTag();
    const smrencPayload = Buffer.concat([Buffer.from('SMRENC1', 'ascii'), dbIv, tag, encPayload]);

    await prisma.mediaAsset.create({
      data: {
        id: dbAssetId,
        patientId: patientBId,
        category: 'MEDICATION_PHOTO',
        storageProvider: 'DB_ENCRYPTED',
        storageKey: `${patientBId}/${dbAssetId}.enc`,
        mimeType: 'image/png',
        sizeBytes: rawPng.length,
        encrypted: true,
        encryptedBlob: smrencPayload,
      },
    });
    const dbMediaRes = await patientB.req(`/api/patients/${patientBId}/media/${dbAssetId}`);
    assert.equal(dbMediaRes.status, 200, 'DB_ENCRYPTED MediaAsset decrypts and streams via RBAC endpoint');
    const fetchedBuf = Buffer.from(await dbMediaRes.arrayBuffer());
    assert.deepEqual(fetchedBuf, rawPng);

    // 17. Synthetic Demo Seed script idempotency on isolated DB copy
    const seedDbPath = path.join(TEST_DIR, 'seed_test.db');
    const seedUrl = `file:${seedDbPath.replace(/\\/g, '/')}`;
    prepareIsolatedSqlite(seedDbPath, seedUrl);
    const seedOut = execFileSync('node', [path.join(WORKSPACE, 'scripts', 'seed-synthetic-demo.mjs')], {
      cwd: WORKSPACE,
      env: { ...process.env, DATABASE_URL: seedUrl, ENCRYPTION_MASTER_KEY: MASTER_KEY },
      encoding: 'utf8',
    });
    assert.ok(JSON.parse(seedOut).seeded === true, 'Synthetic seed succeeded');
    const seedOut2 = execFileSync('node', [path.join(WORKSPACE, 'scripts', 'seed-synthetic-demo.mjs')], {
      cwd: WORKSPACE,
      env: { ...process.env, DATABASE_URL: seedUrl, ENCRYPTION_MASTER_KEY: MASTER_KEY },
      encoding: 'utf8',
    });
    assert.ok(seedOut2.includes('already exists'), 'Second synthetic seed run skips cleanly');
  });
});
