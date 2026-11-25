-- AlterTable
ALTER TABLE "Medication" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Medication" ADD COLUMN "mediaAssetId" TEXT;

-- AlterTable
ALTER TABLE "HydrationEvent" ADD COLUMN "clientMutationId" TEXT;
ALTER TABLE "HydrationEvent" ADD COLUMN "deviceId" TEXT;

-- AlterTable
ALTER TABLE "VitalLog" ADD COLUMN "clientMutationId" TEXT;
ALTER TABLE "VitalLog" ADD COLUMN "deviceId" TEXT;

-- AlterTable
ALTER TABLE "MoodRecord" ADD COLUMN "clientMutationId" TEXT;
ALTER TABLE "MoodRecord" ADD COLUMN "deviceId" TEXT;

-- AlterTable
ALTER TABLE "WellbeingEntry" ADD COLUMN "clientMutationId" TEXT;
ALTER TABLE "WellbeingEntry" ADD COLUMN "deviceId" TEXT;

-- AlterTable
ALTER TABLE "LocationPing" ADD COLUMN "clientMutationId" TEXT;
ALTER TABLE "LocationPing" ADD COLUMN "deviceId" TEXT;

-- AlterTable
ALTER TABLE "CognitiveSession" ADD COLUMN "clientMutationId" TEXT;
ALTER TABLE "CognitiveSession" ADD COLUMN "deviceId" TEXT;

-- AlterTable
ALTER TABLE "CaregiverReport" ADD COLUMN "clientMutationId" TEXT;
ALTER TABLE "CaregiverReport" ADD COLUMN "deviceId" TEXT;

-- CreateTable
CREATE TABLE "PatientPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "complexityMode" TEXT NOT NULL DEFAULT 'GUIDED',
    "scriptPreference" TEXT,
    "culturalPackId" TEXT NOT NULL DEFAULT 'ner-as-01',
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "textScale" REAL NOT NULL DEFAULT 1.0,
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "voiceRate" REAL NOT NULL DEFAULT 0.85,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiInteractionStyle" TEXT NOT NULL DEFAULT 'BALANCED',
    "caregiverLockEnabled" BOOLEAN NOT NULL DEFAULT false,
    "caregiverLockPinHash" TEXT,
    "updatedByUserId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientPreference_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientProvisionToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientProvisionToken_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "authorityType" TEXT NOT NULL DEFAULT 'CAREGIVER_REPRESENTATIVE',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncMutation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "entityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "conflictDetail" TEXT,
    "clientCreatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncMutation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "category" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL_PRIVATE',
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaAsset_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "label" TEXT,
    "revokedAt" DATETIME,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FamilyAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "allowCall" BOOLEAN NOT NULL DEFAULT false,
    "requireCallConfirm" BOOLEAN NOT NULL DEFAULT true,
    "contributorUserId" TEXT,
    "visibilityScope" TEXT NOT NULL DEFAULT 'ALL',
    "imageBase64" TEXT,
    "audioBase64" TEXT,
    "mediaPhotoId" TEXT,
    "mediaAudioId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyAsset_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FamilyAsset" ("audioBase64", "createdAt", "id", "imageBase64", "isActive", "name", "patientId", "relation") SELECT "audioBase64", "createdAt", "id", "imageBase64", "isActive", "name", "patientId", "relation" FROM "FamilyAsset";
DROP TABLE "FamilyAsset";
ALTER TABLE "new_FamilyAsset" RENAME TO "FamilyAsset";
CREATE INDEX "FamilyAsset_patientId_isActive_idx" ON "FamilyAsset"("patientId", "isActive");
CREATE TABLE "new_ScrapbookEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageBase64" TEXT,
    "audioBase64" TEXT,
    "mediaPhotoId" TEXT,
    "mediaAudioId" TEXT,
    "contributorUserId" TEXT,
    "contributorName" TEXT,
    "languageCode" TEXT,
    "eventDateLabel" TEXT,
    "locationLabel" TEXT,
    "visibilityScope" TEXT NOT NULL DEFAULT 'ALL',
    "dateAdded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapbookEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ScrapbookEntry" ("audioBase64", "dateAdded", "description", "id", "imageBase64", "patientId", "title") SELECT "audioBase64", "dateAdded", "description", "id", "imageBase64", "patientId", "title" FROM "ScrapbookEntry";
DROP TABLE "ScrapbookEntry";
ALTER TABLE "new_ScrapbookEntry" RENAME TO "ScrapbookEntry";
CREATE INDEX "ScrapbookEntry_patientId_dateAdded_idx" ON "ScrapbookEntry"("patientId", "dateAdded");
CREATE TABLE "new_VoiceReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "routineType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "speakerName" TEXT NOT NULL,
    "audioBase64" TEXT NOT NULL DEFAULT '',
    "mediaAssetId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoiceReminder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VoiceReminder" ("audioBase64", "createdAt", "id", "isActive", "patientId", "routineType", "speakerName", "time", "title") SELECT "audioBase64", "createdAt", "id", "isActive", "patientId", "routineType", "speakerName", "time", "title" FROM "VoiceReminder";
DROP TABLE "VoiceReminder";
ALTER TABLE "new_VoiceReminder" RENAME TO "VoiceReminder";
CREATE INDEX "VoiceReminder_patientId_isActive_idx" ON "VoiceReminder"("patientId", "isActive");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "loginCode" TEXT,
    "passwordHash" TEXT NOT NULL,
    "pinHash" TEXT,
    "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" DATETIME,
    "role" TEXT NOT NULL DEFAULT 'PATIENT',
    "createdByCaregiverId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "passwordHash", "role", "updatedAt") SELECT "createdAt", "email", "id", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_loginCode_key" ON "User"("loginCode");
CREATE TABLE "new_PatientProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "bloodGroup" TEXT,
    "emergencyContact" TEXT,
    "preferredLanguage" TEXT DEFAULT 'en',
    "diagnoses" TEXT,
    "allergies" TEXT,
    "dietaryRestrictions" TEXT,
    "cognitiveBaseline" INTEGER,
    "mobilityInfo" TEXT,
    "isAccountClaimed" BOOLEAN NOT NULL DEFAULT true,
    "retentionDays" INTEGER NOT NULL DEFAULT 730,
    CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PatientProfile" ("allergies", "bloodGroup", "cognitiveBaseline", "dateOfBirth", "diagnoses", "dietaryRestrictions", "emergencyContact", "fullName", "id", "mobilityInfo", "preferredLanguage", "userId") SELECT "allergies", "bloodGroup", "cognitiveBaseline", "dateOfBirth", "diagnoses", "dietaryRestrictions", "emergencyContact", "fullName", "id", "mobilityInfo", "preferredLanguage", "userId" FROM "PatientProfile";
DROP TABLE "PatientProfile";
ALTER TABLE "new_PatientProfile" RENAME TO "PatientProfile";
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");
CREATE TABLE "new_MedicationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledTime" DATETIME NOT NULL,
    "actualTime" DATETIME,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recordedByUserId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT_REPORTED',
    "clientMutationId" TEXT,
    "deviceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicationEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MedicationEvent_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MedicationEvent" ("action", "actualTime", "createdAt", "id", "medicationId", "patientId", "scheduledTime", "status") SELECT "action", "actualTime", "createdAt", "id", "medicationId", "patientId", "scheduledTime", "status" FROM "MedicationEvent";
DROP TABLE "MedicationEvent";
ALTER TABLE "new_MedicationEvent" RENAME TO "MedicationEvent";
CREATE INDEX "MedicationEvent_patientId_scheduledTime_status_idx" ON "MedicationEvent"("patientId", "scheduledTime", "status");
CREATE INDEX "MedicationEvent_medicationId_status_idx" ON "MedicationEvent"("medicationId", "status");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "PatientPreference_patientId_key" ON "PatientPreference"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProvisionToken_tokenHash_key" ON "PatientProvisionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PatientProvisionToken_patientId_expiresAt_idx" ON "PatientProvisionToken"("patientId", "expiresAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_patientId_scope_createdAt_idx" ON "ConsentRecord"("patientId", "scope", "createdAt");

-- CreateIndex
CREATE INDEX "SyncMutation_patientId_createdAt_idx" ON "SyncMutation"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncMutation_patientId_clientMutationId_key" ON "SyncMutation"("patientId", "clientMutationId");

-- CreateIndex
CREATE INDEX "MediaAsset_patientId_category_idx" ON "MediaAsset"("patientId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "DeviceSession_userId_revokedAt_idx" ON "DeviceSession"("userId", "revokedAt");

