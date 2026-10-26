import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Calendar,
  Clock,
  UserCheck,
  FileSpreadsheet,
  Download,
  Upload,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Table } from '../components/common/Table';
import type { Column } from '../components/common/Table';
import { Modal } from '../components/common/Modal';
import { ErrorBanner } from '../components/common/ErrorBanner';

export const Shifts: React.FC = () => {
  const queryClient = useQueryClient();
  const [branchFilter, setBranchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalShift, setAssignModalShift] = useState<any | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Form states for Shift Creation
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [checkType, setCheckType] = useState('gps');
  const [overtimeEnabled, setOvertimeEnabled] = useState(true);
  const [overtimeLimit, setOvertimeLimit] = useState('4');
  const [lunchDeduction, setLunchDeduction] = useState('30');
  const [shiftFormError, setShiftFormError] = useState<string | null>(null);

  // Form states for Shift Assignment
  const [assignType, setAssignType] = useState<'single' | 'all'>('single');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Excel import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Fetch branches and employees for selectors
  const { data: branchesData } = useQuery({
    queryKey: ['branchesList'],
    queryFn: () => api.getBranches({ limit: 100 }),
  });
  const allBranches = branchesData?.items ?? [];

  const { data: employeesData } = useQuery({
    queryKey: ['employeesList', assignModalShift?.branch_id],
    queryFn: () =>
      api.getEmployees({
        branch_id: assignModalShift?.branch_id || undefined,
        status: 'active',
        limit: 100,
      }),
    enabled: !!assignModalShift,
  });
  const branchEmployees = employeesData?.items ?? [];

  // Shifts list query — backend returns { items: [...], pagination: {...} }
  const { data: shiftsData, isLoading, error: shiftsError } = useQuery({
    queryKey: ['shifts', branchFilter, search],
    queryFn: () =>
      api.getShifts({
        branch_id: branchFilter || undefined,
        search: search || undefined,
      }),
  });
  const shifts = shiftsData?.items ?? [];

  const createShiftMutation = useMutation({
    mutationFn: (newShift: any) => api.createShift(newShift),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setCreateModalOpen(false);
      setName('');
      setShiftFormError(null);
    },
    onError: (err: any) => setShiftFormError(err.message),
  });

  const assignMutation = useMutation({
    mutationFn: ({ shiftId, data }: { shiftId: string; data: any }) =>
      api.assignShift(shiftId, data),
    onSuccess: (res: any) => {
      setAssignSuccess(
        `Shift successfully assigned to ${res.assignedCount || 1} guard(s). Notification created.`
      );
      setAssignError(null);
      setTimeout(() => {
        setAssignModalShift(null);
        setAssignSuccess(null);
      }, 2000);
    },
    onError: (err: any) => {
      setAssignError(err.message);
      setAssignSuccess(null);
    },
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => api.disableShift(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts'] }),
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => api.enableShift(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts'] }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => api.importShiftsExcel(file),
    onSuccess: (data: any) => {
      setImportReport(data);
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: any) => setImportError(err.message),
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      setShiftFormError('Please select an operational branch');
      return;
    }
    setShiftFormError(null);
    createShiftMutation.mutate({
      name,
      branch_id: branchId,
      start_time: startTime,
      end_time: endTime,
      check_type: checkType,
      overtime_enabled: overtimeEnabled,
      overtime_limit_hours: overtimeEnabled ? Number(overtimeLimit) : 0,
      lunch_deduction_minutes: Number(lunchDeduction),
      is_active: true,
    });
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalShift) return;
    setAssignError(null);
    setAssignSuccess(null);

    const payload: any = {
      start_date: startDate,
      end_date: endDate,
    };

    if (assignType === 'all') {
      payload.assign_all_branch = true;
    } else {
      if (!selectedUserId) {
        setAssignError('Please select a guard');
        return;
      }
      payload.user_id = selectedUserId;
    }

    assignMutation.mutate({
      shiftId: assignModalShift.id,
      data: payload,
    });
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await api.downloadShiftTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rsg-shifts-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Shift Name & Site',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
            {row.branch?.name}
          </div>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Time Window',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px' }}>
            {row.start_time} - {row.end_time}
          </span>
        </div>
      ),
    },
    {
      key: 'rules',
      header: 'Rules & Check Type',
      render: (row) => (
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          <div>Method: <span style={{ textTransform: 'uppercase', color: 'var(--color-text)' }}>{row.check_type}</span></div>
          <div>Lunch: {row.lunch_deduction_minutes}m • OT: {row.overtime_enabled ? `${row.overtime_limit_hours}h max` : 'Disabled'}</div>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span className={`badge ${row.is_active ? 'badge-success' : 'badge-danger'}`}>
          {row.is_active ? 'Active' : 'Disabled'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setAssignModalShift(row);
              setAssignError(null);
              setAssignSuccess(null);
            }}
            leftIcon={<UserCheck size={14} />}
          >
            Assign
          </Button>

          {row.is_active ? (
            <Button
              size="sm"
              variant="outline"
              style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              onClick={() => disableMutation.mutate(row.id)}
              leftIcon={<Ban size={13} />}
            >
              Disable
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              style={{ color: 'var(--color-success)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
              onClick={() => enableMutation.mutate(row.id)}
              leftIcon={<CheckCircle2 size={13} />}
            >
              Enable
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ErrorBanner message={shiftsError ? (shiftsError as any).message : null} />
      {/* Page Header */}
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
            Shifts & Rota Scheduling
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>
            Create operational shifts, assign guards, detect overlaps, and import rosters via Excel.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            leftIcon={<FileSpreadsheet size={16} />}
            onClick={() => setImportModalOpen(true)}
          >
            Import Excel
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Shift
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '220px' }}>
            <Input
              placeholder="Search shifts by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ flex: 1, minWidth: '180px' }}>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              style={{
                width: '100%',
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
          </div>
        </div>
      </Card>

      {/* Shifts Table */}
      <Table
        columns={columns}
        data={shifts}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="No shifts found. Click 'Create Shift' to set up your rota."
      />

      {/* Create Shift Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Operational Shift"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {shiftFormError && (
            <div style={{ padding: '10px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              {shiftFormError}
            </div>
          )}

          <Input
            label="Shift Name"
            placeholder="e.g. Night Gate Patrol 8h"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Operational Branch
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              style={{
                width: '100%',
                height: '40px',
                backgroundColor: 'var(--color-bg-darker)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            >
              <option value="">Select Branch...</option>
              {allBranches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Start Time (HH:mm)"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
            <Input
              label="End Time (HH:mm)"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Check-In Type
              </label>
              <select
                value={checkType}
                onChange={(e) => setCheckType(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  backgroundColor: 'var(--color-bg-darker)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              >
                <option value="gps">GPS Geofence</option>
                <option value="qr">QR Code Checkpoint</option>
                <option value="manual">Manual Entry Only</option>
              </select>
            </div>

            <Input
              label="Lunch Deduction (min)"
              type="number"
              value={lunchDeduction}
              onChange={(e) => setLunchDeduction(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="otEnabled"
              checked={overtimeEnabled}
              onChange={(e) => setOvertimeEnabled(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
            />
            <label htmlFor="otEnabled" style={{ fontSize: '13px', color: 'var(--color-text)' }}>
              Overtime Enabled
            </label>
          </div>

          {overtimeEnabled && (
            <Input
              label="Overtime Limit (1-50 Hours)"
              type="number"
              min="1"
              max="50"
              value={overtimeLimit}
              onChange={(e) => setOvertimeLimit(e.target.value)}
              required
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createShiftMutation.isPending}>
              Create Shift
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Shift Modal */}
      <Modal
        isOpen={!!assignModalShift}
        onClose={() => setAssignModalShift(null)}
        title={`Assign Shift: ${assignModalShift?.name}`}
      >
        <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {assignError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              <AlertTriangle size={16} />
              <span>{assignError}</span>
            </div>
          )}

          {assignSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              <CheckCircle2 size={16} />
              <span>{assignSuccess}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              type="button"
              variant={assignType === 'single' ? 'primary' : 'secondary'}
              size="sm"
              style={{ flex: 1 }}
              onClick={() => setAssignType('single')}
            >
              Single Officer
            </Button>
            <Button
              type="button"
              variant={assignType === 'all' ? 'primary' : 'secondary'}
              size="sm"
              style={{ flex: 1 }}
              onClick={() => setAssignType('all')}
            >
              All Branch Officers
            </Button>
          </div>

          {assignType === 'single' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Select Officer ({assignModalShift?.branch?.name})
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                style={{
                  width: '100%',
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
                {branchEmployees.map((e: any) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ padding: '12px', backgroundColor: 'var(--color-bg-darker)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Will assign this shift to all {branchEmployees.length} active guards at branch <strong>{assignModalShift?.branch?.name}</strong>.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setAssignModalShift(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={assignMutation.isPending}>
              Confirm Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Excel Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setImportReport(null);
          setImportError(null);
        }}
        title="Import Rota from Excel (.xlsx)"
        maxWidth="600px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-bg-darker)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Download Demo Template</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Pre-formatted workbook with valid column headers
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Download size={14} />}
              onClick={handleDownloadTemplate}
            >
              Template (.xlsx)
            </Button>
          </div>

          <div
            style={{
              border: '2px dashed var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px 16px',
              textAlign: 'center',
            }}
          >
            <Upload size={32} style={{ color: 'var(--color-primary)', margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Choose your .xlsx spreadsheet</div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              style={{ marginTop: '8px' }}
            />
          </div>

          {importError && (
            <div style={{ padding: '10px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              {importError}
            </div>
          )}

          {importReport && (
            <div style={{ padding: '16px', backgroundColor: 'var(--color-bg-darker)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--color-success)' }}>
                Import Completed: {importReport.importedCount} created / {importReport.failedCount} failed
              </div>
              {importReport.errors?.length > 0 && (
                <div style={{ marginTop: '8px', color: 'var(--color-danger)' }}>
                  <strong>Errors report:</strong>
                  {importReport.errors.map((err: any, idx: number) => (
                    <div key={idx} style={{ marginTop: '4px', fontSize: '12px' }}>
                      Row {err.row}: {err.errors.join(', ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setImportModalOpen(false);
                setImportReport(null);
                setImportError(null);
              }}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!selectedFile}
              isLoading={importMutation.isPending}
              onClick={() => selectedFile && importMutation.mutate(selectedFile)}
            >
              Upload & Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
