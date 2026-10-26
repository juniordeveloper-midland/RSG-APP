import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredUser, getAccessToken, setAuthSession, clearAuthSession } from '../api/client';
import type { User } from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = getAccessToken();
    const stored = getStoredUser();

    if (token && stored) {
      setUser(stored);
    } else {
      setUser(null);
    }
    setIsLoading(false);

    // Global unauthorized listener from API client auto-refresh failure
    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('rsg:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('rsg:unauthorized', handleUnauthorized);
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const data = await api.login(credentials);
      setAuthSession(data);
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Continue client cleanup even if network request fails
    } finally {
      clearAuthSession();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
