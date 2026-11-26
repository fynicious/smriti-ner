# SMRITI (`Smriti-NER`)

**Offline-first voice companion, cognitive engagement, and care coordination PWA built for older adults experiencing dementia or memory challenges across India's North Eastern Region (NER).**

> Notice: SMRITI is a supportive memory and daily-routine companion. It does **not** diagnose, cure, or replace qualified clinicians or emergency medical services.

---

## Key Capabilities

- **Patient Experience (`SIMPLE` / `GUIDED` / `FULL`):** High-contrast elderly-friendly UI with `>= 56px` touch targets, adaptive single-task `NowCard`, caregiver PIN lock on mode changes, pill identification photos, 1-tap hydration logging with Undo, skippable 6-area wellbeing check-ins, family photo scrapbook, safe calling confirmation modal with truthful SOS dispatch status, and **14 offline cognitive activities**.
- **Caregiver & Clinician Portals:**
  - Caregiver creation of passwordless elder accounts (`SMR-XXXXXX` login code + 4–6 digit PIN + single-use 24h QR pairing link; 5-attempt lockout protection).
  - Strict separation of duties: **Clinicians (`/doctor`)** exclusively manage medication prescriptions (`POST`/`PATCH /api/patients/[id]/medications/manage`), while **Caregivers (`/caregiver`)** manage routines, pill photos, `CareCircleMember` granular JSON permissions, consents (`ConsentRecord`), and log verified administration (`CAREGIVER_CONFIRMED` vs `PATIENT_REPORTED`).
  - Printable A4 kitchen wall schedule, JSON/CSV exports, and audited deletion (`POST /api/account/delete`).
- **Security & Privacy:** Authenticated AES-256-GCM field & private binary encryption at rest (`ENCRYPTION_MASTER_KEY`), RBAC-protected `/api/patients/[id]/media/[assetId]`, session-scoped WebCrypto offline cache encryption with idle/logout wipe, fail-closed env secret validation, and CSP/security headers.
- **8-State NER Localization & Voice Fallback:** Supports all 8 North Eastern states with localized SVG cultural packs, Manipur dual script (`mni` Bengali script / `mni-mymk` Meetei Mayek), transparent translation verification & speech badges, and offline Caregiver/native-speaker recorded core phrases before Web Speech fallback.
- **Offline-First Sync:** Dexie IndexedDB outbox (`db.ts` v12) + `SyncMutation` server deduplication (`clientMutationId`), conflict preservation, and delta `GET /api/sync` pulls.

---

## Local Development Setup

### Prerequisites
- Node.js `>= 20.x`
- npm `>= 10.x`

### 1. Configure Environment
```powershell
Copy-Item .env.example .env.local
```
Generate strong 32-byte secrets for `NEXTAUTH_SECRET` and `ENCRYPTION_MASTER_KEY` (e.g., `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), and set `NEXTAUTH_URL="http://localhost:3000"`, `DATABASE_URL="file:./dev.db"`, and `CLINICIAN_INVITE_CODE`.

### 2. Install, Migrate & Run Locally
```powershell
npm.cmd install
npx.cmd prisma migrate deploy
npx.cmd prisma generate
npm.cmd run build
npm.cmd run start
```
Open `http://localhost:3000` (or run `npm.cmd run dev` for hot reload; Windows developers can also use `Start-Dashboards.bat`).

### Optional: Seed Strictly Synthetic Demo Accounts (Local / Staging Showcase Only)
Never run over real user data if unwanted; designed for fresh demo databases:
```powershell
npm.cmd run db:seed:demo
```
Creates synthetic demo accounts (`SMR-100001` PIN `1234`, `demo.caregiver@smriti.local` / `DemoCare123!`, `demo.doctor@smriti.local` / `DemoDoctor123!`).

---

## Automated Verification Suite

All E2E and v1 integration suites copy SQLite into temporary `os.tmpdir()` directories and verify `prisma/dev.db` stays untouched:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd run test:v1
```

---

## ₹0 Free-Tier Web Deployment (Vercel Hobby + Neon Postgres Free)

Full cost comparisons and credit-card disclosures live in [SMRITI_FREE_TIER_COST_AND_LIMITS.md](docs/SMRITI_FREE_TIER_COST_AND_LIMITS.md) and [SMRITI_PRODUCTION_DATABASE_GUIDE.md](docs/SMRITI_PRODUCTION_DATABASE_GUIDE.md).

1. **Create a Free Neon Postgres Project** at `neon.tech` (**no credit card required**; `1 GB` persistent storage). Copy the pooled PostgreSQL connection string (`postgresql://...?sslmode=require`).
2. **Create a Free Vercel Project** (`vercel.com`, Hobby plan for non-commercial student/family demonstration; **no credit card required**). Connect your Git repository (build command `node scripts/vercel-build.mjs` is preconfigured in `vercel.json`).
3. **Configure Vercel Environment Variables:**
   - `DATABASE_URL`: Neon `postgresql://...` URI
   - `NEXTAUTH_SECRET`: 32+ char CSPRNG secret
   - `NEXTAUTH_URL`: Your `https://<project>.vercel.app` URL
   - `ENCRYPTION_MASTER_KEY`: 64 hex chars CSPRNG master key
   - `MEDIA_STORAGE_DRIVER`: `DB_ENCRYPTED` (recommended single-provider persistent mode storing AES-256-GCM blobs in Neon `MediaAsset.encryptedBlob`) — or set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `MEDIA_STORAGE_DRIVER=SUPABASE_PRIVATE` for a private Supabase bucket (`1 GB` free, no card)
   - `CLINICIAN_INVITE_CODE`: Secret code gating clinician signup
   - Optional: `SEED_SYNTHETIC_DEMO=1` (first deploy only on empty DB to create showcase accounts), `GROQ_API_KEY` (free console tier), `SMRITI_AI_PROVIDER=local` if offline-only AI fallback is preferred.
4. **Verify Live Health Endpoint:** After deploy, visit `https://<your-app>.vercel.app/api/health` and confirm `200 OK` (`database.status: "connected"`, `configReady: true`).

---

## Complete Project Documentation & Submission Index

| Project Stage | Included Artifacts & Documents |
| :--- | :--- |
| **1. Planning & Problem Identification** | [Milestone 1 Project Proposal (PDF)](docs/reports/SMRITI_Milestone_1_Project_Proposal_Final.pdf) · [Phase 0 Decision Record](docs/SMRITI_PHASE0_DECISION_RECORD.md) · [Phase 0 Validation](docs/SMRITI_PHASE0_VALIDATION.md) · [Product Specification v1](docs/SMRITI_PRODUCT_SPECIFICATION_V1.md) |
| **2. Design (Architecture, DB, UI, Security)** | [Complete Technical Design Documentation (PDF)](docs/reports/SMRITI_Technical_Design_Documentation.pdf) · [Technical Design Source (MD)](docs/SMRITI_TECHNICAL_DESIGN_DOCUMENTATION.md) · [Project Design Diagrams (PDF)](docs/reports/SMRITI_Project_Design_Diagrams.pdf) · [System Architecture](docs/SMRITI_ARCHITECTURE.md) · [Product & UX Guide](docs/SMRITI_PRODUCT_ARCHITECTURE_AND_UX_GUIDE.md) · [Database & Migrations](docs/SMRITI_DATABASE_AND_MIGRATIONS.md) · [Security & Privacy](docs/SMRITI_SECURITY_AND_PRIVACY.md) |
| **3. Development & Implementation** | Source Code (`src/`, `prisma/`, `scripts/`, `public/`) · [API Reference](docs/SMRITI_API_DOCUMENTATION.md) · [8-State NER Language Validation](docs/SMRITI_LANGUAGE_VALIDATION.md) · [Production Database Guide](docs/SMRITI_PRODUCTION_DATABASE_GUIDE.md) · [Deployment Guide](docs/SMRITI_DEPLOYMENT_GUIDE.md) · [Changelog](docs/SMRITI_CHANGELOG.md) |
| **4. Testing & Verification** | Automated Suites (`tests/`, `.github/workflows/ci.yml`) · [Testing & Verification Guide](docs/SMRITI_TESTING_GUIDE.md) · [Comprehensive Audit](docs/SMRITI_COMPREHENSIVE_AUDIT.md) · [Codebase Audit](docs/SMRITI_CODEBASE_AUDIT.md) · [Issue Tracker](docs/SMRITI_ISSUE_TRACKER.md) |
| **5. Results & Deployment** | [Final Engineering & Deployment Report](docs/SMRITI_FINAL_ENGINEERING_AND_DEPLOYMENT_REPORT.md) · [Autonomous Execution Report](docs/SMRITI_AUTONOMOUS_EXECUTION_REPORT.md) · [Free-Tier Cost & Limits](docs/SMRITI_FREE_TIER_COST_AND_LIMITS.md) · [Deployment Plan](docs/SMRITI_DEPLOYMENT_PLAN.md) |
| **6. Datasets & Supporting Resources** | [Datasets, Cultural Packs & Schema Index](docs/DATASETS_AND_RESOURCES.md) · Synthetic Seed (`scripts/seed-synthetic-demo.mjs`) · NER Cultural & Linguistic Packs (`src/lib/translations.ts`, `src/lib/regional-content.ts`) |
| **7. Presentation & UI Screenshots** | [Project Presentation Deck (12 Slides)](docs/presentation/SMRITI_Project_Presentation.md) · [Patient Phone UI](docs/screenshots/smriti-patient-dashboard-phone.png) · [Caregiver Phone UI](docs/screenshots/smriti-caregiver-dashboard-phone.png) · [Medical Phone UI](docs/screenshots/smriti-medical-dashboard-phone.png) |
| **8. Conclusion & Future Work** | Covered in [Technical Design Documentation (Part 11)](docs/SMRITI_TECHNICAL_DESIGN_DOCUMENTATION.md) & [Project Presentation (Slides 11–12)](docs/presentation/SMRITI_Project_Presentation.md) |
