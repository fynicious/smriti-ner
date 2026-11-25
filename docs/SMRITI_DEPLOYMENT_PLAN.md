# SMRITI (Smriti-NER) — Deployment Plan & Architecture Readiness

**Status:** Codebase Ready for Staging; Pending Postgres Migration & Explicit Deployment Authorization  
**Last Updated:** 2026-11-25

---

## 1. Current Database & Migration Policy
- **Current Development Database:** SQLite (`prisma/dev.db`, `file:./dev.db`).
- **Policy:** Per remediation authorization rules, SQLite is retained during local remediation so pre-existing user profiles are preserved safely. **Production PostgreSQL migration and online deployment will NOT occur without explicit user authorization.**

## 2. Proposed Minimal-Cost Production Architecture

| Layer | Recommended Option | Alternative Option | Current Verified Free-Tier Terms & Caveats |
| :--- | :--- | :--- | :--- |
| **Web & API Hosting** | **Vercel (Hobby)** | **Cloudflare Pages + Functions** (via OpenNext) | **Vercel Hobby:** 100 GB CDN transfer, 10 GB origin transfer, 1M invocations, 4 CPU-hrs/mo, 300s max duration. **Strictly personal/non-commercial use**; commercial healthcare deployment requires Pro. **Cloudflare Pages:** Unlimited static bandwidth, 500 builds/mo, 100k Functions requests/day (requires edge-compatible DB driver). |
| **Managed Postgres DB** | **Neon (Serverless Postgres)** | **Supabase (Free Postgres)** | **Neon Free:** ~0.5–1 GB storage, 100 CU-hrs/mo, scales to zero after 5 mins idle (~1–3s cold start). Does **not** expire after 30 days (unlike Render Free Postgres which expires in 30 days). **Supabase Free:** 500 MB DB, 1 GB file storage, pauses after 7 days of zero traffic. |
| **Media Storage** | **Supabase Storage** (or S3-compatible R2) | DB bytea (discouraged) | Supabase Free includes 1 GB file storage for caregiver photos/voice notes instead of Base64 blobs in DB/IndexedDB. |
| **AI Chat / ASR** | **Groq API (Free Tier)** | **Bhashini API** (for NER ASR/TTS/NMT) | **Groq:** Free console tier (~30 RPM, 1,000 RPD, ~8k TPM). **Gemini Free Tier** should not be used with sensitive patient PHI unless linked to a paid billing account (free-tier inputs may be used for model training). **Bhashini** requires registration/approval at `bhashini.gov.in`. |

## 3. Pre-Deployment Checklist (Verified Local Readiness)
- [x] All P0 critical security & crash issues fixed and verified (`SMR-001`..`SMR-012`, `SMR-025`).
- [x] P1 schema expansion, APIs, pairing, cross-patient RBAC, and patient/caregiver/doctor workflows verified against isolated SQLite integration tests (`SMR-014`..`SMR-026`).
- [x] P2 UX, elderly accessibility (`BottomNav`, `SpeakButton`, modals, WCAG contrast), local NER SVG assets, and responsive grids implemented (`SMR-027`..`SMR-036`).
- [x] P3 localization parity (`en` 250/250 keys, Proxy fallback for all 16 locales, fake bracketed placeholders removed) and language-aware `/api/chat` hardened (`SMR-037`..`SMR-039`; Bhashini/Vosk/TFLite deferred cleanly pending external API credentials).
- [x] `tsc --noEmit`, `eslint src`, and `next build` pass cleanly with zero build-error suppression.
- [x] `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `CLINICIAN_INVITE_CODE` handling hardened via fail-closed env checks and documented in `.env.example`.
- [x] `public/sw.js` excludes `/api/` from caching (`NetworkOnly`); `icon-192x192.png` & `icon-512x512.png` bundled.
- [x] Security headers (`CSP`, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`) active in `next.config.mjs`.
- [x] Automated unit & E2E integration tests added under `tests/` (`package.json` `test` & `test:e2e`).
- [ ] **Manual Production Step (Requires Explicit Authorization):** Switch `prisma/schema.prisma` provider to `postgresql` (`Neon`/`Supabase`), run `prisma migrate deploy`, migrate existing SQLite rows (`prisma/dev.db`), and deploy behind TLS.
