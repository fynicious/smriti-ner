import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const WORKSPACE = process.cwd();
const ORIG_DB = path.join(WORKSPACE, 'prisma', 'dev.db');
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'smriti-e2e-'));
const TEST_DB = path.join(TEST_DIR, 'e2e_test.db');
const PORT = Number(process.env.TEST_PORT || 3016);
const BASE_URL = `http://localhost:${PORT}`;
const CLINIC_CODE = 'SMRITI-CI-E2E-CODE-2026';

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
      const firstPart = sc.split(';')[0];
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx > 0) {
        const name = firstPart.slice(0, eqIdx).trim();
        const val = firstPart.slice(eqIdx + 1).trim();
        if (val === '' || val === 'deleted') this.cookies.delete(name);
        else this.cookies.set(name, val);
      }
    }
  }

  async req(urlPath, opts = {}) {
    const headers = new Headers(opts.headers || {});
    if (this.cookies.size > 0) {
      headers.set('cookie', Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; '));
    }
    const res = await fetch(`${BASE_URL}${urlPath}`, { ...opts, headers, redirect: opts.redirect || 'manual' });
    this._updateCookies(res);
    return res;
  }

  async json(urlPath, opts = {}) {
    const res = await this.req(urlPath, opts);
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    return { status: res.status, body, headers: res.headers };
  }

  async login(email, password) {
    const csrfRes = await this.json('/api/auth/csrf');
    assert.equal(csrfRes.status, 200);
    const form = new URLSearchParams({
      csrfToken: csrfRes.body.csrfToken,
      mode: 'PASSWORD',
      email,
      password,
      callbackUrl: `${BASE_URL}/`,
      json: 'true',
    });
    const loginRes = await this.req('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    assert.ok([200, 302].includes(loginRes.status));
    const sessionRes = await this.json('/api/auth/session');
    assert.equal(sessionRes.body?.user?.email, email.toLowerCase());
    return sessionRes.body.user;
  }

  async loginPatientPin(loginCode, pin) {
    const csrfRes = await this.json('/api/auth/csrf');
    assert.equal(csrfRes.status, 200);
    const form = new URLSearchParams({
      csrfToken: csrfRes.body.csrfToken,
      mode: 'PATIENT_PIN',
      loginCode,
      pin,
      callbackUrl: `${BASE_URL}/`,
      json: 'true',
    });
    const loginRes = await this.req('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    assert.ok([200, 302].includes(loginRes.status));
    const sessionRes = await this.json('/api/auth/session');
    assert.equal(sessionRes.body?.user?.role, 'PATIENT');
    return sessionRes.body.user;
  }
}

async function waitForServer(timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/csrf`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error('Server startup timeout');
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

async function main() {
  const hasOrigDb = fs.existsSync(ORIG_DB);
  const initialHash = hasOrigDb ? sha256(ORIG_DB) : null;
  const testDbUrl = `file:${TEST_DB.replace(/\\/g, '/')}`;
  prepareIsolatedSqlite(TEST_DB, testDbUrl);

  const masterKey = crypto.randomBytes(32).toString('hex');
  const mediaDir = path.join(TEST_DIR, 'private_media');
  fs.mkdirSync(mediaDir, { recursive: true });

  const server = spawn('node', [path.join(WORKSPACE, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(PORT)], {
    cwd: WORKSPACE,
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
      NEXTAUTH_URL: BASE_URL,
      CLINICIAN_INVITE_CODE: CLINIC_CODE,
      ENCRYPTION_MASTER_KEY: masterKey,
      MEDIA_STORAGE_DIR: mediaDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer();

    const anon = new CookieClient();

    // Check Security Headers & PWA Icons
    const homeRes = await anon.req('/login');
    assert.equal(homeRes.status, 200);
    assert.equal(homeRes.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(homeRes.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(homeRes.headers.get('content-security-policy'), 'CSP header active');

    const swRes = await anon.req('/sw.js');
    if (swRes.status === 200) {
      const swText = await swRes.text();
      assert.ok(swText.includes('NetworkOnly'), 'Generated sw.js enforces NetworkOnly');
    }

    // Check Middleware Route Redirects
    for (const protectedPage of ['/caregiver', '/caregiver/settings', '/doctor', '/profile', '/check-in']) {
      const r = await anon.req(protectedPage);
      assert.equal(r.status, 307, `Expected redirect for ${protectedPage}`);
    }

    // Auth & RBAC E2E Flow: open PATIENT self-registration must be rejected (403)
    const openPatientReg = await anon.json('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'blocked.patient@test.local', password: 'Password123!', fullName: 'Blocked', role: 'PATIENT' }),
    });
    assert.equal(openPatientReg.status, 403, 'Open PATIENT self-signup must be blocked');

    const reg = async (email, fullName, role, extra = {}) => {
      const r = await anon.json('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password123!', fullName, role, ...extra }),
      });
      assert.equal(r.status, 201, `Register ${email}`);
      return r.body.user;
    };

    const cg = 'e2e.caregiver@test.local';
    const dr = 'e2e.clinician@test.local';

    await reg(cg, 'Rina Devi', 'CAREGIVER');
    await reg(dr, 'Dr. Bikash Roy', 'CLINICIAN', { clinicianInviteCode: CLINIC_CODE });

    const clientPA = new CookieClient();
    const clientPB = new CookieClient();
    const clientCG = new CookieClient();
    const clientDR = new CookieClient();

    await clientCG.login(cg, 'Password123!');
    await clientDR.login(dr, 'Password123!');

    // Caregiver provisions Patient A & Patient B using PIN onboarding
    const provA = await clientCG.json('/api/caregiver/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Aita Devi', pin: '1234', preferredLanguage: 'as', complexityMode: 'GUIDED' }),
    });
    assert.equal(provA.status, 201, 'Caregiver provisions Patient A');

    const provB = await clientCG.json('/api/caregiver/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Koka Baruah', pin: '5678', preferredLanguage: 'en', complexityMode: 'SIMPLE' }),
    });
    assert.equal(provB.status, 201, 'Caregiver provisions Patient B');

    const loginCodeA = provA.body.onboarding.loginCode;
    const loginCodeB = provB.body.onboarding.loginCode;
    const sessA = await clientPA.loginPatientPin(loginCodeA, '1234');
    await clientPB.loginPatientPin(loginCodeB, '5678');

    const patientAId = sessA.profileId;

    // Assign Clinician via pairing code + Elder Login Code
    const code2 = await clientCG.json('/api/pairing', { method: 'POST', body: '{}' });
    assert.equal(code2.status, 201);
    const assignDr = await clientDR.json('/api/clinician/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientEmail: loginCodeA, pairingCode: code2.body.code }),
    });
    assert.equal(assignDr.status, 201);

    // Cross-patient isolation
    assert.equal((await clientPB.json(`/api/patients/${patientAId}/medications`)).status, 403);
    assert.equal((await clientPB.json(`/api/patients/${patientAId}/wellbeing`)).status, 403);

    // Language chat & clinical persistence
    const chatRes = await clientPA.json('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: patientAId, lang: 'as', message: 'How much water today?' }),
    });
    assert.equal(chatRes.status, 200);
    assert.ok(chatRes.body.reply);

    const hydPost = await clientPA.json(`/api/patients/${patientAId}/hydration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountMl: 250 }),
    });
    assert.equal(hydPost.status, 201);
    const hydGet = await clientPA.json(`/api/patients/${patientAId}/hydration`);
    assert.equal(hydGet.body.totalMl, 250);

    console.log('ALL E2E INTEGRATION CHECKS PASSED CLEANLY');
  } finally {
    await new Promise((resolve) => {
      server.once('exit', resolve);
      server.kill();
      setTimeout(resolve, 1500);
    });
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    if (hasOrigDb) {
      assert.equal(sha256(ORIG_DB), initialHash, 'Original prisma/dev.db remained untouched');
    }
  }
}

main();
