import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { ClientDetails } from './pages/ClientDetails';
import { Branches } from './pages/Branches';
import { Employees } from './pages/Employees';
import { EmployeeDetails } from './pages/EmployeeDetails';
import { Shifts } from './pages/Shifts';
import { Attendance } from './pages/Attendance';
import { Patrol } from './pages/Patrol';
import { Alerts } from './pages/Alerts';
import { LiveMap } from './pages/LiveMap';
import './theme.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text-muted)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<Login />} />

              {/* Protected Management Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                <Route path="clients" element={<ErrorBoundary><Clients /></ErrorBoundary>} />
                <Route path="clients/:id" element={<ErrorBoundary><ClientDetails /></ErrorBoundary>} />
                <Route path="branches" element={<ErrorBoundary><Branches /></ErrorBoundary>} />
                <Route path="employees" element={<ErrorBoundary><Employees /></ErrorBoundary>} />
                <Route path="employees/:id" element={<ErrorBoundary><EmployeeDetails /></ErrorBoundary>} />
                <Route path="shifts" element={<ErrorBoundary><Shifts /></ErrorBoundary>} />
                <Route path="attendance" element={<ErrorBoundary><Attendance /></ErrorBoundary>} />
                <Route path="patrol" element={<ErrorBoundary><Patrol /></ErrorBoundary>} />
                <Route path="alerts" element={<ErrorBoundary><Alerts /></ErrorBoundary>} />
                <Route path="live-map" element={<ErrorBoundary><LiveMap /></ErrorBoundary>} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
