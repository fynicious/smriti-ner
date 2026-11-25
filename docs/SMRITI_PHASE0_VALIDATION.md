# SMRITI (`Smriti-NER`) — Phase 0: Technical Validation Report

**Date:** 2026-11-25  
**Target Specification:** `docs/SMRITI_PRODUCT_SPECIFICATION_V1.md` (`SMRITI v1.0`)  
**Workspace Audited:** `C:\E_Drive\final ka final build` (strictly read-only validation; no application source files or SQLite records altered)  
**Purpose:** Fulfill Section 19 **Phase 0: Technical Validation** by distinguishing what is genuinely implemented, partially implemented, or unimplemented in the repository, establishing verified automated test baselines, evaluating database/API/migration risks, assessing 8-state NER localization & speech feasibility, and framing Section 21 Open Technical Decisions before Phase 1 begins.

---

## 1. Executive Summary & Verified Baseline Checks

All static checks, unit security checks, and isolated API/RBAC integration checks ran cleanly against the current codebase on `2026-11-25`:

| Check Command | Scope & Isolation | Observed Result |
| :--- | :--- | :--- |
| `npm run typecheck` (`tsc --noEmit`) | Entire TypeScript codebase | **Passed** (`0` errors) |
| `npm run lint` (`next lint`) | `src/` ESLint rules | **Passed** (`0` errors; `8` `@next/next/no-img-element` `<img>` warnings across `caregiver/family`, `scrapbook`, and 5 game pages) |
| `npm test` (`tests/unit-security.test.mjs`) | Secret-handling hygiene, no hardcoded patient IDs, English baseline translation key parity, PNG icons, Workbox `NetworkOnly` `/api` rule, NER SVG existence | **Passed** (`5/5` tests passed, `0` failed, `0` skipped) |
| `npm run test:e2e` (`tests/integration-e2e.mjs`) | Spawns `next start` against a temp copy of `prisma/dev.db` in `os.tmpdir()`; tests CSP/headers, `/sw.js`, middleware redirects, registration, pairing, clinician assignment, cross-patient `403` isolation, `/api/chat`, and hydration logging | **Passed** (`ALL E2E INTEGRATION CHECKS PASSED CLEANLY`; verified `prisma/dev.db` SHA-256 unchanged) |
| Database Inspection (`prisma/dev.db`) | Read-only SQLite check | Intact (`450,560` bytes; `32` schema tables; `3` `User` rows, `3` `PatientProfile` rows; **no** `prisma/migrations/` folder — current DB relies on `db push`) |

### Overall Phase 0 Verdict
Smriti already possesses a clean, compiling, RBAC-hardened Next.js `14.2.35` application foundation with 33 page routes, 32 Prisma models, 25 API endpoint groups, 14 working cognitive activities, PWA offline asset bundles, and strong cross-patient authorization (`RBAC`).  
However, **significant architectural and product gaps remain between the existing baseline and SMRITI v1.0** — notably around the 3 patient complexity modes, caregiver-created patient provisioning, clinical vs. caregiver prescription boundaries, truthful SOS/alert UI status, 8-state translation/speech accuracy, idempotent offline synchronization, encryption at rest, and media storage outside Base64 DB columns.

---

## 2. Spec-to-Repository Compliance Matrix (`SMRITI v1.0` Sections 1–18)

Status legend:
- **IMPLEMENTED:** Built end-to-end and verified in source code.
- **PARTIAL:** Foundation exists, but key behaviors or safety boundaries required by v1.0 are missing or incomplete.
- **GAP:** Not implemented in the current codebase.

| Spec Section | Requirement | Status | Codebase Reality & Evidence |
| :--- | :--- | :--- | :--- |
| **Sec. 1 & 18** | Non-diagnostic guardrails & no fabricated outputs | **PARTIAL** | `src/app/api/predict/route.ts` explicitly states `"Rule-based engagement indicator only. Not a clinical or dementia diagnosis."` `/doctor` displays a disclaimer banner. `/api/chat` instructs Groq not to invent events or diagnose, but has no automated output validator separating AI prose from stored database facts. |
| **Sec. 2 & 3.2** | Patient accounts **created and managed by caregiver** | **GAP / PARTIAL** | `src/app/api/auth/register/route.ts` allows open self-registration for `PATIENT` and `CAREGIVER`. `src/services/pairing.service.ts` links existing accounts via a 6-digit code. Caregivers cannot currently provision a patient login/profile, set initial settings, or manage patient complexity mode. |
| **Sec. 3.2 & 4.4** | Clinical prescription authorization vs. caregiver administration | **PARTIAL (Policy Risk)** | `src/app/api/patients/[patientId]/medications/manage/route.ts` (`POST` & `PATCH`) currently accepts `['CAREGIVER', 'CLINICIAN']` equally, letting caregivers create, alter dosage/frequency, or discontinue prescriptions instead of separating prescriber-only treatment edits from caregiver-managed reminders/logs. `MedicationEvent` logs server `AuditService`, but does not store a direct `source` / `recordedBy` column distinguishing patient-reported intake vs. caregiver-confirmed administration. |
| **Sec. 3.4 & 6.3** | Family Circle scoped permissions & approved photo calling | **PARTIAL / GAP** | `CareCircleMember` (`prisma/schema.prisma`) stores a `permissions` JSON string and `src/app/api/care-circle/route.ts` lists members, **but API routes (`RBAC.verifyPatientAccess`) check `status: 'ACTIVE'` without enforcing fine-grained `CareCircleMember.permissions`** (so any active Care Circle link can read medical/location endpoints unless further scoped). `FamilyAsset` stores photo/audio for games, without phone numbers or accidental-call protection UI. |
| **Sec. 4.1–4.2** | **Three Complexity Modes** (`Simple`, `Guided`, `Full`) & uncluttered Patient Home | **GAP** | `src/app/page.tsx` renders one single vertical layout containing greeting banner, `Smriti Companion`, `TimeWeatherWidget` (weather card), location sharing prompt, daily check-in banner, hydration card, `NowCard`, Brain Games card, `PlannerTimeline`, and `Help Near Me`. Neither `PatientProfile` nor frontend routing implements `Simple` / `Guided` / `Full` modes. |
| **Sec. 4.3** | Visual Daily Routines (`NowCard`, timeline, snooze, voice clip) | **IMPLEMENTED** | `src/app/api/patients/[patientId]/routines/route.ts`, `src/hooks/useDailyPlanner.ts`, `src/components/patient/NowCard.tsx`, `src/components/patient/PlannerTimeline.tsx`, and `RoutineNotification` support routines, occurrence tracking, snoozing, and attached caregiver `VoiceReminder` audio. Print pictorial schedule is not yet built. |
| **Sec. 4.4** | Medication photographs (`Medication` image reference) | **GAP** | `Medication` in `prisma/schema.prisma` stores `name`, `dosage`, `frequency`, `time`, `instructions` — there is no image/photo field (`imageUrl` / `mediaId`) to show actual pill/strip photographs on `NowCard`. |
| **Sec. 4.5** | Patient-specific Hydration target & one-tap + Undo | **PARTIAL** | `HydrationService` (`src/services/hydration.service.ts`) reads `HydrationTarget` per patient and supports `UNDO` soft-delete (`DELETED`). However, `src/app/api/auth/register/route.ts` initializes every patient at `2000` ml and no Caregiver API/UI currently updates `HydrationTarget` per patient medical guidance. |
| **Sec. 4.6** | 6-area Wellbeing Check-In (`Mood`..`Overall`) | **PARTIAL** | `src/app/check-in/page.tsx` asks one question at a time across all `6` areas with TTS (`playTTS`) and `POST /api/patients/[id]/wellbeing` saves `source` (`PATIENT_REPORTED`, `CAREGIVER_OBSERVED`, `CLINICIAN_ENTERED`). However, it does not offer per-question **Skip** or partial submission. |
| **Sec. 5** | Voice-First Companion (`Conversational` + `Task-focused` intents + replaceable AI) | **PARTIAL** | `ConversationalUI.tsx` and `/api/chat` provide conversational Q&A (Groq `openai/gpt-oss-20b` + simple offline keyword fallback for `med` / `water`). Missing: structured intent recognition to execute in-app navigation/calls/games, replaceable AI provider interface (`src/lib/ai-provider.ts` absent; `@google/generative-ai` dependency unused), and tested offline speech recognition (`Vosk` absent). |
| **Sec. 6.1–6.2** | Family Memories (`ScrapbookEntry` + `FamilyAsset`) | **PARTIAL** | `/scrapbook` and `/caregiver/family` handle photos, descriptions, and browser `MediaRecorder` audio backed by SQLite + Dexie. Missing: contributor metadata, language tag, granular per-memory family access permissions, and encrypted external media references. |
| **Sec. 7** | 14 Cognitive Activities + Adaptive Difficulty + Offline Logging | **IMPLEMENTED** | All `14` games under `src/app/games/*` work offline and log telemetry (`CognitiveSession` + Dexie `db.gameLogs`); `src/lib/ai-difficulty.ts` tunes difficulty (`1..10`) without punitive fail screens. |
| **Sec. 8** | 8-State NER Languages, Quality Verification & Regional Content | **PARTIAL (Critical Gap)** | Detailed audit in Section 5 below: English passes baseline key checks, `lus`/`as`/`bn`/`brx`/`mni`/`ne`/`kha` have substantial keys, **`grt`/`njm`/`njo` currently hold copied English text (`0` distinct strings)**, and `njz`/`adi`/`clk`/`sip`/`trp` have only `22` starter keys. Only Assam visual assets exist (`NER_ASSAM_PACK`). |
| **Sec. 9** | Caregiver Application | **IMPLEMENTED / PARTIAL** | `9` pages under `/caregiver/*` cover routines, wellbeing + CSV export, Care Circle invites, Leaflet/OSM SafeZone geofencing, voice reminders, family assets, NER resources, and JSON export + cache clear. Home (`/caregiver`) still presents an 8-tile grid rather than the unified `Today's Care` prioritization layout in Sec. 9.1–9.2, and lacks `HydrationTarget` editor & `Simple/Guided/Full` selector. |
| **Sec. 10** | Clinician Portal (`/doctor`) | **IMPLEMENTED** | 5 tabs (`Overview`, `Vitals & Trends`, `Prescriptions`, `Timeline`, `Engagement Analytics`), invite-gated clinician signup (`CLINICIAN_INVITE_CODE`), caregiver pairing authorization (`POST /api/clinician/patients`), CSV/Print export, non-diagnostic trend badge. |
| **Sec. 11** | Visual Identity & Elderly Accessibility | **PARTIAL** | Warm `#FDFBF7` / `#2D3748` + Mint/Peach/Lavender system (`tailwind.config.ts`), `BottomNav`, and `SpeakButton` exist. Missing: systematic `>= 56px` touch targets, `prefers-reduced-motion`, high-contrast mode, text-scale preferences, and removal of clinical/sync labels from patient-visible chrome (`SpeakButton` still mounts across patient routes). |
| **Sec. 12** | Offline-First Sync Outbox & Conflict Rules | **PARTIAL (Risk)** | `src/lib/db.ts` (Dexie `IndexedDB`), `src/hooks/useSync.ts`, and `src/app/api/sync/route.ts` push unsynced batches via `POST`. Missing: `clientMutationId` idempotency keys, device IDs, server-to-client delta `GET` pull, and conflict reconciliation rules — risking duplicate rows on interrupted retries. |
| **Sec. 13** | Encryption, CSP & Privacy Controls | **PARTIAL (Critical Gap)** | Passwords hashed (`bcryptjs` 12 rounds), rate limits in `src/lib/auth.ts`, headers in `next.config.mjs`. **No rest encryption**: SQLite columns and Dexie `IndexedDB` rows store medical notes, coordinates, and Base64 audio/images unencrypted; `crypto-js` (`src/lib/security.ts`) is unused; CSP still allows `'unsafe-inline'` and `'unsafe-eval'`; consent records, session revocation list, and account deletion endpoints do not exist. |
| **Sec. 16** | Emergency & Honest Delivery Status | **PARTIAL (Safety Mismatch)** | `/help-near-me` seeds `10` NER resources (`112`, `108`, `14567`, `14416`, `GMCH`, `LGBRIMH`, `NEIGRIHMS`, `RIMS`, `ARDSI` marked `COMMUNITY_REPORTED`, `Janaushadhi Kendra`). **UI Bug vs. Sec. 16:** `/api/alert` returns `{ success: true, smsSent: false, simulated: true }` when Twilio/phone are unset, **but `src/app/page.tsx` checks only `res.ok` and shows `"Caregiver Notified — An urgent alert has been sent"`** even when no SMS was dispatched! |

---

## 3. Reusable Features & Services (Preserve & Build Upon)

1. **Authorization & Audit Backbone:**
   - `RBAC.requireSession`, `RBAC.verifyPatientAccess`, and `RBAC.requirePatientAccess` (`src/lib/rbac.ts`), `src/middleware.ts`, `src/lib/env.ts` (`getNextAuthSecret`, `safeCompareSecrets`), `src/lib/api-errors.ts`, `AuditService` (`src/services/audit.service.ts`).
2. **Core Patient Domain Services:**
   - `HydrationService` (respects `HydrationTarget` lookups and soft-delete `UNDO`), `MedicationService` (scoped `UNDO` + audit), `TimelineService` (merges 5 streams), `PairingService` (`crypto.randomInt` 6-digit 24h codes).
3. **Cognitive Engine & 14 Games:**
   - `src/app/games/*` + `GameContainer` + `src/lib/ai-difficulty.ts` + `src/lib/cognitive-logger.ts` + `src/app/api/predict/route.ts` + `14` bundled local SVGs under `public/assets/ner/`.
4. **Offline PWA Shell & Check-In Baseline:**
   - Workbox `/offline` document fallback and `NetworkOnly` `/api/.*` exclusion (`next.config.mjs`, `public/sw.js`), valid PNG icons, `check-in/page.tsx` 6-step emoji cards with DB `source` tracking.
5. **NER Resource Directory & Clinical Portal Tabs:**
   - `src/app/api/resources/route.ts`, `src/app/help-near-me/page.tsx`, `src/app/doctor/page.tsx` 5-tab layout + `Recharts` visualizations.

---

## 4. Database, API & Destructive Migration Risk Assessment

### 4.1 Current State (`prisma/schema.prisma` & `prisma/dev.db`)
- **Provider:** SQLite (`file:./dev.db`, `32` models).
- **Live Data Present:** `3` existing `User` rows and `3` `PatientProfile` rows in `C:\E_Drive\final ka final build\prisma\dev.db` (`450,560` bytes).
- **No Migration History Folder:** Only `dev.db` and `schema.prisma` exist inside `prisma/`; there is no `prisma/migrations/` folder yet.

### 4.2 High-Risk Migration & Data-Loss Hazards
1. **`prisma db push --force-reset` or Provider Swap Without Export:** Changing `provider = "sqlite"` directly to `"postgresql"` or running destructive resets will orphan or wipe the `3` existing patient users and `dev.db` records. Always establish baseline `migrations/` (or JSON snapshot + verified row-count importer) before schema changes.
2. **Inline Base64 Media Bloat (`ScrapbookEntry`, `FamilyAsset`, `VoiceReminder`):** Base64 columns (`2.5 MB` images / `4 MB` audio accepted by APIs) inside relational tables create multi-megabyte SQLite/Postgres rows, bloat Dexie `IndexedDB` quota on budget Android phones, and block fast delta synchronization. Moving to object storage requires a careful backfill strategy keeping `imageBase64` / `audioBase64` readable or migrating them losslessly to private object keys + URLs.
3. **Missing Idempotency on Offline Sync (`src/app/api/sync/route.ts` & `src/lib/db.ts`):** Today only `routineOccurrences` upserts by `(routineId, date)`. Replaying `moods`, `gameLogs`, `hydrationEvents`, `wellbeingEntries`, `vitalLogs`, `caregiverReports`, or `locationPings` during flaky NER cellular handoffs **inserts duplicate records** because neither Dexie records nor Prisma tables carry a `clientMutationId` unique key (`@@unique([patientId, clientMutationId])`).
4. **Plaintext Clinical & Location Records:** `PatientProfile` (`diagnoses`, `allergies`, `emergencyContact`), `CaregiverReport.notes`, `WellbeingEntry.notes`, and `LocationPing` coordinates sit in plaintext inside both SQLite and browser `IndexedDB`.

### 4.3 Recommended Additive Schema Evolution (Non-Destructive)
- Add optional/defaulted fields or new companion tables rather than breaking existing columns:
  - `PatientPreference` (1:1 with `PatientProfile`: `complexityMode` default `'GUIDED'`, `hydrationTargetMl`, `reducedMotion`, `highContrast`, `textScale`, `caregiverLockPinHash`, `lockedSettings`)
  - `ConsentRecord` (`patientId`, `grantedByUserId`, `scope` [`LOCATION_SHARING`, `AI_COMPANION`, `DATA_SYNC`, `CLINICIAN_ACCESS`], `version`, `grantedAt`, `revokedAt`)
  - `Medication.imageRef` (optional photo reference) and `MedicationEvent.{recordedByUserId, source}` (`PATIENT_REPORTED` vs. `CAREGIVER_CONFIRMED`)
  - `FamilyAsset.{phoneNumber, allowCall, visibilityScope, contributorUserId}`
  - `SyncMutation` (`patientId`, `clientMutationId`, `deviceId`, `recordType`, `appliedAt` with `@@unique([patientId, clientMutationId])`)
  - `DeviceSession` (revocation & multi-device management) and `MediaObject` metadata when migrating off inline Base64.

---

## 5. Regional Language & Voice-Service Feasibility (All 8 NER States)

### 5.1 Direct Code Audit of `src/lib/translations.ts`

`TranslationStrings` declares **`247`** keys (`244` explicit keys in the `en` object literal passing `tests/unit-security.test.mjs`). Direct key comparison against English (`en`) across all `16` configured entries reveals:

| Locale Code | Language | Primary State Link | Distinct Non-EN Keys | English Fallback / Copied Keys | Declared `speechCode` | Phase 0 Assessment |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `en` | English | Pan-NER Baseline | `244` (`en`) | `0` | `en-IN` | Complete baseline |
| `lus` | Lushai (Mizo) | **Mizoram** | `237` | `0` (`7` omitted keys fallback via proxy) | *None* | High text coverage; **needs native review & speech support** |
| `mni` | Meitei | **Manipur** | `215` | `2` exact matches + omitted keys | `mni-IN` | Strong starter pack; needs `~30` missing keys + script (`Meetei Mayek` vs Bengali script) validation |
| `bn` | Bengali | Tripura / Barak Valley | `214` | `2` exact + omitted | `bn-IN` | Strong starter pack; needs `~30` clinical/new keys |
| `ne` | Nepali | **Sikkim** | `214` | `2` exact + omitted | `ne-NP` | Strong starter pack; needs `~30` keys |
| `brx` | Bodo | Assam | `213` | `2` exact + omitted | *None* | Strong starter pack; no Web Speech ASR/TTS |
| `as` | Assamese | **Assam** | `212` | `2` exact + omitted | `as-IN` | Strong starter pack; missing `~32` keys; Web Speech `as-IN` availability varies by Android TTS engine |
| `kha` | Khasi | **Meghalaya** | `170` | `47` English + omitted | *None* | Partial (~69% translated); needs native completion + voice fallback |
| `njz` | Nyishi | **Arunachal Pradesh** | `22` (`partial`) | ~`222` English fallbacks | *None* | Starter greeting/nav only (~9%); unsafe to mark launch-ready |
| `adi` | Adi | Arunachal Pradesh | `22` (`partial`) | ~`222` English fallbacks | *None* | Starter only (~9%) |
| `clk` | Mishmi | Arunachal Pradesh | `22` (`partial`) | ~`222` English fallbacks | *None* | Starter only (~9%) |
| `sip` | Sikkimese | Sikkim | `22` (`partial`) | ~`222` English fallbacks | *None* | Starter only (~9%) |
| `trp` | Kokborok | **Tripura** | `22` (`partial`) | ~`222` English fallbacks | *None* | Starter only (~9%) |
| `grt` | Garo (`A·chik`) | Meghalaya | **`0`** | **`237` copied EN strings** | *None* | **Unclean placeholder copy** (stripped bracket tags left raw English) |
| `njm` | Angami (`Tenyidie`) | **Nagaland** | **`0`** | **`237` copied EN strings** | *None* | **Unclean placeholder copy** — Nagaland currently has **0 translated strings** |
| `njo` | Ao | **Nagaland** | **`0`** | **`237` copied EN strings** | *None* | **Unclean placeholder copy** — Nagaland currently has **0 translated strings** |

### 5.2 Speech Recognition (STT) & Speech Synthesis (TTS) Feasibility
1. **Browser Web Speech API (`SpeechRecognition` / `SpeechSynthesis`):**
   - `VoiceAssistantProvider.tsx` only advertises `3` locales (`en-IN`, `as-IN`, `bn-IN`), while `ConversationalUI.tsx` tries `activeSpeechCode` (`en-IN`, `as-IN`, `bn-IN`, `mni-IN`, `ne-NP`) and falls back silently to `en-IN` for the other `11` languages.
   - Android Chrome / WebView Web Speech ASR depends on cloud Google Speech servers (fails offline) and lacks official ASR/TTS voices for Khasi (`kha`), Mizo (`lus`), Nyishi (`njz`), Kokborok (`trp`), Bodo (`brx`), Garo (`grt`), Angami (`njm`), and Ao (`njo`).
2. **Bhashini API (MeitY Digital Public Infrastructure):**
   - Technically supports Scheduled Indian languages including Assamese (`as`), Bengali (`bn`), Bodo (`brx`), Manipuri/Meitei (`mni`), and Nepali (`ne`) via server-side ASR/NMT/TTS REST APIs once registered at `bhashini.gov.in`.
   - Does **not** work offline and does **not** currently cover all non-scheduled NER languages (e.g., Khasi, Mizo, Nyishi, Kokborok, Naga languages) uniformly.
3. **Offline Deterministic Voice & Local Speech Assets:**
   - **Vosk** WASM/native models exist for English (`en-in`) and Hindi, not most NER tribal languages (`40 MB–1.8 GB` model sizes impractical inside a browser cache on low-end Android phones).
   - **Verified Feasible Strategy for v1.0 Compliance:**
     - **Online Server Speech Adapter:** Pluggable ASR/TTS interface supporting Browser Web Speech (`en-IN`, `bn-IN`, `ne-NP`, `as-IN` where present) + optional Bhashini server bridge + Whisper/Groq audio fallback where supported.
     - **Pre-Recorded Native Human Audio Clips (Offline-First Guarantee):** Because synthesized TTS and ASR do not reliably exist for Khasi, Mizo, Nyishi, Kokborok, or Naga languages, pre-recorded native-speaker `.webm`/`.mp3` prompt packs (~`20–40` tiny prompts per language pack, `< 1 MB` per language cached by Service Worker) plus Caregiver-recorded `VoiceReminder` clips can guarantee real spoken instructions offline across **all 8 NER states**!
     - **Honest Capability Badge:** Explicitly display `"Voice input unavailable in <Language> — use large buttons or English/Assamese speech"` whenever a language lacks live STT, honoring Section 5.6 & 8.4.

---

## 6. Section 21 Open Technical Decisions & Recommended Resolution Paths

Before starting **Phase 1**, the following 10 open items from **SMRITI v1.0 Section 21** require concrete engineering sign-off:

| # | Section 21 Open Decision | Current State in Repo | Recommended Resolution Option | Requires User Approval? |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **Exact 8-state initial language & script list** | `16` codes in `translations.ts`; Nagaland & Arunachal incomplete | Lock **8 MVP Launch Packs** (1 primary per state): `en` (shared baseline), `as` (Assam), `kha` (Meghalaya), `mni` (Manipur — confirm Bengali vs. Meetei Mayek script with users), `lus` (Mizoram), `ne` (Sikkim), `trp` (Kokborok/Tripura), `njz` (Nyishi/Arunachal), plus **Nagaland community choice (`Nagamese` or `Tenyidie`/`Ao`?)**. Require native review before marking any pack `VERIFIED`. | **Yes** (especially Nagaland primary candidate & Meitei script) |
| 2 | **Offline speech recognition model & licensing** | No offline ASR model installed | **Defer bundled browser Vosk** for tribal languages (`100+ MB` download penalty & missing models). Keep `MediaRecorder` -> server STT when online, offline English/basic fallback or optional downloadable WebSpeech/Vosk-`en-IN` plugin only after device benchmarking, and ensure **100% large visual UI parity** without ASR. | **Yes** |
| 3 | **Regional Text-to-Speech quality & fallback** | `SpeechSynthesis` (`en-IN`, `as-IN`, `bn-IN`, `mni-IN`, `ne-NP`) | Combine browser `SpeechSynthesis` (where native voice exists) + **pre-recorded lightweight native human audio sprites** for core patient phrases in all 8 launch languages (cached offline in IndexedDB/CacheStorage) + caregiver personal voice recordings. | **Yes** |
| 4 | **AI provider & PHI privacy policy** | Groq `openai/gpt-oss-20b` (`GROQ_API_KEY`); unused `@google/generative-ai` | Build `AIProvider` interface (`Groq` default + pluggable `Gemini Paid`/`Ollama`/`Local Rules`), **strip patient full names, exact coordinates, and phone numbers** from external LLM prompts, send only anonymized routine/hydration context + `lang`. | **Yes** |
| 5 | **Local encryption & key recovery** | None (`crypto-js` helper unused; Dexie plaintext) | Use **Node `crypto` `AES-256-GCM` server-side field encryption** (`ENCRYPTION_MASTER_KEY` env) + **WebCrypto `AES-GCM` client cache encryption** unlocked per session (derived via ephemeral server session key + wiped on logout/30-min inactivity). Document honestly as **Encryption-at-Rest + Transport Encryption** (not zero-knowledge E2EE) so account recovery stays simple for caregivers. | **Yes** |
| 6 | **Caregiver-created patient provisioning & recovery** | Self-signup `/register` + 6-digit pairing | Caregivers create patient profiles directly under `/caregiver` (generating a simple one-time QR / 6-digit device link or PIN sign-in for the elder's tablet without requiring an email/password remembered by the patient); caregiver controls password/PIN reset & recovery. Keep `/register` patient option disabled or caregiver-assisted. | **Yes** |
| 7 | **Multi-device sync conflict rules** | Append-only `POST /api/sync` | Add `(patientId, clientMutationId, deviceId)` idempotency; **Hydration / Cognitive / Check-in:** append-only deduplicated by `clientMutationId`; **Medication / Routine status:** last-write-wins unless caregiver-confirmed/clinician-discontinued (which takes precedence and records conflict audit notice); **Prescriptions:** `CLINICIAN`-authoritative server state only. | **Yes** |
| 8 | **Hosting, DB & private object storage** | Local Next.js + SQLite + Base64 DB blobs | Stage/deploy zero-cost stack per `docs/SMRITI_DEPLOYMENT_PLAN.md`: **Neon Serverless Postgres** (`0.5–1 GB` free) + **Cloudflare R2** (`10 GB` free) or **Supabase Storage** (`1 GB` free) with signed RBAC URLs + **Cloudflare Pages / Vercel Hobby** (non-commercial pilot; commercial NGO/clinic scale -> budget VPS/managed tier). | **Yes** (deferred until authorized deployment) |
| 9 | **Notification & SOS delivery guarantees** | `/api/alert` logs audit event; `Twilio` optional; **Home modal fakes `"Sent"`** | Fix Home SOS UI immediately in Phase 1/2 to **report actual server status** (`Audit Logged Only` vs. `SMS Dispatched`), add free **Web Push (`VAPID`)** for caregiver browsers, and emphasize **1-tap `tel:` direct call to family / `112` / `108`**. | **Yes** |
| 10 | **Consent, privacy & retention policy** | Opt-in location UI state only; no DB consent log or delete-account flow | Add immutable `ConsentRecord` table (representative caregiver / patient assent tracking for Location GPS, Family Sharing, AI Companion, Clinician link), configurable retention window, full JSON/CSV export, and cascading **`Delete Account & Erase Patient Data`** API under RBAC + audit confirmation. | **Yes** |

---

## 7. Phase 1 Readiness Checklist (Awaiting User Approval)

No Phase 1 code or schema modifications have started. Once you confirm your preferences on the **Section 21 decisions** above (especially Decision #1 on the 8-state language candidates/scripts and Decision #6 on patient device login vs. email signup), **Phase 1: Safety and Foundations** can execute incrementally:
1. Lock non-destructive baseline Prisma migrations (preserving `3` existing users in `prisma/dev.db`).
2. Add caregiver-created patient provisioning API/UI + `PatientPreference` & `ConsentRecord` models.
3. Enforce clinical-only `Medication` prescription rules vs. caregiver/patient administration logging (`source`, `recordedBy`), plus fix truthful SOS delivery reporting.
4. Implement idempotent offline sync (`clientMutationId` + delta pull + `WebCrypto` local encryption).
5. Introduce private object-storage abstraction for photos/audio alongside server-side `AES-256-GCM` sensitive field protection and `AuditLog` coverage.
