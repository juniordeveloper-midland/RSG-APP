import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  Briefcase,
  Building2,
  Users,
  CalendarDays,
  Clock,
  QrCode,
  AlertTriangle,
  Map,
  LogOut,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { to: '/clients', label: 'Clients', icon: <Briefcase size={20} /> },
    { to: '/branches', label: 'Branches', icon: <Building2 size={20} /> },
    { to: '/employees', label: 'Employees', icon: <Users size={20} /> },
    { to: '/shifts', label: 'Shifts & Rota', icon: <CalendarDays size={20} /> },
    { to: '/attendance', label: 'Attendance Grid', icon: <Clock size={20} /> },
    { to: '/patrol', label: 'Patrol QRs & Logs', icon: <QrCode size={20} /> },
    { to: '/alerts', label: 'Alerts Queue', icon: <AlertTriangle size={20} /> },
    { to: '/live-map', label: 'Live Map', icon: <Map size={20} /> },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}>
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 90,
            backdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: '260px',
          backgroundColor: 'var(--color-bg-sidebar)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          transform: mobileMenuOpen ? 'translateX(0)' : undefined,
          transition: 'transform var(--transition-normal)',
        }}
        className={`rsg-sidebar ${mobileMenuOpen ? 'open' : ''}`}
      >
        {/* Brand / Logo Header */}
        <div
          style={{
            padding: '24px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-on-primary)',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <Shield size={24} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: 'var(--color-text)',
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                RSG PORTAL
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Region Security Guarding
              </span>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="mobile-close-btn"
            style={{
              display: 'none',
              color: 'var(--color-text-muted)',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav
          style={{
            flex: 1,
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            overflowY: 'auto',
          }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '11px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                backgroundColor: isActive ? 'var(--color-primary-muted)' : 'transparent',
                borderLeft: isActive ? '4px solid var(--color-primary)' : '4px solid transparent',
                transition: 'all var(--transition-fast)',
                textDecoration: 'none',
              })}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Card & Logout */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-darker)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text)',
              }}
            >
              <UserIcon size={18} />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name || 'Manager'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {user?.role === 'manager' || user?.managerial_access
                  ? 'Operations Manager'
                  : 'Supervisor'}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--color-danger)' }}
            leftIcon={<LogOut size={16} />}
            onClick={handleLogout}
          >
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          marginLeft: '260px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
        className="rsg-main-wrapper"
      >
        {/* Top Navbar */}
        <header
          style={{
            height: '64px',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-sidebar)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-hamburger-btn"
              style={{
                display: 'none',
                color: 'var(--color-text)',
                padding: '6px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <Menu size={22} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success)',
                  boxShadow: '0 0 8px var(--color-success)',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                RSG Live System Active
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
              }}
            >
              UTC Operational Clock
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main
          style={{
            flex: 1,
            padding: '28px',
            overflowY: 'auto',
            backgroundColor: 'var(--color-bg)',
          }}
        >
          <Outlet />
        </main>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        @media (max-width: 1024px) {
          .rsg-sidebar {
            transform: translateX(-100%);
          }
          .rsg-sidebar.open {
            transform: translateX(0);
          }
          .rsg-main-wrapper {
            margin-left: 0 !important;
          }
          .mobile-hamburger-btn {
            display: inline-flex !important;
          }
          .mobile-close-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
};
