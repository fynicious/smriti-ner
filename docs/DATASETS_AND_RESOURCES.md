# SMRITI (`Smriti-NER`) — Datasets, Cultural Packs & Schema Resources

This document indexes the structured datasets, synthetic test fixtures, linguistic/cultural packs, and database schemas included in the repository.

---

## 1. Synthetic Demonstration & Testing Datasets
- **Synthetic Seed Dataset Generator:** `scripts/seed-synthetic-demo.mjs`
  - Generates strictly synthetic, non-PII demonstration data for local/staging showcase and automated verification:
    - Synthetic accounts across all three roles (Patient `SMR-100001`, Caregiver `demo.caregiver@smriti.local`, Clinician `demo.doctor@smriti.local`)
    - Daily routines, medication schedules, hydration logs, wellbeing check-ins, and cognitive game session metrics
- **Automated Integration & Security Test Fixtures:**
  - `tests/unit-security.test.mjs` — cryptographic envelope, RBAC, and validation unit fixtures
  - `tests/integration-e2e.mjs` — isolated temporary SQLite E2E lifecycle fixtures
  - `tests/v1-comprehensive.test.mjs` — comprehensive v1 API, pairing, sync, and clinical workflow fixtures

> **Privacy Note:** Real user databases (`prisma/*.db`), local environment secrets (`.env`, `.env.local`), and private encrypted media (`/private_media/`) are strictly excluded via `.gitignore` and never committed to source control.

---

## 2. 8-State North Eastern Region (NER) Linguistic & Cultural Datasets
- **Multilingual UI & Voice String Dataset:** `src/lib/translations.ts`
  - Curated translations covering all 8 North Eastern states of India, including dual-script Manipuri support (`mni` Bengali script and `mni-mymk` Meetei Mayek).
- **Language & Script Metadata Registry:** `src/lib/i18n/metadata.ts`
  - Stores language codes, native labels, script identifiers, speech-synthesis support flags, and translation verification metadata.
- **Regional Cultural Content & Cognitive Stimuli:** `src/lib/regional-content.ts`
  - Cultural packs, festivals, regional motifs, and localized prompts powering the cognitive activities and cultural reminiscence features.
- **Language Validation Report:** `docs/SMRITI_LANGUAGE_VALIDATION.md`

---

## 3. Database Schemas & Migration History
- **SQLite Development/Local Schema:** `prisma/schema.prisma` & `prisma/migrations/`
- **PostgreSQL Production Schema:** `prisma/postgres/schema.prisma` & `prisma/postgres/migrations/`
- **Schema & Migration Documentation:** `docs/SMRITI_DATABASE_AND_MIGRATIONS.md`
- **Client Offline IndexedDB Schema:** `src/lib/db.ts` (Dexie v12 offline cache & `SyncMutation` outbox)
