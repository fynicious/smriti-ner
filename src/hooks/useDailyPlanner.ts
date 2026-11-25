'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db, VoiceReminder } from '@/lib/db';
import { getLocalDateString } from '@/lib/dateUtils';
import { useLiveQuery } from 'dexie-react-hooks';

export type PlannerItemType =
  | 'MEDICATION'
  | 'MEAL'
  | 'HYDRATION'
  | 'HYGIENE'
  | 'COGNITIVE'
  | 'PHYSICAL'
  | 'SLEEP'
  | 'APPOINTMENT'
  | 'FAMILY'
  | 'CUSTOM';

export interface PlannerItem {
  id: string;
  sourceType: 'ROUTINE' | 'MEDICATION' | 'HYDRATION';
  sourceId?: number;
  serverRoutineId?: string;
  serverMedicationId?: string;
  serverEventId?: string;
  patientId?: string;
  category: PlannerItemType;
  title: string;
  time: string; // HH:MM
  iconEmoji: string;
  imageUrl?: string | null;
  color: string;
  status: 'pending' | 'completed' | 'snoozed' | 'missed';
  voiceReminder?: VoiceReminder;
  sortTime: number;
  assignedTo?: string;
  completedBy?: string;
}

interface ServerRoutine {
  id: string;
  category: string;
  title: string;
  time: string;
  iconEmoji: string;
  imageUrl?: string | null;
  color: string;
  assignedTo?: string | null;
  voiceReminderId?: string | null;
}

interface ServerOccurrence {
  id: string;
  routineId: string;
  date: string;
  status: string;
  completedBy?: string | null;
  assignedTo?: string | null;
}

interface ServerVoiceReminder {
  id: string;
  routineType: string;
  title: string;
  time: string;
  speakerName: string;
  audioBase64: string;
}

interface ServerMedicationEvent {
  id: string;
  action: string;
  scheduledTime: string;
}

interface ServerMedication {
  id: string;
  name: string;
  dosage: string;
  time?: string | null;
  imageUrl?: string | null;
  status: string;
  events?: ServerMedicationEvent[];
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }
  const dateObj = new Date(timeStr);
  if (Number.isNaN(dateObj.getTime())) return 0;
  return dateObj.getHours() * 60 + dateObj.getMinutes();
}

function normalizeCategory(raw: string): PlannerItemType {
  const up = raw.toUpperCase();
  const valid: PlannerItemType[] = [
    'MEDICATION',
    'MEAL',
    'HYDRATION',
    'HYGIENE',
    'COGNITIVE',
    'PHYSICAL',
    'SLEEP',
    'APPOINTMENT',
    'FAMILY',
    'CUSTOM',
  ];
  return valid.includes(up as PlannerItemType) ? (up as PlannerItemType) : 'CUSTOM';
}

export function useDailyPlanner(patientId: string | undefined | null) {
  const [nowItem, setNowItem] = useState<PlannerItem | null>(null);
  const [nextItem, setNextItem] = useState<PlannerItem | null>(null);
  const [todayItems, setTodayItems] = useState<PlannerItem[]>([]);
  const [serverRoutines, setServerRoutines] = useState<ServerRoutine[]>([]);
  const [serverOccurrences, setServerOccurrences] = useState<ServerOccurrence[]>([]);
  const [serverVoiceReminders, setServerVoiceReminders] = useState<ServerVoiceReminder[]>([]);
  const [serverMeds, setServerMeds] = useState<ServerMedication[]>([]);

  const fetchServerPlanner = useCallback(async () => {
    if (!patientId) return;
    const today = getLocalDateString();
    try {
      const [routRes, medRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/routines?date=${today}`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/medications`, { cache: 'no-store' }),
      ]);

      if (routRes.ok) {
        const routData = await routRes.json();
        setServerRoutines(Array.isArray(routData.routines) ? routData.routines : []);
        setServerOccurrences(Array.isArray(routData.occurrences) ? routData.occurrences : []);
        setServerVoiceReminders(Array.isArray(routData.voiceReminders) ? routData.voiceReminders : []);
      }

      if (medRes.ok) {
        const medData = await medRes.json();
        setServerMeds(Array.isArray(medData.medications) ? medData.medications : []);
      }
    } catch {
      // Offline fallback uses Dexie automatically
    }
  }, [patientId]);

  useEffect(() => {
    fetchServerPlanner();
  }, [fetchServerPlanner]);

  const medsQuery = useLiveQuery(async () => {
    const today = getLocalDateString();
    if (!patientId) return { events: [], prescriptions: [], today };

    const events = await db.medicationEvents.where('patientId').equals(patientId).toArray();
    const todayEvents = events.filter(
      (e) => e.status !== 'deleted' && (e.scheduledTime.startsWith(today) || e.scheduledTime.length <= 5)
    );
    const activePrescriptions = await db.prescriptions
      .where('patientId')
      .equals(patientId)
      .filter((p) => p.status === 'ACTIVE')
      .toArray();

    return { events: todayEvents, prescriptions: activePrescriptions, today };
  }, [patientId]);

  const medsData = useMemo(
    () => medsQuery ?? { events: [], prescriptions: [], today: getLocalDateString() },
    [medsQuery]
  );

  useEffect(() => {
    async function generateMissingMeds() {
      if (!patientId || !medsData.prescriptions.length) return;
      const { prescriptions, events } = medsData;

      for (const rx of prescriptions) {
        if (!rx.time) continue;
        const hasEvent = events.find(
          (e) => e.medicationName === rx.medicationName && e.scheduledTime === rx.time
        );
        if (!hasEvent) {
          await db.medicationEvents.add({
            patientId,
            medicationName: rx.medicationName,
            dosage: rx.dosage,
            scheduledTime: rx.time,
            action: 'pending',
            status: 'active',
            synced: false,
          });
        }
      }
    }
    generateMissingMeds();
  }, [medsData, patientId]);

  const routinesQuery = useLiveQuery(async () => {
    const today = getLocalDateString();
    if (!patientId) return { routines: [], occurrences: [], today };
    const activeRoutines = await db.dailyRoutines
      .where('patientId')
      .equals(patientId)
      .filter((r) => r.isActive)
      .toArray();
    const occurrences = await db.routineOccurrences
      .where('patientId')
      .equals(patientId)
      .filter((o) => o.date === today)
      .toArray();
    return { routines: activeRoutines, occurrences, today };
  }, [patientId]);

  const routinesData = useMemo(
    () => routinesQuery ?? { routines: [], occurrences: [], today: getLocalDateString() },
    [routinesQuery]
  );

  useEffect(() => {
    async function generateMissing() {
      if (!patientId || !routinesData.routines.length) return;
      const { routines, occurrences, today } = routinesData;
      for (const routine of routines) {
        if (routine.id && !occurrences.find((o) => o.routineId === routine.id)) {
          await db.routineOccurrences.add({
            routineId: routine.id,
            patientId,
            date: today,
            status: 'pending',
            synced: false,
          });
        }
      }
    }
    generateMissing();
  }, [routinesData, patientId]);

  const voiceQuery = useLiveQuery(async () => {
    if (!patientId) return [];
    return db.voiceReminders.where('patientId').equals(patientId).toArray();
  }, [patientId]);

  const localVoiceReminders = useMemo(() => voiceQuery ?? [], [voiceQuery]);

  useEffect(() => {
    if (!patientId) {
      setTodayItems([]);
      setNowItem(null);
      setNextItem(null);
      return;
    }

    const today = getLocalDateString();
    const items: PlannerItem[] = [];
    const seenKeys = new Set<string>();

    const resolveVoice = (category: string, time: string, voiceId?: string | null): VoiceReminder | undefined => {
      const sv = serverVoiceReminders.find(
        (vr) => (voiceId && vr.id === voiceId) || (vr.routineType === category.toLowerCase() && vr.time === time)
      );
      if (sv) {
        return {
          patientId,
          routineType: sv.routineType,
          title: sv.title,
          time: sv.time,
          speakerName: sv.speakerName,
          audioBase64: sv.audioBase64,
          isActive: true,
          synced: true,
        };
      }
      return localVoiceReminders.find((vr) => vr.routineType === category.toLowerCase() && vr.time === time);
    };

    // 1. Server medications (authoritative)
    for (const sm of serverMeds) {
      if (sm.status !== 'ACTIVE') continue;
      const timeStr = sm.time || '09:00';
      const todayEvent = (sm.events || []).find((ev) => ev.scheduledTime.startsWith(today));
      const action = todayEvent?.action?.toUpperCase();
      const status: PlannerItem['status'] =
        action === 'TAKEN'
          ? 'completed'
          : action === 'SKIPPED' || action === 'MISSED'
          ? 'missed'
          : action === 'SNOOZED'
          ? 'snoozed'
          : 'pending';

      const dedupKey = `MED:${sm.name.toLowerCase()}:${timeStr}`;
      seenKeys.add(dedupKey);
      items.push({
        id: `smed-${sm.id}`,
        sourceType: 'MEDICATION',
        serverMedicationId: sm.id,
        serverEventId: todayEvent?.id,
        patientId,
        category: 'MEDICATION',
        title: `${sm.name} (${sm.dosage})`,
        time: timeStr,
        iconEmoji: '💊',
        imageUrl: sm.imageUrl || null,
        color: 'bg-lavender-500',
        status,
        voiceReminder: resolveVoice('medication', timeStr),
        sortTime: timeToMinutes(timeStr),
      });
    }

    // 2. Local Dexie medication events (offline fallback if not shadowed by server)
    for (const med of medsData.events) {
      const timeStr = med.scheduledTime.length > 5 ? med.scheduledTime.split('T')[1].substring(0, 5) : med.scheduledTime;
      const dedupKey = `MED:${med.medicationName.toLowerCase()}:${timeStr}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      items.push({
        id: `med-${med.id}`,
        sourceType: 'MEDICATION',
        sourceId: med.id,
        serverMedicationId: med.medicationId,
        patientId,
        category: 'MEDICATION',
        title: med.medicationName,
        time: timeStr,
        iconEmoji: '💊',
        color: 'bg-lavender-500',
        status:
          med.action === 'taken'
            ? 'completed'
            : med.action === 'skipped' || med.action === 'missed'
            ? 'missed'
            : med.action === 'snoozed'
            ? 'snoozed'
            : 'pending',
        voiceReminder: resolveVoice('medication', timeStr),
        sortTime: timeToMinutes(timeStr),
        assignedTo: med.assignedTo,
        completedBy: med.completedBy,
      });
    }

    // 3. Server routines (authoritative)
    for (const sr of serverRoutines) {
      const occ = serverOccurrences.find((o) => o.routineId === sr.id && o.date === today);
      const occStatus = (occ?.status || 'pending') as PlannerItem['status'];
      const dedupKey = `ROUT:${sr.title.toLowerCase()}:${sr.time}`;
      seenKeys.add(dedupKey);

      items.push({
        id: `srout-${sr.id}`,
        sourceType: 'ROUTINE',
        serverRoutineId: sr.id,
        patientId,
        category: normalizeCategory(sr.category),
        title: sr.title,
        time: sr.time,
        iconEmoji: sr.iconEmoji,
        color: sr.color,
        status: occStatus,
        voiceReminder: resolveVoice(sr.category, sr.time, sr.voiceReminderId),
        sortTime: timeToMinutes(sr.time),
        assignedTo: occ?.assignedTo || sr.assignedTo || undefined,
        completedBy: occ?.completedBy || undefined,
      });
    }

    // 4. Local Dexie routines (offline fallback)
    for (const occ of routinesData.occurrences) {
      const routine = routinesData.routines.find((r) => r.id === occ.routineId);
      if (!routine) continue;
      const dedupKey = `ROUT:${routine.title.toLowerCase()}:${routine.time}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      items.push({
        id: `rout-${occ.id}`,
        sourceType: 'ROUTINE',
        sourceId: occ.id,
        patientId,
        category: routine.category,
        title: routine.title,
        time: routine.time,
        iconEmoji: routine.iconEmoji,
        color: routine.color,
        status: occ.status,
        voiceReminder: resolveVoice(routine.category, routine.time),
        sortTime: timeToMinutes(routine.time),
        assignedTo: occ.assignedTo || routine.assignedTo,
        completedBy: occ.completedBy,
      });
    }

    items.sort((a, b) => a.sortTime - b.sortTime);
    setTodayItems(items);

    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const pendingItems = items.filter((i) => i.status === 'pending' || i.status === 'snoozed');

    if (pendingItems.length > 0) {
      const dueItems = pendingItems.filter((i) => i.sortTime <= nowMinutes + 30);
      if (dueItems.length > 0) {
        setNowItem(dueItems[0]);
        setNextItem(pendingItems.length > 1 ? pendingItems.find((i) => i.id !== dueItems[0].id) || null : null);
      } else {
        setNowItem(null);
        setNextItem(pendingItems[0]);
      }
    } else {
      setNowItem(null);
      setNextItem(null);
    }
  }, [medsData, routinesData, localVoiceReminders, serverRoutines, serverOccurrences, serverVoiceReminders, serverMeds, patientId]);

  const completeItem = useCallback(
    async (item: PlannerItem) => {
      if (item.sourceId) {
        if (item.sourceType === 'MEDICATION') {
          await db.medicationEvents.update(item.sourceId, { action: 'taken', completedBy: 'Patient', synced: false });
        } else if (item.sourceType === 'ROUTINE') {
          await db.routineOccurrences.update(item.sourceId, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            completedBy: 'Patient',
            synced: false,
          });
        }
      }

      if (item.patientId) {
        const today = getLocalDateString();
        try {
          if (item.sourceType === 'ROUTINE' && item.serverRoutineId) {
            await fetch(`/api/patients/${item.patientId}/routines`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kind: 'OCCURRENCE_STATUS',
                routineId: item.serverRoutineId,
                date: today,
                status: 'completed',
              }),
            });
          } else if (item.sourceType === 'MEDICATION' && item.serverMedicationId) {
            await fetch(`/api/patients/${item.patientId}/medications`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                medicationId: item.serverMedicationId,
                action: 'TAKEN',
                scheduledTime: `${today}T${item.time}:00`,
                actualTime: new Date().toISOString(),
              }),
            });
          }
          await fetchServerPlanner();
        } catch {
          // Offline mutation persisted locally
        }
      }
    },
    [fetchServerPlanner]
  );

  const snoozeItem = useCallback(
    async (item: PlannerItem) => {
      if (item.sourceId) {
        if (item.sourceType === 'MEDICATION') {
          await db.medicationEvents.update(item.sourceId, { action: 'snoozed', synced: false });
        } else if (item.sourceType === 'ROUTINE') {
          await db.routineOccurrences.update(item.sourceId, { status: 'snoozed', synced: false });
        }
      }

      if (item.patientId) {
        const today = getLocalDateString();
        try {
          if (item.sourceType === 'ROUTINE' && item.serverRoutineId) {
            await fetch(`/api/patients/${item.patientId}/routines`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kind: 'OCCURRENCE_STATUS',
                routineId: item.serverRoutineId,
                date: today,
                status: 'snoozed',
              }),
            });
          } else if (item.sourceType === 'MEDICATION' && item.serverMedicationId) {
            await fetch(`/api/patients/${item.patientId}/medications`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                medicationId: item.serverMedicationId,
                action: 'SNOOZED',
                scheduledTime: `${today}T${item.time}:00`,
              }),
            });
          }
          await fetchServerPlanner();
        } catch {
          // Non-blocking offline snooze
        }
      }
    },
    [fetchServerPlanner]
  );

  return { nowItem, nextItem, todayItems, completeItem, snoozeItem, refreshPlanner: fetchServerPlanner };
}
