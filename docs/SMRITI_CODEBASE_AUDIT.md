# SMRITI (`Smriti-NER`) — Repository Codebase & Dependency Audit

**Audit Date:** 2026-11-25  
**Target Directory:** `C:\E_Drive\final ka final build`  
**Baseline Backup:** `C:\E_Drive\smriti_backup_pre_cleanup_20261125_2331` (`prisma\dev.db` SHA-256: `99D15125EE13C2404CDF6E22E11602896AB348BEA6052A8542E42B3A6B088FDF`)

---

## 1. Audit Methodology

Static analysis and dependency tracing ran across `src/`, `scripts/`, `tests/`, `prisma/`, `public/`, root scripts, and `package.json` using Node AST/regex import resolution, Prisma model reference scanning, App Router endpoint caller tracing, static asset verification, and manual code inspection for dynamic imports or runtime-constructed URLs (such as `/api/patients/[patientId]/media/[assetId]`).

---

## 2. Confirmed Obsolete Files & Scripts (Safe to Remove)

| File | Size | Evidence of Obsolescence | Risk Assessment & Mitigation |
| :--- | :---: | :--- | :--- |
| `fix.js` | `5,361 B` | Legacy one-off Node patch script used historically to populate missing keys in `src/lib/translations.ts`. Never imported or referenced in runtime/build/tests. | Zero runtime/build risk. Archived in backup before removal. |
| `fix2.js` | `6,032 B` | Legacy follow-up translation patch script. Never imported or executed by npm scripts or app routes. | Zero runtime/build risk. Archived in backup before removal. |
| `src/lib/security.ts` | `1,414 B` | Legacy `crypto-js` client helper (`Security`). `0` imports across `src/` (superseded by server Node `aes-256-gcm` `src/lib/crypto-envelope.ts` and browser WebCrypto `src/lib/offline-crypto.ts`). Only referenced by a legacy negative string check in `tests/unit-security.test.mjs`. | Replace negative check in `unit-security.test.mjs` with a repo-wide scan asserting `crypto-js` and static keys do not exist in `src/`. |
| `src/lib/authUtils.ts` | `910 B` | Pre-v1 static permission map (`ROLE_PERMISSIONS`, `hasPermission`). `0` imports across codebase (superseded by database-enforced `RBAC` in `src/lib/rbac.ts`). | Zero risk. |
| `src/lib/notifications.ts` | `2,277 B` | Unused prototype browser timer notification utility (`requestNotificationPermission`, `sendNotification`, `startReminders`, `stopReminders`). `0` imports across codebase (`RoutineNotification.tsx` handles patient reminders). | Zero risk. |
| `src/components/ui/Card.tsx`, `PageHeader.tsx`, `Icon3D.tsx`, `DynamicHydrationIcon.tsx`, `DynamicPillIcon.tsx` | `~6.8 KB` | Re-exported by `src/components/ui/index.ts`, with **`0` callers** anywhere across App Router pages, components, games, or tests (`@/components/ui` consumers strictly import `FadeIn`, `Button`, and `ListenButton`). | Remove unused files and restrict `src/components/ui/index.ts` exports to `Button`, `FadeIn`, and `ListenButton`. |
| `src/app/api/content/route.ts` & `src/services/cms.service.ts` | `~5.3 KB` | Early CMS prototype (`GET`/`POST /api/content`). `0` frontend, hook, or test callers (`DailyRoutine`, `NER_REGIONAL_PACKS`, and `src/app/games/*` handle routines and games). | Remove route and service while **preserving** `ContentItem` table in `prisma/schema.prisma` to honor non-destructive schema preservation rules. |

---

## 3. Dependency Audit (`package.json`)

| Dependency | Usage Count & Callers | Decision | Rationale |
| :--- | :--- | :---: | :--- |
| `swiper` | `0` files | **Remove** | Completely unused bundle/dependency bloat. |
| `crypto-js`, `@types/crypto-js` | Only obsolete `src/lib/security.ts` | **Remove** | Replaced by native Node `crypto` (`AES-256-GCM`) and browser `SubtleCrypto`. Eliminates insecure/weak legacy helper and package weight. |
| `twilio` | `1` file (`src/app/api/alert/route.ts`) | **Replace & Remove** | Replaced SDK import (`60+` transitive packages) with lightweight native HTTP `fetch` to Twilio REST API `Messages.json`, preserving optional SOS SMS transport at zero bundle cost. |
| `@google/generative-ai` | `1` file (`src/lib/ai/provider.ts`) | **Retain (Gated)** or use REST | Wait: keep lightweight package OR enforce privacy gate (`GEMINI_PRIVACY_APPROVED`) per free-tier data training findings; zero cost unless configured. |
| `next`, `react`, `react-dom`, `next-auth`, `@prisma/client`, `prisma`, `bcryptjs`, `dexie`, `dexie-react-hooks`, `framer-motion`, `lucide-react`, `recharts`, `leaflet`, `react-leaflet`, `next-pwa` | Active (`1` to `63` files each) | **Retain** | Essential core framework, DB, offline IndexedDB, charting, mapping, and PWA packages. |

---

## 4. Intentionally Retained Items (Verified Not Dead Despite Low Static Import Counts)

| Item | Reason Retained |
| :--- | :--- |
| `/api/patients/[patientId]/media/[assetId]/route.ts` | Dynamically referenced via returned URL strings `/api/patients/${patientId}/media/${assetId}` in `src/lib/media-storage.ts`. |
| `public/assets/ner/*.svg` (`21` SVGs) | Every single SVG under `public/assets/ner/` is actively referenced by `src/lib/regional-content.ts` (`NER_REGIONAL_PACKS`), `src/app/scrapbook/page.tsx`, or `src/components/patient/FamilyCallModal.tsx`. |
| `prisma/schema.prisma` model `HealthScore` & `ContentItem` | Baseline SQLite schema tables intentionally preserved so live/existing DBs never encounter destructive table drops during migration. |
| `prisma/schema.prisma` model `DeviceSession` & `PushSubscription` | Retained and wired into onboarding revocation / optional push registration without breaking schema parity. |
| `Start-Dashboards.bat` | Helpful student/Windows developer one-click launcher (`npm.cmd run dev` + browser tabs) documented in README. |
| `public/sw.js`, `public/workbox-*.js`, `public/fallback-*.js` | Auto-generated PWA runtime artifacts produced by `next-pwa` on `next build` (git-ignored via `.gitignore`). |
| `console.error` / `console.warn` calls in `src/` | Structured boundary error logging in `api-errors.ts`, `audit.service.ts`, sync catch blocks; only noisy debug `console.log` in `RoutineNotification.tsx` removed. |
