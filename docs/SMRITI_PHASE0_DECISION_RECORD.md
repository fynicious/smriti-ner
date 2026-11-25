# SMRITI (Smriti-NER)
## Phase 0: Technical Decision Record
**Version:** 1.0  
**Date:** 25 November 2026  
**Status:** Approved by Product Owner (`2026-11-25`)  
**Implementation status:** Authorized (`Phases 1–6` incremental rollout under data-preservation rules)  
**Related Documents:**  
- `docs/SMRITI_PRODUCT_SPECIFICATION_V1.md`  
- `docs/SMRITI_PHASE0_VALIDATION.md`

---

### Product-Owner Review Clarifications (25 November 2026)

During Phase 0 review, the product owner recorded these explicit requirements alongside the Technical Decision Record:
1. **Patient Accounts:** Favour caregiver-created accounts with PIN-based onboarding and optional QR/device pairing; email/password must not be mandatory for elderly patients.
2. **Clinical Permissions:** Caregivers manage routines and reminders, while prescription creation, modification, and discontinuation must remain clinician-controlled.
3. **Emergency / SOS Honesty:** SOS must never claim someone was notified unless notification dispatch was actually confirmed.
4. **Encryption & Sync Risk Discipline:** Encryption and synchronization changes affect existing data, migration strategy, and offline behavior, so they must be explicitly designed and tested (dry-run verified against backups/isolated copies) before touching existing or production data.

---

### 1. Regional language and script strategy

**Decision status: Partially confirmed**

SMRITI will prioritize regional language support across all eight North Eastern states from the beginning.

Proposed primary language packs:

| State | Initial language |
|---|---|
| Assam | Assamese |
| Meghalaya | Khasi |
| Manipur | Meitei, with both scripts |
| Nagaland | Community-selected after validation |
| Mizoram | Mizo |
| Arunachal Pradesh | Nyishi |
| Tripura | Kokborok |
| Sikkim | Nepali |

**Confirmed choices:**
- Nagaland's primary language will be selected through community consultation and native-speaker validation.
- Manipur will support both Meetei Mayek and Bengali scripts, with a user-selectable preference.

**Requirements:**
- No language pack may be marked verified without native-speaker review.
- Translation completeness, cultural suitability and accessibility must be validated independently.
- Additional community languages may be supported as the project evolves.
- English remains a shared fallback, not a substitute for complete regional localization.

### 2. Offline speech recognition (STT)

**Decision status: Proposed, pending approval**

Recommended approach:
- Do not bundle offline ASR models for all regional languages in the initial release.
- Use server-side speech recognition when online and supported.
- Retain basic deterministic voice commands where a tested offline engine supports them.
- Keep all essential visual controls available when speech recognition or AI is unavailable.
- Do not advertise offline recognition for unsupported languages.

### 3. Regional text-to-speech (TTS) and offline voice

**Decision status: Confirmed**

The offline voice experience will combine:
- Pre-recorded native-speaker phrases for essential patient interactions.
- Caregiver-recorded voice reminders and personal messages.
- Browser TTS where a suitable regional voice is available.

**Requirements:**
- Cache essential audio for offline use.
- Clearly distinguish live synthesized speech from recorded audio.
- Do not silently switch to an unrelated language when a regional voice is unavailable.
- Provide visual alternatives for every essential voice interaction.

### 4. AI provider abstraction and patient-data privacy

**Decision status: Proposed, pending approval**

Recommended architecture:
- Introduce a replaceable `AIProvider` interface.
- Retain Groq as the initial provider.
- Allow future integrations such as Gemini, Ollama and local rule-based responses.
- Minimize personally identifiable and sensitive health information sent to external providers.

External prompts should exclude patient full names, exact coordinates and phone numbers wherever they are not essential.

AI output must not fabricate memories, diagnose conditions, modify prescriptions or claim an action succeeded without confirmation.

### 5. Encryption and key recovery

**Decision status: Proposed, pending approval (Design & test plan required before any data change)**

Recommended approach:
- Server-side sensitive-field encryption using AES-256-GCM.
- Client-side offline cache encryption using WebCrypto AES-GCM.
- Secure key management and session lifecycle controls.
- Clear recovery procedures for caregiver-managed accounts.
- Secure media storage rather than relying on plaintext Base64 database fields.
- **Explicit Pre-Execution Requirement:** Encryption schema changes, backfill scripts, key rotation/recovery flows, and Dexie local decryption/lock lifecycle must be designed in full and verified against isolated copies of existing data before touching live/production records.

The security model must be described accurately as encryption at rest and transport encryption, not end-to-end encryption or zero-knowledge encryption.

### 6. Caregiver-created patient accounts and onboarding

**Decision status: Confirmed**

Patient onboarding will use:

**Caregiver-created account + PIN + optional QR device pairing.**

Requirements:
- Caregivers create and manage patient accounts.
- Patients must not need an email address or conventional password to onboard or use their device.
- A QR code or one-time pairing mechanism securely links the patient's device.
- PIN authentication must be protected against guessing and unauthorized access.
- Caregiver-controlled recovery must include appropriate authorization checks.
- Patient dignity, consent and privacy must remain protected.

The existing open patient self-registration flow must eventually be replaced or restricted to caregiver-assisted provisioning.

### 7. Clinical vs. caregiver permission boundaries

**Decision status: Confirmed**

Requirements:
- **Caregivers:** Manage daily routines, voice/visual reminders, hydration preferences, family assets, Care Circle permissions, and may log caregiver-confirmed medication administration without modifying prescriptions.
- **Clinicians:** Exclusively control prescription (`Medication`) creation, dosage/frequency modification, and discontinuation (`ACTIVE` / `DISCONTINUED`), replacing the current permissive caregiver write access in `POST/PATCH /api/patients/[patientId]/medications/manage`.
- **Attribution:** Administration events must distinguish patient-reported intake from caregiver-confirmed administration alongside verified timestamps.

### 8. Multi-device synchronization and conflict resolution

**Decision status: Proposed, pending approval (Design & test plan required before any data change)**

Recommended architecture:
- Unique `clientMutationId` for every offline mutation.
- Device identification for synchronization.
- Idempotent server processing to prevent duplicate records.
- Server-to-client delta synchronization.
- Explicit conflict detection and audit history.
- **Explicit Pre-Execution Requirement:** Because sync changes affect existing data, migration compatibility, and offline Dexie behavior, reconciliation rules and replay tests must be designed and validated offline/online before schema migration.

Proposed conflict rules:

| Data category | Recommended rule |
|---|---|
| Hydration events | Append-only, deduplicated |
| Cognitive sessions | Append-only, deduplicated |
| Wellbeing/check-ins | Append-only, deduplicated |
| Medication administration events | Preserve source and attribution |
| Routine status | Conflict-aware reconciliation |
| Prescriptions | Clinician-authoritative state |

Caregiver-confirmed and clinician-recorded events must not be silently overwritten by older offline data.

### 9. Hosting, database and media storage

**Decision status: Proposed deferral, pending approval**

No hosting migration or production deployment is authorized at this stage.

Potential future architecture:
- PostgreSQL through Neon or another suitable managed provider.
- Private media storage through Cloudflare R2 or Supabase Storage.
- Signed, access-controlled media URLs.
- Vercel or Cloudflare deployment for an appropriately scoped pilot.

The current SQLite database and existing patient records must remain preserved.

Any future migration requires a verified backup, baseline migration strategy, data integrity checks and an explicit deployment authorization.

### 10. Notifications and SOS delivery guarantees

**Decision status: Confirmed policy (`Never show false success`); delivery transport (`Web Push` etc.) pending final approval**

Confirmed & recommended requirements:
- **Strict Honesty Guarantee (Confirmed):** SMRITI must **never** display or imply that a caregiver has been notified unless the relevant notification service confirms actual dispatch.
- Fix the existing mismatch between `/api/alert` (`smsSent` / `simulated`) and the patient-facing SOS modal in `src/app/page.tsx`.
- Distinguish clearly between an audit event being recorded and an actual notification being dispatched.
- Add Web Push notifications for caregiver devices where supported (`pending approval`).
- Provide direct one-tap calling through `tel:` links to approved family contacts and emergency services.
- Show delivery failures and unavailable services honestly.

### 11. Consent, privacy, data retention and deletion

**Decision status: Proposed, pending approval**

Recommended approach:
- Introduce immutable, auditable consent records.
- Record consent or appropriate representative authorization and patient assent where applicable.
- Track consent for location sharing, AI companion use, family sharing and clinician access.
- Support consent withdrawal.
- Define data-retention periods.
- Provide patient-data export.
- Provide an authorized account and patient-data deletion workflow with audit confirmation.

Caregiver account management must not automatically imply unrestricted authority over every patient privacy decision.

---

## Approval boundaries

### Confirmed by the product owner
1. Nagaland language selection deferred to community validation.
2. Manipur supports both Meetei Mayek and Bengali scripts.
3. Patient onboarding uses caregiver-created accounts with PIN and optional QR/device pairing (no mandatory email/password).
4. Offline voice combines recorded native-speaker phrases and caregiver recordings.
5. Clinical permission split: caregivers manage routines/reminders; prescription creation, modification, and discontinuation are clinician-controlled.
6. Strict SOS confirmation rule: never claim notification succeeded without confirmed dispatch.
7. Design-and-test-first requirement: encryption and synchronization architecture must be designed and tested before touching existing or production data.

### Still awaiting explicit approval (technical design choices)
1. Offline speech recognition strategy.
2. AI provider abstraction and external-data privacy policy.
3. Encryption architecture, schema backfill, and key recovery design.
4. Multi-device synchronization, delta protocol, and conflict rules.
5. Hosting, PostgreSQL, and media-storage migration timing/providers.
6. Notification transport stack (e.g., Web Push `VAPID` alongside SMS/direct `tel:`).
7. Consent, retention, export, and deletion workflows.

## Authorization statement

This document records product decisions and proposed technical resolutions for SMRITI Phase 0.

**Approval of this decision record does not automatically authorize implementation.**

Until a separate implementation authorization is provided:
- Do not modify application source code.
- Do not modify Prisma schema or generate migrations.
- Do not modify, reset or migrate the existing SQLite database.
- Do not change authentication, authorization or patient records.
- Do not deploy or change hosting infrastructure.
- Preserve all existing data and verified test baselines.

**Phase 1 remains on hold pending explicit approval and a separately scoped implementation instruction.**
