import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, LoginCredentials } from '../types/auth';
import { api } from '../services/api';
import { authStorage } from '../services/storage';
import { biometricsService, BiometricStatus } from '../services/biometrics';
import { offlineQueue } from '../services/offlineQueue';
import { setSessionExpiredHandler } from '../api/client';
import { SESSION_RESTORE_TIMEOUT_MS } from '../config';

interface AuthContextType {
  user: User | null;
  /** Access token; drives conditional navigation (token => App tabs). */
  token: string | null;
  /** True only during the one-time startup restore. Never toggled by login. */
  isLoading: boolean;
  isAuthenticated: boolean;
  biometricStatus: BiometricStatus;
  biometricsEnabled: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithBiometrics: () => Promise<boolean>;
  logout: () => Promise<void>;
  toggleBiometrics: (enabled: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** A promise that rejects after `ms`, used to bound the startup restore. */
const restoreTimeout = (ms: number) =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('SESSION_RESTORE_TIMEOUT')), ms),
  );

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>({
    isAvailable: false,
    hasHardware: false,
    isEnrolled: false,
    biometryType: 'None',
  });

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async (): Promise<void> => {
      const [storedToken, storedUser, bioEnabled] = await Promise.all([
        authStorage.getAccessToken(),
        authStorage.getUser(),
        authStorage.isBiometricsEnabled(),
      ]);

      if (cancelled) return;

      setBiometricsEnabled(bioEnabled);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        offlineQueue.startPeriodicSync(30000);
      } else {
        // Partial / corrupt session – never trust a token without a user.
        await authStorage.clearAuth();
      }
    };

    const run = async () => {
      try {
        // Restore must complete within SESSION_RESTORE_TIMEOUT_MS. If it fails
        // or hangs we clear the token and fall through to the Login screen.
        await Promise.race([
          restoreSession(),
          restoreTimeout(SESSION_RESTORE_TIMEOUT_MS),
        ]);
      } catch {
        if (!cancelled) {
          await authStorage.clearAuth();
          setToken(null);
          setUser(null);
        }
      } finally {
        // Biometric availability is checked in the background and must NEVER
        // block startup or password login – it simply enables an optional
        // unlock button once resolved.
        biometricsService
          .checkStatus()
          .then((status) => {
            if (!cancelled) setBiometricStatus(status);
          })
          .catch(() => {});
        if (!cancelled) setIsLoading(false);
      }
    };

    run();

    // The axios client calls this when a token refresh fails, so we can clear
    // the in-memory session and flip back to Login without a hard reload.
    setSessionExpiredHandler(() => {
      setUser(null);
      setToken(null);
      offlineQueue.stopPeriodicSync();
    });

    return () => {
      cancelled = true;
      offlineQueue.stopPeriodicSync();
      setSessionExpiredHandler(null);
    };
  }, []);

  /**
   * Login does NOT toggle the global `isLoading`. The LoginScreen owns its own
   * button-spinner state (cleared in a `finally`), so the screen stays mounted
   * and the full-screen startup spinner is never shown mid-login.
   */
  const login = async (credentials: LoginCredentials) => {
    const auth = await api.login(credentials);
    setToken(auth.accessToken);
    setUser(auth.user);
    offlineQueue.startPeriodicSync(30000);
  };

  const loginWithBiometrics = async (): Promise<boolean> => {
    if (!biometricStatus.isAvailable || !biometricsEnabled) return false;

    const storedToken = await authStorage.getAccessToken();
    const storedUser = await authStorage.getUser();
    if (!storedToken || !storedUser) return false;

    const success = await biometricsService.authenticate(
      'Unlock RSG Guard Mobile App',
    );

    if (success) {
      setToken(storedToken);
      setUser(storedUser);
      offlineQueue.startPeriodicSync(30000);
      return true;
    }
    return false;
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      offlineQueue.stopPeriodicSync();
      setUser(null);
      setToken(null);
    }
  };

  const toggleBiometrics = async (enabled: boolean) => {
    await authStorage.setBiometricsEnabled(enabled);
    setBiometricsEnabled(enabled);
  };

  const refreshUser = async () => {
    try {
      const fresh = await api.getCurrentUser();
      setUser(fresh);
      await authStorage.setUser(fresh);
    } catch {
      // Keep cached user if offline
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        biometricStatus,
        biometricsEnabled,
        login,
        loginWithBiometrics,
        logout,
        toggleBiometrics,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
