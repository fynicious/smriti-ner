import Dexie, { type EntityTable } from 'dexie';

// --- Existing Types ---
export interface TaskRecord {
  id?: number;
  taskId: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  synced: boolean;
}

export interface GameLogRecord {
  id?: number;
  gameType: string;
  gridSize: string;
  moves: number;
  errors: number;
  avgTimePerMove: number;
  difficultyLevel: number;
  playedAt: string;
  synced: boolean;
}

export interface MoodRecord {
  id?: number;
  mood: string;
  recordedAt: string;
  synced: boolean;
}

export interface ScrapbookEntry {
  id?: number;
  title: string;
  description: string;
  imageBase64: string;
  audioBase64?: string;
  dateAdded: string;
  synced: boolean;
}

// --- New Longitudinal PHR Types ---
export interface PatientProfile {
  id?: number;
  patientId: string;
  fullName: string;
  dob: string;
  bloodGroup: string;
  allergies: string;
  chronicConditions: string;
  emergencyContact: string;
  primaryCaregiver: string;
  lastUpdated: string;
  synced: boolean;
}

export interface VitalLog {
  id?: number;
  patientId: string;
  date: string;
  weight?: number; // kg
  sysBp?: number;
  diaBp?: number;
  heartRate?: number;
  synced: boolean;
}

export interface Prescription {
  id?: number;
  patientId: string;
  datePrescribed: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  time?: string; // HH:MM
  status: 'ACTIVE' | 'DISCONTINUED';
  notes: string;
  clinician: string;
  synced: boolean;
}

export interface CaregiverReport {
  id?: number;
  patientId: string;
  date: string;
  reportType: '30_DAY_UPDATE' | 'INCIDENT' | 'DAILY_OBSERVATION';
  symptoms: string;
  appetite: string;
  sleep: string;
  notes: string;
  synced: boolean;
}

export interface ClinicalVisit {
  id?: number;
  patientId: string;
  date: string;
  clinician: string;
  reason: string;
  notes: string;
  synced: boolean;
}

export interface HydrationEvent {
  id?: number;
  patientId: string;
  amountMl: number;
  timestamp: string;
  status: 'active' | 'deleted';
  clientMutationId?: string;
  deviceId?: string;
  synced: boolean;
}

export interface MedicationEvent {
  id?: number;
  patientId: string;
  medicationId?: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  actualTime?: string;
  action: 'taken' | 'skipped' | 'snoozed' | 'missed' | 'pending';
  status: 'active' | 'deleted';
  source?: 'PATIENT_REPORTED' | 'CAREGIVER_CONFIRMED' | 'CLINICIAN_RECORDED';
  assignedTo?: string; // name or ID
  completedBy?: string; // name or ID
  clientMutationId?: string;
  deviceId?: string;
  synced: boolean;
}

export interface VoiceReminder {
  id?: number;
  patientId: string;
  routineType: string;
  title: string;
  time: string;
  speakerName: string;
  audioBase64: string;
  isActive: boolean;
  synced: boolean;
}

export interface DailyRoutine {
  id?: number;
  patientId: string;
  category: 'MEDICATION' | 'MEAL' | 'HYDRATION' | 'HYGIENE' | 'COGNITIVE' | 'PHYSICAL' | 'SLEEP' | 'APPOINTMENT' | 'FAMILY' | 'CUSTOM';
  title: string;
  time: string; // HH:MM
  iconEmoji: string;
  color: string;
  voiceReminderId?: number;
  assignedTo?: string; // Default assignee for occurrences
  isActive: boolean;
  synced: boolean;
}

export interface RoutineOccurrence {
  id?: number;
  routineId: number;
  patientId: string;
  date: string; // YYYY-MM-DD
  status: 'pending' | 'completed' | 'snoozed' | 'missed';
  completedAt?: string;
  snoozedUntil?: string;
  assignedTo?: string; // Name or ID
  completedBy?: string; // Name or ID
  synced: boolean;
}

export interface SafeZone {
  id?: number;
  patientId: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters
  isActive: boolean;
  synced: boolean;
}

export interface LocationEvent {
  id?: number;
  patientId: string;
  timestamp: string;
  eventType: 'ZONE_ENTER' | 'ZONE_EXIT' | 'LOCATION_UNAVAILABLE' | 'TRACKING_DISABLED';
  zoneId?: number; // Related safe zone ID
  lat?: number;
  lng?: number;
  accuracy?: number;
  synced: boolean;
}

export interface CurrentPatientLocation {
  id?: number; // Singular row per patient
  patientId: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
  status: 'INSIDE' | 'OUTSIDE' | 'UNAVAILABLE' | 'STALE';
  insideZoneId?: number;
  synced: boolean;
}

export interface CareCircleMember {
  id?: number;
  patientId: string;
  userId: string;
  name: string;
  role: 'PRIMARY' | 'SECONDARY' | 'FAMILY' | 'CLINICIAN';
  permissions: string[];
  status: 'ACTIVE' | 'PENDING' | 'REMOVED';
  synced: boolean;
}

export interface CareUpdate {
  id?: number;
  patientId: string;
  authorId: string;
  authorName: string;
  content: string;
  type: 'TEXT' | 'SYSTEM' | 'VOICE';
  timestamp: string;
  synced: boolean;
}

export interface DailyWellbeingEntry {
  id?: number;
  patientId: string;
  date: string; // YYYY-MM-DD for easy grouping
  timestamp: string; // ISO
  recordedBy: string; // User ID
  source: 'PATIENT_REPORTED' | 'CAREGIVER_OBSERVED' | 'CLINICIAN_ENTERED';
  
  // Scales: -1=Skipped, 0=Good/Clear/None, 1=Okay/Mild, 2=Poor/Moderate, 3=Severe/Very Low
  mood: number;
  sleepQuality: number;
  confusionLevel: number;
  energyLevel: number;
  painLevel: number;
  overallWellbeing: number;
  
  notes?: string;
  clientMutationId?: string;
  deviceId?: string;
  synced: boolean;
}

export interface PatientPreferenceRecord {
  id?: number;
  patientId: string;
  complexityMode: 'SIMPLE' | 'GUIDED' | 'FULL';
  scriptPreference?: string | null;
  culturalPackId: string;
  reducedMotion: boolean;
  highContrast: boolean;
  textScale: number;
  voiceEnabled: boolean;
  voiceRate: number;
  aiEnabled: boolean;
  aiInteractionStyle: 'CONVERSATIONAL' | 'TASK_FOCUSED' | 'BALANCED';
  caregiverLockEnabled: boolean;
  hydrationTargetMl: number;
  preferredLanguage: string;
  updatedAt: string;
}

export interface LocalResource {
  id?: number;
  name: string;
  category: 'DOCTOR' | 'HOSPITAL' | 'PHARMACY' | 'EMERGENCY' | 'SUPPORT' | 'NGO';
  description: string;
  state: string;
  district: string;
  locality: string;
  address: string;
  phone: string;
  emergencyPhone?: string;
  openingHours: string;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'UNVERIFIED';
  verifiedAt?: string;
  telehealthAvailable: boolean;
  homeVisitAvailable: boolean;
  synced: boolean;
}

export interface SavedResource {
  id?: number;
  patientId: string;
  resourceId: number;
  notes?: string;
  savedAt?: string;
  role?: string;
  synced?: boolean;
}

export interface FamilyMemberAsset {
  id?: number;
  patientId: string;
  name: string;
  relation: string;
  imageBase64?: string;
  audioBase64?: string;
  isActive: boolean;
  synced: boolean;
}

export class CognitiveAppDB extends Dexie {
  tasks!: EntityTable<TaskRecord, 'id'>;
  gameLogs!: EntityTable<GameLogRecord, 'id'>;
  moods!: EntityTable<MoodRecord, 'id'>;
  scrapbook!: EntityTable<ScrapbookEntry, 'id'>;
  patientProfiles!: EntityTable<PatientProfile, 'id'>;
  vitalLogs!: EntityTable<VitalLog, 'id'>;
  prescriptions!: EntityTable<Prescription, 'id'>;
  caregiverReports!: EntityTable<CaregiverReport, 'id'>;
  clinicalVisits!: EntityTable<ClinicalVisit, 'id'>;
  hydrationEvents!: EntityTable<HydrationEvent, 'id'>;
  medicationEvents!: EntityTable<MedicationEvent, 'id'>;
  voiceReminders!: EntityTable<VoiceReminder, 'id'>;
  dailyRoutines!: EntityTable<DailyRoutine, 'id'>;
  routineOccurrences!: EntityTable<RoutineOccurrence, 'id'>;
  safeZones!: EntityTable<SafeZone, 'id'>;
  locationEvents!: EntityTable<LocationEvent, 'id'>;
  currentLocation!: EntityTable<CurrentPatientLocation, 'id'>;
  careCircleMembers!: EntityTable<CareCircleMember, 'id'>;
  careUpdates!: EntityTable<CareUpdate, 'id'>;
  wellbeingEntries!: EntityTable<DailyWellbeingEntry, 'id'>;
  localResources!: EntityTable<LocalResource, 'id'>;
  savedResources!: EntityTable<SavedResource, 'id'>;
  familyAssets!: EntityTable<FamilyMemberAsset, 'id'>;
  patientPreferences!: EntityTable<PatientPreferenceRecord, 'id'>;

  constructor() {
    super('CognitiveAppDB');
    
    // ... we don't have older versions preserved correctly here, I will just re-add version 11

    // V4: Today's Care Analytics Upgrade (Medication & Hydration)
    this.version(4).stores({
      tasks: '++id, taskId, synced',
      gameLogs: '++id, gameType, synced',
      moods: '++id, synced, recordedAt',
      scrapbook: '++id, synced, dateAdded',
      patientProfiles: '++id, patientId, synced',
      vitalLogs: '++id, patientId, date, synced',
      prescriptions: '++id, patientId, status, synced',
      caregiverReports: '++id, patientId, reportType, date, synced',
      clinicalVisits: '++id, patientId, date, synced',
      hydrationEvents: '++id, patientId, timestamp, status, synced',
      medicationEvents: '++id, patientId, scheduledTime, status, synced',
    });

    // V5: Family Voice Reminders Upgrade
    this.version(5).stores({
      tasks: '++id, taskId, synced',
      gameLogs: '++id, gameType, synced',
      moods: '++id, synced, recordedAt',
      scrapbook: '++id, synced, dateAdded',
      patientProfiles: '++id, patientId, synced',
      vitalLogs: '++id, patientId, date, synced',
      prescriptions: '++id, patientId, status, synced',
      caregiverReports: '++id, patientId, reportType, date, synced',
      clinicalVisits: '++id, patientId, date, synced',
      hydrationEvents: '++id, patientId, timestamp, status, synced',
      medicationEvents: '++id, patientId, scheduledTime, status, synced',
      voiceReminders: '++id, patientId, routineType, time, synced',
    });

    // V6: Daily Planner Upgrade
    this.version(6).stores({
      tasks: '++id, taskId, synced',
      gameLogs: '++id, gameType, synced',
      moods: '++id, synced, recordedAt',
      scrapbook: '++id, synced, dateAdded',
      patientProfiles: '++id, patientId, synced',
      vitalLogs: '++id, patientId, date, synced',
      prescriptions: '++id, patientId, status, synced',
      caregiverReports: '++id, patientId, reportType, date, synced',
      clinicalVisits: '++id, patientId, date, synced',
      hydrationEvents: '++id, patientId, timestamp, status, synced',
      medicationEvents: '++id, patientId, scheduledTime, status, synced',
      voiceReminders: '++id, patientId, routineType, time, synced',
      dailyRoutines: '++id, patientId, category, time, synced',
      routineOccurrences: '++id, routineId, patientId, date, status, synced',
    });
    // V7: Safe Zones & Location Tracking
    this.version(7).stores({
      tasks: '++id, taskId, synced',
      gameLogs: '++id, gameType, synced',
      moods: '++id, synced, recordedAt',
      scrapbook: '++id, synced, dateAdded',
      patientProfiles: '++id, patientId, synced',
      vitalLogs: '++id, patientId, date, synced',
      prescriptions: '++id, patientId, status, synced',
      caregiverReports: '++id, patientId, reportType, date, synced',
      clinicalVisits: '++id, patientId, date, synced',
      hydrationEvents: '++id, patientId, timestamp, status, synced',
      medicationEvents: '++id, patientId, scheduledTime, status, synced',
      voiceReminders: '++id, patientId, routineType, time, synced',
      dailyRoutines: '++id, patientId, category, time, synced',
      routineOccurrences: '++id, routineId, patientId, date, status, synced',
      safeZones: '++id, patientId, name, synced',
      locationEvents: '++id, patientId, timestamp, eventType, synced',
      currentLocation: '++id, patientId, status, synced',
    });

    // V8: Shared Care Circle
    this.version(8).stores({
      tasks: '++id, taskId, synced',
      gameLogs: '++id, gameType, synced',
      moods: '++id, synced, recordedAt',
      scrapbook: '++id, synced, dateAdded',
      patientProfiles: '++id, patientId, synced',
      vitalLogs: '++id, patientId, date, synced',
      prescriptions: '++id, patientId, status, synced',
      caregiverReports: '++id, patientId, reportType, date, synced',
      clinicalVisits: '++id, patientId, date, synced',
      hydrationEvents: '++id, patientId, timestamp, status, synced',
      medicationEvents: '++id, patientId, scheduledTime, status, synced',
      voiceReminders: '++id, patientId, routineType, time, synced',
      dailyRoutines: '++id, patientId, category, time, synced',
      routineOccurrences: '++id, routineId, patientId, date, status, synced',
      safeZones: '++id, patientId, name, synced',
      locationEvents: '++id, patientId, timestamp, eventType, synced',
      currentLocation: '++id, patientId, status, synced',
      careCircleMembers: '++id, patientId, userId, role, synced',
      careUpdates: '++id, patientId, timestamp, type, synced',
    });

    // V9: Daily Symptom & Wellbeing Tracker
    this.version(9).stores({
      tasks: '++id, taskId, synced',
      gameLogs: '++id, gameType, synced',
      moods: '++id, synced, recordedAt',
      scrapbook: '++id, synced, dateAdded',
      patientProfiles: '++id, patientId, synced',
      vitalLogs: '++id, patientId, date, synced',
      prescriptions: '++id, patientId, status, synced',
      caregiverReports: '++id, patientId, reportType, date, synced',
      clinicalVisits: '++id, patientId, date, synced',
      hydrationEvents: '++id, patientId, timestamp, status, synced',
      medicationEvents: '++id, patientId, scheduledTime, status, synced',
      voiceReminders: '++id, patientId, routineType, time, synced',
      dailyRoutines: '++id, patientId, category, time, synced',
      routineOccurrences: '++id, routineId, patientId, date, status, synced',
      safeZones: '++id, patientId, name, synced',
      locationEvents: '++id, patientId, timestamp, eventType, synced',
      currentLocation: '++id, patientId, status, synced',
      careCircleMembers: '++id, patientId, userId, role, synced',
      careUpdates: '++id, patientId, timestamp, type, synced',
      wellbeingEntries: '++id, patientId, date, timestamp, synced',
    });

    // V10: Local Resources
    this.version(10).stores({
      tasks: '++id, taskId, synced',
      gameLogs: '++id, gameType, synced',
      moods: '++id, synced, recordedAt',
      scrapbook: '++id, synced, dateAdded',
      patientProfiles: '++id, patientId, synced',
      vitalLogs: '++id, patientId, date, synced',
      prescriptions: '++id, patientId, status, synced',
      caregiverReports: '++id, patientId, reportType, date, synced',
      clinicalVisits: '++id, patientId, date, synced',
      hydrationEvents: '++id, patientId, timestamp, status, synced',
      medicationEvents: '++id, patientId, scheduledTime, status, synced',
      voiceReminders: '++id, patientId, routineType, time, synced',
      dailyRoutines: '++id, patientId, category, time, synced',
      routineOccurrences: '++id, routineId, patientId, date, status, synced',
      safeZones: '++id, patientId, name, synced',
      locationEvents: '++id, patientId, timestamp, eventType, synced',
      currentLocation: '++id, patientId, status, synced',
      careCircleMembers: '++id, patientId, userId, role, synced',
      careUpdates: '++id, patientId, timestamp, type, synced',
      wellbeingEntries: '++id, patientId, date, timestamp, synced',
      localResources: '++id, category, district, state, verificationStatus, synced',
      savedResources: '++id, patientId, resourceId, synced',
    });

    // V11: Family Assets for Cognitive Games
    this.version(11).stores({
      tasks: '++id, taskId, synced',
      gameLogs: '++id, gameType, synced',
      moods: '++id, synced, recordedAt',
      scrapbook: '++id, synced, dateAdded',
      patientProfiles: '++id, patientId, synced',
      vitalLogs: '++id, patientId, date, synced',
      prescriptions: '++id, patientId, status, synced',
      caregiverReports: '++id, patientId, reportType, date, synced',
      clinicalVisits: '++id, patientId, date, synced',
      hydrationEvents: '++id, patientId, timestamp, status, synced',
      medicationEvents: '++id, patientId, scheduledTime, status, synced',
      voiceReminders: '++id, patientId, routineType, time, synced',
      dailyRoutines: '++id, patientId, category, time, synced',
      routineOccurrences: '++id, routineId, patientId, date, status, synced',
      safeZones: '++id, patientId, name, synced',
      locationEvents: '++id, patientId, timestamp, eventType, synced',
      currentLocation: '++id, patientId, status, synced',
      careCircleMembers: '++id, patientId, userId, role, synced',
      careUpdates: '++id, patientId, timestamp, type, synced',
      wellbeingEntries: '++id, patientId, date, timestamp, synced',
      localResources: '++id, category, district, state, verificationStatus, synced',
      savedResources: '++id, patientId, resourceId, synced',
      familyAssets: '++id, patientId, name, synced',
    });

    // V12: Complexity Preferences & Idempotent Sync Outbox Metadata
    this.version(12).stores({
      tasks: '++id, taskId, synced',
      gameLogs: '++id, gameType, synced',
      moods: '++id, synced, recordedAt',
      scrapbook: '++id, synced, dateAdded',
      patientProfiles: '++id, patientId, synced',
      vitalLogs: '++id, patientId, date, synced',
      prescriptions: '++id, patientId, status, synced',
      caregiverReports: '++id, patientId, reportType, date, synced',
      clinicalVisits: '++id, patientId, date, synced',
      hydrationEvents: '++id, patientId, timestamp, status, clientMutationId, synced',
      medicationEvents: '++id, patientId, scheduledTime, status, clientMutationId, synced',
      voiceReminders: '++id, patientId, routineType, time, synced',
      dailyRoutines: '++id, patientId, category, time, synced',
      routineOccurrences: '++id, routineId, patientId, date, status, synced',
      safeZones: '++id, patientId, name, synced',
      locationEvents: '++id, patientId, timestamp, eventType, synced',
      currentLocation: '++id, patientId, status, synced',
      careCircleMembers: '++id, patientId, userId, role, synced',
      careUpdates: '++id, patientId, timestamp, type, synced',
      wellbeingEntries: '++id, patientId, date, timestamp, clientMutationId, synced',
      localResources: '++id, category, district, state, verificationStatus, synced',
      savedResources: '++id, patientId, resourceId, synced',
      familyAssets: '++id, patientId, name, synced',
      patientPreferences: '++id, patientId',
    });
  }
}

export const db = new CognitiveAppDB();

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const KEY = 'smriti_device_id';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `dev_${crypto.randomUUID()}`
      : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export function generateClientMutationId(prefix = 'mut'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Offline-First Sync Engine
export async function runSyncEngine(patientId?: string) {
  if (typeof window === 'undefined' || !navigator.onLine || !patientId) return;

  const deviceId = getOrCreateDeviceId();

  try {
    const unsyncedHydration = await db.hydrationEvents
      .filter((h) => !h.synced && h.patientId === patientId)
      .toArray();
    const unsyncedMedication = await db.medicationEvents
      .filter((m) => !m.synced && m.patientId === patientId)
      .toArray();

    const totalUnsynced = unsyncedHydration.length + unsyncedMedication.length;
    if (totalUnsynced === 0) return;

    const hydrationBatch: Array<{ id?: number; clientMutationId: string; amountMl: number; timestamp: string }> = [];
    for (const h of unsyncedHydration) {
      if (h.status === 'deleted') {
        if (h.id) await db.hydrationEvents.update(h.id, { synced: true });
        continue;
      }
      const mutId = h.clientMutationId || generateClientMutationId('hyd');
      if (!h.clientMutationId && h.id) {
        await db.hydrationEvents.update(h.id, { clientMutationId: mutId, deviceId });
      }
      hydrationBatch.push({ id: h.id, clientMutationId: mutId, amountMl: h.amountMl, timestamp: h.timestamp });
    }

    let serverMedsMap: Map<string, string> | null = null;
    const medBatch: Array<{
      id?: number;
      clientMutationId: string;
      medicationId: string;
      action: string;
      scheduledTime: string;
      actualTime?: string;
    }> = [];

    for (const m of unsyncedMedication) {
      if (m.status === 'deleted') {
        if (m.id) await db.medicationEvents.update(m.id, { synced: true });
        continue;
      }

      let resolvedMedId = m.medicationId;
      if (!resolvedMedId) {
        if (!serverMedsMap) {
          serverMedsMap = new Map();
          const medsRes = await fetch(`/api/patients/${patientId}/medications`);
          if (medsRes.ok) {
            const data = await medsRes.json();
            if (Array.isArray(data.medications)) {
              for (const sm of data.medications) {
                if (sm?.name && sm?.id) {
                  serverMedsMap.set(String(sm.name).toLowerCase(), String(sm.id));
                }
              }
            }
          }
        }
        resolvedMedId = serverMedsMap.get(m.medicationName.toLowerCase());
      }

      if (!resolvedMedId || m.action === 'pending') {
        continue;
      }

      const mutId = m.clientMutationId || generateClientMutationId('med');
      if (!m.clientMutationId && m.id) {
        await db.medicationEvents.update(m.id, { clientMutationId: mutId, deviceId });
      }
      medBatch.push({
        id: m.id,
        clientMutationId: mutId,
        medicationId: resolvedMedId,
        action: m.action.toUpperCase(),
        scheduledTime: m.scheduledTime,
        actualTime: m.actualTime,
      });
    }

    if (hydrationBatch.length === 0 && medBatch.length === 0) return;

    const syncRes = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        deviceId,
        hydrationEvents: hydrationBatch.map(({ clientMutationId, amountMl, timestamp }) => ({
          clientMutationId,
          amountMl,
          timestamp,
        })),
        medicationEvents: medBatch.map(({ clientMutationId, medicationId, action, scheduledTime, actualTime }) => ({
          clientMutationId,
          medicationId,
          action,
          scheduledTime,
          actualTime,
        })),
      }),
    });

    if (syncRes.ok) {
      await db.transaction('rw', db.hydrationEvents, db.medicationEvents, async () => {
        await Promise.all([
          ...hydrationBatch.map((h) => (h.id ? db.hydrationEvents.update(h.id, { synced: true }) : Promise.resolve())),
          ...medBatch.map((m) => (m.id ? db.medicationEvents.update(m.id, { synced: true }) : Promise.resolve())),
        ]);
      });
    }
  } catch (err) {
    console.error('[Sync Engine] Sync failed', err);
  }
}
