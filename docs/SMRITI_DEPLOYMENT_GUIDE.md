# SMRITI (`Smriti-NER`) — Deployment & Operations Runbook

**Version:** 1.0  
**Last Updated:** 2026-11-25

> **Important Status Notice:** No cloud infrastructure has been provisioned, purchased, or publicly deployed from this repository. Local verification uses SQLite (`prisma/dev.db` untouched; isolated temp SQLite copies for tests) and `.env.local` placeholders documented in `.env.example`.

---

## 1. Local Development & Staging Commands

```powershell
# 1. Install dependencies (already installed locally)
npm.cmd install

# 2. Generate Prisma client & inspect migration state (non-destructive)
npx.cmd prisma generate
npx.cmd prisma migrate status

# 3. Verify static checks & production PWA build
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build

# 4. Start local production server cleanly
npm.cmd run start
```

Wait: on Windows PowerShell with default `ExecutionPolicy`, invoke `npm.cmd` and `npx.cmd` instead of `npm` / `npx`.

---

## 2. Environment Variables Required (Placeholders Only)

Refer to `.env.example`:

| Variable | Required? | Purpose |
| :--- | :---: | :--- |
| `DATABASE_URL` | **Yes** | `"file:./dev.db"` (local SQLite) or managed PostgreSQL URI for authorized staging/prod |
| `NEXTAUTH_SECRET` | **Yes** | >=32-byte random CSPRNG string (`openssl rand -hex 32`) signing NextAuth JWT sessions |
| `NEXTAUTH_URL` | **Yes** | Canonical origin (`http://localhost:3000` local; `https://...` deployed) |
| `ENCRYPTION_MASTER_KEY` | **Yes** | 32-byte key (64 hex chars or base64) used for AES-256-GCM field & media binary encryption |
| `MEDIA_STORAGE_DIR` | Recommended | Private host/mounted directory outside `public/` (default `./private_media`) |
| `CLINICIAN_INVITE_CODE` | Required for Dr signup | Constant-time verified invite secret gating `/api/auth/register` clinician accounts |
| `GROQ_API_KEY` | Optional | Enables `GroqAIProvider`; when omitted, `AIProvider` falls back to `GeminiAIProvider` or local deterministic responses |
| `GEMINI_API_KEY` | Optional | Enables `GeminiAIProvider` fallback (use billing-enabled API keys for privacy-sensitive deployments) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `CAREGIVER_PHONE_NUMBER` | Optional | Enables confirmed SMS delivery on `POST /api/alert`; when unset, SOS honestly logs `AUDIT_LOGGED_ONLY` and guides 1-tap `tel:` dialing |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional | Browser Web Push keys for caregiver push subscriptions (`POST /api/push/subscribe`) |

---

## 3. Recommended Low/Zero-Cost Staging Architecture (When Authorized)

Based on vendor documentation reviewed on `2026-11-25` (`neon.tech`, `developers.cloudflare.com`, `prisma.io`):
1. **Compute:** Pilot Next.js hosting (e.g., Vercel / self-hosted Node TLS reverse proxy via Nginx/Caddy — note free-tier personal hosting plans must be upgraded to commercial tiers before clinic/NGO production use).
2. **Database (`Neon Serverless Postgres` Free Tier):** Provides `~0.5–1 GB` Postgres storage, scale-to-zero after 5 minutes of inactivity, and avoids fixed 30-day DB expiry. Swap `provider = "postgresql"` in `prisma/schema.prisma`, generate PostgreSQL baseline migration, run `prisma migrate deploy`, and migrate SQLite rows without changing `ENCRYPTION_MASTER_KEY`.
3. **Private Media Storage (`Cloudflare R2` / S3-compatible):** `10 GB/month` free storage with `$0` egress fees behind signed or RBAC proxy routes (`/api/patients/[patientId]/media/[assetId]`), replacing local disk `./private_media` on stateless containers.

---

## 4. Backup, Monitoring & Rollback

- **Pre-Upgrade Backups:** Always copy `prisma/dev.db` and `MEDIA_STORAGE_DIR` + back up `.env.local` (`ENCRYPTION_MASTER_KEY`) into an external encrypted vault before running schema migrations or `scripts/encrypt-existing-fields.mjs --apply`. Loss of `ENCRYPTION_MASTER_KEY` renders `enc:v1:` fields and `SMRENC1` media files permanently unrecoverable.
- **Health Checks & Observability:** Monitor HTTP status distribution (`500` alerts vs expected `401`/`403` RBAC guards), `AuditLog` entries (`BATCH_SYNC`, `ALERT_SOS`, `CONSENT_WITHDRAWN`, `DELETE_PATIENT_ACCOUNT_AND_DATA`), and `SyncMutation` conflict counts (`status = 'CONFLICT_RESOLVED'`).
- **Rollback Procedure:**
  1. Halt Node service.
  2. Restore code artifact / previous container build.
  3. Restore SQLite `.db-backup-*` (or Neon point-in-time branch) + matching `MEDIA_STORAGE_DIR` + `.env` keys.
  4. Verify `npx.cmd prisma migrate status` and smoke-test `/api/auth/csrf` and `/login`.
