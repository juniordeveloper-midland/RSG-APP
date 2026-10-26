import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Download,
  PlusCircle,
  LogOut,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Table } from '../components/common/Table';
import type { Column } from '../components/common/Table';
import { Modal } from '../components/common/Modal';
import { ErrorBanner } from '../components/common/ErrorBanner';

export const Attendance: React.FC = () => {
  const queryClient = useQueryClient();
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Manual attendance form states
  const [manualUserId, setManualUserId] = useState('');
  const [manualShiftId, setManualShiftId] = useState('');
  const [manualCheckIn, setManualCheckIn] = useState(new Date().toISOString().slice(0, 16));
  const [manualCheckOut, setManualCheckOut] = useState(
    new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [manualStatus, setManualStatus] = useState('present');
  const [manualNotes, setManualNotes] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Load branches & employees & shifts for dropdowns
  const { data: branchesData } = useQuery({
    queryKey: ['branchesList'],
    queryFn: () => api.getBranches({ limit: 100 }),
  });
  // Backend returns { items: [...], pagination: {...} }
  const allBranches = branchesData?.items ?? [];

  const { data: employeesData } = useQuery({
    queryKey: ['employeesListAll'],
    queryFn: () => api.getEmployees({ limit: 100 }),
  });
  const allEmployees = employeesData?.items ?? [];

  const { data: shiftsData } = useQuery({
    queryKey: ['shiftsListAll'],
    queryFn: () => api.getShifts({}),
  });
  const allShifts = shiftsData?.items ?? [];

  // Attendance query — backend returns { items: [...], pagination: {...} }
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['attendance', page, branchFilter, statusFilter, startDate, endDate],
    queryFn: () =>
      api.getAttendance({
        page,
        limit: 10,
        branch_id: branchFilter || undefined,
        status: statusFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
  });

  const attendanceList = data?.items ?? [];
  const pagination = data?.pagination;

  const manualMutation = useMutation({
    mutationFn: (body: any) => api.createManualAttendance(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setManualModalOpen(false);
      setManualError(null);
    },
    onError: (err: any) => setManualError(err.message),
  });

  const forceCheckoutMutation = useMutation({
    mutationFn: (id: string) => api.forceCheckout(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAttendance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setDeleteConfirmId(null);
    },
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUserId || !manualShiftId) {
      setManualError('Officer and Shift are required.');
      return;
    }
    setManualError(null);
    manualMutation.mutate({
      user_id: manualUserId,
      shift_id: manualShiftId,
      check_in_at: new Date(manualCheckIn).toISOString(),
      check_out_at: manualCheckOut ? new Date(manualCheckOut).toISOString() : undefined,
      status: manualStatus,
      notes: manualNotes,
      request_id: `manual-ui-${Date.now()}`,
    });
  };

  const handleExportExcel = () => {
    // Generate CSV / Excel from current view
    if (attendanceList.length === 0) {
      alert('No attendance records to export.');
      return;
    }
    const headers = ['Officer', 'Branch', 'Shift', 'Clock In', 'Clock Out', 'Hours', 'OT Hours', 'Lunch', 'Status'];
    const rows = attendanceList.map((r: any) => [
      r.user?.name || '',
      r.shift?.branch?.name || '',
      r.shift?.name || '',
      r.check_in_at ? new Date(r.check_in_at).toISOString() : '',
      r.check_out_at ? new Date(r.check_out_at).toISOString() : '',
      r.hours_worked ?? '',
      r.overtime_hours ?? '',
      r.lunch_deduction ?? 0,
      r.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e: any[]) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rsg-attendance-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const columns: Column<any>[] = [
    {
      key: 'officer',
      header: 'Officer',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.user?.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{row.user?.email}</div>
        </div>
      ),
    },
    {
      key: 'branch',
      header: 'Branch Hub',
      render: (row) => row.shift?.branch?.name || 'N/A',
    },
    {
      key: 'shift',
      header: 'Shift & Type',
      render: (row) => (
        <div>
          <div>{row.shift?.name || 'Unassigned Shift'}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
            {row.method} Check
          </div>
        </div>
      ),
    },
    {
      key: 'times',
      header: 'Clock In / Out (UTC)',
      render: (row) => (
        <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          <div>In: {row.check_in_at ? new Date(row.check_in_at).toLocaleString() : 'Pending'}</div>
          <div style={{ color: 'var(--color-text-muted)' }}>
            Out: {row.check_out_at ? new Date(row.check_out_at).toLocaleString() : 'Active'}
          </div>
        </div>
      ),
    },
    {
      key: 'payroll',
      header: 'Duration & Rules',
      render: (row) => (
        <div style={{ fontSize: '12px' }}>
          <div><strong>{row.hours_worked ? `${row.hours_worked}h` : '-'}</strong> worked</div>
          <div style={{ color: 'var(--color-text-muted)' }}>
            OT: {row.overtime_hours ? `${row.overtime_hours}h` : '0h'} • Lunch: {row.lunch_deduction || 0}m
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const statusMap: Record<string, string> = {
          checked_in: 'badge-info',
          present: 'badge-success',
          late: 'badge-warning',
          absent: 'badge-danger',
          half_day: 'badge-warning',
        };
        return <span className={`badge ${statusMap[row.status] || 'badge-neutral'}`}>{row.status}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {row.status === 'checked_in' && (
            <Button
              size="sm"
              variant="outline"
              style={{ color: 'var(--color-warning)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
              onClick={() => forceCheckoutMutation.mutate(row.id)}
              leftIcon={<LogOut size={13} />}
            >
              Force Out
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            style={{ color: 'var(--color-danger)' }}
            onClick={() => setDeleteConfirmId(row.id)}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ErrorBanner message={queryError ? (queryError as any).message : null} />
      {/* Header */}
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
            Attendance & Clock Records
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>
            5-minute clock rounding, automated lunch deduction, overtime calculation, and manual adjustments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            leftIcon={<Download size={16} />}
            onClick={handleExportExcel}
          >
            Export Sheet
          </Button>
          <Button
            variant="primary"
            leftIcon={<PlusCircle size={16} />}
            onClick={() => setManualModalOpen(true)}
          >
            Manual Entry
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            style={{
              height: '40px',
              backgroundColor: 'var(--color-bg-darker)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text)',
              padding: '0 12px',
              fontSize: '14px',
            }}
          >
            <option value="">All Branches</option>
            {allBranches.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              height: '40px',
              backgroundColor: 'var(--color-bg-darker)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text)',
              padding: '0 12px',
              fontSize: '14px',
            }}
          >
            <option value="">All Statuses</option>
            <option value="checked_in">Checked In (Active)</option>
            <option value="present">Present (Completed)</option>
            <option value="late">Late Arrival</option>
            <option value="absent">Absent</option>
          </select>

          <Input
            type="date"
            placeholder="From Date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />

          <Input
            type="date"
            placeholder="To Date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </Card>

      {/* Attendance Grid Table */}
      <Table
        columns={columns}
        data={attendanceList}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="No attendance records match your active query."
        pagination={
          pagination
            ? {
                currentPage: pagination.page,
                totalPages: pagination.totalPages,
                onPageChange: (p) => setPage(p),
              }
            : undefined
        }
      />

      {/* Manual Entry Modal */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Manual Attendance Entry (Audited)"
      >
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {manualError && (
            <div style={{ padding: '10px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              {manualError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Security Officer
            </label>
            <select
              value={manualUserId}
              onChange={(e) => setManualUserId(e.target.value)}
              required
              style={{
                height: '40px',
                backgroundColor: 'var(--color-bg-darker)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            >
              <option value="">Select Officer...</option>
              {allEmployees.map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.email})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Shift
            </label>
            <select
              value={manualShiftId}
              onChange={(e) => setManualShiftId(e.target.value)}
              required
              style={{
                height: '40px',
                backgroundColor: 'var(--color-bg-darker)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            >
              <option value="">Select Shift...</option>
              {allShifts.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.start_time} - {s.end_time})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Check In Time"
              type="datetime-local"
              value={manualCheckIn}
              onChange={(e) => setManualCheckIn(e.target.value)}
              required
            />
            <Input
              label="Check Out Time"
              type="datetime-local"
              value={manualCheckOut}
              onChange={(e) => setManualCheckOut(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Status
            </label>
            <select
              value={manualStatus}
              onChange={(e) => setManualStatus(e.target.value)}
              style={{
                height: '40px',
                backgroundColor: 'var(--color-bg-darker)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            >
              <option value="present">Present (Completed)</option>
              <option value="late">Late</option>
              <option value="half_day">Half Day</option>
              <option value="absent">Absent</option>
            </select>
          </div>

          <Input
            label="Manager Notes"
            placeholder="Reason for manual entry..."
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setManualModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={manualMutation.isPending}>
              Record Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Confirm Record Deletion"
        maxWidth="420px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>
            Are you sure you want to delete this attendance record? This action will be permanently recorded in the system audit logs.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
