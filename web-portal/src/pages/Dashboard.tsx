import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  AlertTriangle,
  QrCode,
  ShieldAlert,
  ArrowRight,
  MapPin,
  CalendarDays,
  PlusCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Table } from '../components/common/Table';
import type { Column } from '../components/common/Table';
import { ErrorBanner } from '../components/common/ErrorBanner';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading, refetch, error: statsError } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 15000, // Live poll every 15s
  });

  const activeEmployees = stats?.activeEmployees ?? [];
  const recentAlerts = stats?.recentAlerts ?? [];

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Officer',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.user?.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{row.user?.email}</div>
        </div>
      ),
    },
    {
      key: 'branch',
      header: 'Branch Hub',
      render: (row) => row.shift?.branch?.name || 'Main Branch',
    },
    {
      key: 'shift',
      header: 'Assigned Shift',
      render: (row) => (
        <div>
          <div>{row.shift?.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
            {row.shift?.start_time} - {row.shift?.end_time}
          </div>
        </div>
      ),
    },
    {
      key: 'check_in_at',
      header: 'Clock In (UTC)',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {row.check_in_at ? new Date(row.check_in_at).toLocaleTimeString() : 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: () => <span className="badge badge-success">On Duty</span>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <ErrorBanner message={statsError ? (statsError as any).message : null} />
      {/* Top Banner & Quick Actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0' }}>
            Operational Command Centre
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>
            Real-time guard attendance, geofencing status, and patrol monitoring.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            leftIcon={<MapPin size={16} />}
            onClick={() => navigate('/live-map')}
          >
            Live Map
          </Button>
          <Button
            variant="secondary"
            leftIcon={<CalendarDays size={16} />}
            onClick={() => navigate('/shifts')}
          >
            Assign Shift
          </Button>
          <Button
            variant="primary"
            leftIcon={<PlusCircle size={16} />}
            onClick={() => navigate('/attendance')}
          >
            Manual Attendance
          </Button>
        </div>
      </div>

      {/* 5 Core Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {/* On Duty */}
        <Card style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                ON DUTY NOW
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>
                {isLoading ? '-' : stats?.onDutyCount ?? 0}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-success-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-success)',
              }}
            >
              <Users size={22} />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-success)' }}>
            Active verified shifts
          </div>
        </Card>

        {/* Late Arrivals */}
        <Card style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                LATE TODAY
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>
                {isLoading ? '-' : stats?.lateCount ?? 0}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-warning-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-warning)',
              }}
            >
              <Clock size={22} />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-warning)' }}>
            Past scheduled start time
          </div>
        </Card>

        {/* Absent */}
        <Card style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                ABSENT GUARDS
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>
                {isLoading ? '-' : stats?.absentCount ?? 0}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-danger-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-danger)',
              }}
            >
              <AlertTriangle size={22} />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-danger)' }}>
            Flagged by auto-absent cron
          </div>
        </Card>

        {/* Missed Patrols */}
        <Card style={{ borderLeft: '4px solid #f97316' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                MISSED PATROLS
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>
                {isLoading ? '-' : stats?.missedPatrolsCount ?? 0}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f97316',
              }}
            >
              <QrCode size={22} />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#f97316' }}>
            Overdue checkpoint intervals
          </div>
        </Card>

        {/* Open Alerts */}
        <Card style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                OPEN ALERTS
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                {isLoading ? '-' : stats?.openAlertsCount ?? 0}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <ShieldAlert size={22} />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Awaiting manager action
          </div>
        </Card>
      </div>

      {/* Main Grid: On-Duty Active Guards & Alerts Queue */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Active Checked-in Guards */}
        <Card
          title="On-Duty Guard Roster"
          subtitle="Currently verified at branch posts"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/attendance')}
              rightIcon={<ArrowRight size={14} />}
            >
              View Grid
            </Button>
          }
        >
          <Table
            columns={columns}
            data={activeEmployees}
            keyExtractor={(item) => item.id}
            isLoading={isLoading}
            emptyMessage="No security guards currently clocked into an active shift."
          />
        </Card>

        {/* Urgent Operations Alerts */}
        <Card
          title="Urgent Alerts Queue"
          subtitle="Missed patrols, geofence breaches & panics"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/alerts')}
              rightIcon={<ArrowRight size={14} />}
            >
              All Alerts
            </Button>
          }
        >
          {recentAlerts.length === 0 ? (
            <div
              style={{
                padding: '40px 16px',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
              }}
            >
              <div style={{ color: 'var(--color-success)', marginBottom: '8px', fontWeight: 600 }}>
                ✓ All Clear
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-dim)' }}>
                No active operational alerts or missed patrols detected.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentAlerts.map((alert: any) => (
                <div
                  key={alert.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-darker)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        className={`badge ${
                          alert.severity === 'critical' || alert.severity === 'high'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                        {alert.type?.replace('_', ' ').toUpperCase()}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                        • {alert.branch?.name || 'Branch Hub'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {alert.message}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await api.updateAlertStatus(alert.id, 'acknowledged');
                      refetch();
                    }}
                  >
                    Ack
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
