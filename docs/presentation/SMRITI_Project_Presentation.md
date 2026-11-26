# SMRITI (`Smriti-NER`) — Project Presentation Deck

> **Offline-First AI Voice Companion, Cognitive Engagement & Care Coordination Platform for Older Adults in India's North Eastern Region (NER)**

---

## Slide 1: Title & Project Identity
- **Project Name:** SMRITI (`Smriti-NER`)
- **Domain:** Assistive Healthcare, Cognitive Support & Full-Stack Web Engineering (PWA)
- **Target Region:** India's 8 North Eastern States (Assam, Arunachal Pradesh, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, Tripura)
- **Disclaimer:** Supportive memory and daily-routine companion — does **not** diagnose, cure, or replace qualified clinicians or emergency services.

---

## Slide 2: Problem Identification & Motivation
- **Aging & Dementia Care Gap:** Older adults experiencing mild cognitive impairment or dementia face daily medication errors, dehydration, disorientation, and social isolation.
- **Regional & Linguistic Barriers:** Most digital health tools are English-only, assume continuous high-speed internet, and lack cultural familiarity for India's North Eastern Region (NER).
- **Fragmented Care:** Caregivers lack lightweight remote coordination tools, while clinicians need structured adherence and engagement summaries without exposing raw family media.

---

## Slide 3: Planning & Project Scope
- **Milestone 1 (Proposal & Problem Definition):** `docs/reports/SMRITI_Milestone_1_Project_Proposal_Final.pdf`
- **Phase 0 (Architecture & Decisions):** `docs/SMRITI_PHASE0_DECISION_RECORD.md`, `docs/SMRITI_PHASE0_VALIDATION.md`
- **Product Specification v1:** `docs/SMRITI_PRODUCT_SPECIFICATION_V1.md`
- **6-Phase Execution Plan:**
  1. Core Patient & Caregiver Foundations
  2. Cognitive Gaming Engine & Adaptive Difficulty
  3. 8-State NER Localization & Voice Companion
  4. Clinician Portal, Separation of Duties & RBAC
  5. AES-256-GCM Security, Offline Sync & PWA Hardening
  6. Codebase Audit, Mobile/Tablet Responsiveness & ₹0 Free-Tier Deployment

---

## Slide 4: System Architecture & Tech Stack
- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS, PWA (`@ducanh2912/next-pwa`)
- **Backend:** Next.js Route Handlers (`/api/*`), NextAuth / Session RBAC
- **Databases:**
  - Local / CI: SQLite via Prisma (`prisma/schema.prisma`)
  - Production: Neon Serverless PostgreSQL (`prisma/postgres/schema.prisma`)
  - Client Offline: Dexie IndexedDB (`src/lib/db.ts` v12) with WebCrypto session-scoped cache encryption (`src/lib/offline-crypto.ts`)
- **AI & Voice:** Groq / OpenAI-compatible LLM provider (`src/lib/ai/provider.ts`) with deterministic local fallback (`src/lib/ai/intent-parser.ts`) + Web Speech / recorded caregiver audio (`src/lib/offline-voice.ts`)

---

## Slide 5: Database & Security Design
- **39-Model Relational Schema:** Patients, Caregivers, Clinicians, `CareCircleMember` granular permissions, `ConsentRecord`, Medications, Routines, Hydration, Cognitive Sessions, `SyncMutation`, `MediaAsset`.
- **Security Controls (`docs/SMRITI_SECURITY_AND_PRIVACY.md`):**
  - Authenticated **AES-256-GCM** field & private binary encryption (`src/lib/crypto-envelope.ts`)
  - Role-Based Access Control (`PATIENT`, `CAREGIVER`, `CLINICIAN`) with strict separation of duties
  - Passwordless elder login (`SMR-XXXXXX` + 4–6 digit PIN + 5-attempt lockout + 24h single-use QR pairing)
  - Fail-closed environment validation (`src/lib/env.ts`) & rate limiting (`src/lib/rate-limit.ts`)

---

## Slide 6: UI/UX & Responsive Mobile Design
- **Three Role-Specific Dashboards (Phone `375×812`, Tablet, Desktop):**
  - **Patient (`/`):** `SIMPLE` / `GUIDED` / `FULL` modes, `>= 56px` touch targets, `NowCard`, 1-tap hydration with Undo, SOS confirmation modal, 14 offline cognitive games (`docs/screenshots/smriti-patient-dashboard-phone.png`).
  - **Caregiver (`/caregiver`):** Patient creation (PIN & QR), daily routine & medication tracking, hydration monitoring, printable A4 schedule (`docs/screenshots/smriti-caregiver-dashboard-phone.png`).
  - **Medical / Clinical (`/doctor`):** Prescription management, vitals & trends, timeline, engagement analytics, CSV/print export (`docs/screenshots/smriti-medical-dashboard-phone.png`).

---

## Slide 7: AI Companion, Adaptive Games & NER Localization
- **14 Offline Cognitive Activities** with adaptive difficulty (`src/lib/ai-difficulty.ts`) based on accuracy, response time, and frustration signals.
- **8-State NER Localization:** Cultural packs (`src/lib/regional-content.ts`), translations (`src/lib/translations.ts`), Manipur dual-script (`mni` & `mni-mymk` Meetei Mayek), and transparent verification badges (`src/lib/i18n/metadata.ts`).
- **Privacy-Preserving AI Assistant:** Grounded on patient routines/medications without leaking raw private media; falls back gracefully offline.

---

## Slide 8: Development & Implementation Highlights
- **Offline-First Sync Engine:** Dexie IndexedDB outbox queues mutations offline and replays them with `clientMutationId` idempotency against `/api/sync`.
- **Dual-Database Build Pipeline:** `scripts/vercel-build.mjs` handles Neon pooled + `directUrl` Prisma migrations cleanly during Vercel builds.
- **Full Documentation:** `docs/SMRITI_TECHNICAL_DESIGN_DOCUMENTATION.md` & `docs/reports/SMRITI_Technical_Design_Documentation.pdf` + `docs/reports/SMRITI_Project_Design_Diagrams.pdf`.

---

## Slide 9: Testing & Verification Results
- **Automated CI Pipeline (`.github/workflows/ci.yml`):**
  - Prisma schema validation (both SQLite & PostgreSQL)
  - TypeScript typecheck (`npm run typecheck`) & ESLint (`npm run lint`)
  - Production Next.js + PWA build (`npm run build`)
  - Unit Security Suite (`tests/unit-security.test.mjs`)
  - Isolated E2E Integration Suite (`tests/integration-e2e.mjs`)
  - Comprehensive v1 Suite (`tests/v1-comprehensive.test.mjs`)
- **Responsive & Browser Audits:** Verified across desktop, tablet, and `375×812` phone viewports.

---

## Slide 10: Live Deployment & Results
- **100% Free-Tier Production Stack (`docs/SMRITI_FREE_TIER_COST_AND_LIMITS.md`):**
  - **Hosting:** Vercel Hobby (₹0, no credit card)
  - **Database:** Neon Serverless PostgreSQL Free Tier (₹0, 1 GB storage, no credit card)
  - **Encrypted Media:** `DB_ENCRYPTED` mode in PostgreSQL `MediaAsset.encryptedBlob`
- **Outcome:** Clean zero-seed production database ready for real user onboarding, passing `/api/health` and full CI checks.

---

## Slide 11: Conclusion
- Delivered a secure, offline-first, culturally grounded cognitive support and care coordination PWA tailored to India's North Eastern Region.
- Successfully unified three distinct user roles (Patient, Caregiver, Clinician) with strict RBAC, AES-256-GCM encryption, 14 adaptive cognitive games, and 8-state NER localization on a ₹0 free-tier cloud stack.

---

## Slide 12: Future Work
- Native Android/iOS wrapper (Capacitor/TWA) for background push reminders and hardware SOS triggers.
- Expanded native-speaker audio recordings across additional NER dialects and tribal languages.
- Longitudinal clinical trend ML models (with explicit patient/caregiver consent) and wearable vitals integration.
- Automated scheduled data-retention purge jobs and multi-caregiver real-time WebSocket notifications.
