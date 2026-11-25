# SMRITI (`Smriti-NER`) — Testing & Verification Guide

**Version:** 1.0  
**Last Updated:** 2026-11-25

> Cross-references: [Master Execution Report (Section G)](./SMRITI_AUTONOMOUS_EXECUTION_REPORT.md) · [Security & Privacy](./SMRITI_SECURITY_AND_PRIVACY.md)

---

## 1. Automated Verification Commands

All automated API/E2E suites isolate SQLite and media writes inside `os.tmpdir()`, verifying SHA-256 checksum preservation on `prisma/dev.db`:

```powershell
# 1. Static Type Checking
npm.cmd run typecheck

# 2. ESLint Inspection
npm.cmd run lint

# 3. Production PWA Build (required before E2E tests spawn next start)
npm.cmd run build

# 4. Unit Security, Asset, Crypto & 8-State Localization Tests (7 tests)
npm.cmd test

# 5. Core API & Multi-User RBAC Integration E2E Suite
npm.cmd run test:e2e

# 6. Comprehensive SMRITI v1.0 Security, Consent, Sync, Media & Deletion Suite
node --test tests/v1-comprehensive.test.mjs
```

---

## 2. Observed Test Results (Post-Final Edit, `2026-11-25`)

| Check | Command | Outcome | Notes |
| :--- | :--- | :---: | :--- |
| TypeScript | `npm.cmd run typecheck` | **Passed** (`0` errors) | Verified across all `src/` and App Router routes |
| ESLint | `npm.cmd run lint` | **Passed** (`0` errors) | `15` `@next/next/no-img-element` warnings remain intentionally where dynamic private media routes, Base64 data URIs, or local SVGs render via `<img>` |
| Next.js Build | `npm.cmd run build` | **Passed** (`0` errors) | Compiled all App Router routes, middleware (`48.7 kB`), and Workbox service worker (`public/sw.js`) |
| Unit Security & i18n | `npm.cmd test` | **Passed (`7/7`)** | Secret hygiene, no hardcoded IDs, EN baseline parity, PNG icons + `NetworkOnly` Workbox check, SVG assets, 8-state NER + Manipuri dual-script check, AES-GCM metadata check |
| Core E2E Integration | `npm.cmd run test:e2e` | **Passed (`1/1`)** | Verified CSP/security headers, middleware redirects, `403` open patient signup rejection, Caregiver PIN provisioning, Clinician assignment via `SMR-XXXXXX`, cross-patient `403`, `/api/chat` (`lang: 'as'`), `/api/hydration`, and `prisma/dev.db` SHA-256 unchanged |
| V1 Comprehensive Suite | `node --test tests/v1-comprehensive.test.mjs` | **Passed (`1/1`)** | End-to-end 14-stage run (`~4.3s`): AES-GCM encryption at rest (`enc:v1:`), wrong-AAD tamper failure, single-use QR claim + replay fail, 5-fail PIN lockout + Caregiver reset, Family `CareCircleMember` `403` on vitals/safety, Clinician-only Rx vs Caregiver pill photo (`SMRENC1` on disk + cross-patient `403`), `/api/sync` `clientMutationId` deduplication & `CAREGIVER_CONFIRMED` conflict preservation, `-1` skipped wellbeing, `LOCATION_SHARING` consent withdrawal `403`, SOS `deliveryStatus: 'AUDIT_LOGGED_ONLY'`, `AI_COMPANION` consent fallback, `scripts/encrypt-existing-fields.mjs` dry-run + apply backfill, and `POST /api/account/delete` media wipe |
| Browser Verification | Playwright Subagent against isolated preview (`http://localhost:3018`) | **Passed (Interactive Flows)** | Verified Patient PIN keypad login -> Guided Home (`Aita Devi`, Assamese) -> Check-in -> Profile; Caregiver Dashboard (`Confirm Taken` + `Caregiver-confirmed` badge), Settings, Routines (`Print Kitchen Wall Schedule`); Clinician Portal (`Donepezil` Rx + Timeline). Zero console errors and zero layout overlap; `localResources`/`cognitiveTrends`/`saveHealthUpdate` i18n fallback fixed after run |

---

## 3. Manual / Environment-Blocked Test Procedures

Tests requiring external paid/third-party credentials or hardware remain unexecuted locally and follow these exact reproducible verification procedures once provisioned:
1. **Twilio SMS SOS Dispatch:** Populate `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `CAREGIVER_PHONE_NUMBER` in staging `.env` -> trigger `POST /api/alert` -> assert `{ delivered: true, smsSent: true, deliveryStatus: 'CONFIRMED_SMS', simulated: false }`.
2. **External LLM (`Groq` / `Gemini`) Live Integration:** Execute conversational prompt (`AI_COMPANION` granted) in `/api/chat` against staging API keys -> verify PII scrubbing (`stripDirectPii`) and fallback behavior under HTTP `429`/`503`.
3. **Native-Speaker NER Linguistic Audit & Offline Audio:** Recruit native reviewers per state in [Language Validation](./SMRITI_LANGUAGE_VALIDATION.md) -> complete missing translations -> record core prompts under `/caregiver/voice` -> test offline playback on target Android Chrome / Samsung Internet WebView devices.
