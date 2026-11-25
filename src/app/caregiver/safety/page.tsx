'use client';

import { useState, useEffect, useCallback } from 'react';
import { useActivePatient } from '@/hooks/useActivePatient';
import { CaregiverPatientBar } from '@/components/caregiver/CaregiverPatientBar';
import type { SafeZone as DexieSafeZone, CurrentPatientLocation } from '@/lib/db';
import { ChevronLeft, MapPin, Shield, Plus, Trash2, ShieldAlert, History } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/caregiver/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-slate-100 rounded-3xl animate-pulse flex items-center justify-center text-slate-600 font-bold">
      Loading Map...
    </div>
  ),
});

interface ServerSafeZone {
  id: string;
  patientId: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  isActive: boolean;
}

interface ServerLocationPing {
  id: string;
  patientId: string;
  lat: number;
  lng: number;
  accuracy: number;
  status: string;
  recordedAt: string;
}

interface ServerLocationEvent {
  id: string;
  eventType: string;
  timestamp: string;
}

export default function CaregiverSafetyPage() {
  const { patientId, patients, setActivePatientId, isLoading } = useActivePatient();

  const [safeZones, setSafeZones] = useState<ServerSafeZone[]>([]);
  const [latestPing, setLatestPing] = useState<ServerLocationPing | null>(null);
  const [locationEvents, setLocationEvents] = useState<ServerLocationEvent[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState(150);

  const loadSafety = useCallback(async () => {
    if (!patientId) {
      setSafeZones([]);
      setLatestPing(null);
      setLocationEvents([]);
      return;
    }
    try {
      const res = await fetch(`/api/patients/${patientId}/safety`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSafeZones(Array.isArray(data.safeZones) ? data.safeZones : []);
        setLatestPing(data.latestPing || null);
        setLocationEvents(Array.isArray(data.events) ? data.events : []);
      }
    } catch {
      // Offline non-blocking
    }
  }, [patientId]);

  useEffect(() => {
    loadSafety();
  }, [loadSafety]);

  const handleAddZone = async () => {
    if (!patientId || !newZoneName.trim()) return;
    const lat = latestPing?.lat || 26.1445;
    const lng = latestPing?.lng || 91.7362;

    const res = await fetch(`/api/patients/${patientId}/safety`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'SAFE_ZONE',
        name: newZoneName.trim(),
        lat,
        lng,
        radius: newZoneRadius,
      }),
    });

    if (res.ok) {
      setIsAddingZone(false);
      setNewZoneName('');
      await loadSafety();
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!patientId) return;
    await fetch(`/api/patients/${patientId}/safety?zoneId=${encodeURIComponent(zoneId)}`, {
      method: 'DELETE',
    });
    setConfirmDeleteId(null);
    await loadSafety();
  };

  const getFreshness = () => {
    if (!latestPing?.recordedAt) return 'No location ping yet';
    const mins = Math.round((Date.now() - new Date(latestPing.recordedAt).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins > 60) return '> 1 hr ago';
    return `${mins} mins ago`;
  };

  const isStale = Boolean(
    latestPing?.recordedAt && Date.now() - new Date(latestPing.recordedAt).getTime() > 15 * 60000
  );

  const mapZones: DexieSafeZone[] = safeZones.map((z, idx) => ({
    id: idx + 1,
    patientId: z.patientId,
    name: z.name,
    lat: z.lat,
    lng: z.lng,
    radius: z.radius,
    isActive: z.isActive,
    synced: true,
  }));

  const mapCurrentLoc: CurrentPatientLocation | undefined = latestPing
    ? {
        patientId: latestPing.patientId,
        lat: latestPing.lat,
        lng: latestPing.lng,
        accuracy: latestPing.accuracy,
        status: (['INSIDE', 'OUTSIDE', 'UNAVAILABLE', 'STALE'].includes(latestPing.status)
          ? latestPing.status
          : 'UNAVAILABLE') as CurrentPatientLocation['status'],
        timestamp: latestPing.recordedAt,
        synced: true,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50 pb-32 sm:pb-28 font-sans">
      <div className="bg-white pt-6 sm:pt-12 pb-4 sm:pb-5 px-4 sm:px-6 shadow-sm border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center gap-3 sm:gap-4">
          <Link href="/caregiver" aria-label="Back to Caregiver Dashboard" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors shrink-0">
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Safety & Location</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Manage safe zones and live geofence telemetry</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-3xl mx-auto">
        <CaregiverPatientBar patientId={patientId} patients={patients} onSelectPatient={setActivePatientId} isLoading={isLoading} />

        {patientId && (
          <>
            {/* Status Card */}
            <div className="bg-white p-4 sm:p-6 rounded-[28px] shadow-sm border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="font-extrabold text-slate-600 text-sm uppercase tracking-wider">Patient Location Status</h2>
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                  Updated: {getFreshness()}
                </span>
              </div>

              {latestPing?.status === 'INSIDE' ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-mint-100 flex items-center justify-center">
                    <Shield className="text-mint-700" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">SAFE</h3>
                    <p className="text-mint-700 font-bold text-sm">Inside approved safe zone</p>
                  </div>
                </div>
              ) : latestPing?.status === 'OUTSIDE' ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center animate-pulse">
                    <ShieldAlert className="text-rose-700" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-rose-700">OUTSIDE ZONE</h3>
                    <p className="text-rose-600 font-bold text-sm">Outside configured safe zones</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                    <MapPin className="text-slate-600" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">AWAITING LOCATION</h3>
                    <p className="text-slate-600 font-bold text-sm">Turn on Location Sharing from the patient screen</p>
                  </div>
                </div>
              )}

              {isStale && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold">
                  Last location update is older than 15 minutes. Patient device may be offline or indoors.
                </div>
              )}
            </div>

            {/* Map */}
            <div className="bg-white p-2 rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
              <MapView
                center={latestPing ? [latestPing.lat, latestPing.lng] : [26.1445, 91.7362]}
                zoom={15}
                safeZones={mapZones}
                currentLocation={mapCurrentLoc}
              />
            </div>

            {/* Safe Zones */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                  <Shield size={20} className="text-sky-600" /> Safe Zones
                </h2>
                <button
                  type="button"
                  onClick={() => setIsAddingZone(!isAddingZone)}
                  className="text-sky-700 font-bold text-sm bg-sky-50 border border-sky-200 px-4 py-2 rounded-full flex items-center gap-1 hover:bg-sky-100"
                >
                  <Plus size={16} /> Add Zone
                </button>
              </div>

              {isAddingZone && (
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-200 mb-4 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase block mb-1.5">Zone Name</label>
                    <input
                      type="text"
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      placeholder="e.g., Home, Morning Park"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-600 uppercase mb-1.5">
                      <span>Radius</span>
                      <span className="text-sky-700">{newZoneRadius} meters</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={newZoneRadius}
                      onChange={(e) => setNewZoneRadius(parseInt(e.target.value, 10))}
                      className="w-full accent-sky-600"
                    />
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    Centered at {latestPing ? 'last known patient GPS coordinates' : 'Guwahati regional default coordinates (26.1445, 91.7362)'}.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddZone}
                    disabled={!newZoneName.trim()}
                    className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl disabled:opacity-50"
                  >
                    Save Safe Zone
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {safeZones.length === 0 ? (
                  <div className="text-center py-6 bg-white rounded-2xl border border-slate-200 text-slate-600 font-medium text-sm">
                    No safe zones configured yet.
                  </div>
                ) : (
                  safeZones.map((zone) => (
                    <div key={zone.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-extrabold text-slate-900">{zone.name}</h3>
                        <p className="text-xs font-bold text-slate-600 uppercase">{zone.radius}m radius</p>
                      </div>
                      {confirmDeleteId === zone.id ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleDeleteZone(zone.id)} className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg">
                            Delete
                          </button>
                          <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Remove ${zone.name}`}
                          onClick={() => setConfirmDeleteId(zone.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Event History */}
            <div>
              <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2 mb-3">
                <History size={20} className="text-slate-600" /> Recent Location Events
              </h2>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                {locationEvents.length === 0 ? (
                  <div className="p-6 text-center text-slate-600 text-sm font-medium">No geofence events recorded yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {locationEvents.map((event) => (
                      <div key={event.id} className="p-4 flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            event.eventType === 'ZONE_EXIT'
                              ? 'bg-rose-100 text-rose-700'
                              : event.eventType === 'ZONE_ENTER'
                              ? 'bg-mint-100 text-mint-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {event.eventType === 'ZONE_EXIT' ? <ShieldAlert size={16} /> : <Shield size={16} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            {event.eventType === 'ZONE_EXIT'
                              ? 'Left safe zone'
                              : event.eventType === 'ZONE_ENTER'
                              ? 'Entered safe zone'
                              : 'Location tracking disabled'}
                          </p>
                          <p className="text-xs font-bold text-slate-600">
                            {new Date(event.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
