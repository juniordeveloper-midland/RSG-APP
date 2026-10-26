/**
 * Calculate the great-circle distance between two points on Earth using the Haversine formula.
 * @returns Distance in meters
 */
export const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth radius in meters
  const toRad = (angle: number) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Checks whether user coordinates fall within the branch radius.
 */
export const verifyGeofence = (
  userLat: number,
  userLng: number,
  branchLat: number,
  branchLng: number,
  branchRadiusM: number
): { isWithin: boolean; distanceMeters: number } => {
  const distanceMeters = calculateHaversineDistance(
    userLat,
    userLng,
    branchLat,
    branchLng
  );
  return {
    isWithin: distanceMeters <= branchRadiusM,
    distanceMeters: Math.round(distanceMeters * 10) / 10,
  };
};
