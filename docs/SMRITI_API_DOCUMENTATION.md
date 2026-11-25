# SMRITI (`Smriti-NER`) — API Reference

**Version:** 1.0  
**Last Updated:** 2026-11-25

> Every `/api/patients/[patientId]/*` endpoint enforces session authentication, active `User.isActive` verification, cross-patient access scoping, and fine-grained `CareCircleMember` permission scopes via `RBAC` (`src/lib/rbac.ts`).

---

## 1. Authentication, Onboarding & Account Governance

| Method & Route | Allowed Roles | Purpose & Key Contract Notes |
| :--- | :--- | :--- |
| `POST /api/auth/register` | Public (`CAREGIVER`, `CLINICIAN` only) | Creates Caregiver or Clinician account (`CLINICIAN_INVITE_CODE` required for `CLINICIAN`). Returns **`403`** for `PATIENT` self-signup. |
| `POST /api/auth/[...nextauth]` | All | Credentials provider supporting `mode`: `PASSWORD` (email+password), `PATIENT_PIN` (`loginCode` + 4–6 digit PIN; locks 15m after 5 failures), `QR_TOKEN` (single-use token). |
| `GET / POST /api/caregiver/patients` | `CAREGIVER` | `GET` lists paired patients with decrypted medical summary & `loginCode`. `POST` creates a patient account with PIN, `SMR-XXXXXX` code, preferences, and 24h single-use QR onboarding link. |
| `GET / POST /api/caregiver/patients/[patientId]/onboarding` | `CAREGIVER` (`manage_settings`) | `GET` inspects PIN/lock/claim status. `POST` updates PIN (`newPin`, clears lockout) and issues a fresh single-use 24h QR link. |
| `GET / POST / DELETE /api/pairing` | `CAREGIVER`, `PATIENT` | `POST` creates (Caregiver) or redeems (Patient) a 6-digit 24h pairing invitation. |
| `GET / POST /api/clinician/patients` | `CLINICIAN` | `GET` lists assigned patients (decrypted fields + `loginCode`). `POST` links patient via `{ patientEmail or patientLoginCode, pairingCode }`. |
| `GET / POST / PATCH / DELETE /api/care-circle` | `CAREGIVER` / `PATIENT` / `CLINICIAN` | Manages `CareCircleMember` list, scoped email invitations (`role`, `permissions[]`), permission edits, and revocation. |
| `POST /api/account/delete` | Authenticated | Permanently deletes paired patient (Caregiver `manage_settings`) or own account when `confirm === 'DELETE'`; writes audit record and deletes disk `MediaAsset` binaries. |
| `GET / PATCH /api/profile` | Authenticated | Reads and updates role profile, language, and encrypted sensitive patient fields (`emergencyContact`, `allergies`, `diagnoses`). |

---

## 2. Patient Care, Clinical Boundaries & Sync Endpoints

| Method & Route | Permission Scope / Roles | Purpose & Key Contract Notes |
| :--- | :--- | :--- |
| `GET /api/patients/[patientId]/medications` | `view_clinical` | Lists patient prescriptions + intake history. |
| `POST /api/patients/[patientId]/medications` | `view_routines` | Logs intake (`TAKEN`, `SKIPPED`, `SNOOZED`, `MISSED`, `UNDO`). Automatically tags `source`: `CAREGIVER_CONFIRMED`, `CLINICIAN_RECORDED`, or `PATIENT_REPORTED`. |
| `POST / PATCH /api/patients/[patientId]/medications/manage` | **`CLINICIAN` ONLY** | Creates (`POST`) or toggles `ACTIVE`/`DISCONTINUED` (`PATCH`) prescriptions. Returns `403` for Caregivers/Patients. |
| `PATCH /api/patients/[patientId]/medications/photo` | `CAREGIVER`, `CLINICIAN` (`edit_routines`) | Attaches encrypted pill photo (`MediaAsset`) to an existing prescription without touching dosage/frequency. |
| `GET / PATCH /api/patients/[patientId]/preferences` | `GET`: `view_routines`; `PATCH`: `CAREGIVER` `manage_settings` (+ PIN verify) | Manages `complexityMode` (`SIMPLE` \| `GUIDED` \| `FULL`), `scriptPreference`, `culturalPackId`, `textScale`, `highContrast`, `reducedMotion`, `voiceRate`, `aiEnabled`, `aiInteractionStyle`, `caregiverLockEnabled`, `hydrationTargetMl`, `retentionDays`. |
| `GET / POST /api/patients/[patientId]/consents` | `GET`: `view_clinical`; `POST`: `manage_settings` | Records append-only grants/withdrawals (`LOCATION_SHARING`, `AI_COMPANION`, `FAMILY_SHARING`, `CLINICIAN_ACCESS`, `DATA_SYNC`, `VOICE_RECORDING`). |
| `GET / POST /api/patients/[patientId]/hydration` | `view_routines` | Returns today’s ml total & target; supports logging water intake & soft-delete `UNDO`. |
| `GET / POST /api/patients/[patientId]/wellbeing` | `GET`: `view_clinical`; `POST`: `view_routines` | Records 6-domain check-ins supporting `-1` (skipped), AES-GCM encrypted `notes`, `source`, and optional `clientMutationId`. |
| `GET / POST / DELETE /api/patients/[patientId]/routines` | `view_routines` / `edit_routines` | Daily routines, completion occurrences, and `VoiceReminder` audio notes (stored privately via `MediaAsset`). |
| `GET / POST / DELETE /api/patients/[patientId]/vitals` | `view_clinical` | Records/queries vitals (`weight`, `sysBp`, `diaBp`, `heartRate`) & `CaregiverReport` notes encrypted at rest. |
| `GET / POST /api/patients/[patientId]/cognitive` | `view_clinical` / `view_routines` | Saves cognitive game telemetry (`gameId`, `domain`, `accuracy`, `score`) and returns next adaptive difficulty. |
| `GET / POST / DELETE /api/patients/[patientId]/scrapbook` | `view_memories` / `contribute_memories` | Family memories with `MediaAsset` storage, language tags, contributor attribution, and visibility scoping. |
| `GET / POST / PATCH / DELETE /api/patients/[patientId]/family-assets` | `view_memories` / `contribute_memories` / `manage_settings` | Photos & audio for games and safe family calling (`phoneNumber`, `allowCall`, `requireCallConfirm`, `visibilityScope`). |
| `GET /api/patients/[patientId]/media/[assetId]` | Authenticated RBAC scope | Decrypts & streams private encrypted image/audio binaries with `no-store` & `nosniff`. |
| `GET / POST /api/patients/[patientId]/safety` | `view_location` / `manage_settings` | Safe zones & location pings; enforces `LOCATION_SHARING` consent (`403` when withdrawn). |
| `GET /api/patients/[patientId]/timeline` | `view_clinical` | Chronological unified summary merging medication intake attribution, hydration, check-ins, reports, and games. |
| `GET / POST /api/patients/[patientId]/care-updates` | `view_updates` | Shared Care Circle feed + circle member updates. |
| `GET / POST /api/sync` | `view_routines` | `GET`: delta sync pull (`?patientId=...&since=...`). `POST`: idempotent batch upload via `SyncMutation` deduplication and conflict resolution. |

---

## 3. AI, Alerts, Push & Regional Utility Endpoints

| Method & Route | Allowed Roles | Behavior |
| :--- | :--- | :--- |
| `POST /api/chat` | `PATIENT`, `CAREGIVER` | Executes deterministic task intents (`source: 'verified-record'`), enforces `AI_COMPANION` consent, strips PII before Groq/Gemini calls, and falls back to `LocalFallbackAIProvider`. |
| `POST /api/alert` | `PATIENT`, `CAREGIVER` | Dispatches Twilio SOS SMS when configured; writes immutable audit log and returns honest `{ delivered, smsSent, simulated, deliveryStatus }`. |
| `POST /api/push/subscribe` | Authenticated | Saves Web Push VAPID browser subscription per user/device (`PushSubscription`). |
| `POST /api/predict` | `PATIENT`, `CAREGIVER`, `CLINICIAN` | Computes non-diagnostic rule-based engagement indicator (`LOW`, `MODERATE`, `HIGH` watch flags) with explicit disclaimer. |
| `GET /api/resources` | Public / Authenticated | Returns curated + patient-saved NER healthcare/helpline directory (`112`, `108`, `14567`, `14416`, `GMCH`, `LGBRIMH`, `NEIGRIHMS`, `RIMS`, `ARDSI`). |
| `GET /api/content` | Public / Authenticated | Returns localized `NER_REGIONAL_PACKS` (`8` states) & cultural object assets. |
