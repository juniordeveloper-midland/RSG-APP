import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  UserCheck,
  UserX,
  Shield,
  Edit2,
  Eye,
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  Briefcase,
  User,
  FileText,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Table } from '../components/common/Table';
import type { Column } from '../components/common/Table';
import { Modal } from '../components/common/Modal';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { PhotoUploadBox } from '../components/common/PhotoUploadBox';
import { DocumentUploadBox, type EmployeeDocumentItem } from '../components/common/DocumentUploadBox';
import { getExpiryInfo } from '../utils/date';

export const Employees: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<any | null>(null);
  const [viewEmployee, setViewEmployee] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Create Form State ───────────────────────────────────────────────────────
  // 1. Personal Details
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [documents, setDocuments] = useState<EmployeeDocumentItem[]>([]);

  // 2. General Information
  const [username, setUsername] = useState('');
  const [position, setPosition] = useState('');

  // 3. Operational Details
  const [payRate, setPayRate] = useState('15.50');
  const [weeklyWorkingHours, setWeeklyWorkingHours] = useState('40');
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [brpExpiryDate, setBrpExpiryDate] = useState('');
  const [licenceExpiryDate, setLicenceExpiryDate] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [managerialAccess, setManagerialAccess] = useState(false);

  // ─── Edit Form State ─────────────────────────────────────────────────────────
  const [editData, setEditData] = useState<any>({});
  const [editPassword, setEditPassword] = useState('');
  const [editDocuments, setEditDocuments] = useState<EmployeeDocumentItem[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: clientsData } = useQuery({
    queryKey: ['clientsListAll'],
    queryFn: () => api.getClients({ limit: 100 }),
  });
  const allClients = clientsData?.items ?? [];

  // Branches list for filtering and branch dropdowns
  const { data: allBranchesData } = useQuery({
    queryKey: ['allBranchesList'],
    queryFn: () => api.getBranches({ limit: 100 }),
  });
  const allBranches = allBranchesData?.items ?? [];

  // Cascading branches for Create Modal
  const createBranches = companyId
    ? allBranches.filter((b: any) => b.client_id === companyId)
    : [];

  // Cascading branches for Edit Modal
  const editBranches = editData?.client_id
    ? allBranches.filter((b: any) => b.client_id === editData.client_id)
    : [];

  // Query employees
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['employees', page, search, branchFilter, clientFilter, statusFilter],
    queryFn: () =>
      api.getEmployees({
        page,
        limit: 10,
        search,
        branch_id: branchFilter || undefined,
        status: statusFilter || undefined,
      }),
  });
  const employees = data?.items ?? [];
  const pagination = data?.pagination;

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (newEmp: any) => api.createEmployee(newEmp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setCreateModalOpen(false);
      resetCreateForm();
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create employee'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEditEmployee(null);
      setEditError(null);
    },
    onError: (err: any) => setEditError(err.message || 'Failed to update employee'),
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

  const resetCreateForm = () => {
    setPhotoUrl(null);
    setName('');
    setEmail('');
    setPhone('');
    setDateOfBirth('');
    setPassword('');
    setAddress('');
    setDocuments([]);
    setUsername('');
    setPosition('');
    setPayRate('15.50');
    setWeeklyWorkingHours('40');
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setBrpExpiryDate('');
    setLicenceExpiryDate('');
    setLicenceNumber('');
    setCompanyId('');
    setBranchId('');
    setManagerialAccess(false);
    setFormError(null);
  };

  // ─── Validation ─────────────────────────────────────────────────────────────
  // All fields are required except BRP expiry date and documents.
  const isCreateFormValid = Boolean(
    photoUrl &&
    name.trim().length >= 4 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    phone.trim().length >= 5 &&
    dateOfBirth.trim() &&
    password.trim().length >= 8 &&
    address.trim() &&
    username.trim().length >= 3 &&
    position.trim() &&
    Number(payRate) > 0 &&
    Number(weeklyWorkingHours) > 0 &&
    joiningDate.trim() &&
    licenceExpiryDate.trim() &&
    licenceNumber.trim() &&
    companyId.trim() &&
    branchId.trim()
  );

  const isEditFormValid = Boolean(
    editData &&
    editData.photo_url &&
    editData.name?.trim()?.length >= 4 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editData.email?.trim() || '') &&
    editData.phone?.trim()?.length >= 5 &&
    editData.date_of_birth?.trim() &&
    (!editPassword || editPassword.trim().length >= 8) &&
    editData.address?.trim() &&
    editData.username?.trim()?.length >= 3 &&
    editData.position?.trim() &&
    Number(editData.pay_rate) > 0 &&
    Number(editData.weekly_working_hours) > 0 &&
    editData.joining_date?.trim() &&
    editData.licence_expiry_date?.trim() &&
    editData.licence_number?.trim() &&
    editData.client_id?.trim() &&
    editData.branch_id?.trim()
  );

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreateFormValid) return;
    setFormError(null);

    createMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      date_of_birth: dateOfBirth,
      password: password.trim(),
      address: address.trim(),
      photo_url: photoUrl,
      profile_image: photoUrl,
      documents,
      username: username.trim(),
      position: position.trim(),
      pay_rate: Number(payRate),
      hourly_rate: Number(payRate),
      weekly_working_hours: Number(weeklyWorkingHours),
      weekly_hours: Number(weeklyWorkingHours),
      joining_date: joiningDate,
      brp_expiry_date: brpExpiryDate ? brpExpiryDate : null,
      licence_expiry_date: licenceExpiryDate,
      licence_number: licenceNumber.trim(),
      client_id: companyId,
      branch_id: branchId,
      managerial_access: managerialAccess,
    });
  };

  const openEditModal = (row: any) => {
    setEditEmployee(row);
    setEditData({
      ...row,
      pay_rate: row.pay_rate ?? (row.hourly_rate ? Number(row.hourly_rate) : ''),
      weekly_working_hours: row.weekly_working_hours ?? row.weekly_hours ?? '',
      photo_url: row.profile_image || row.photo_url || '',
      client_id: row.client_id || row.client?.id || '',
      branch_id: row.branch_id || row.branch?.id || '',
    });
    setEditDocuments(row.documents || []);
    setEditPassword('');
    setEditError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployee || !isEditFormValid) return;
    setEditError(null);

    const payload: any = {
      name: editData.name?.trim(),
      email: editData.email?.trim(),
      phone: editData.phone?.trim(),
      date_of_birth: editData.date_of_birth,
      address: editData.address?.trim(),
      photo_url: editData.photo_url,
      profile_image: editData.photo_url,
      username: editData.username?.trim(),
      position: editData.position?.trim(),
      pay_rate: Number(editData.pay_rate),
      hourly_rate: Number(editData.pay_rate),
      weekly_working_hours: Number(editData.weekly_working_hours),
      weekly_hours: Number(editData.weekly_working_hours),
      joining_date: editData.joining_date,
      brp_expiry_date: editData.brp_expiry_date || null,
      licence_expiry_date: editData.licence_expiry_date,
      licence_number: editData.licence_number?.trim(),
      client_id: editData.client_id,
      branch_id: editData.branch_id,
      documents: editDocuments,
    };

    if (editPassword && editPassword.trim().length >= 8) {
      payload.password = editPassword.trim();
    }

    updateMutation.mutate({ id: editEmployee.id, data: payload });
  };

  // ─── Table Columns ──────────────────────────────────────────────────────────
  const columns: Column<any>[] = [
    {
      key: 'profile',
      header: 'Officer Profile',
      render: (row) => {
        const photo = row.profile_image || row.photo_url;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Round Avatar / Profile Picture */}
            <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }}>
              {photo ? (
                <img
                  src={photo}
                  alt={row.name}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--color-primary)',
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(235, 5, 5, 0.15)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '16px',
                  }}
                >
                  {row.name?.charAt(0) || <User size={20} />}
                </div>
              )}
            </div>

            <div>
              <div
                onClick={() => navigate(`/employees/${row.id}`)}
                style={{
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-text)';
                }}
              >
                {row.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                @{row.username || 'guard'} • {row.email}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>{row.phone}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'position',
      header: 'Position & Role',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '13px' }}>
            {row.position || 'Security Officer'}
          </div>
          <div style={{ marginTop: '4px' }}>
            {row.managerial_access || row.role === 'manager' ? (
              <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                <Shield size={11} /> Manager
              </span>
            ) : (
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>Guard</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'company_branch',
      header: 'Company & Branch',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Building2 size={13} />
            <span>{row.client?.name || 'Region Security Guarding'}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {row.branch?.name || <span style={{ color: 'var(--color-text-dim)' }}>Unassigned</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'rates',
      header: 'Rate & Hours',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>
            £{Number(row.pay_rate ?? row.hourly_rate ?? 0).toFixed(2)}/hr
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {row.weekly_working_hours ?? row.weekly_hours ?? 40} hrs/week
          </div>
        </div>
      ),
    },
    {
      key: 'expiries',
      header: 'Licence & BRP Expiry',
      render: (row) => {
        const licenceExp = getExpiryInfo(row.licence_expiry_date);
        const brpExp = getExpiryInfo(row.brp_expiry_date);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {/* Licence Expiry */}
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--color-text-dim)', fontSize: '11px' }}>Lic: </span>
              {licenceExp.isRed ? (
                <span
                  style={{
                    color: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <AlertTriangle size={11} /> {licenceExp.text}
                </span>
              ) : (
                <span style={{ color: 'var(--color-text)' }}>{licenceExp.text}</span>
              )}
            </div>

            {/* BRP Expiry (if present) */}
            {row.brp_expiry_date && (
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-dim)', fontSize: '11px' }}>BRP: </span>
                {brpExp.isRed ? (
                  <span
                    style={{
                      color: '#ef4444',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <AlertTriangle size={11} /> {brpExp.text}
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-text)' }}>{brpExp.text}</span>
                )}
              </div>
            )}
          </div>
        );
      },
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
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/employees/${row.id}`)}
            title="View Full Profile"
          >
            <Eye size={14} />
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => openEditModal(row)}
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
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
            Workforce & Security Personnel
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>
            Manage officers, credentials, SIA licences, BRP expiries, and assigned branches.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => {
            resetCreateForm();
            setCreateModalOpen(true);
          }}
        >
          Add Employee
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '220px' }}>
            <Input
              placeholder="Search by name, email, username, position, or SIA number..."
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
        emptyMessage="No security personnel found matching the specified filters."
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

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Add Employee Modal (3 Structured Sections)                                 */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add New Security Officer"
        maxWidth="780px"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {formError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              {formError}
            </div>
          )}

          {/* Section 1: Personal Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--color-primary)',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '6px',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              1. Personal Details
            </h3>

            {/* Profile Image Upload Box (Round preview, JPG or PNG up to 2 MB) */}
            <PhotoUploadBox
              label="Profile Picture (Round Preview, JPG or PNG up to 2 MB) *"
              photoUrl={photoUrl}
              onPhotoChange={(url) => setPhotoUrl(url)}
              uploadFn={api.uploadEmployeePhoto}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Full Name (min 4 characters) *"
                placeholder="e.g. Johnathan Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Email Address *"
                type="email"
                placeholder="guard@region.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Phone Number *"
                placeholder="+44 7700 900123"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Input
                label="Date of Birth *"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </div>

            <Input
              label="Password (min 8 characters) *"
              type="password"
              placeholder="Secure password for mobile & portal login"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Input
              label="Residential Address *"
              placeholder="e.g. 12 High Street, Birmingham, B1 1AA"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />

            {/* Employee Documents Upload (upload many files, show list with remove button) */}
            <DocumentUploadBox
              label="Employee Documents (Upload many files, PDF/JPG/PNG up to 5 MB each)"
              documents={documents}
              onChange={(docs) => setDocuments(docs)}
            />
          </div>

          {/* Section 2: General Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--color-primary)',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '6px',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              2. General Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Username (Unique, min 3 chars) *"
                placeholder="e.g. jsmith26"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <Input
                label="Position / Designation *"
                placeholder="e.g. Security Guard / Patrol Officer"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Section 3: Operational Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--color-primary)',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '6px',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              3. Operational Details
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Pay Rate (£/hr) *"
                type="number"
                step="0.25"
                min="1"
                placeholder="15.50"
                value={payRate}
                onChange={(e) => setPayRate(e.target.value)}
                required
              />
              <Input
                label="Weekly Working Hours *"
                type="number"
                step="1"
                min="1"
                placeholder="40"
                value={weeklyWorkingHours}
                onChange={(e) => setWeeklyWorkingHours(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Joining Date *"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                required
              />
              <Input
                label="Licence Number *"
                placeholder="e.g. 1000123456789012"
                value={licenceNumber}
                onChange={(e) => setLicenceNumber(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <Input
                  label="Licence Expiry Date *"
                  type="date"
                  value={licenceExpiryDate}
                  onChange={(e) => setLicenceExpiryDate(e.target.value)}
                  required
                />
                {licenceExpiryDate && getExpiryInfo(licenceExpiryDate).isRed && (
                  <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>
                    <AlertTriangle size={11} style={{ display: 'inline', marginRight: '3px' }} />
                    {getExpiryInfo(licenceExpiryDate).text}
                  </div>
                )}
              </div>

              <div>
                <Input
                  label="BRP Expiry Date (Optional)"
                  type="date"
                  value={brpExpiryDate}
                  onChange={(e) => setBrpExpiryDate(e.target.value)}
                />
                {brpExpiryDate && getExpiryInfo(brpExpiryDate).isRed && (
                  <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>
                    <AlertTriangle size={11} style={{ display: 'inline', marginRight: '3px' }} />
                    {getExpiryInfo(brpExpiryDate).text}
                  </div>
                )}
              </div>
            </div>

            {/* Cascading Company & Branch Select */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Company (Client) *
                </label>
                <select
                  value={companyId}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setCompanyId(selected);
                    setBranchId(''); // Reset branch selection when company changes
                  }}
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
                  <option value="">Select Company</option>
                  {allClients.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Branch / Site *
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={!companyId}
                  required
                  style={{
                    width: '100%',
                    height: '40px',
                    backgroundColor: 'var(--color-bg-darker)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: companyId ? 'var(--color-text)' : 'var(--color-text-dim)',
                    padding: '0 12px',
                    fontSize: '14px',
                    cursor: companyId ? 'pointer' : 'not-allowed',
                  }}
                >
                  <option value="">
                    {companyId
                      ? createBranches.length > 0
                        ? 'Select Branch / Site'
                        : 'No branches found for this company'
                      : 'Choose company first'}
                  </option>
                  {createBranches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
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
                Grant Managerial Access (Can access web portal & administrative routes)
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isCreateFormValid || createMutation.isPending}
              isLoading={createMutation.isPending}
            >
              Enrol Officer
            </Button>
          </div>
        </form>
      </Modal>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Edit Employee Modal (Same 3 Structured Sections)                           */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editEmployee}
        onClose={() => setEditEmployee(null)}
        title={`Edit Officer: ${editEmployee?.name}`}
        maxWidth="780px"
      >
        {editEmployee && (
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {editError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                }}
              >
                {editError}
              </div>
            )}

            {/* Section 1: Personal Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '6px',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                1. Personal Details
              </h3>

              <PhotoUploadBox
                label="Profile Picture (Round Preview, JPG or PNG up to 2 MB) *"
                photoUrl={editData.photo_url}
                onPhotoChange={(url) => setEditData({ ...editData, photo_url: url || '' })}
                uploadFn={api.uploadEmployeePhoto}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input
                  label="Full Name (min 4 characters) *"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  required
                />
                <Input
                  label="Email Address *"
                  type="email"
                  value={editData.email || ''}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input
                  label="Phone Number *"
                  value={editData.phone || ''}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  required
                />
                <Input
                  label="Date of Birth *"
                  type="date"
                  value={editData.date_of_birth || ''}
                  onChange={(e) => setEditData({ ...editData, date_of_birth: e.target.value })}
                  required
                />
              </div>

              <Input
                label="Password (Leave blank to keep current password)"
                type="password"
                placeholder="Min 8 characters if changing"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />

              <Input
                label="Residential Address *"
                placeholder="e.g. 12 High Street, Birmingham"
                value={editData.address || ''}
                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                required
              />

              <DocumentUploadBox
                label="Employee Documents (Upload many files, PDF/JPG/PNG up to 5 MB each)"
                documents={editDocuments}
                onChange={(docs) => setEditDocuments(docs)}
              />
            </div>

            {/* Section 2: General Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '6px',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                2. General Information
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input
                  label="Username (Unique, min 3 chars) *"
                  value={editData.username || ''}
                  onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                  required
                />
                <Input
                  label="Position / Designation *"
                  placeholder="e.g. Senior Patrol Officer"
                  value={editData.position || ''}
                  onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Section 3: Operational Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '6px',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                3. Operational Details
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input
                  label="Pay Rate (£/hr) *"
                  type="number"
                  step="0.25"
                  min="1"
                  value={editData.pay_rate ?? ''}
                  onChange={(e) => setEditData({ ...editData, pay_rate: e.target.value })}
                  required
                />
                <Input
                  label="Weekly Working Hours *"
                  type="number"
                  step="1"
                  min="1"
                  value={editData.weekly_working_hours ?? ''}
                  onChange={(e) => setEditData({ ...editData, weekly_working_hours: e.target.value })}
                  required
                />
              </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input
                  label="Joining Date *"
                  type="date"
                  value={editData.joining_date || ''}
                  onChange={(e) => setEditData({ ...editData, joining_date: e.target.value })}
                  required
                />
                <Input
                  label="Licence Number *"
                  placeholder="e.g. 1000123456789012"
                  value={editData.licence_number || ''}
                  onChange={(e) => setEditData({ ...editData, licence_number: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <Input
                    label="Licence Expiry Date *"
                    type="date"
                    value={editData.licence_expiry_date || ''}
                    onChange={(e) => setEditData({ ...editData, licence_expiry_date: e.target.value })}
                    required
                  />
                  {editData.licence_expiry_date && getExpiryInfo(editData.licence_expiry_date).isRed && (
                    <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>
                      <AlertTriangle size={11} style={{ display: 'inline', marginRight: '3px' }} />
                      {getExpiryInfo(editData.licence_expiry_date).text}
                    </div>
                  )}
                </div>

                <div>
                  <Input
                    label="BRP Expiry Date (Optional)"
                    type="date"
                    value={editData.brp_expiry_date || ''}
                    onChange={(e) => setEditData({ ...editData, brp_expiry_date: e.target.value })}
                  />
                  {editData.brp_expiry_date && getExpiryInfo(editData.brp_expiry_date).isRed && (
                    <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>
                      <AlertTriangle size={11} style={{ display: 'inline', marginRight: '3px' }} />
                      {getExpiryInfo(editData.brp_expiry_date).text}
                    </div>
                  )}
                </div>
              </div>

              {/* Cascading Company & Branch Select */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    Company (Client) *
                  </label>
                  <select
                    value={editData.client_id || ''}
                    onChange={(e) => {
                      const newClientId = e.target.value;
                      setEditData({ ...editData, client_id: newClientId, branch_id: '' });
                    }}
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
                    <option value="">Select Company</option>
                    {allClients.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    Branch / Site *
                  </label>
                  <select
                    value={editData.branch_id || ''}
                    onChange={(e) => setEditData({ ...editData, branch_id: e.target.value })}
                    disabled={!editData.client_id}
                    required
                    style={{
                      width: '100%',
                      height: '40px',
                      backgroundColor: 'var(--color-bg-darker)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      color: editData.client_id ? 'var(--color-text)' : 'var(--color-text-dim)',
                      padding: '0 12px',
                      fontSize: '14px',
                      cursor: editData.client_id ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <option value="">
                      {editData.client_id
                        ? editBranches.length > 0
                          ? 'Select Branch / Site'
                          : 'No branches for this company'
                        : 'Choose company first'}
                    </option>
                    {editBranches.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button type="button" variant="secondary" onClick={() => setEditEmployee(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!isEditFormValid || updateMutation.isPending}
                isLoading={updateMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
