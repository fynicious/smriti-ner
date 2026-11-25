# SMRITI (`Smriti-NER`) — Database Schema, Migrations & Recovery Guide

**Version:** 1.0  
**Last Updated:** 2026-11-25

> Cross-references: [Master Execution Report (Section H)](./SMRITI_AUTONOMOUS_EXECUTION_REPORT.md) · [Deployment Guide](./SMRITI_DEPLOYMENT_GUIDE.md)

---

## 1. Current Database Overview

- **Engine (Local Dev & Verified Integration):** SQLite (`file:./dev.db`, `573,440` bytes, `40` SQLite tables = `39` Prisma models + `_prisma_migrations`) managed via Prisma `5.11.0`.
- **Staging / Production Readiness Target:** PostgreSQL (e.g., Neon Serverless Postgres). Schema migration to PostgreSQL is intentionally **staged and deferred** until deployment authorization so pre-existing SQLite records (`3` users / `3` patients) remain safely preserved.

### 1.1 Prisma Models (39 Application Models)
- **Identity & Access:** `User`, `PatientProfile`, `CaregiverProfile`, `ClinicianProfile`, `PatientCaregiver`, `CareCircleMember`, `PairingInvitation`, `PatientProvisionToken`, `ConsentRecord`, `DeviceSession`, `AuditLog`.
- **Preferences & Synchronization:** `PatientPreference`, `SyncMutation`, `MediaAsset`, `PushSubscription`.
- **Daily Care & Clinical Records:** `Medication`, `MedicationEvent`, `HydrationTarget`, `HydrationEvent`, `VitalLog`, `SleepRecord`, `ActivityRecord`, `MoodRecord`, `WellbeingEntry`, `DailyRoutine`, `RoutineOccurrence`, `VoiceReminder`, `CaregiverReport`.
- **Safety, Family & Engagement:** `SafeZone`, `LocationPing`, `LocationEvent`, `CareUpdate`, `FamilyAsset`, `ScrapbookEntry`, `LocalResource`, `SavedResource`, `CognitiveSession`, `HealthScore`, `ContentItem`.

---

## 2. Additive Migration History (`prisma/migrations/`)

| Migration | File Size | Scope | Data Preservation Verification |
| :--- | :---: | :--- | :--- |
| `0000_baseline/migration.sql` | `20,486` bytes | Baseline snapshot of the pre-v1 32-table schema registered non-destructively via `prisma migrate resolve --applied` | Pre-migration `prisma/dev.db` SHA-256: `9706C9C443C1C5816275D3C32821189BF87885B319F8B09E7F19C6986520E11A` |
| `0001_v1_foundations/migration.sql` | `13,116` bytes | Additive v1 evolution: adds `loginCode`, `pinHash`, lockout fields, `clientMutationId`/`deviceId` unique indexes, attribution columns (`source`, `recordedByUserId`), media refs, and 7 new models (`PatientPreference`, `PatientProvisionToken`, `ConsentRecord`, `SyncMutation`, `MediaAsset`, `PushSubscription`, `DeviceSession`) | Dry-run tested on `os.tmpdir()` copy before live apply; all `3` existing `User` & `PatientProfile` rows preserved (`dev.db` SHA-256 post-apply: `99D15125EE13C2404CDF6E22E11602896AB348BEA6052A8542E42B3A6B088FDF`) |

---

## 3. Sensitive-Field Encryption Backfill (`scripts/encrypt-existing-fields.mjs`)

For existing databases that still hold plaintext clinical strings in `PatientProfile.{emergencyContact, allergies, diagnoses}`, `CaregiverReport.notes`, or `WellbeingEntry.notes`:

1. **Dry-Run Inspection (non-mutating):**
   ```powershell
   node scripts/encrypt-existing-fields.mjs
   ```
   Reports row counts scanned and records needing encryption without touching the DB.
2. **Apply Encryption (auto-creates timestamped `.db-backup-<ms>` copy + Prisma transaction):**
   ```powershell
   node scripts/encrypt-existing-fields.mjs --apply
   ```
   Requires `ENCRYPTION_MASTER_KEY` configured in `.env.local` or shell environment.
3. **Target an Isolated Copy (for testing):**
   ```powershell
   node scripts/encrypt-existing-fields.mjs --apply --db "C:\path\to\copy.db"
   ```

---

## 4. Backup & Recovery Runbook

- **Pre-v1 Archive Checkpoint:** Full file & DB backup stored outside active directory at `C:\E_Drive\smriti_backup_pre_v1_20261125` (`prisma\dev.db` SHA-256: `9706C9C443C1C5816275D3C32821189BF87885B319F8B09E7F19C6986520E11A`).
- **Restore Procedure (SQLite):**
  1. Stop Next.js server processes holding `prisma/dev.db`.
  2. Restore `prisma/dev.db` from `C:\E_Drive\smriti_backup_pre_v1_20261125\prisma\dev.db` or the latest `.db-backup-*` alongside `.env.local` (`ENCRYPTION_MASTER_KEY` must match any encrypted records created with that key!).
  3. Re-run `npx.cmd prisma migrate status` and `npx.cmd prisma generate` to verify schema/client alignment.
- **PostgreSQL Migration Path (Future Authorized Deployment):** Keep additive migrations under `prisma/migrations/`, provision a managed PostgreSQL instance (`DATABASE_URL`), regenerate provider-compatible migration history or run `prisma migrate deploy`, and export/re-import SQLite records via Prisma script preserving `enc:v1:` payloads and `ENCRYPTION_MASTER_KEY`.
