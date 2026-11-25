# SMRITI (`Smriti-NER`) — Security, Privacy & Patient-Safety Architecture

**Version:** 1.0  
**Last Updated:** 2026-11-25

> Cross-references: [Master Execution Report (Section E)](./SMRITI_AUTONOMOUS_EXECUTION_REPORT.md) · [Architecture](./SMRITI_ARCHITECTURE.md) · [API Documentation](./SMRITI_API_DOCUMENTATION.md)

---

## 1. Threat Model & Honest Security Posture

**Honest Encryption Classification:** SMRITI implements **Authenticated Encryption at Rest** (server-side field/binary AES-256-GCM + session-scoped client WebCrypto AES-GCM) and **Transport Encryption** (TLS in deployed environments), coupled with strict server-side RBAC. It is **not** zero-knowledge or end-to-end encrypted (`E2EE`), because caregivers, authorized clinicians, SOS SMS dispatch, and server-side sync require server-accessible plaintext during authorized operations.

---

## 2. Authentication & Provisioning (`src/lib/auth.ts`, `src/app/api/auth/*`)

| Pathway | Allowed Roles | Credential Mechanism | Abuse Controls |
| :--- | :--- | :--- | :--- |
| Email + Password (`PASSWORD`) | `CAREGIVER`, `CLINICIAN` (legacy patients optional) | `bcryptjs` (12 rounds) | In-memory window rate limit (10 attempts / 15 min) + `isActive` check |
| Elder Code + PIN (`PATIENT_PIN`) | `PATIENT` (caregiver-provisioned) | `SMR-XXXXXX` + `bcryptjs` 4–6 digit PIN hash | Per-account DB lockout: `5` wrong attempts sets `pinLockedUntil = +15m`, clearable only by caregiver |
| Single-Use QR Link (`QR_TOKEN`) | `PATIENT` device setup | 24-byte CSPRNG token stored as SHA-256 `tokenHash` | Single-use (`usedAt` atomic transaction), 24h expiry, marks `PatientProfile.isAccountClaimed = true` |
| Open Patient Self-Signup | Blocked (`403`) | Rejected at `POST /api/auth/register` | Enforces caregiver creation rule |
| Clinician Signup Gate | `CLINICIAN` | Requires constant-time match against `CLINICIAN_INVITE_CODE` | `safeCompareSecrets` prevents timing attacks |

---

## 3. Authorization & Permission Boundaries (`src/lib/rbac.ts`)

1. **Cross-Patient Isolation:** All `/api/patients/[patientId]/*` handlers invoke `RBAC.requirePatientAccess()` or `RBAC.verifyPatientAccess()` against `PatientProfile`, active `PatientCaregiver` links, or active `CareCircleMember` rows. Unrelated patients and unlinked users receive HTTP `403`.
2. **Fine-Grained Family Care Circle Scoping:** `CareCircleMember.permissions` is enforced server-side on every resource check (`PermissionScope`):
   - `FAMILY` default: `['contribute_memories', 'view_memories', 'view_updates']` -> receives `403` on `/vitals`, `/safety`, `/wellbeing`, `/medications`, and `/cognitive`.
   - `SECONDARY` default: adds routine visibility/editing while excluding settings deletion/administrative changes unless explicitly granted.
   - `CLINICIAN` default: `['view_clinical', 'edit_clinical', 'view_routines']`.
3. **Clinical Prescription Split (`/api/patients/[patientId]/medications/manage` & `/medications`):**
   - `POST /medications/manage` & `PATCH /medications/manage` strictly verify `CLINICIAN` role — Caregivers receive `403` if attempting to prescribe, alter dosage, or discontinue treatment.
   - `PATCH /medications/photo` lets `CAREGIVER` attach a pill identification photograph (`MediaAsset`) without modifying prescribed medication parameters.
   - `POST /medications` logs adherence tagged explicitly by session role: `PATIENT_REPORTED`, `CAREGIVER_CONFIRMED`, or `CLINICIAN_RECORDED`.

---

## 4. Cryptography & Key Management (`src/lib/crypto-envelope.ts`, `src/lib/offline-crypto.ts`)

- **Fail-Closed Secrets (`src/lib/env.ts`):** `getNextAuthSecret()` and `getEncryptionMasterKey()` throw explicit startup errors if missing or weak in runtime, avoiding any hardcoded defaults or `NEXT_PUBLIC_` exposure.
- **Server AES-256-GCM Envelope (`encryptSensitiveField`, `decryptSensitiveField`):**
  - Wire format: `enc:v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>` with fresh 96-bit CSPRNG IV per write.
  - Binds `patientId` via GCM Additional Authenticated Data (`cipher.setAAD`) so ciphertext cannot be swapped across patient rows without authentication failure.
  - Covered fields: `PatientProfile.{emergencyContact, allergies, diagnoses}`, `CaregiverReport.notes`, `WellbeingEntry.notes`. Legacy non-enveloped strings decode transparently until migrated via `scripts/encrypt-existing-fields.mjs`.
- **Encrypted Binary Media (`encryptBinaryBuffer` / `decryptBinaryBuffer`):** Magic header `SMRENC1` + 12B IV + 16B GCM auth tag + ciphertext stored under `MEDIA_STORAGE_DIR` outside `public/`.
- **Client Ephemeral Cache Encryption (`src/lib/offline-crypto.ts`):** Generates a 256-bit WebCrypto `AES-GCM` session key stored only in `sessionStorage`, auto-locked after `30` minutes of inactivity (`IDLE_TIMEOUT_MS`), and destroyed immediately by `clearOfflineEncryptionKey()` on sign-out or cache wipe.
- **Security Headers (`next.config.mjs`):** `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and Content Security Policy (`default-src 'self'`).

---

## 5. Patient Safety, Privacy Controls & Truthfulness Guarantees

- **SOS & Alert Honesty (`src/app/api/alert/route.ts`, `src/components/patient/FamilyCallModal.tsx`):** Returns explicit booleans (`delivered`, `smsSent`, `pushSent`, `simulated`, `deliveryStatus` in `['CONFIRMED_SMS', 'FAILED', 'AUDIT_LOGGED_ONLY']`). UI never claims a caregiver was notified unless Twilio confirms external SMS dispatch; otherwise guides the user directly to one-tap `tel:` dialing and helpline `112` / `108`.
- **Consent Ledger (`ConsentRecord` & `/api/patients/[patientId]/consents`):** Append-only records track `LOCATION_SHARING`, `AI_COMPANION`, `FAMILY_SHARING`, `CLINICIAN_ACCESS`, `DATA_SYNC`, and `VOICE_RECORDING` with `authorityType` (`PATIENT_ASSENT`, `CAREGIVER_REPRESENTATIVE`, `JOINT`). Withdrawing `LOCATION_SHARING` immediately rejects `POST /safety` `PING` writes (`403`); withdrawing `AI_COMPANION` forces local deterministic fallback (`LocalFallbackAIProvider`).
- **Right to Erasure (`POST /api/account/delete`):** Requires typed confirmation `"DELETE"`, writes a server `AuditLog` event first, deletes the user/patient hierarchy via cascading relational constraints, and removes encrypted binary files from disk (`deleteStoredMediaFiles`).
