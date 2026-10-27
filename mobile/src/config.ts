import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Port the RSG backend listens on (see backend/src/config/env.ts, default 4000). */
export const API_PORT = 4000;

/** Axios request timeout in milliseconds (10 seconds). */
export const API_TIMEOUT_MS = 10000;

/** Maximum time allowed to restore a saved session on startup (milliseconds). */
export const SESSION_RESTORE_TIMEOUT_MS = 3000;

/** Hosts that must NOT be treated as a "real device LAN IP". */
const SPECIAL_HOSTS = new Set(['10.0.2.2', '127.0.0.1', 'localhost', '0.0.0.0']);

/**
 * Extract the host (IP) from an Expo dev-server "host:port" URI such as
 * "192.168.1.5:8081" or "10.0.2.2:8081". Returns null for loopback / emulator
 * aliases / empty input so the caller can fall through to the next case.
 */
function hostFromUri(uri: string | undefined | null): string | null {
  if (!uri) return null;
  const cleaned = uri.replace(/^https?:\/\//i, '');
  const host = cleaned.split(':')[0];
  return host && !SPECIAL_HOSTS.has(host) ? host : null;
}

/**
 * Resolve the backend base URL, in priority order:
 *
 *   a. EXPO_PUBLIC_API_URL – if set and non-empty, use it verbatim. This lets
 *      you point at a remote/staging backend and overrides all auto-detection.
 *   b. Real device – derive the PC LAN IP from the dev server's hostUri
 *      (Constants.expoConfig.hostUri, e.g. "192.168.1.5:8081") and use
 *      http://<that-ip>:4000. The backend runs on the same PC as the bundler.
 *   c. Android emulator – 10.0.2.2 maps to the host machine's localhost.
 *   d. Fallback (iOS Simulator / web) – 127.0.0.1 shares the host's loopback.
 *
 * The port always comes from the single API_PORT constant above.
 */
function resolveApiUrl(): string {
  // a. Explicit override wins.
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim();
  }

  // b. Real device: hostUri is the PC LAN IP (not the emulator alias / loopback).
  const hostUri: string | undefined =
    Constants.expoConfig?.hostUri ?? Constants.platform?.hostUri;
  const lanHost = hostFromUri(hostUri);
  if (lanHost) {
    return `http://${lanHost}:${API_PORT}`;
  }

  // c. Android emulator.
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}`;
  }

  // d. iOS Simulator / web fallback.
  return `http://127.0.0.1:${API_PORT}`;
}

/** Base URL of the RSG backend. Source of truth for the axios client. */
export const API_URL: string = resolveApiUrl();

// Print the resolved URL once at startup so the actual login target is visible.
// eslint-disable-next-line no-console
console.log(`[RSG] API base URL resolved to: ${API_URL}`);
