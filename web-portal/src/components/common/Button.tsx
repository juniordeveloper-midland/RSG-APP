import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  style,
  className = '',
  ...props
}) => {
  const getStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontWeight: 600,
      borderRadius: 'var(--radius-md)',
      transition: 'all var(--transition-fast)',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled || isLoading ? 0.6 : 1,
      outline: 'none',
      border: '1px solid transparent',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
    };

    const sizes: Record<string, React.CSSProperties> = {
      sm: { padding: '6px 12px', fontSize: '13px' },
      md: { padding: '9px 16px', fontSize: '14px', minHeight: '38px' },
      lg: { padding: '12px 24px', fontSize: '16px', minHeight: '44px' },
    };

    const variants: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-text-on-primary)',
        borderColor: 'var(--color-primary)',
        boxShadow: 'var(--shadow-sm)',
      },
      secondary: {
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text)',
        borderColor: 'var(--color-border)',
      },
      outline: {
        backgroundColor: 'transparent',
        color: 'var(--color-text)',
        borderColor: 'var(--color-border-light)',
      },
      danger: {
        backgroundColor: 'var(--color-danger)',
        color: 'var(--color-text-on-primary)',
        borderColor: 'var(--color-danger)',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--color-text-muted)',
        borderColor: 'transparent',
      },
    };

    return {
      ...base,
      ...sizes[size],
      ...variants[variant],
      ...style,
    };
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={getStyles()}
      className={`rsg-btn rsg-btn-${variant} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.75s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
