import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';

interface LoginErrorInfo {
  type: 'network' | 'credentials' | 'suspended' | 'general';
  title: string;
  message: string;
  hint?: string;
}

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorInfo, setErrorInfo] = useState<LoginErrorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    setIsLoading(true);

    try {
      await login({ email: email.trim(), password });
      navigate('/dashboard');
    } catch (err: any) {
      const isNetwork =
        err.isNetworkError ||
        err.status === 502 ||
        err.status === 503 ||
        err.status === 504 ||
        err.code === 'NETWORK_ERROR' ||
        err.code === 'SERVER_UNAVAILABLE' ||
        err.message?.includes('502') ||
        err.message?.toLowerCase().includes('failed to fetch') ||
        err.message?.toLowerCase().includes('network');

      const isSuspended =
        err.status === 403 ||
        err.code === 'ACCOUNT_SUSPENDED' ||
        err.message?.toLowerCase().includes('suspended');

      const isInvalidCreds =
        err.status === 401 ||
        err.code === 'INVALID_CREDENTIALS' ||
        err.message?.toLowerCase().includes('invalid email') ||
        err.message?.toLowerCase().includes('password');

      if (isNetwork) {
        setErrorInfo({
          type: 'network',
          title: 'Backend Unreachable (502 / Network Error)',
          message:
            'Unable to connect to the RSG Backend API. The server may not be started or is not listening on port 4000.',
          hint: 'Ensure the backend server is running: execute "npm run dev" in the backend directory.',
        });
      } else if (isSuspended) {
        setErrorInfo({
          type: 'suspended',
          title: 'Account Suspended (403)',
          message: err.message || 'This account is suspended and cannot log in. Please contact administration.',
        });
      } else if (isInvalidCreds) {
        setErrorInfo({
          type: 'credentials',
          title: 'Invalid Credentials (401)',
          message: err.message || 'Incorrect email or password. Please verify your credentials.',
        });
      } else {
        setErrorInfo({
          type: 'general',
          title: 'Authentication Error',
          message: err.message || 'An unexpected error occurred during login. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--color-bg)',
        backgroundImage:
          'radial-gradient(circle at 50% 20%, rgba(235, 5, 5, 0.08) 0%, transparent 60%)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-on-primary)',
              boxShadow: 'var(--shadow-glow)',
              marginBottom: '16px',
            }}
          >
            <Shield size={32} />
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0',
            }}
          >
            REGION SECURITY GUARDING
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', margin: 0 }}>
            Operational Management Portal
          </p>
        </div>

        <Card style={{ borderTop: '3px solid var(--color-primary)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {errorInfo && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px 16px',
                  backgroundColor:
                    errorInfo.type === 'network'
                      ? 'rgba(235, 5, 5, 0.12)'
                      : 'var(--color-danger-bg)',
                  border:
                    errorInfo.type === 'network'
                      ? '1px solid var(--color-primary)'
                      : '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                }}
              >
                <div style={{ color: errorInfo.type === 'network' ? 'var(--color-primary)' : 'var(--color-danger)', marginTop: '2px', flexShrink: 0 }}>
                  {errorInfo.type === 'network' ? <WifiOff size={20} /> : <AlertCircle size={20} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <span style={{ fontWeight: 700, color: '#ffffff' }}>
                    {errorInfo.title}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                    {errorInfo.message}
                  </span>
                  {errorInfo.hint && (
                    <span
                      style={{
                        marginTop: '4px',
                        padding: '6px 8px',
                        backgroundColor: 'var(--color-bg-darker)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px dashed var(--color-border)',
                        color: 'var(--color-warning)',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {errorInfo.hint}
                    </span>
                  )}
                </div>
              </div>
            )}

            <Input
              label="Manager Email"
              type="email"
              placeholder="manager@region.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={16} />}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={16} />}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              style={{ width: '100%', marginTop: '6px' }}
            >
              Sign In to Management Portal
            </Button>

            <div
              onClick={() => {
                setEmail('manager@region.com');
                setPassword('Manager123!');
                setErrorInfo(null);
              }}
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-darker)',
                border: '1px solid var(--color-border)',
                fontSize: '12px',
                color: 'var(--color-text-dim)',
                lineHeight: 1.5,
                cursor: 'pointer',
                transition: 'border-color var(--transition-fast)',
              }}
              title="Click to auto-fill demo credentials"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ color: 'var(--color-text-muted)' }}>Demo Credentials:</strong>
                <span style={{ color: 'var(--color-primary-hover)', fontSize: '11px', fontWeight: 600 }}>Click to auto-fill</span>
              </div>
              <div>Email: <code style={{ color: 'var(--color-text)' }}>manager@region.com</code></div>
              <div>Password: <code style={{ color: 'var(--color-text)' }}>Manager123!</code></div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
