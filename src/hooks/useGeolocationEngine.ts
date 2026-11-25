'use client';

import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/db';
import { isLocationInsideZone } from '@/lib/geoUtils';

export type TrackingState = 'IDLE' | 'TRACKING' | 'PERMISSION_DENIED' | 'UNAVAILABLE';

interface ZoneShape {
  id: number | string;
  lat: number;
  lng: number;
  radius: number;
}

export function useGeolocationEngine(patientId: string | undefined | null) {
  const [trackingState, setTrackingState] = useState<TrackingState>('IDLE');
  const [hasConsent, setHasConsent] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const lastStateRef = useRef<'INSIDE' | 'OUTSIDE' | 'UNAVAILABLE' | null>(null);
  const lastZoneIdRef = useRef<string | null>(null);
  const lastPingSentRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !patientId) return;
    if (window.localStorage.getItem(`smriti_geo_consent_${patientId}`) === 'granted') {
      setHasConsent(true);
    }
  }, [patientId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !patientId || !hasConsent) {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setTrackingState('IDLE');
      return;
    }

    if (!('geolocation' in navigator)) {
      setTrackingState('UNAVAILABLE');
      return;
    }

    setTrackingState('TRACKING');
    let serverZonesCache: ZoneShape[] = [];
    if (navigator.onLine) {
      fetch(`/api/patients/${patientId}/safety`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (Array.isArray(data?.safeZones)) {
            serverZonesCache = data.safeZones;
          }
        })
        .catch(() => {});
    }

    const handlePosition = async (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      const timestamp = new Date().toISOString();

      const localZones = await db.safeZones
        .where('patientId')
        .equals(patientId)
        .filter((z) => z.isActive)
        .toArray();

      const combinedZones: ZoneShape[] =
        serverZonesCache.length > 0 ? serverZonesCache : localZones.map((z) => ({ id: z.id!, lat: z.lat, lng: z.lng, radius: z.radius }));

      let currentStatus: 'INSIDE' | 'OUTSIDE' = 'OUTSIDE';
      let insideZoneId: string | undefined;

      for (const zone of combinedZones) {
        if (isLocationInsideZone(latitude, longitude, accuracy, zone.lat, zone.lng, zone.radius)) {
          currentStatus = 'INSIDE';
          insideZoneId = String(zone.id);
          break;
        }
      }

      const currentLocs = await db.currentLocation.where('patientId').equals(patientId).toArray();
      const currentLoc = currentLocs[0];
      const numericInsideZone = insideZoneId && !Number.isNaN(Number(insideZoneId)) ? Number(insideZoneId) : undefined;

      if (currentLoc) {
        await db.currentLocation.update(currentLoc.id!, {
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp,
          status: currentStatus,
          insideZoneId: numericInsideZone,
          synced: false,
        });
      } else {
        await db.currentLocation.add({
          patientId,
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp,
          status: currentStatus,
          insideZoneId: numericInsideZone,
          synced: false,
        });
      }

      const isStatusChanged = lastStateRef.current !== currentStatus;
      const isZoneChanged = lastZoneIdRef.current !== (insideZoneId || null);

      if (isStatusChanged || isZoneChanged) {
        if (currentStatus === 'OUTSIDE' && lastStateRef.current === 'INSIDE') {
          await db.locationEvents.add({
            patientId,
            timestamp,
            eventType: 'ZONE_EXIT',
            lat: latitude,
            lng: longitude,
            accuracy,
            synced: false,
          });
        } else if (currentStatus === 'INSIDE' && (lastStateRef.current === 'OUTSIDE' || lastZoneIdRef.current !== insideZoneId)) {
          await db.locationEvents.add({
            patientId,
            timestamp,
            eventType: 'ZONE_ENTER',
            zoneId: numericInsideZone,
            lat: latitude,
            lng: longitude,
            accuracy,
            synced: false,
          });
        }

        lastStateRef.current = currentStatus;
        lastZoneIdRef.current = insideZoneId || null;
      }

      // Sync GPS ping to backend every 60 seconds or on transition
      const nowMs = Date.now();
      if (navigator.onLine && (isStatusChanged || nowMs - lastPingSentRef.current >= 60_000)) {
        lastPingSentRef.current = nowMs;
        fetch(`/api/patients/${patientId}/safety`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'PING',
            lat: latitude,
            lng: longitude,
            accuracy,
            status: currentStatus,
            insideZoneId,
            recordedAt: timestamp,
          }),
        }).catch(() => {});
      }
    };

    const handleError = async (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        setTrackingState('PERMISSION_DENIED');
        await db.locationEvents.add({
          patientId,
          timestamp: new Date().toISOString(),
          eventType: 'TRACKING_DISABLED',
          synced: false,
        });
        if (navigator.onLine) {
          fetch(`/api/patients/${patientId}/safety`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'LOCATION_EVENT', eventType: 'TRACKING_DISABLED' }),
          }).catch(() => {});
        }
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 27000,
    });

    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [patientId, hasConsent]);

  const requestConsent = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setHasConsent(true);
          if (typeof window !== 'undefined' && patientId) {
            window.localStorage.setItem(`smriti_geo_consent_${patientId}`, 'granted');
          }
        },
        () => setTrackingState('PERMISSION_DENIED')
      );
    }
  };

  return { trackingState, hasConsent, setHasConsent, requestConsent };
}
