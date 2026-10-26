import * as Location from 'expo-location';
import { Branch } from '../types/shift';

export const MAX_ALLOWED_ACCURACY_METERS = 150; // In accordance with RSG domain rules

export interface LocationSnapshot {
  lat: number;
  lng: number;
  accuracy_m: number;
  device_time: string; // ISO UTC string
}

export interface GeofenceCheckResult {
  isWithinGeofence: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
  accuracyMeters: number;
  isAccuracyAcceptable: boolean;
  errorMessage?: string;
}

export type LocationErrorType =
  | 'PERMISSION_DENIED'
  | 'SERVICES_DISABLED'
  | 'TIMEOUT'
  | 'POOR_ACCURACY'
  | 'OUTSIDE_GEOFENCE'
  | 'UNKNOWN';

export class LocationServiceError extends Error {
  type: LocationErrorType;
  details?: any;

  constructor(type: LocationErrorType, message: string, details?: any) {
    super(message);
    this.name = 'LocationServiceError';
    this.type = type;
    this.details = details;
  }
}

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export const locationService = {
  /**
   * Request foreground location permission.
   */
  requestPermissions: async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  /**
   * Check if location services are enabled on the device.
   */
  isLocationEnabled: async (): Promise<boolean> => {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch {
      return false;
    }
  },

  /**
   * Acquire a fresh, high-accuracy GPS position snapshot.
   */
  getCurrentPosition: async (
    maxAccuracyMeters: number = MAX_ALLOWED_ACCURACY_METERS
  ): Promise<LocationSnapshot> => {
    const hasPermission = await locationService.requestPermissions();
    if (!hasPermission) {
      throw new LocationServiceError(
        'PERMISSION_DENIED',
        'Location permission is required to clock in and verify patrols. Please enable location access in settings.'
      );
    }

    const enabled = await locationService.isLocationEnabled();
    if (!enabled) {
      throw new LocationServiceError(
        'SERVICES_DISABLED',
        'Device location / GPS is turned off. Please turn on location services on your device.'
      );
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const accuracy = position.coords.accuracy ?? 999;
      const deviceTime = new Date(position.timestamp || Date.now()).toISOString();

      if (accuracy > maxAccuracyMeters) {
        throw new LocationServiceError(
          'POOR_ACCURACY',
          `GPS signal is too weak (${Math.round(accuracy)}m accuracy, required ≤ ${maxAccuracyMeters}m). Please move closer to an open window or outdoors.`,
          { accuracy, required: maxAccuracyMeters }
        );
      }

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy_m: Math.round(accuracy),
        device_time: deviceTime,
      };
    } catch (err: any) {
      if (err instanceof LocationServiceError) throw err;
      throw new LocationServiceError(
        'TIMEOUT',
        err.message || 'Unable to acquire accurate GPS fix. Please ensure you have clear sky view and try again.'
      );
    }
  },

  /**
   * Evaluate whether a location snapshot satisfies a branch geofence boundary.
   */
  checkGeofence: (location: LocationSnapshot, branch: Branch): GeofenceCheckResult => {
    const distance = calculateHaversineDistanceMeters(
      location.lat,
      location.lng,
      branch.lat,
      branch.lng
    );

    const isWithin = distance <= branch.radius_m;
    const isAccurate = location.accuracy_m <= MAX_ALLOWED_ACCURACY_METERS;

    let errorMessage: string | undefined;
    if (!isWithin) {
      errorMessage = `You are ${distance}m away from ${branch.name}. Clock in/out is restricted to within ${branch.radius_m}m of the branch boundary.`;
    } else if (!isAccurate) {
      errorMessage = `GPS accuracy is too weak (${location.accuracy_m}m). High precision required within geofence.`;
    }

    return {
      isWithinGeofence: isWithin && isAccurate,
      distanceMeters: distance,
      allowedRadiusMeters: branch.radius_m,
      accuracyMeters: location.accuracy_m,
      isAccuracyAcceptable: isAccurate,
      errorMessage,
    };
  },
};
