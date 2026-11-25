-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "loginCode" TEXT,
    "passwordHash" TEXT NOT NULL,
    "pinHash" TEXT,
    "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" TIMESTAMP(3),
    "role" TEXT NOT NULL DEFAULT 'PATIENT',
    "createdByCaregiverId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
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

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT,

    CONSTRAINT "CaregiverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "specialization" TEXT,
    "hospital" TEXT,

    CONSTRAINT "ClinicianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientCaregiver" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientCaregiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareCircleMember" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT,
    "clinicianId" TEXT,
    "role" TEXT NOT NULL,
    "permissions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareCircleMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingInvitation" (
    "id" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairingInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "time" TEXT,
    "instructions" TEXT,
    "imageUrl" TEXT,
    "mediaAssetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "actualTime" TIMESTAMP(3),
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recordedByUserId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PATIENT_REPORTED',
    "clientMutationId" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HydrationTarget" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "targetMl" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HydrationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HydrationEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "clientMutationId" TEXT,
    "deviceId" TEXT,

    CONSTRAINT "HydrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VitalLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "sysBp" INTEGER,
    "diaBp" INTEGER,
    "heartRate" INTEGER,
    "clientMutationId" TEXT,
    "deviceId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VitalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "interruptions" INTEGER,
    "qualityScore" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "SleepRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "steps" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "ActivityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoodRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "moodScore" INTEGER NOT NULL,
    "note" TEXT,
    "clientMutationId" TEXT,
    "deviceId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoodRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellbeingEntry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mood" INTEGER NOT NULL,
    "sleepQuality" INTEGER NOT NULL,
    "confusionLevel" INTEGER NOT NULL,
    "energyLevel" INTEGER NOT NULL,
    "painLevel" INTEGER NOT NULL,
    "overallWellbeing" INTEGER NOT NULL,
    "notes" TEXT,
    "clientMutationId" TEXT,
    "deviceId" TEXT,

    CONSTRAINT "WellbeingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRoutine" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "iconEmoji" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "assignedTo" TEXT,
    "voiceReminderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineOccurrence" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceReminder" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "routineType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "speakerName" TEXT NOT NULL,
    "audioBase64" TEXT NOT NULL DEFAULT '',
    "mediaAssetId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafeZone" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radius" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafeZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "insideZoneId" TEXT,
    "clientMutationId" TEXT,
    "deviceId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "zoneId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareUpdate" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyAsset" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapbookEntry" (
    "id" TEXT NOT NULL,
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
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapbookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalResource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "emergencyPhone" TEXT,
    "openingHours" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "telehealthAvailable" BOOLEAN NOT NULL DEFAULT false,
    "homeVisitAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedResource" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "notes" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CognitiveSession" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "difficultyLevel" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "reactionTimeMs" INTEGER,
    "errors" INTEGER NOT NULL,
    "clientMutationId" TEXT,
    "deviceId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CognitiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthScore" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "cognitiveSub" INTEGER NOT NULL,
    "physicalSub" INTEGER NOT NULL,
    "sleepSub" INTEGER NOT NULL,
    "socialSub" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "domain" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverReport" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "appetite" TEXT,
    "sleep" TEXT,
    "notes" TEXT,
    "clientMutationId" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaregiverReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "prevValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPreference" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "complexityMode" TEXT NOT NULL DEFAULT 'GUIDED',
    "scriptPreference" TEXT,
    "culturalPackId" TEXT NOT NULL DEFAULT 'ner-as-01',
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "textScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "voiceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiInteractionStyle" TEXT NOT NULL DEFAULT 'BALANCED',
    "caregiverLockEnabled" BOOLEAN NOT NULL DEFAULT false,
    "caregiverLockPinHash" TEXT,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProvisionToken" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientProvisionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "authorityType" TEXT NOT NULL DEFAULT 'CAREGIVER_REPRESENTATIVE',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncMutation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "entityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "conflictDetail" TEXT,
    "clientCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncMutation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "category" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL_PRIVATE',
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "encryptedBlob" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "label" TEXT,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_loginCode_key" ON "User"("loginCode");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverProfile_userId_key" ON "CaregiverProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianProfile_userId_key" ON "ClinicianProfile"("userId");

-- CreateIndex
CREATE INDEX "PatientCaregiver_caregiverId_status_idx" ON "PatientCaregiver"("caregiverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientCaregiver_patientId_caregiverId_key" ON "PatientCaregiver"("patientId", "caregiverId");

-- CreateIndex
CREATE INDEX "CareCircleMember_patientId_status_idx" ON "CareCircleMember"("patientId", "status");

-- CreateIndex
CREATE INDEX "CareCircleMember_caregiverId_status_idx" ON "CareCircleMember"("caregiverId", "status");

-- CreateIndex
CREATE INDEX "CareCircleMember_clinicianId_status_idx" ON "CareCircleMember"("clinicianId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PairingInvitation_code_key" ON "PairingInvitation"("code");

-- CreateIndex
CREATE INDEX "PairingInvitation_caregiverId_status_idx" ON "PairingInvitation"("caregiverId", "status");

-- CreateIndex
CREATE INDEX "Medication_patientId_status_idx" ON "Medication"("patientId", "status");

-- CreateIndex
CREATE INDEX "MedicationEvent_patientId_scheduledTime_status_idx" ON "MedicationEvent"("patientId", "scheduledTime", "status");

-- CreateIndex
CREATE INDEX "MedicationEvent_medicationId_status_idx" ON "MedicationEvent"("medicationId", "status");

-- CreateIndex
CREATE INDEX "HydrationTarget_patientId_effectiveFrom_idx" ON "HydrationTarget"("patientId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "HydrationEvent_patientId_timestamp_status_idx" ON "HydrationEvent"("patientId", "timestamp", "status");

-- CreateIndex
CREATE INDEX "VitalLog_patientId_recordedAt_idx" ON "VitalLog"("patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "SleepRecord_patientId_date_idx" ON "SleepRecord"("patientId", "date");

-- CreateIndex
CREATE INDEX "ActivityRecord_patientId_date_idx" ON "ActivityRecord"("patientId", "date");

-- CreateIndex
CREATE INDEX "MoodRecord_patientId_recordedAt_idx" ON "MoodRecord"("patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "WellbeingEntry_patientId_date_idx" ON "WellbeingEntry"("patientId", "date");

-- CreateIndex
CREATE INDEX "DailyRoutine_patientId_isActive_idx" ON "DailyRoutine"("patientId", "isActive");

-- CreateIndex
CREATE INDEX "RoutineOccurrence_patientId_date_idx" ON "RoutineOccurrence"("patientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineOccurrence_routineId_date_key" ON "RoutineOccurrence"("routineId", "date");

-- CreateIndex
CREATE INDEX "VoiceReminder_patientId_isActive_idx" ON "VoiceReminder"("patientId", "isActive");

-- CreateIndex
CREATE INDEX "SafeZone_patientId_isActive_idx" ON "SafeZone"("patientId", "isActive");

-- CreateIndex
CREATE INDEX "LocationPing_patientId_recordedAt_idx" ON "LocationPing"("patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "LocationEvent_patientId_timestamp_idx" ON "LocationEvent"("patientId", "timestamp");

-- CreateIndex
CREATE INDEX "CareUpdate_patientId_timestamp_idx" ON "CareUpdate"("patientId", "timestamp");

-- CreateIndex
CREATE INDEX "FamilyAsset_patientId_isActive_idx" ON "FamilyAsset"("patientId", "isActive");

-- CreateIndex
CREATE INDEX "ScrapbookEntry_patientId_dateAdded_idx" ON "ScrapbookEntry"("patientId", "dateAdded");

-- CreateIndex
CREATE INDEX "LocalResource_category_district_idx" ON "LocalResource"("category", "district");

-- CreateIndex
CREATE UNIQUE INDEX "LocalResource_name_district_key" ON "LocalResource"("name", "district");

-- CreateIndex
CREATE UNIQUE INDEX "SavedResource_patientId_resourceId_key" ON "SavedResource"("patientId", "resourceId");

-- CreateIndex
CREATE INDEX "CognitiveSession_patientId_domain_completedAt_idx" ON "CognitiveSession"("patientId", "domain", "completedAt");

-- CreateIndex
CREATE INDEX "HealthScore_patientId_weekStartDate_idx" ON "HealthScore"("patientId", "weekStartDate");

-- CreateIndex
CREATE INDEX "CaregiverReport_patientId_createdAt_idx" ON "CaregiverReport"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

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

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverProfile" ADD CONSTRAINT "CaregiverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianProfile" ADD CONSTRAINT "ClinicianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCaregiver" ADD CONSTRAINT "PatientCaregiver_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCaregiver" ADD CONSTRAINT "PatientCaregiver_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCircleMember" ADD CONSTRAINT "CareCircleMember_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCircleMember" ADD CONSTRAINT "CareCircleMember_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCircleMember" ADD CONSTRAINT "CareCircleMember_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingInvitation" ADD CONSTRAINT "PairingInvitation_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationEvent" ADD CONSTRAINT "MedicationEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationEvent" ADD CONSTRAINT "MedicationEvent_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HydrationTarget" ADD CONSTRAINT "HydrationTarget_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HydrationEvent" ADD CONSTRAINT "HydrationEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalLog" ADD CONSTRAINT "VitalLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepRecord" ADD CONSTRAINT "SleepRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecord" ADD CONSTRAINT "ActivityRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodRecord" ADD CONSTRAINT "MoodRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellbeingEntry" ADD CONSTRAINT "WellbeingEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRoutine" ADD CONSTRAINT "DailyRoutine_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineOccurrence" ADD CONSTRAINT "RoutineOccurrence_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "DailyRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineOccurrence" ADD CONSTRAINT "RoutineOccurrence_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceReminder" ADD CONSTRAINT "VoiceReminder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafeZone" ADD CONSTRAINT "SafeZone_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationPing" ADD CONSTRAINT "LocationPing_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationEvent" ADD CONSTRAINT "LocationEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareUpdate" ADD CONSTRAINT "CareUpdate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyAsset" ADD CONSTRAINT "FamilyAsset_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapbookEntry" ADD CONSTRAINT "ScrapbookEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedResource" ADD CONSTRAINT "SavedResource_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedResource" ADD CONSTRAINT "SavedResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "LocalResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CognitiveSession" ADD CONSTRAINT "CognitiveSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthScore" ADD CONSTRAINT "HealthScore_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverReport" ADD CONSTRAINT "CaregiverReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverReport" ADD CONSTRAINT "CaregiverReport_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPreference" ADD CONSTRAINT "PatientPreference_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProvisionToken" ADD CONSTRAINT "PatientProvisionToken_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncMutation" ADD CONSTRAINT "SyncMutation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

