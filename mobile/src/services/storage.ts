import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { User } from '../types/auth';

const ACCESS_TOKEN_KEY = 'rsg_mobile_access_token';
const REFRESH_TOKEN_KEY = 'rsg_mobile_refresh_token';
const USER_KEY = 'rsg_mobile_user';
const BIOMETRICS_KEY = 'rsg_mobile_biometrics_enabled';
const SERVER_URL_KEY = 'rsg_mobile_server_url';

// Default backend host depending on platform
// Android Emulator uses 10.0.2.2 to reach host machine's localhost:4000
// iOS Simulator and Web use localhost:4000 or 127.0.0.1:4000
export const DEFAULT_SERVER_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://127.0.0.1:4000';

// In-memory fallback for environments without SecureStore support
const memoryFallback = new Map<string, string>();

async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
      memoryFallback.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return memoryFallback.get(key) || null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return memoryFallback.get(key) || null;
  }
}

async function deleteItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
      memoryFallback.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    memoryFallback.delete(key);
  }
}

export const authStorage = {
  getAccessToken: () => getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => setItem(ACCESS_TOKEN_KEY, token),

  getRefreshToken: () => getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => setItem(REFRESH_TOKEN_KEY, token),

  getUser: async (): Promise<User | null> => {
    const raw = await getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setUser: (user: User) => setItem(USER_KEY, JSON.stringify(user)),

  clearAuth: async () => {
    await deleteItem(ACCESS_TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
    await deleteItem(USER_KEY);
  },

  isBiometricsEnabled: async (): Promise<boolean> => {
    const val = await getItem(BIOMETRICS_KEY);
    return val === 'true';
  },
  setBiometricsEnabled: (enabled: boolean) =>
    setItem(BIOMETRICS_KEY, enabled ? 'true' : 'false'),

  getServerUrl: async (): Promise<string> => {
    const custom = await getItem(SERVER_URL_KEY);
    return custom || DEFAULT_SERVER_URL;
  },
  setServerUrl: (url: string) => setItem(SERVER_URL_KEY, url.trim()),
};
