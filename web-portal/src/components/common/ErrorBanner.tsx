import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string | null | undefined;
  onDismiss?: () => void;
}

/** Themed error banner shown at the top of a page when an API call fails. */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: 'rgba(235, 5, 5, 0.12)',
        border: '1px solid rgba(235, 5, 5, 0.4)',
        borderRadius: '8px',
        marginBottom: '16px',
      }}
    >
      <AlertTriangle size={18} style={{ color: '#eb0505', flexShrink: 0, marginTop: '1px' }} />
      <span style={{ flex: 1, fontSize: '14px', color: '#ffffff', lineHeight: 1.5 }}>
        {message}
      </span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#bdbdbd',
            cursor: 'pointer',
            padding: '0',
            flexShrink: 0,
          }}
          aria-label="Dismiss error"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};
