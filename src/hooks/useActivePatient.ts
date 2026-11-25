'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface AuthorizedPatientSummary {
  id: string;
  fullName: string;
  loginCode?: string | null;
  hasPin?: boolean;
  preferredLanguage?: string;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  emergencyContact?: string | null;
  hydrationTargetMl?: number;
}

const STORAGE_KEY = 'smriti_active_patient_id';

export function useActivePatient() {
  const { data: session, status } = useSession();
  const [patients, setPatients] = useState<AuthorizedPatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const role = session?.user?.role || null;
  const userProfileId = session?.user?.profileId || null;

  const refreshPatients = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user) {
      setPatients([]);
      setSelectedPatientId(null);
      return;
    }

    if (session.user.role === 'PATIENT') {
      const ownId = session.user.profileId || null;
      const list = ownId
        ? [{ id: ownId, fullName: session.user.name || 'Patient' }]
        : [];
      setPatients(list);
      setSelectedPatientId(ownId);
      return;
    }

    if (session.user.role === 'CAREGIVER' || session.user.role === 'CLINICIAN') {
      setIsFetching(true);
      try {
        const endpoint =
          session.user.role === 'CAREGIVER'
            ? '/api/caregiver/patients'
            : '/api/clinician/patients';

        const res = await fetch(endpoint, { cache: 'no-store' });
        let normalized: AuthorizedPatientSummary[] = [];

        if (res.ok) {
          const data = await res.json();
          const rawList = Array.isArray(data.patients) ? data.patients : [];
          normalized = rawList
            .map((entry: Record<string, unknown>) => {
              const p = (entry.patient as Record<string, unknown> | undefined) || entry;
              if (!p || typeof p.id !== 'string') return null;
              return {
                id: p.id,
                fullName: typeof p.fullName === 'string' ? p.fullName : 'Patient',
                loginCode: typeof p.loginCode === 'string' ? p.loginCode : null,
                hasPin: Boolean(p.hasPin),
                preferredLanguage: typeof p.preferredLanguage === 'string' ? p.preferredLanguage : undefined,
                dateOfBirth: typeof p.dateOfBirth === 'string' ? p.dateOfBirth : null,
                bloodGroup: typeof p.bloodGroup === 'string' ? p.bloodGroup : null,
                allergies: typeof p.allergies === 'string' ? p.allergies : null,
                chronicConditions: typeof p.chronicConditions === 'string' ? p.chronicConditions : null,
                emergencyContact: typeof p.emergencyContact === 'string' ? p.emergencyContact : null,
                hydrationTargetMl: typeof p.hydrationTargetMl === 'number' ? p.hydrationTargetMl : undefined,
              } as AuthorizedPatientSummary;
            })
            .filter((item: AuthorizedPatientSummary | null): item is AuthorizedPatientSummary => Boolean(item));
        } else if (session.user.role === 'CAREGIVER' && Array.isArray(session.user.patients)) {
          normalized = session.user.patients.map((p) => ({
            id: p.id,
            fullName: p.fullName,
          }));
        }

        setPatients(normalized);
        const storedId =
          typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
        const matched = storedId ? normalized.find((p) => p.id === storedId) : undefined;
        const resolvedId = matched ? matched.id : (normalized[0]?.id || null);
        setSelectedPatientId(resolvedId);
        if (typeof window !== 'undefined' && resolvedId) {
          window.localStorage.setItem(STORAGE_KEY, resolvedId);
        }
      } catch (err) {
        console.error('[useActivePatient] Failed to fetch authorized patients', err);
      } finally {
        setIsFetching(false);
      }
    }
  }, [session, status]);

  useEffect(() => {
    refreshPatients();
  }, [refreshPatients]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ patientId?: string }>).detail;
      if (detail?.patientId) {
        window.localStorage.setItem(STORAGE_KEY, detail.patientId);
      }
      refreshPatients();
    };
    window.addEventListener('smriti:patients-updated', handler);
    return () => window.removeEventListener('smriti:patients-updated', handler);
  }, [refreshPatients]);

  const setActivePatientId = useCallback(
    (id: string) => {
      if (!patients.some((p) => p.id === id)) return;
      setSelectedPatientId(id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, id);
      }
    },
    [patients]
  );

  const activePatient = patients.find((p) => p.id === selectedPatientId) || null;

  return {
    patientId: role === 'PATIENT' ? userProfileId : selectedPatientId,
    patientName: activePatient?.fullName || (role === 'PATIENT' ? session?.user?.name || 'Patient' : null),
    activePatient,
    patients,
    setActivePatientId,
    refreshPatients,
    isLoading: status === 'loading' || isFetching,
    status,
    role,
    isPatient: role === 'PATIENT',
    isCaregiver: role === 'CAREGIVER',
    isClinician: role === 'CLINICIAN',
    user: session?.user || null,
  };
}
