import { Linking } from 'react-native';
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
  distanceMessage: string;
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
  lat1: number | string,
  lon1: number | string,
  lat2: number | string,
  lon2: number | string
): number {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(nLat1);
  const phi2 = toRad(nLat2);
  const deltaPhi = toRad(nLat2 - nLat1);
  const deltaLambda = toRad(nLon2 - nLon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export const locationService = {
  /**
   * Open native device settings for the RSG application.
   */
  openSettings: async (): Promise<void> => {
    try {
      await Linking.openSettings();
    } catch {
      // Ignore fallback
    }
  },

  /**
   * Request foreground location permission.
   */
  requestPermissions: async (): Promise<boolean> => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.granted) return true;
      const requested = await Location.requestForegroundPermissionsAsync();
      return requested.granted;
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
    // 1. Check if device location services are turned on
    const enabled = await locationService.isLocationEnabled();
    if (!enabled) {
      throw new LocationServiceError(
        'SERVICES_DISABLED',
        'Device location is turned off. Please enable GPS / location services on your device to check in.'
      );
    }

    // 2. Check permission (ask if needed)
    const hasPermission = await locationService.requestPermissions();
    if (!hasPermission) {
      throw new LocationServiceError(
        'PERMISSION_DENIED',
        'Location permission is denied. Please grant location access in device settings to verify check-in.'
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
          `Weak GPS signal (±${Math.round(accuracy)}m). High accuracy (within ${maxAccuracyMeters}m) required. Please move to an open area.`,
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
    const branchLat = Number(branch.lat);
    const branchLng = Number(branch.lng);
    const branchRadius = Number(branch.radius_m) || 150;

    const distance = calculateHaversineDistanceMeters(
      location.lat,
      location.lng,
      branchLat,
      branchLng
    );

    const isWithin = distance <= branchRadius;
    const isAccurate = location.accuracy_m <= MAX_ALLOWED_ACCURACY_METERS;

    const distanceMessage = `You are ${distance} m from ${branch.name}, allowed ${branchRadius} m`;

    let errorMessage: string | undefined;
    if (!isWithin) {
      errorMessage = `${distanceMessage}. You are outside the designated check-in radius.`;
    } else if (!isAccurate) {
      errorMessage = `Weak GPS signal (±${location.accuracy_m}m). High accuracy required within geofence.`;
    }

    return {
      isWithinGeofence: isWithin && isAccurate,
      distanceMeters: distance,
      allowedRadiusMeters: branchRadius,
      accuracyMeters: location.accuracy_m,
      isAccuracyAcceptable: isAccurate,
      distanceMessage,
      errorMessage,
    };
  },
};
