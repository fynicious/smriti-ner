/**
 * Calculates the great-circle distance between two points on the Earth's surface using the Haversine formula.
 * @param lat1 Latitude of point 1 in decimal degrees
 * @param lon1 Longitude of point 1 in decimal degrees
 * @param lat2 Latitude of point 2 in decimal degrees
 * @param lon2 Longitude of point 2 in decimal degrees
 * @returns Distance in meters
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (val: number) => (val * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Determines if a location point is inside a safe zone.
 * Includes jitter prevention using the accuracy radius.
 * @param userLat 
 * @param userLon 
 * @param accuracy GPS accuracy in meters
 * @param zoneLat 
 * @param zoneLon 
 * @param zoneRadius Zone radius in meters
 * @returns true if inside, false if outside
 */
export function isLocationInsideZone(
  userLat: number, 
  userLon: number, 
  accuracy: number,
  zoneLat: number, 
  zoneLon: number, 
  zoneRadius: number
): boolean {
  const distance = calculateDistanceMeters(userLat, userLon, zoneLat, zoneLon);
  
  // Hysteresis/Jitter protection:
  // If distance is just slightly outside the boundary, but within the GPS inaccuracy margin,
  // we do NOT trigger an exit. We give the benefit of the doubt that the patient is still inside.
  // Effectively, the patient must be clearly outside the zone + accuracy margin to be declared outside.
  return distance <= (zoneRadius + (accuracy || 10));
}
