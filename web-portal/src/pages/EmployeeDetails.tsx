import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  User,
  Shield,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  FileText,
  Edit2,
  UserCheck,
  UserX,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { PhotoUploadBox } from '../components/common/PhotoUploadBox';
import { DocumentUploadBox, type EmployeeDocumentItem } from '../components/common/DocumentUploadBox';
import { getExpiryInfo } from '../utils/date';

export const EmployeeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Edit form state
  const [editData, setEditData] = useState<any>({});
  const [editPassword, setEditPassword] = useState('');
  const [editDocuments, setEditDocuments] = useState<EmployeeDocumentItem[]>([]);

  // Query employee
  const { data: employee, isLoading, error: queryError } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.getEmployee(id!),
    enabled: !!id,
  });

  // Query clients for company dropdown in edit modal
  const { data: clientsData } = useQuery({
    queryKey: ['clientsListAll'],
    queryFn: () => api.getClients({ limit: 100 }),
  });
  const allClients = clientsData?.items ?? [];

  // Query branches for branch dropdown in edit modal
  const { data: branchesData } = useQuery({
    queryKey: ['branchesListAll', editData?.client_id],
    queryFn: () => api.getBranches({ limit: 100, client_id: editData?.client_id || undefined }),
    enabled: !!editData?.client_id,
  });
  const filteredBranches = branchesData?.items ?? [];

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateEmployee(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEditModalOpen(false);
      setEditError(null);
    },
    onError: (err: any) => setEditError(err.message || 'Failed to update employee'),
  });

  const suspendMutation = useMutation({
    mutationFn: (status: 'active' | 'suspended') => api.updateEmployeeStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const openEditModal = () => {
    if (!employee) return;
    setEditData({
      ...employee,
      pay_rate: employee.pay_rate ?? (employee.hourly_rate ? Number(employee.hourly_rate) : ''),
      weekly_working_hours: employee.weekly_working_hours ?? employee.weekly_hours ?? '',
      photo_url: employee.profile_image || employee.photo_url || '',
      client_id: employee.client_id || employee.client?.id || '',
      branch_id: employee.branch_id || employee.branch?.id || '',
    });
    setEditDocuments(employee.documents || []);
    setEditPassword('');
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData) return;

    const payload: any = {
      name: editData.name,
      email: editData.email,
      phone: editData.phone,
      date_of_birth: editData.date_of_birth,
      address: editData.address,
      photo_url: editData.photo_url,
      profile_image: editData.photo_url,
      username: editData.username,
      position: editData.position,
      pay_rate: Number(editData.pay_rate),
      hourly_rate: Number(editData.pay_rate),
      weekly_working_hours: Number(editData.weekly_working_hours),
      weekly_hours: Number(editData.weekly_working_hours),
      joining_date: editData.joining_date,
      brp_expiry_date: editData.brp_expiry_date || null,
      licence_expiry_date: editData.licence_expiry_date,
      licence_number: editData.licence_number,
      client_id: editData.client_id,
      branch_id: editData.branch_id,
      documents: editDocuments,
    };

    if (editPassword && editPassword.trim().length >= 8) {
      payload.password = editPassword.trim();
    }

    updateMutation.mutate(payload);
  };

  // Validation for Edit Form
  const isEditValid = Boolean(
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

  if (isLoading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading employee profile...
      </div>
    );
  }

  if (queryError || !employee) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Button variant="ghost" onClick={() => navigate('/employees')} leftIcon={<ArrowLeft size={16} />}>
          Back to Workforce
        </Button>
        <ErrorBanner message={(queryError as any)?.message || 'Employee profile not found.'} />
      </div>
    );
  }

  const licenceExpiry = getExpiryInfo(employee.licence_expiry_date);
  const brpExpiry = getExpiryInfo(employee.brp_expiry_date);
  const profilePic = employee.profile_image || employee.photo_url;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Navigation */}
      <div>
        <Button variant="ghost" onClick={() => navigate('/employees')} leftIcon={<ArrowLeft size={16} />}>
          Back to Workforce
        </Button>
      </div>

      {/* Profile Header Card */}
      <Card>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {/* Round Profile Picture */}
            <div style={{ position: 'relative', width: '74px', height: '74px', flexShrink: 0 }}>
              {profilePic ? (
                <img
                  src={profilePic}
                  alt={employee.name}
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--color-primary)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(235, 5, 5, 0.15)',
                    border: '3px solid var(--color-border)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '24px',
                  }}
                >
                  {employee.name?.charAt(0) || <User size={32} />}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                  {employee.name}
                </h1>
                <span className={`badge ${employee.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                  {employee.status}
                </span>
                {employee.managerial_access || employee.role === 'manager' ? (
                  <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Shield size={12} /> Managerial Access
                  </span>
                ) : (
                  <span className="badge badge-neutral">Security Guard</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  @{employee.username || 'no-username'}
                </span>
                <span style={{ color: 'var(--color-border)' }}>•</span>
                <span style={{ fontSize: '14px', color: 'var(--color-primary)', fontWeight: 600 }}>
                  {employee.position || 'Security Officer'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={openEditModal} leftIcon={<Edit2 size={15} />}>
              Edit Officer
            </Button>
            {employee.status === 'active' ? (
              <Button
                variant="outline"
                style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                onClick={() => suspendMutation.mutate('suspended')}
                leftIcon={<UserX size={15} />}
                isLoading={suspendMutation.isPending}
              >
                Suspend
              </Button>
            ) : (
              <Button
                variant="outline"
                style={{ color: 'var(--color-success)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                onClick={() => suspendMutation.mutate('active')}
                leftIcon={<UserCheck size={15} />}
                isLoading={suspendMutation.isPending}
              >
                Activate
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 3 Detail Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Section 1: Personal Details */}
        <Card title="1. Personal Details">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Email Address
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)', marginTop: '2px' }}>
                <Mail size={15} style={{ color: 'var(--color-text-muted)' }} />
                <span>{employee.email}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Phone Number
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)', marginTop: '2px' }}>
                <Phone size={15} style={{ color: 'var(--color-text-muted)' }} />
                <span>{employee.phone || '—'}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Date of Birth
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)', marginTop: '2px' }}>
                <Calendar size={15} style={{ color: 'var(--color-text-muted)' }} />
                <span>{employee.date_of_birth || '—'}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Residential Address
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--color-text)', marginTop: '2px' }}>
                <MapPin size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: '2px' }} />
                <span>{employee.address || '—'}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Section 2: General Information */}
        <Card title="2. General Information">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Username
              </div>
              <div style={{ color: 'var(--color-text)', fontWeight: 600, marginTop: '2px' }}>
                @{employee.username || '—'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Position / Designation
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)', marginTop: '2px' }}>
                <Briefcase size={15} style={{ color: 'var(--color-text-muted)' }} />
                <span>{employee.position || '—'}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Account Privileges
              </div>
              <div style={{ color: 'var(--color-text)', marginTop: '2px' }}>
                {employee.managerial_access ? 'Managerial Portal Access Enabled' : 'Standard Guard Mobile App Only'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Enrolment Date
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '2px' }}>
                {employee.created_at ? new Date(employee.created_at).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>
        </Card>

        {/* Section 3: Operational Details */}
        <Card title="3. Operational Details">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Company (Client)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)', fontWeight: 600, marginTop: '2px' }}>
                  <Building2 size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>{employee.client?.name || 'Region Security Guarding'}</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Branch / Site
                </div>
                <div style={{ color: 'var(--color-text)', fontWeight: 600, marginTop: '2px' }}>
                  {employee.branch?.name || <span style={{ color: 'var(--color-text-dim)' }}>Unassigned</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Pay Rate
                </div>
                <div style={{ color: 'var(--color-text)', fontWeight: 700, fontSize: '16px', marginTop: '2px' }}>
                  £{Number(employee.pay_rate || employee.hourly_rate || 0).toFixed(2)}/hr
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Weekly Working Hours
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)', marginTop: '2px' }}>
                  <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />
                  <span>{employee.weekly_working_hours || employee.weekly_hours || 40} hrs/week</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Joining Date
                </div>
                <div style={{ color: 'var(--color-text)', marginTop: '2px' }}>
                  {employee.joining_date || '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Licence Number
                </div>
                <div style={{ color: 'var(--color-text)', fontFamily: 'monospace', fontWeight: 600, marginTop: '2px' }}>
                  {employee.licence_number || employee.id_number || '—'}
                </div>
              </div>
            </div>

            {/* Expiry Dates with Red Highlighting */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Licence Expiry Date
                </div>
                <div style={{ marginTop: '4px' }}>
                  {licenceExpiry.isRed ? (
                    <span
                      style={{
                        color: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertTriangle size={13} /> {licenceExpiry.text}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text)' }}>{licenceExpiry.text}</span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  BRP Expiry Date
                </div>
                <div style={{ marginTop: '4px' }}>
                  {employee.brp_expiry_date ? (
                    brpExpiry.isRed ? (
                      <span
                        style={{
                          color: '#ef4444',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <AlertTriangle size={13} /> {brpExpiry.text}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text)' }}>{brpExpiry.text}</span>
                    )
                  ) : (
                    <span style={{ color: 'var(--color-text-dim)' }}>Not applicable</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Employee Documents Card */}
      <Card title={`Officer Documents (${employee.documents?.length || 0})`}>
        {employee.documents && employee.documents.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {employee.documents.map((doc: any) => (
              <div
                key={doc.id || doc.file_url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(235, 5, 5, 0.12)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={18} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={doc.name}
                    >
                      {doc.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Uploaded'}
                    </div>
                  </div>
                </div>

                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--color-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  <span>View</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-dim)', fontSize: '14px', textAlign: 'center', padding: '16px' }}>
            No documents uploaded for this officer yet.
          </div>
        )}
      </Card>

      {/* Edit Employee Modal with 3 Sections */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Officer: ${employee.name}`}
        maxWidth="760px"
      >
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
              label="Profile Image (Round preview, JPG/PNG up to 2 MB) *"
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
                      ? filteredBranches.length > 0
                        ? 'Select Branch / Site'
                        : 'No branches for this company'
                      : 'Choose company first'}
                  </option>
                  {filteredBranches.map((b: any) => (
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
            <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isEditValid || updateMutation.isPending}
              isLoading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
