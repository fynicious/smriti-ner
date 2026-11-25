'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { SafeZone, CurrentPatientLocation } from '@/lib/db';

// Fix for default marker icons in Next.js
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to recenter map when location changes
function RecenterAutomatically({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

interface MapViewProps {
  center: [number, number];
  zoom: number;
  safeZones: SafeZone[];
  currentLocation?: CurrentPatientLocation;
}

export default function MapView({ center, zoom, safeZones, currentLocation }: MapViewProps) {
  return (
    <div className="w-full h-64 rounded-3xl overflow-hidden relative z-0">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Render Patient Location */}
        {currentLocation && (
          <>
            <Marker position={[currentLocation.lat, currentLocation.lng]} icon={customIcon}>
              <Popup>
                Patient Location <br/>
                Accuracy: ±{Math.round(currentLocation.accuracy)}m
              </Popup>
            </Marker>
            
            {/* Accuracy Circle */}
            <Circle 
              center={[currentLocation.lat, currentLocation.lng]}
              radius={currentLocation.accuracy}
              pathOptions={{ fillColor: '#3b82f6', color: '#3b82f6', weight: 1, opacity: 0.3, fillOpacity: 0.15 }}
            />
            
            <RecenterAutomatically lat={currentLocation.lat} lng={currentLocation.lng} />
          </>
        )}

        {/* Render Safe Zones */}
        {safeZones.map(zone => (
           <Circle
             key={zone.id}
             center={[zone.lat, zone.lng]}
             radius={zone.radius}
             pathOptions={{ 
               fillColor: '#10b981', // mint green
               color: '#059669', 
               weight: 2, 
               opacity: 0.8, 
               fillOpacity: 0.2 
             }}
           >
             <Popup>{zone.name} ({zone.radius}m)</Popup>
           </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
