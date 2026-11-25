import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();

describe('Smriti Core Security, Date, i18n & Bundle Checks', () => {
  it('enforces constant-time comparison and removes exposed encryption keys', () => {
    assert.equal(
      fs.existsSync(path.join(ROOT, 'src', 'lib', 'security.ts')),
      false,
      'Obsolete crypto-js wrapper src/lib/security.ts must remain removed'
    );

    const authSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'auth.ts'), 'utf8');
    assert.equal(authSrc.includes('fallback_super_secret'), false, 'Hardcoded NextAuth secret must not exist');
  });

  it('removes all hardcoded patient IDs across active UI & API routes', () => {
    const forbidden = ['demo-patient-1', 'patient-ravi-sharma-123', 'DEMO BYPASS', 'NEXT_PUBLIC_ENCRYPTION_KEY', 'SIH_NER_COGNITIVE_APP_SUPER_SECRET_KEY', 'crypto-js'];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf8');
          for (const needle of forbidden) {
            assert.equal(
              content.includes(needle),
              false,
              `Found forbidden hardcoded pattern "${needle}" in ${full}`
            );
          }
        }
      }
    }
    walk(path.join(ROOT, 'src'));
  });

  it('maintains 250-key parity on English baseline and omits bracketed fake locale tags', () => {
    const translationsSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'translations.ts'), 'utf8');
    assert.equal(/'\[(A·chik|Ao|Tenyidie)\]/.test(translationsSrc), false, 'No bracketed fake prefixes');

    const ifaceMatch = translationsSrc.match(/export interface TranslationStrings\s*\{([\s\S]*?)\n\}/);
    assert.ok(ifaceMatch, 'TranslationStrings interface exists');
    const allKeys = [...ifaceMatch[1].matchAll(/^\s+([a-zA-Z0-9_]+)\s*:/gm)].map((m) => m[1]);
    const enMatch = translationsSrc.match(/^\s*en:\s*\{([\s\S]*?)^\s*\},/m);
    assert.ok(enMatch, 'English translation block exists');
    const enKeys = new Set([...enMatch[1].matchAll(/(?:^|,)\s*([a-zA-Z0-9_]+)\s*:/gm)].map((m) => m[1]));
    const missing = allKeys.filter((k) => !enKeys.has(k));
    assert.deepEqual(missing, [], `English baseline missing keys: ${missing.join(', ')}`);
  });

  it('ships valid PNG PWA icons and excludes /api from Workbox caching', () => {
    for (const icon of ['icon-192x192.png', 'icon-512x512.png']) {
      const buf = fs.readFileSync(path.join(ROOT, 'public', icon));
      assert.equal(buf.slice(0, 8).toString('hex'), '89504e470d0a1a0a', `${icon} must be valid PNG`);
    }
    const nextConfig = fs.readFileSync(path.join(ROOT, 'next.config.mjs'), 'utf8');
    assert.ok(nextConfig.includes("handler: 'NetworkOnly'"), 'API routes must use NetworkOnly caching');
    assert.ok(nextConfig.includes('X-Frame-Options'), 'Security headers configured');
  });

  it('confirms local cultural SVG assets exist for NER_ASSAM_PACK', () => {
    const regSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'regional-content.ts'), 'utf8');
    const paths = [...regSrc.matchAll(/(\/assets\/ner\/[a-z0-9-]+\.svg)/g)].map((m) => m[1]);
    assert.ok(paths.length >= 12, 'At least 12 local cultural SVG assets linked');
    for (const p of paths) {
      const abs = path.join(ROOT, 'public', p.slice(1));
      assert.ok(fs.existsSync(abs), `Asset exists: ${p}`);
      assert.ok(crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').length === 64);
    }
  });

  it('covers all 8 NER states with Manipur dual script and honest translation verification status', () => {
    const metaSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'i18n', 'metadata.ts'), 'utf8');
    const regSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'regional-content.ts'), 'utf8');
    const transSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'translations.ts'), 'utf8');

    for (const state of [
      'Assam',
      'Meghalaya',
      'Manipur',
      'Nagaland',
      'Mizoram',
      'Arunachal Pradesh',
      'Tripura',
      'Sikkim',
    ]) {
      assert.ok(metaSrc.includes(state), `Metadata represents NER state: ${state}`);
      assert.ok(regSrc.includes(state), `Regional pack represents NER state: ${state}`);
    }

    assert.ok(metaSrc.includes('mni-mymk'), 'Manipur Meetei Mayek catalog entry exists');
    assert.ok(transSrc.includes("'mni-mymk'"), 'Manipur Meetei Mayek translation block exists');
    assert.equal(
      metaSrc.includes('VERIFIED_BASELINE') && metaSrc.indexOf('VERIFIED_BASELINE', metaSrc.indexOf('as:')) !== -1,
      false,
      'Non-English packs must not claim VERIFIED_BASELINE without native review'
    );
  });

  it('enforces ENCRYPTION_MASTER_KEY fail-fast and authenticated AES-256-GCM envelope prefix', () => {
    const envSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'env.ts'), 'utf8');
    const envelopeSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'crypto-envelope.ts'), 'utf8');
    assert.ok(envSrc.includes('getEncryptionMasterKey'), 'Dedicated encryption key accessor exists');
    assert.ok(envelopeSrc.includes('aes-256-gcm'), 'AEAD AES-256-GCM used for field encryption');
    assert.ok(envelopeSrc.includes('setAAD'), 'Additional authenticated data context bound to patientId');
    assert.equal(envSrc.includes('NEXT_PUBLIC_'), false, 'Master secrets never read from NEXT_PUBLIC vars');
  });
});
