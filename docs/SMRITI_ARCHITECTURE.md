# SMRITI (`Smriti-NER`) — System Architecture Reference

**Version:** 1.0  
**Last Updated:** 2026-11-25  
**Workspace Root:** `C:\E_Drive\final ka final build`

> Cross-references: [Master Execution Report](./SMRITI_AUTONOMOUS_EXECUTION_REPORT.md) · [Security & Privacy](./SMRITI_SECURITY_AND_PRIVACY.md) · [Database & Migrations](./SMRITI_DATABASE_AND_MIGRATIONS.md) · [API Documentation](./SMRITI_API_DOCUMENTATION.md)

---

## 1. High-Level Architectural Topology

SMRITI is an **offline-first Next.js 14 App Router Progressive Web Application (PWA)** organized into three isolated role experiences over a single RBAC-enforced REST + Sync backend:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Client PWA (Next.js 14 App Router, Tailwind CSS, Workbox SW, Dexie v12)    │
│                                                                            │
│  ├── Patient UI (/, /games/*, /check-in, /scrapbook, /help-near-me)        │
│  │     ├── Complexity Modes: SIMPLE | GUIDED | FULL                        │
│  │     ├── Voice Companion: Intent Parser + Recorded Audio / Web Speech    │
│  │     └── Session Cache: WebCrypto AES-GCM ephemeral key wrapper          │
│  ├── Caregiver Portal (/caregiver/*)                                       │
│  │     └── Patient PIN/QR provisioning, routines, pills/photos, circle,   │
│  │         consents, settings, JSON/CSV exports, account deletion          │
│  └── Clinician Portal (/doctor)                                            │
│        └── Assigned patient switcher, Prescriptions (/medications/manage), │
│            unified timeline, rule-based engagement indicator               │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │ HTTPS / NextAuth JWT Session Cookie
┌───────────────────────────────────▼────────────────────────────────────────┐
│ Next.js Route Handlers & Domain Services (src/app/api/*, src/services/*)   │
│                                                                            │
│  ├── src/lib/rbac.ts         -> Role + CareCircleMember JSON scope checks  │
│  ├── src/lib/crypto-envelope -> Node AES-256-GCM field/binary encryption   │
│  ├── src/lib/media-storage   -> Private disk media store (./private_media) │
│  ├── src/lib/ai/             -> Intent Parser + AIProvider abstraction     │
│  └── Services                -> Medication, Hydration, Timeline, Pairing,  │
│                                 Audit                                      │
└───────────────────┬───────────────────────────────────────┬────────────────┘
                    │ Prisma Client (5.11.0)                │ Outbound HTTPS
┌───────────────────▼────────────────────┐  ┌───────────────▼────────────────┐
│ Relational DB (39 Prisma models)       │  │ Optional External Providers    │
│ Current: SQLite (prisma/dev.db)        │  │ - AI: Groq / Gemini (Paid-key) │
│ Staging Target: Neon Serverless PG     │  │ - SMS: Twilio REST API         │
└────────────────────────────────────────┘  │ - Push: Web Push VAPID         │
                                            └────────────────────────────────┘
```

---

## 2. Core Architectural Subsystems

### 2.1 Experience Adaptation & Mode Architecture
Implemented via `PatientPreference`, `/api/patients/[patientId]/preferences`, `src/hooks/usePatientPreferences.ts`, `src/components/layout/ClientProviders.tsx`, and `src/app/page.tsx`:
- **`SIMPLE` Mode:** Single-card priority view (`NowCard`), immediate `I Need Help` trigger, direct family calling (`FamilyCallModal`), optional listening cue, and Caregiver PIN lock modal if changing modes on a shared tablet.
- **`GUIDED` Mode:** Adds visual hydration glass counter (`+1 Glass` + Undo), guided 1-question-at-a-time wellbeing check-in banner, daily timeline preview, and large navigation shortcuts (`BottomNav`).
- **`FULL` Mode:** Unlocks all 14 cognitive activities (`src/app/games/*`), family photo storybook (`/scrapbook`), conversational/task Voice Companion (`ConversationalUI`), and `/help-near-me`.
- **Accessibility Controls (`ClientProviders` + `globals.css`):** Injects `--smriti-text-scale` (`0.9`–`1.5`), `[data-high-contrast="true"]`, `[data-reduced-motion="true"]`, and Framer Motion `<MotionConfig reducedMotion="always" />`.

### 2.2 Voice-First AI & Deterministic Fallback (`src/lib/ai/`)
- **Deterministic Task Parser (`src/lib/ai/intent-parser.ts`):** Recognizes high-confidence requests (`HYDRATION_STATUS`, `LOG_WATER`, `MEDICATION_STATUS`, `READ_ROUTINE`, `NEXT_ACTIVITY`, `SHOW_FAMILY`, `PLAY_GAME`, `CALL_FAMILY`, `OPEN_CHECK_IN`) prior to any external LLM call.
- **Provider Abstraction (`src/lib/ai/provider.ts`):** `AIProvider` interface implemented by `GroqAIProvider`, `GeminiAIProvider`, and offline `LocalFallbackAIProvider`, selected via `resolveAIProvider()`.
- **PII Stripping & Source Attribution (`src/app/api/chat/route.ts`):** `stripDirectPii()` redacts phone numbers, email addresses, and coordinates before external transmission; verified database replies carry `source: 'verified-record'` and `factGrounded: true`, whereas prose responses check `AI_COMPANION` consent first.

### 2.3 Offline Storage & Synchronization Engine
- **IndexedDB Schema (`src/lib/db.ts`, Dexie v12):** Stores local tables (`moods`, `gameLogs`, `hydrationEvents`, `wellbeingEntries`, `vitalLogs`, `caregiverReports`, `routineOccurrences`, `medicationEvents`, `locationPings`, `patientPreferences`, `routines`, `familyAssets`, `scrapbook`, `voiceReminders`, plus device helper metadata).
- **Idempotency & Conflict Resolution (`src/app/api/sync/route.ts` & `src/hooks/useSync.ts`):**
  - Client assigns `getOrCreateDeviceId()` and `generateClientMutationId()` per mutation.
  - `POST /api/sync` records every applied operation inside `SyncMutation` keyed by `@@unique([patientId, clientMutationId])` to prevent duplicates across unstable network retries.
  - **Conflict Rule:** `CAREGIVER_CONFIRMED` `MedicationEvent` and caregiver/completed `RoutineOccurrence` records are preserved on conflict (`status: 'CONFLICT_RESOLVED'`), emitting a conflict count and audit note rather than silently overwriting with stale offline patient taps.
  - `GET /api/sync` pulls updated server preferences, active medications, hydration targets, approved family assets, scrapbook entries, and consents back into client state.
- **Offline Document Fallback (`next.config.mjs` & `public/sw.js`):** Generated by `next-pwa` Workbox (`NetworkOnly` strictly enforced on `/api/*`, offline HTML fallback at `/offline`, offline SVG assets cached under `public/assets/ner/*`).

### 2.4 Private Media Pipeline
- **Client Pre-Compression (`src/lib/media-compress.ts`):** Downscales and compresses photo uploads to WebP/JPEG via HTML5 Canvas (`compressImageFileToDataUrl`) to keep SQLite/IndexedDB payloads small on budget Android devices.
- **Private Encrypted Server Storage (`src/lib/media-storage.ts` & `/api/patients/[patientId]/media/[assetId]`):** Converts incoming image/audio data URIs into AES-256-GCM encrypted binary files (`SMRENC1` header) stored outside `public/` under `MEDIA_STORAGE_DIR` (`./private_media`), served exclusively via RBAC-authorized streaming with `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`.
