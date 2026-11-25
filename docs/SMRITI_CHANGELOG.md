# SMRITI (Smriti-NER) — Engineering Remediation Changelog

This log tracks every remediation phase, modified file, test executed, result, and known limitation.

---

## Phase Zero: Pre-Implementation Safety & Baseline (2026-11-25)

### Actions Performed
1. Confirmed project root: `C:\E_Drive\final ka final build` (Git not initialized; `.git` absent).
2. Read `docs/SMRITI_COMPREHENSIVE_AUDIT.md` and `docs/SMRITI_ISSUE_TRACKER.md` completely.
3. Verified database file state: `prisma/dev.db` (`208,896` bytes; SHA256 `66D72C48D94805C61941E9D1407C78BA226CE7607C727BE8142222D36AE587AE`; contains 3 `PATIENT` user profiles and 0 rows in all 18 clinical/activity tables).
4. Created full timestamped pre-remediation backup at `C:\E_Drive\smriti_backup_20261125_1601` (129 files excluding `node_modules` and `.next`) and verified SHA256 parity and SQLite header readability (`SQLite format 3 `).
5. Recorded pre-remediation build, schema, and lint baseline.

### Baseline Diagnostic Results
- **`prisma validate`:** Passed (`The schema at prisma\schema.prisma is valid`).
- **`tsc --noEmit`:** **Failed — 59 TypeScript errors** (suppressed in `next.config.mjs` via `typescript.ignoreBuildErrors: true`).
- **`eslint src`:** **Failed — 146 errors, 15 warnings** (suppressed in `next.config.mjs` via `eslint.ignoreDuringBuilds: true`).
- **`next build`:** Built only because TS & ESLint gates are suppressed (`next-pwa` regenerates `public/sw.js` during build).
- **Issue Tracker Baseline:** 42 `OPEN` issues (12 Critical / P0, 18 High, 10 Medium, 2 Low).

### Known Limitations Entering P0
- Automated test suite does not exist yet (0 unit/integration/E2E tests).
- `.env.local` currently lacks `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `DATABASE_URL` (Twilio variables are also unset).
- SQLite (`file:./dev.db`) remains the active development database pending completion of P1 reliability work and explicit authorization before any production PostgreSQL migration.

---

## Phase P0: Security & Critical Stability (2026-11-25)

### Issues Addressed
- `SMR-001`, `SMR-002`, `SMR-003`, `SMR-004`, `SMR-005`, `SMR-006`, `SMR-007`, `SMR-008`, `SMR-009`, `SMR-010`, `SMR-011`, `SMR-012`, `SMR-025`

### Files Created / Modified
- **Created:** `src/lib/env.ts`, `src/lib/api-errors.ts`, `src/middleware.ts`, `.env.example`
- **Modified:** `.env.local` (added random `NEXTAUTH_SECRET` and `NEXTAUTH_URL`), `next.config.mjs` (removed `ignoreDuringBuilds` & `ignoreBuildErrors`), `types/next-auth.d.ts`, `src/lib/auth.ts`, `src/lib/security.ts`, `src/lib/rbac.ts`, `src/lib/prisma.ts`, `src/lib/db.ts`, `src/lib/translations.ts`, `src/services/{cms,hydration,medication,timeline}.service.ts`, `src/app/api/**` (all routes updated for RBAC, validation, error handling, and SQLite compatibility), `src/app/{page,login/page,register/page,profile/page,check-in/page,help-near-me/page,scrapbook/page,layout}.tsx`, `src/app/caregiver/**`, `src/app/doctor/page.tsx`, `src/app/games/**`, `src/components/{dashboard/DailyMemory,dashboard/TodaysCare,games/GameContainer,layout/BottomNav,mood/MoodTracker,patient/NowCard,patient/PlannerTimeline,patient/RoutineNotification,patient/TimeWeatherWidget,voice/ConversationalUI}.tsx`, `src/hooks/{useDailyPlanner,useGeolocationEngine}.ts`

### Tests & Verification Results
- **`tsc --noEmit`:** Passed (`0` errors; down from `59`).
- **`eslint src`:** Passed (`0` errors, `11` warnings; down from `146` errors, `15` warnings).
- **`next build`:** Passed cleanly with TS & ESLint checks enforced (`48.7 kB` Edge middleware generated).
- **Live HTTP/Middleware Verification (`next start` on port `3010`):**
  - All 11 protected API routes returned `401 Unauthorized` when unauthenticated (zero `500`s, zero unauthenticated `200` leaks).
  - Weak registration password (`"123"`) rejected with `400`; unverified `CLINICIAN` registration rejected with `403`.
  - Unauthenticated requests to `/caregiver`, `/caregiver/settings`, `/caregiver/circle`, `/caregiver/safety`, `/doctor`, `/profile`, and `/check-in` returned `307` redirects to `/login`.
- **Production Bundle JS Check:** Validated all `35` compiled `.next/static/chunks/app/**/*.js` bundles (`0` SyntaxErrors).
- **Database Safety:** `prisma/dev.db` remained unchanged (`208,896` bytes).


---

## Phase P1: Database Schema, Core APIs & End-to-End Workflows (2026-11-25)

### Issues Addressed
- `SMR-013` (Partial: SQLite schema expanded; PostgreSQL deferred to deployment authorization), `SMR-014`, `SMR-015`, `SMR-016`, `SMR-017`, `SMR-018`, `SMR-019`, `SMR-020`, `SMR-021`, `SMR-022`, `SMR-023`, `SMR-024`, `SMR-026`
- Also resolved foundational parts of P2 items during workflow wiring (`SMR-029`, `SMR-030`, `SMR-031`, `SMR-032`, `SMR-033`, `SMR-036`) — full P2 sweep & browser E2E verification next.

### Files Created / Modified
- **Schema & Env:** `prisma/schema.prisma` (added 12 missing clinical/caregiver/resource/scrapbook models, composite `@@index` declarations, `Medication.time`), `.env`, `.gitignore`
- **Assets & Libraries:** Created `public/assets/ner/*.svg` (14 local cultural/scene SVGs), `src/lib/dateUtils.ts`, `src/lib/cognitive-logger.ts`, updated `src/lib/regional-content.ts`, `src/lib/db.ts` (fixed Dexie sync query + UUID mapping), `src/hooks/{useActivePatient,useDailyPlanner,useGeolocationEngine,useGameAdaptation,useSync}.ts`
- **Backend APIs & Services:** Created `src/app/api/{pairing,profile,clinician/patients,resources}/route.ts`, `src/app/api/patients/[patientId]/{routines,wellbeing,vitals,medications/manage,safety,family-assets,scrapbook,care-updates}/route.ts`; expanded `src/app/api/sync/route.ts`, `src/services/{hydration,medication}.service.ts`, and `src/app/api/patients/[patientId]/{hydration,medications}/route.ts`
- **Frontend Portals & Games:** Created `src/components/caregiver/CaregiverPatientBar.tsx`; updated `src/components/{games/GameContainer,patient/NowCard,patient/PlannerTimeline}.tsx`; updated `src/app/{page,profile/page,check-in/page,help-near-me/page,scrapbook/page,doctor/page}.tsx`, all 9 `src/app/caregiver/**/*.tsx` pages, and `src/app/games/{page,color-sequence/page,find-the-item/page,guess-faces/page,memory-match/page,pattern-weave/page,recognize-voices/page,sorting-game/page,word-garden/page}.tsx`; removed orphaned unreferenced `src/components/dashboard/*` prototype files.

### Tests & Verification Results
- **`prisma db push` & `prisma generate`:** Validated on isolated scratch copy first, then applied to `prisma/dev.db` preserving all `3` pre-existing user & patient profiles (`dev.db users: 3, patients: 3`).
- **`tsc --noEmit`:** Passed (`0` errors).
- **`eslint src`:** Passed (`0` errors, `8` warnings).
- **`next build`:** Passed cleanly (`45/45` static pages + Edge middleware + all dynamic API routes).
- **Automated Integration Suite (`p1_integration_test.mjs` against disposable DB copy on port `3015`):**
  - Unauthenticated access to new endpoints blocked with `401`.
  - Patient A, Patient B, Caregiver, Clinician registration + invite code enforcement (`403` invalid code, `201` valid code) + JWT login verified.
  - Pairing & Clinician patient assignment (`6-digit` invite codes) verified.
  - Cross-patient IDOR isolation across Patient B, Caregiver, and Clinician verified (`403` on all attempts).
  - Full persistence verified for Profile, Medications, Hydration, Routines, Wellbeing (`0` score preservation), Vitals, SafeZones & `ZONE_EXIT` transitions, Family Assets, Scrapbook, Care Updates, NER Resources + bookmarks, Cognitive Telemetry, Rule-based Predictor, Timeline, and multi-collection `/api/sync`.
- **Database Integrity:** `prisma/dev.db` SHA256 remained identical before and after test suite (`9706c9c443c1c5816275d3c32821189bf87885b319f8b09e7f19c6986520e11a`).

---

## Phase P2, P3 & P4: UX/Accessibility, Localization, PWA Security & Final E2E Verification (2026-11-25)

### Issues Addressed
- **P2 (`SMR-027`..`SMR-036`):** Global nav/floating control hiding on auth/check-in, `shrink-0` nav spacing, contrast & ARIA compliance, 0 native `alert()`/`confirm()` or clickable `<div>` handlers, responsive grids, orphaned component cleanup (`WelcomeScreen.tsx`, `MoodTracker.tsx`), gentle retry in `pattern-weave`, live Open-Meteo fallback in `TimeWeatherWidget`
- **P3 (`SMR-037`..`SMR-039`):** English `250/250` key parity in `src/lib/translations.ts`, stripped `729` fake bracketed prefixes (`[A·chik]`, `[Ao]`, `[Tenyidie]`), safe fallback Proxy across all 16 locales, language-aware `/api/chat` + `ConversationalUI` voice/keyboard fallbacks
- **P4 (`SMR-040`..`SMR-042`):** Generated valid RGBA PNGs `public/icon-{192x192,512x512}.png`, configured Workbox `NetworkOnly` for `/api/.*`, updated `public/manifest.json` & `.gitignore`, configured HTTP security headers (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) in `next.config.mjs`, added `tests/{unit-security.test.mjs,integration-e2e.mjs}` & `package.json` scripts (`test`, `test:e2e`, `typecheck`), finalized `docs/SMRITI_DEPLOYMENT_PLAN.md`

### Final Verification Gate
- **TypeScript (`tsc --noEmit`):** `0` errors
- **ESLint (`eslint src`):** `0` errors (`8` non-blocking `@next/next/no-img-element` warnings on local SVGs / uploaded base64 previews)
- **Production Build (`next build`):** Passed (`45/45` static pages, Edge middleware `48.7 kB`, regenerated `public/sw.js`)
- **Unit & Static Suite (`tests/unit-security.test.mjs`):** `5/5` passed (`0` failures, `0` skipped)
- **Automated Integration Suite (`tests/integration-e2e.mjs` against isolated SQLite copy):** Passed (security headers, `sw.js` `NetworkOnly`, middleware `307`s, multi-role auth, pairing, clinician assignment, cross-patient `403` isolation, language-aware chat, hydration persistence)
- **Browser E2E Audit (`http://localhost:3018` in headless Chromium across Desktop `1280x800` & Mobile `390x844`):**
  - Cold `/` load cleanly redirected to `/login` with `0` JS errors (`SMR-012` resolved)
  - Verified auth hiding (`0` `<nav>`, `0` Speak buttons), dynamic patient greeting, hydration +250ml persistence across reload, all 14 games listed, `color-sequence` Level 1 -> Level 2 advancement, crisp `memory-match` SVG sizing (`72x72`), graceful empty `guess-faces`, local SVGs on `/scrapbook` (`0` broken 404s), `EMERGENCY`/`SUPPORT` directory on `/help-near-me`, `/profile` & `/caregiver/settings` free of fake HIPAA/AES claims, Caregiver invite code generation (`540426`), and Caregiver -> `/doctor` RBAC redirect
- **Database Integrity:** Original `prisma/dev.db` untouched (`3` users, `3` patient profiles intact)
