# SMRITI (`Smriti-NER`) — 100% Free-Tier Hosting, Cost & Quota Analysis

**Research Date:** 2026-11-25  
**Target Objective:** ₹0 / \$0 recurring cost public demonstration deployment without requiring a credit card or enabling auto-billing trials.

---

## 1. Provider Comparison & Official Limit Audit

| Category | Provider Evaluated | Pricing / Billing Model | Verified Free Quotas (Official Docs, `2026-11-25`) | Credit Card Required? | Sleep / Pause / Hard-Stop Behavior | Suitability Verdict |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **Web + API Host** | **Vercel Hobby** (`vercel.com`) | Ongoing Free Tier (**Non-commercial / personal / student only**) | `100 GB` Fast Data Transfer, `10 GB` Origin Transfer, `1M` CDN requests, `1M` function invocations, `4` CPU-hrs/mo, `360 GB-hrs`, max `300s` function duration | **No** | Temporary pause/rate-limit until 30-day cycle resets (`$0` overage risk); **commercial use strictly prohibited** | **SELECTED** (Full Node.js Next.js App Router + `bcryptjs` + Prisma compatibility) |
| **Web + API Host** | **Cloudflare Workers / Pages** (`developers.cloudflare.com`) | Ongoing Free Tier | `100,000` requests/day, `128 MB` memory, **`10 ms` CPU time/request** | **No** | Returns error beyond `100k`/day; paid upgrade manual (`$5/mo`) | **Rejected** (`10 ms` CPU time limit breaks `bcryptjs` 12-round hashing & Node API crypto/SSR under free tier) |
| **Web + API Host** | **Netlify Free Starter** (`netlify.com`) | Ongoing Hard-Capped Credit Pool | `300` credits/mo (`20`/GB bandwidth, `15`/deploy, `10`/GB-hr compute, `2`/10k reqs) | **No** | Sites pause until reset (`$0` auto-charges) | **Rejected as primary** (Deploys + bandwidth share `300` credits; ~20 builds alone exhaust monthly allowance) |
| **Cloud Database** | **Neon Postgres Free** (`neon.tech` / `neon.com`) | Ongoing Free Tier | **`1 GB`** Postgres storage, **`100` CU-hrs/mo**, scales up to `2` CU | **No** | Auto-scales to zero after `5` min idle (~1-2s cold wake); writes block if `1 GB` full (data not deleted) | **SELECTED** (Persistent Postgres, `1 GB` capacity, no 7-day freeze or 30-day DB expiry) |
| **Cloud Database & Media** | **Supabase Free** (`supabase.com`) | Ongoing Free Tier (Max 2 active free projects) | `500 MB` Postgres, **`1 GB` Private File Storage**, `5 GB/mo` egress, `50,000` MAUs | **No** | **Auto-pauses after `7` days of zero DB traffic** until manually unpaused in dashboard (data kept intact) | **Optional Media Backend / Secondary DB** (`SUPABASE_PRIVATE` driver usable with no card if kept active) |
| **Object Storage** | **Cloudflare R2** (`developers.cloudflare.com`) | Always-Free Usage Allowance (Usage-billed account) | `10 GB-mo`, `$0` egress, `1M` Class A / `10M` Class B ops | **YES (Mandatory)** | Usage beyond free tier bills payment method on file | **REJECTED** (Violates zero-credit-card & zero auto-billing rule) |
| **CI/CD** | **GitHub Actions** (`docs.github.com`) | Free for public repos / included pool for private | Public repos: **Unlimited** standard Linux minutes; Private repos: `~2,000` std Linux min (`$12` credit equivalent) + `500 MB` storage | **No** | Private repos pause beyond included credit unless billing enabled | **SELECTED** (Public/private repo CI checks) |
| **AI Companion** | **Groq Free Tier** (`groq.com`) + Deterministic Fallback | Ongoing Free Console Tier | Text (~`30` RPM, `1,000` RPD, `8k` TPM, `200k` TPD); Whisper audio (~`2,000` RPD) | **No** | HTTP `429` beyond cap -> **SMRITI automatically falls back cleanly to `LocalFallbackAIProvider`** | **SELECTED** (Optional free LLM + strict `stripDirectPii` + `/api/chat` 20 req/10m limiter) |
| **AI Companion** | **Google Gemini Free Tier** (`ai.google.dev`) | Ongoing Free Tier (**Human review / model training applies outside EEA/UK/CH**) | Strict per-project RPM/TPM/RPD caps on Flash models | **No** | **Prompts/inputs may be used to train models unless billing enabled** | **GATED OFF BY DEFAULT** (`GEMINI_PAID_OR_PRIVATE=true` required) |

---

## 2. Selected ₹0 Production Stack Summary

| Layer | Choice | Payment Card? | Monthly Cost | Hard Quota Safeguards |
| :--- | :--- | :---: | :---: | :--- |
| Frontend & Next.js APIs | **Vercel Hobby** | No | **₹0 / \$0** | Non-commercial student/demo use only; `Cache-Control: no-store` on `/api/*` |
| Cloud PostgreSQL DB | **Neon Postgres Free** (`1 GB`) | No | **₹0 / \$0** | Scales cleanly to zero; retains encrypted rows across deploys |
| Private Media Storage | **`DB_ENCRYPTED`** in Neon `MediaAsset.encryptedBlob` (or optional **`SUPABASE_PRIVATE`** `1 GB` bucket) | No | **₹0 / \$0** | Client WebP/JPEG compression (`compressImageFileToDataUrl`) keeps media `< 200 KB`; server AES-256-GCM `SMRENC1` + RBAC streaming |
| Optional AI Prose | **Groq Free Tier** + Deterministic Local Fallback | No | **₹0 / \$0** | Rate-limited (`20`/10m per patient); PII stripped; core intents work without any AI key |
| Alerts & Notifications | **Browser Native / Web Push + Truthful Audit Log + 1-Tap `tel:` Dialing** | No | **₹0 / \$0** | Twilio SDK removed (lightweight `fetch` remains if optional external SMS key ever supplied); never fakes delivery |
| Weather Widget & Maps | **Open-Meteo** & **OpenStreetMap / Leaflet** | No | **₹0 / \$0** | Keyless free public services with graceful offline fallback |

---

## 3. Privacy & Compliance Caveat for Free Hosting

A free hosting provider (**Vercel Hobby**, **Neon Free**, **Supabase Free**) does **not** execute clinical Business Associate Agreements (BAA) or HIPAA/DISHA compliance attestations on `$0` plans. **Do not upload real patient records, identifiable patient media, or live medical histories to a free public deployment.** Public cloud demonstration deployments must run using strictly synthetic demo accounts (`scripts/seed-synthetic-demo.mjs`).
