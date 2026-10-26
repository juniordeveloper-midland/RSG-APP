import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, UserCheck, UserX, Shield, Edit2, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Table } from '../components/common/Table';
import type { Column } from '../components/common/Table';
import { Modal } from '../components/common/Modal';
import { ErrorBanner } from '../components/common/ErrorBanner';

export const Employees: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<any | null>(null);

  // Form states for Create Employee
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('GuardSecurePassword1!');
  const [idNumber, setIdNumber] = useState('');
  const [hourlyRate, setHourlyRate] = useState('15.50');
  const [monthlyHours, setMonthlyHours] = useState('160');
  const [branchId, setBranchId] = useState('');
  const [managerialAccess, setManagerialAccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: branchesData } = useQuery({
    queryKey: ['branchesListAll'],
    queryFn: () => api.getBranches({ limit: 100 }),
  });
  // Backend returns { items: [...], pagination: {...} }
  const allBranches = branchesData?.items ?? [];

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['employees', page, search, branchFilter, statusFilter],
    queryFn: () =>
      api.getEmployees({
        page,
        limit: 10,
        search,
        branch_id: branchFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  // Backend returns { items: [...], pagination: {...} }
  const employees = data?.items ?? [];
  const pagination = data?.pagination;

  const createMutation = useMutation({
    mutationFn: (newEmp: any) => api.createEmployee(newEmp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setCreateModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setIdNumber('');
      setFormError(null);
    },
    onError: (err: any) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEditEmployee(null);
    },
    onError: (err: any) => setFormError(err.message),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.updateEmployeeStatus(id, 'suspended'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.updateEmployeeStatus(id, 'active'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const managerialMutation = useMutation({
    mutationFn: ({ id, access }: { id: string; access: boolean }) =>
      api.setManagerialAccess(id, access),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 4) {
      setFormError('Employee name must be at least 4 characters');
      return;
    }
    setFormError(null);
    createMutation.mutate({
      name,
      email,
      phone,
      password,
      id_number: idNumber,
      hourly_rate: Number(hourlyRate),
      monthly_hours: Number(monthlyHours),
      branch_id: branchId || undefined,
      managerial_access: managerialAccess,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployee) return;
    updateMutation.mutate({
      id: editEmployee.id,
      data: {
        name: editEmployee.name,
        phone: editEmployee.phone,
        hourly_rate: Number(editEmployee.hourly_rate),
        monthly_hours: Number(editEmployee.monthly_hours),
        branch_id: editEmployee.branch_id || undefined,
      },
    });
  };

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Officer Profile',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{row.email}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{row.phone}</div>
        </div>
      ),
    },
    {
      key: 'branch',
      header: 'Assigned Branch',
      render: (row) => row.branch?.name || <span style={{ color: 'var(--color-text-dim)' }}>Unassigned</span>,
    },
    {
      key: 'id_number',
      header: 'SIA / NI License',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {row.id_number}
        </span>
      ),
    },
    {
      key: 'rates',
      header: 'Rate & Contract',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>£{Number(row.hourly_rate || 0).toFixed(2)}/hr</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {row.monthly_hours} hrs/month
          </div>
        </div>
      ),
    },
    {
      key: 'managerial_access',
      header: 'Privileges',
      render: (row) => (
        <div>
          {row.managerial_access || row.role === 'manager' ? (
            <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={12} /> Manager
            </span>
          ) : (
            <span className="badge badge-neutral">Security Guard</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditEmployee({ ...row })}
            leftIcon={<Edit2 size={13} />}
          >
            Edit
          </Button>

          {row.status === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              onClick={() => suspendMutation.mutate(row.id)}
              leftIcon={<UserX size={13} />}
            >
              Suspend
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              style={{ color: 'var(--color-success)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
              onClick={() => activateMutation.mutate(row.id)}
              leftIcon={<UserCheck size={13} />}
            >
              Activate
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            style={{ fontSize: '12px' }}
            onClick={() =>
              managerialMutation.mutate({
                id: row.id,
                access: !row.managerial_access,
              })
            }
          >
            {row.managerial_access ? 'Revoke Mgr' : 'Grant Mgr'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ErrorBanner message={queryError ? (queryError as any).message : null} />
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
            Workforce & Security Personnel
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>
            Manage officers, SIA licenses, contracted hours, and managerial credentials.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => setCreateModalOpen(true)}
        >
          Enrol Security Officer
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '220px' }}>
            <Input
              placeholder="Search by name, email, or SIA number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search size={16} />}
            />
          </div>

          <div style={{ flex: 1, minWidth: '180px' }}>
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
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

          <div style={{ flex: 1, minWidth: '150px' }}>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
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
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Employees Table */}
      <Table
        columns={columns}
        data={employees}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="No employees found matching the given filters."
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

      {/* Create Employee Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Enrol Security Officer"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {formError && (
            <div style={{ padding: '10px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              {formError}
            </div>
          )}

          <Input
            label="Full Name (min 4 characters)"
            placeholder="e.g. Johnathan Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Email Address"
              type="email"
              placeholder="guard@region.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Phone Number"
              placeholder="+44 7700 900123"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Default Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              label="SIA / NI License Number"
              placeholder="SIA-12345678"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Hourly Rate (£)"
              type="number"
              step="0.5"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              required
            />
            <Input
              label="Contract Monthly Hours"
              type="number"
              value={monthlyHours}
              onChange={(e) => setMonthlyHours(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Assigned Branch
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
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
              <option value="">Unassigned</option>
              {allBranches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <input
              type="checkbox"
              id="mgrAccess"
              checked={managerialAccess}
              onChange={(e) => setManagerialAccess(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
            />
            <label htmlFor="mgrAccess" style={{ fontSize: '13px', color: 'var(--color-text)' }}>
              Grant Managerial Access (Can access management portal & routes)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Enrol Officer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={!!editEmployee}
        onClose={() => setEditEmployee(null)}
        title={`Edit Officer: ${editEmployee?.name}`}
      >
        {editEmployee && (
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Input
              label="Full Name"
              value={editEmployee.name}
              onChange={(e) => setEditEmployee({ ...editEmployee, name: e.target.value })}
              required
            />
            <Input
              label="Phone"
              value={editEmployee.phone}
              onChange={(e) => setEditEmployee({ ...editEmployee, phone: e.target.value })}
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Hourly Rate (£)"
                type="number"
                step="0.5"
                value={editEmployee.hourly_rate}
                onChange={(e) => setEditEmployee({ ...editEmployee, hourly_rate: e.target.value })}
                required
              />
              <Input
                label="Monthly Hours"
                type="number"
                value={editEmployee.monthly_hours}
                onChange={(e) => setEditEmployee({ ...editEmployee, monthly_hours: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <Button type="button" variant="secondary" onClick={() => setEditEmployee(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
