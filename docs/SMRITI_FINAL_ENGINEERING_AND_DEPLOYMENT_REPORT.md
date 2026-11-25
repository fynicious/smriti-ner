# SMRITI (`Smriti-NER`) — Final Codebase Cleanup, Optimization & Free Deployment Report

**Project:** SMRITI (`Smriti-NER`) — Voice-First Cognitive Assistance & Memory Care PWA  
**Workspace Root:** `C:\E_Drive\final ka final build`  
**Date Completed:** 2026-11-25

> Supporting Reports: [Codebase Audit](./SMRITI_CODEBASE_AUDIT.md) · [Free-Tier Cost & Limits](./SMRITI_FREE_TIER_COST_AND_LIMITS.md) · [Production Database Guide](./SMRITI_PRODUCTION_DATABASE_GUIDE.md) · [Architecture](./SMRITI_ARCHITECTURE.md) · [Security & Privacy](./SMRITI_SECURITY_AND_PRIVACY.md)

---

## 1. Original Architecture (Pre-Cleanup State)
Prior to this cleanup and cloud-readiness phase, SMRITI had completed its 6-phase functional build as a local-only Next.js `14.2.35` PWA backed exclusively by SQLite (`prisma/dev.db`) and local filesystem encrypted storage (`./private_media`), alongside `20` production npm dependencies (`swiper`, `crypto-js`, `twilio`, `@google/generative-ai`, etc.), leftover translation patch scripts (`fix.js`, `fix2.js`), `5` unused UI wrapper primitives, `3` unused helper modules (`security.ts`, `authUtils.ts`, `notifications.ts`), an unused CMS prototype (`/api/content` + `cms.service.ts`), duplicated rate-limiting logic, no cloud PostgreSQL migration folder, no health-check endpoint, no stateless cloud media driver, and no Vercel/GitHub Actions deployment config.

## 2. Final Architecture (Clean, Lean & Cloud-Ready)
SMRITI is now a lean `125`-file (`src/`) Next.js `14.2.35` App Router PWA featuring:
- **Dual-Target Prisma Layer:** Local SQLite (`prisma/schema.prisma`, preserved with `3` original users) + validated cloud PostgreSQL (`prisma/postgres/schema.prisma` + `prisma/postgres/migrations/0001_init`), auto-selected at build time via `scripts/vercel-build.mjs`.
- **Three-Driver Encrypted Media Abstraction (`src/lib/media-storage.ts`):** Supports `LOCAL_PRIVATE` (disk `./private_media`), `DB_ENCRYPTED` (Neon Postgres `BYTEA` `MediaAsset.encryptedBlob` — default on stateless cloud Postgres), and `SUPABASE_PRIVATE` (private bucket via HTTPS REST), always wrapped in `SMRENC1` AES-256-GCM ciphertext and served strictly via `/api/patients/[patientId]/media/[assetId]`.
- **Shared Core Controls:** Shared `src/lib/rate-limit.ts` (`auth.ts` + `/api/chat`), zero-dependency Twilio/Gemini HTTP `fetch` adapters, `/api/health` readiness endpoint, Next `images: { unoptimized: true }`, and `Cache-Control: private, no-store` headers on `/api/*`.

## 3. Cleanup Performed
1. Removed leftover one-time patch scripts, unused legacy libraries, unreferenced UI primitives, and unused CMS prototype route/service.
2. Uninstalled `5` unused or heavy SDK dependencies (`swiper`, `crypto-js`, `@types/crypto-js`, `twilio`, `@google/generative-ai`).
3. Removed debug `console.log` inside `RoutineNotification.tsx` and deduplicated rate limiting into `src/lib/rate-limit.ts`.
4. Executed non-breaking `npm audit fix`.

## 4. Deleted Files and Reasons
| Deleted Path | Reason |
| :--- | :--- |
| `fix.js`, `fix2.js` | Obsolete one-off translation patch scripts (`0` runtime/build callers) |
| `src/lib/security.ts` | Legacy `crypto-js` client helper (`0` imports; replaced by `crypto-envelope.ts` & `offline-crypto.ts`) |
| `src/lib/authUtils.ts` | Obsolete static permission map (`0` imports; replaced by `src/lib/rbac.ts`) |
| `src/lib/notifications.ts` | Unused timer prototype (`0` imports; `RoutineNotification.tsx` serves alerts) |
| `src/components/ui/{Card,PageHeader,Icon3D,DynamicHydrationIcon,DynamicPillIcon}.tsx` | Re-exported wrappers with `0` consumers across app/games/tests |
| `src/app/api/content/route.ts`, `src/services/cms.service.ts` | Unused CMS prototype (`0` callers; `DailyRoutine` + `NER_REGIONAL_PACKS` handle schedules & cultural items) |

## 5. Dependencies Removed and Reasons
- `swiper`: `0` imports anywhere in codebase.
- `crypto-js` & `@types/crypto-js`: Unused after removing legacy `src/lib/security.ts`.
- `twilio` (`60+` transitive packages): Replaced in `src/app/api/alert/route.ts` with a 25-line standard `fetch()` call to Twilio's HTTPS REST endpoint (`Messages.json`).
- `@google/generative-ai`: Replaced in `src/lib/ai/provider.ts` with zero-dependency HTTPS REST call gated cleanly by `GEMINI_PAID_OR_PRIVATE=true`.

## 6. Files Refactored / Created
- **Refactored:** `src/lib/media-storage.ts`, `src/app/api/account/delete/route.ts`, `src/app/api/caregiver/patients/[patientId]/onboarding/route.ts`, `src/app/api/alert/route.ts`, `src/app/api/chat/route.ts`, `src/lib/ai/provider.ts`, `src/lib/auth.ts`, `src/components/ui/index.ts`, `src/components/patient/RoutineNotification.tsx`, `next.config.mjs`, `package.json`, `.env.example`, `README.md`, `tests/unit-security.test.mjs`, `tests/v1-comprehensive.test.mjs`, `prisma/schema.prisma`.
- **Created:** `src/lib/rate-limit.ts`, `src/app/api/health/route.ts`, `prisma/migrations/0002_media_encrypted_blob/migration.sql`, `prisma/postgres/schema.prisma`, `prisma/postgres/migrations/migration_lock.toml`, `prisma/postgres/migrations/0001_init/migration.sql`, `scripts/vercel-build.mjs`, `scripts/seed-synthetic-demo.mjs`, `vercel.json`, `.github/workflows/ci.yml`, `docs/SMRITI_CODEBASE_AUDIT.md`, `docs/SMRITI_FREE_TIER_COST_AND_LIMITS.md`, `docs/SMRITI_PRODUCTION_DATABASE_GUIDE.md`, and this report.

## 7. Security Improvements
- Removed client-side `crypto-js` module (`src/lib/security.ts`) permanently and enforced negative check in `tests/unit-security.test.mjs`.
- Wired `DeviceSession` bulk revocation into `POST /api/caregiver/patients/[patientId]/onboarding` whenever PIN/QR credentials reset.
- Enforced AI rate limiting (`20` requests / `10` min per patient) and privacy gate (`GEMINI_PAID_OR_PRIVATE=true` required before sending prompts to Gemini, preventing accidental free-tier model training).
- Added `Cache-Control: private, no-store, no-cache, must-revalidate` across `/api/:path*` and `images: { unoptimized: true }` in `next.config.mjs` (closing CDN response caching & `/_next/image` attack surfaces).
- Applied non-breaking `npm audit fix`; remaining advisories (`next 14.2.35`, `postcss`, `next-pwa 5.6.0`) require breaking major Next 16 upgrade and are documented below.

## 8. Database Changes
- Added optional `encryptedBlob Bytes?` on `MediaAsset` (`0002_media_encrypted_blob`), tested via isolated copy first, then applied cleanly to `prisma/dev.db` (`SHA-256: A1430265A715A8D7CBA66F761A1AAB3405C8A690D5ED70D26DCC132F87F7F5D6`, all `3` original `User` and `3` `PatientProfile` rows intact).
- Created standalone PostgreSQL schema (`prisma/postgres/schema.prisma`) and validated SQL migration (`prisma/postgres/migrations/0001_init/migration.sql`, `31,479` bytes).
- Added synthetic demo seed script (`scripts/seed-synthetic-demo.mjs`).

## 9. Storage Changes
- Upgraded `src/lib/media-storage.ts` from local disk-only (`./private_media`) to configurable 3-driver AES-256-GCM binary persistence (`LOCAL_PRIVATE`, `DB_ENCRYPTED`, `SUPABASE_PRIVATE`), eliminating ephemeral serverless filesystem loss on Vercel.

## 10. Hosting Providers Evaluated
Evaluated via live web research (`2026-11-25`) across `vercel.com`, `neon.tech`/`neon.com`, `supabase.com`, `developers.cloudflare.com`, `netlify.com`, `groq.com`, `ai.google.dev`, and `docs.github.com`:
- **Vercel Hobby vs Netlify Free vs Cloudflare Workers/Pages**
- **Neon Free vs Supabase Free**
- **Cloudflare R2 (rejected due to mandatory credit card)** vs **Supabase Private Storage (no card)** vs **Neon `DB_ENCRYPTED` (no card, single DB)**
- **Groq Free vs Gemini Free**

Full comparative breakdown in [SMRITI_FREE_TIER_COST_AND_LIMITS.md](./SMRITI_FREE_TIER_COST_AND_LIMITS.md).

## 11. Selected Free-Tier Architecture
- **Frontend & Backend Hosting:** **Vercel Hobby** (`$0/mo`, no credit card required; non-commercial demo use only)
- **Cloud Database:** **Neon Postgres Free** (`$0/forever`, no credit card required, `1 GB` storage)
- **Private Encrypted Media:** **`DB_ENCRYPTED` inside Neon `MediaAsset.encryptedBlob`** (or optional **`SUPABASE_PRIVATE` `1 GB` bucket**, also no credit card required)
- **AI Companion:** **Groq Free Console Tier** (optional key, PII stripped, rate-limited) + deterministic `LocalFallbackAIProvider` (`$0`)
- **CI/CD:** **GitHub Actions** (`.github/workflows/ci.yml`)

## 12. Official Pricing References (Checked `2026-11-25`)
- `https://vercel.com/pricing` & Vercel Hobby limits documentation
- `https://neon.com/docs/introduction/plans` / `https://neon.tech`
- `https://supabase.com/pricing`
- `https://developers.cloudflare.com/r2/pricing/` & Workers limits (`developers.cloudflare.com`)
- `https://www.netlify.com/pricing/`
- `https://console.groq.com/docs/rate-limits` & `https://ai.google.dev/pricing`
- `https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions`

## 13. Actual Free-Tier Limits
- **Vercel Hobby:** `100 GB` Fast Data Transfer, `10 GB` Origin Transfer, `1M` invocations, `4` CPU-hrs/mo, `300s` max duration, pause/rate-limit on exhaustion, **strictly non-commercial**.
- **Neon Free:** `1 GB` storage, `100 CU-hrs/mo`, scales to zero after `5` min idle, writes pause at `1 GB` without deletion.
- **Groq Free:** `~30` RPM, `1,000` RPD, `~8k` TPM, `200k` TPD (HTTP `429` degrades automatically to local fallback).
- **Supabase Free (Optional Media):** `1 GB` storage, `5 GB/mo` egress, auto-pauses after `7` days of zero activity.

## 14. Environment Variables Required
Defined in [.env.example](../.env.example) (placeholders only — no secrets committed):
`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ENCRYPTION_MASTER_KEY`, `MEDIA_STORAGE_DRIVER`, `MEDIA_STORAGE_DIR`, `CLINICIAN_INVITE_CODE`, and optional `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `SMRITI_AI_PROVIDER`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `GEMINI_PAID_OR_PRIVATE`, `SEED_SYNTHETIC_DEMO`, Twilio SMS vars, and Web Push VAPID vars.

## 15. Migration Instructions
See [SMRITI_PRODUCTION_DATABASE_GUIDE.md](./SMRITI_PRODUCTION_DATABASE_GUIDE.md):
- Set Neon `postgresql://...?sslmode=require` as `DATABASE_URL` in Vercel.
- Vercel executes `node scripts/vercel-build.mjs`, which automatically validates/generates from `prisma/postgres/schema.prisma`, runs `prisma migrate deploy --schema prisma/postgres/schema.prisma`, optionally seeds synthetic accounts (`SEED_SYNTHETIC_DEMO=1`), and runs `next build`.

## 16. Deployment Instructions
1. Push repository code cleanly (`node_modules`, `.next`, `.env*`, `prisma/dev.db*`, `private_media/` excluded by `.gitignore`) to GitHub.
2. Log in at `https://console.neon.tech` -> create a Free Postgres database -> copy `DATABASE_URL`.
3. Log in at `https://vercel.com` -> import repository on **Hobby (`$0`)** plan -> configure environment variables listed in Section 14 -> deploy (`vercel.json` builds with `node scripts/vercel-build.mjs`).
4. Smoke test `https://<your-app>.vercel.app/api/health`, `/login`, elder `SMR-100001` (`1234`), caregiver portal, clinician portal, and RBAC media retrieval.

## 17. Test Results (Final Run After Final Edit, `2026-11-25`)
| Check Command | Result | Details |
| :--- | :---: | :--- |
| `npm.cmd run typecheck` | **Passed (`0` errors)** | Verified after removing `.next` stale cache & obsolete routes |
| `npm.cmd run lint` | **Passed (`0` errors)** | `15` intentional `@next/next/no-img-element` warnings on dynamic media/SVG `<img>` elements |
| `npm.cmd run vercel-build` | **Passed (`0` errors)** | Generated Prisma client, compiled Next.js 14 production bundle & Workbox `public/sw.js` |
| `npx.cmd prisma validate --schema prisma/postgres/schema.prisma` | **Passed** | All 39 models & relations validated against PostgreSQL dialect |
| `npm.cmd test` (`tests/unit-security.test.mjs`) | **Passed (`7/7`, `0` fail)** | Verified `src/lib/security.ts` removal, no `crypto-js`/hardcoded keys, 8 NER states, Manipuri dual script |
| `npm.cmd run test:e2e` (`tests/integration-e2e.mjs`) | **Passed (`1/1`)** | Verified headers, `403` open patient reg, PIN provisioning, Clinician link via `SMR-XXXXXX`, isolation, `as` chat, hydration, `dev.db` untouched |
| `npm.cmd run test:v1` (`tests/v1-comprehensive.test.mjs`) | **Passed (`1/1`, `17` stages)** | Covered PIN lockout/reset, QR replay block, Family `403`, Clinician Rx boundary, `SMRENC1` disk & **`DB_ENCRYPTED` Postgres media path**, `/api/sync` idempotency & conflict preservation, consent revocation, SOS `AUDIT_LOGGED_ONLY`, backfill, deletion, `/api/health`, and `seed-synthetic-demo.mjs` idempotency |

## 18. Known Limitations
1. **Live Production Deployment Not Executed:** Stopped cleanly at Vercel (`https://vercel.com/login`) and Neon (`https://console.neon.tech`) login gates per user authentication boundary.
2. **`next@14.2.35` / `next-pwa@5.6.0` Upstream Advisories:** Non-breaking audit fixes applied; remaining high/critical advisories require upgrading Next to `16.x` (`React 19`), mitigated meanwhile via `images: { unoptimized: true }` and no unauthenticated Server Actions.
3. **Free-Tier Non-Commercial & Non-BAA Boundary:** Free plans are strictly for personal/student demonstration using synthetic accounts (`scripts/seed-synthetic-demo.mjs`), never real clinical PHI.
4. **Community Language Validation:** Non-English NER packs remain pending native-speaker clinical review and offline native voice recordings (`grt`, `njm`, `njo` placeholders).

## 19. Remaining Blockers
- Interactive user login / authorization required for **Neon (`https://console.neon.tech`)** and **Vercel (`https://vercel.com`)** (`vercel` & `neonctl` CLIs also not installed locally).
- Native community validation & external SMS/Push/BHASHINI API credentials.

## 20. Rollback Instructions
- Full pre-cleanup backup archive resides at `C:\E_Drive\smriti_backup_pre_cleanup_20261125_2331` (and pre-v1 archive at `C:\E_Drive\smriti_backup_pre_v1_20261125`).
- To roll back locally: restore directory files and `prisma\dev.db` from backup and run `npx.cmd prisma generate && npm.cmd run build`.
- To roll back Vercel/Neon deployment: select the previous deployment in Vercel Dashboard (`Rollback`) and restore Neon branch/snapshot.

## 21. Live Deployment URL
**Not yet live deployed (`Pending User Login`)** — Vercel & Neon both require user interactive sign-in (verified `2026-11-25` via browser session inspection: Vercel redirects to `/login?next=%2Fdashboard`; Neon redirects to Keycloak auth). Local production server verified at `http://localhost:3018` / `3016` / `3017`.

## 22. Estimated Recurring Infrastructure Cost
**₹0 / \$0 per month** under Vercel Hobby + Neon Postgres Free + `DB_ENCRYPTED` media storage + Groq Free AI + GitHub Actions Free (zero credit cards required, zero auto-billing trials).
