-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PATIENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PatientProfile" (
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
    CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaregiverProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    CONSTRAINT "CaregiverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicianProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "specialization" TEXT,
    "hospital" TEXT,
    CONSTRAINT "ClinicianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientCaregiver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientCaregiver_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientCaregiver_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CareCircleMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT,
    "clinicianId" TEXT,
    "role" TEXT NOT NULL,
    "permissions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareCircleMember_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CareCircleMember_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CareCircleMember_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PairingInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caregiverId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PairingInvitation_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "time" TEXT,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Medication_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledTime" DATETIME NOT NULL,
    "actualTime" DATETIME,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicationEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MedicationEvent_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HydrationTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "targetMl" INTEGER NOT NULL,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HydrationTarget_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HydrationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "HydrationEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VitalLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "weight" REAL,
    "sysBp" INTEGER,
    "diaBp" INTEGER,
    "heartRate" INTEGER,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VitalLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SleepRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "interruptions" INTEGER,
    "qualityScore" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT "SleepRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "steps" INTEGER,
    "date" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT "ActivityRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MoodRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "moodScore" INTEGER NOT NULL,
    "note" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MoodRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WellbeingEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mood" INTEGER NOT NULL,
    "sleepQuality" INTEGER NOT NULL,
    "confusionLevel" INTEGER NOT NULL,
    "energyLevel" INTEGER NOT NULL,
    "painLevel" INTEGER NOT NULL,
    "overallWellbeing" INTEGER NOT NULL,
    "notes" TEXT,
    CONSTRAINT "WellbeingEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyRoutine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "iconEmoji" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "assignedTo" TEXT,
    "voiceReminderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyRoutine_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoutineOccurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" DATETIME,
    "completedBy" TEXT,
    "assignedTo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoutineOccurrence_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "DailyRoutine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoutineOccurrence_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoiceReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "routineType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "speakerName" TEXT NOT NULL,
    "audioBase64" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoiceReminder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SafeZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "radius" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SafeZone_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "accuracy" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "insideZoneId" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationPing_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "zoneId" TEXT,
    "lat" REAL,
    "lng" REAL,
    "accuracy" REAL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CareUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareUpdate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FamilyAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "imageBase64" TEXT,
    "audioBase64" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyAsset_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScrapbookEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageBase64" TEXT,
    "audioBase64" TEXT,
    "dateAdded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapbookEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocalResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SavedResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "notes" TEXT,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedResource_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "LocalResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CognitiveSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "difficultyLevel" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "accuracy" REAL NOT NULL,
    "reactionTimeMs" INTEGER,
    "errors" INTEGER NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CognitiveSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "weekStartDate" DATETIME NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "cognitiveSub" INTEGER NOT NULL,
    "physicalSub" INTEGER NOT NULL,
    "sleepSub" INTEGER NOT NULL,
    "socialSub" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthScore_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "domain" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CaregiverReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "appetite" TEXT,
    "sleep" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaregiverReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaregiverReport_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "prevValue" TEXT,
    "newValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

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

