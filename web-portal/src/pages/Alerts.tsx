import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Eye,
  CheckCheck,
  Building2,
} from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Table } from '../components/common/Table';
import type { Column } from '../components/common/Table';
import { ErrorBanner } from '../components/common/ErrorBanner';

export const Alerts: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'open' | 'acknowledged' | 'resolved' | ''>('open');
  const [branchFilter, setBranchFilter] = useState('');

  // Load branches
  const { data: branchesData } = useQuery({
    queryKey: ['branchesList'],
    queryFn: () => api.getBranches({ limit: 100 }),
  });
  // Backend returns { items: [...], pagination: {...} }
  const allBranches = branchesData?.items ?? [];

  // Alerts query — backend returns a raw array
  const { data: alerts = [], isLoading, error: queryError } = useQuery({
    queryKey: ['alertsQueue', statusFilter, branchFilter],
    queryFn: () =>
      api.getAlerts({
        branch_id: branchFilter || undefined,
        status: statusFilter || undefined,
      }),
    refetchInterval: 10000, // Live poll every 10s
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'acknowledged' | 'resolved' }) =>
      api.updateAlertStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertsQueue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });

  const columns: Column<any>[] = [
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => {
        const severityClass: Record<string, string> = {
          critical: 'badge-danger',
          high: 'badge-danger',
          medium: 'badge-warning',
          low: 'badge-info',
        };
        return (
          <span className={`badge ${severityClass[row.severity] || 'badge-neutral'}`}>
            {row.severity}
          </span>
        );
      },
    },
    {
      key: 'type',
      header: 'Alert Type',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={16} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 600 }}>{row.type?.replace('_', ' ').toUpperCase()}</span>
        </div>
      ),
    },
    {
      key: 'message',
      header: 'Incident Description',
      render: (row) => (
        <div style={{ maxWidth: '450px', fontSize: '13px', lineHeight: 1.4 }}>
          <div>{row.message}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '2px' }}>
            Site: {row.branch?.name || 'General Operations'}
          </div>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Detected Time',
      render: (row) => (
        <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          <div>{new Date(row.created_at).toLocaleTimeString()}</div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '11px' }}>
            {new Date(row.created_at).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Resolution Status',
      render: (row) => {
        const statusMap: Record<string, string> = {
          open: 'badge-danger',
          acknowledged: 'badge-warning',
          resolved: 'badge-success',
        };
        return <span className={`badge ${statusMap[row.status] || 'badge-neutral'}`}>{row.status}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Triage Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {row.status === 'open' && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Eye size={13} />}
              onClick={() => updateStatusMutation.mutate({ id: row.id, status: 'acknowledged' })}
            >
              Acknowledge
            </Button>
          )}

          {row.status !== 'resolved' && (
            <Button
              size="sm"
              variant="outline"
              style={{ color: 'var(--color-success)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
              leftIcon={<CheckCheck size={13} />}
              onClick={() => updateStatusMutation.mutate({ id: row.id, status: 'resolved' })}
            >
              Resolve
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ErrorBanner message={queryError ? (queryError as any).message : null} />
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0' }}>
          Operations & Safety Alerts Queue
        </h1>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>
          Triage missed patrol checkpoints, geofence breaches, panic triggers, and system anomalies.
        </p>
      </div>

      {/* Filter Tabs & Branch Filter */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['open', 'acknowledged', 'resolved', ''] as const).map((st) => (
              <Button
                key={st || 'all'}
                size="sm"
                variant={statusFilter === st ? 'primary' : 'secondary'}
                onClick={() => setStatusFilter(st)}
              >
                {st ? st.toUpperCase() : 'ALL ALERTS'}
              </Button>
            ))}
          </div>

          <div style={{ width: '240px' }}>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: 'var(--color-bg-darker)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                padding: '0 12px',
                fontSize: '13px',
              }}
            >
              <option value="">All Branches</option>
              {allBranches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Alerts Table */}
      <Table
        columns={columns}
        data={alerts}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="No operational alerts found for this queue selection."
      />
    </div>
  );
};
