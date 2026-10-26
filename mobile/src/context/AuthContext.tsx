import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, LoginCredentials } from '../types/auth';
import { api } from '../services/api';
import { authStorage } from '../services/storage';
import { biometricsService, BiometricStatus } from '../services/biometrics';
import { offlineQueue } from '../services/offlineQueue';

interface AuthContextType {
  user: User | null;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>({
    isAvailable: false,
    hasHardware: false,
    isEnrolled: false,
    biometryType: 'None',
  });

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = await authStorage.getUser();
        const token = await authStorage.getAccessToken();
        const bioEnabled = await authStorage.isBiometricsEnabled();
        const bioStatus = await biometricsService.checkStatus();

        setBiometricsEnabled(bioEnabled);
        setBiometricStatus(bioStatus);

        if (token && storedUser) {
          setUser(storedUser);
          // Start background offline queue sync
          offlineQueue.startPeriodicSync(30000);
        }
      } catch {
        // Fallback to unauthenticated state
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      offlineQueue.stopPeriodicSync();
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const auth = await api.login(credentials);
      setUser(auth.user);
      offlineQueue.startPeriodicSync(30000);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithBiometrics = async (): Promise<boolean> => {
    if (!biometricStatus.isAvailable || !biometricsEnabled) return false;

    const token = await authStorage.getAccessToken();
    const storedUser = await authStorage.getUser();
    if (!token || !storedUser) return false;

    const success = await biometricsService.authenticate(
      'Unlock RSG Guard Mobile App'
    );

    if (success) {
      setUser(storedUser);
      offlineQueue.startPeriodicSync(30000);
      return true;
    }
    return false;
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
      offlineQueue.stopPeriodicSync();
    } finally {
      setUser(null);
      setIsLoading(false);
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
        isLoading,
        isAuthenticated: !!user,
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
