# SMRITI (`Smriti-NER`) — Production Database & Private Storage Guide

**Last Updated:** 2026-11-25

---

## 1. Dual-Target Prisma Schema Architecture (`SQLite` Local vs `PostgreSQL` Cloud)

To avoid destructive schema resets against pre-existing local data while guaranteeing native PostgreSQL compatibility for ₹0 cloud deployment:

| Environment | Schema Path | Migrations Directory | Intended Database |
| :--- | :--- | :--- | :--- |
| **Local Dev & Test Suites** | `prisma/schema.prisma` (`provider = "sqlite"`) | `prisma/migrations/` (`0000_baseline`, `0001_v1_foundations`, `0002_media_encrypted_blob`) | `prisma/dev.db` (existing 3 users preserved) & isolated temp copies in `os.tmpdir()` |
| **Vercel / Cloud Production** | `prisma/postgres/schema.prisma` (`provider = "postgresql"`) | `prisma/postgres/migrations/` (`0001_init`) | **Neon Postgres Free** (`1 GB` storage, `100 CU-hrs/mo`, zero credit card) |

All `39` Prisma models use strictly cross-database scalar types (`TEXT`, `INTEGER`, `DOUBLE PRECISION`, `BOOLEAN`, `TIMESTAMP(3)`, `BYTEA`) with zero dialect-specific raw SQL queries.

---

## 2. Three-Mode Private Encrypted Media Storage (`src/lib/media-storage.ts`)

Every patient photo (`ScrapbookEntry`, `FamilyAsset`, `Medication`) and audio greeting (`VoiceReminder`, `FamilyAsset`) is compressed client-side when uploaded and encrypted server-side into **`SMRENC1` AES-256-GCM** binary envelopes (`aad = "media:<patientId>:<mediaId>"`) before persistence:

1. **`LOCAL_PRIVATE`** (default when `DATABASE_URL` is SQLite): Stores ciphertext `.enc` files inside `MEDIA_STORAGE_DIR` (`./private_media`), outside Next.js `public/`.
2. **`DB_ENCRYPTED`** (default when `DATABASE_URL` starts with `postgres://` or `postgresql://` and no Supabase storage env is set): Stores encrypted `SMRENC1` `BYTEA` directly in `MediaAsset.encryptedBlob` inside Neon Postgres (`1 GB` free tier). Eliminates ephemeral serverless filesystem data loss on Vercel without needing an external object-storage card or second cloud project.
3. **`SUPABASE_PRIVATE`** (optional alternative when `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` are supplied): Uploads and fetches `SMRENC1` ciphertext via server-side authenticated HTTPS calls to a **private Supabase Storage bucket (`1 GB` free, no credit card)** without ever using public bucket URLs.

All downloads stream strictly through `/api/patients/[patientId]/media/[assetId]` behind RBAC verification with `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. Account deletion (`POST /api/account/delete`) cascades database blobs and issues immediate disk/remote deletions via `deleteStoredMediaAssets()`.

---

## 3. Cloud Initialization, Migration & Synthetic Demo Seeding

When `vercel-build` (`node scripts/vercel-build.mjs`) executes on Vercel with a Neon Postgres `DATABASE_URL`:
1. Generates Prisma Client from `prisma/postgres/schema.prisma`.
2. Runs `prisma migrate deploy --schema prisma/postgres/schema.prisma` safely applying `0001_init` (skipped only if `SKIP_DB_MIGRATE=1`).
3. If `SEED_SYNTHETIC_DEMO=1` is temporarily enabled for an empty showcase instance, executes `node scripts/seed-synthetic-demo.mjs` creating strictly synthetic accounts (`SMR-100001` PIN `1234`, `demo.caregiver@smriti.local` / `DemoCare123!`, `demo.doctor@smriti.local` / `DemoDoctor123!`). **Never set `SEED_SYNTHETIC_DEMO=1` on databases with custom user data unless idempotent demo accounts are desired.**

---

## 4. Backup, Restoration & Recovery Procedures

- **Local Pre-Cleanup Snapshot:** `C:\E_Drive\smriti_backup_pre_cleanup_20261125_2331` (and Pre-v1 snapshot `C:\E_Drive\smriti_backup_pre_v1_20261125`).
- **Cloud PostgreSQL Export & Restore (`pg_dump` / Neon Branches):**
  - Free Neon projects include instant point-in-time branching (`<= 24h` history on Free) plus standard logical export:
    ```bash
    pg_dump "$DATABASE_URL" --format=custom --file=smriti_backup_$(date +%Y%m%d).dump
    pg_restore --clean --if-exists --dbname="$TARGET_DATABASE_URL" smriti_backup_YYYYMMDD.dump
    ```
  - Always back up `ENCRYPTION_MASTER_KEY` alongside DB dumps; changing or losing `ENCRYPTION_MASTER_KEY` makes `enc:v1:` fields and `SMRENC1` media blobs undecryptable.
