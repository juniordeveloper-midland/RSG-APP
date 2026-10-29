import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Briefcase,
  UserCheck,
  CreditCard,
  Plus,
  MapPin,
  Globe,
  Mail,
  Phone,
  Archive,
  Edit2,
  User,
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

export const ClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  // ─── Add Branch Form State ─────────────────────────────────────────────────
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchLat, setBranchLat] = useState('51.5074');
  const [branchLng, setBranchLng] = useState('-0.1278');
  const [branchRadiusM, setBranchRadiusM] = useState('150');

  // ─── Edit Client Form State ────────────────────────────────────────────────
  const [editData, setEditData] = useState<any>({});
  const [editError, setEditError] = useState<string | null>(null);

  // ─── Query Client Details ──────────────────────────────────────────────────
  const { data: client, isLoading, error: queryError } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.getClient(id!),
    enabled: !!id,
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const addBranchMutation = useMutation({
    mutationFn: (newBranch: any) => api.createBranch(newBranch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setAddBranchOpen(false);
      setBranchName('');
      setBranchAddress('');
      setBranchError(null);
    },
    onError: (err: any) => setBranchError(err.message || 'Failed to create branch'),
  });

  const updateClientMutation = useMutation({
    mutationFn: (updated: any) => api.updateClient(id!, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditClientOpen(false);
    },
    onError: (err: any) => setEditError(err.message || 'Failed to update client'),
  });

  const archiveClientMutation = useMutation({
    mutationFn: () => api.archiveClient(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const handleAddBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    setBranchError(null);

    addBranchMutation.mutate({
      client_id: id,
      name: branchName.trim(),
      address: branchAddress.trim(),
      lat: Number(branchLat),
      lng: Number(branchLng),
      radius_m: Number(branchRadiusM),
      is_active: true,
    });
  };

  const openEditModal = () => {
    if (!client) return;
    setEditData({
      name: client.name || '',
      code: client.code || '',
      industry: client.industry || '',
      website: client.website || '',
      contact_photo: client.contact_photo || '',
      contact_name: client.contact_name || '',
      contact_email: client.contact_email || '',
      contact_phone: client.contact_phone || '',
      status: client.status || 'active',
      billing_address: client.billing_address || '',
      billing_city: client.billing_city || '',
      billing_state: client.billing_state || '',
      billing_country: client.billing_country || '',
      billing_zip: client.billing_zip || '',
      billing_phone: client.billing_phone || '',
      billing_email: client.billing_email || '',
    });
    setEditError(null);
    setEditClientOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    updateClientMutation.mutate(editData);
  };

  // ─── Branches Table Columns ────────────────────────────────────────────────
  const branchColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Branch Name',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-darker)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
            }}
          >
            <Building2 size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>ID: {row.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Physical Address',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={14} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px' }}>{row.address || '—'}</span>
        </div>
      ),
    },
    {
      key: 'coordinates',
      header: 'Coordinates & Geofence',
      render: (row) => (
        <div>
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {Number(row.lat).toFixed(4)}, {Number(row.lng).toFixed(4)}
          </span>
          <div style={{ fontSize: '11px', color: 'var(--color-primary)' }}>
            Radius: {row.radius_m}m
          </div>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span className={`badge ${row.is_active ? 'badge-success' : 'badge-danger'}`}>
          {row.is_active ? 'Operational' : 'Disabled'}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '300px',
          color: 'var(--color-text-muted)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: '24px' }}>
        <Button variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/clients')}>
          Back to Clients
        </Button>
        <Card style={{ padding: '32px', textAlign: 'center', marginTop: '16px' }}>
          <h3>Client not found</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>The requested client account does not exist.</p>
        </Card>
      </div>
    );
  }

  const branches = client.branches || [];
  const initials = client.name
    ? client.name
        .split(' ')
        .map((w: string) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'CL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ErrorBanner message={queryError ? (queryError as any).message : null} />

      {/* Top Navigation & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/clients')}
          style={{ color: 'var(--color-text-muted)' }}
        >
          Back to Clients
        </Button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" leftIcon={<Edit2 size={14} />} onClick={openEditModal}>
            Edit Client
          </Button>
          {client.status !== 'archived' && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Archive size={14} />}
              style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}
              onClick={() => {
                if (window.confirm(`Are you sure you want to archive client ${client.name}?`)) {
                  archiveClientMutation.mutate();
                }
              }}
              isLoading={archiveClientMutation.isPending}
            >
              Archive Client
            </Button>
          )}
        </div>
      </div>

      {/* Client Profile Header Card */}
      <Card style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Round Profile Picture / Default Avatar */}
            {client.contact_photo ? (
              <img
                src={client.contact_photo}
                alt={client.name}
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--color-primary)',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}

            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-bg-darker)',
                border: '2px solid var(--color-border)',
                color: 'var(--color-primary)',
                display: client.contact_photo ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '22px',
              }}
            >
              {initials}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{client.name}</h1>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-bg-darker)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {client.code}
                </span>
                <span
                  className={`badge ${
                    client.status === 'active'
                      ? 'badge-success'
                      : client.status === 'archived'
                      ? 'badge-danger'
                      : 'badge-warning'
                  }`}
                >
                  {client.status.toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                <span>Industry: <strong style={{ color: 'var(--color-text)' }}>{client.industry}</strong></span>
                {client.client_since && (
                  <span>Client Since: <strong style={{ color: 'var(--color-text)' }}>{client.client_since}</strong></span>
                )}
                {client.website && (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Globe size={13} /> {client.website}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Information Cards (2 Columns: Contact Person & Billing Details) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Contact Person Details */}
        <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><UserCheck size={18} style={{ color: 'var(--color-primary)' }} /> Designated Contact Person</span>}>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Full Name:</span>
              <strong>{client.contact_name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Contact Email:</span>
              <a href={`mailto:${client.contact_email}`} style={{ color: 'var(--color-text)' }}>{client.contact_email}</a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Contact Phone:</span>
              <span>{client.contact_phone}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Portal Status:</span>
              <span className={`badge ${client.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                {client.status}
              </span>
            </div>
          </div>
        </Card>

        {/* Billing Information */}
        <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CreditCard size={18} style={{ color: 'var(--color-primary)' }} /> Billing & Invoicing</span>}>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Billing Address:</span>
              <span style={{ textAlign: 'right' }}>{client.billing_address}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>City, State, Zip:</span>
              <span>{client.billing_city}, {client.billing_state} {client.billing_zip}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Country:</span>
              <span>{client.billing_country}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Invoicing Contacts:</span>
              <span>{client.billing_email} | {client.billing_phone}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Branches Section with Add Branch Button */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} style={{ color: 'var(--color-primary)' }} />
            <span>Assigned Client Branches ({branches.length})</span>
          </div>
        }
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={() => {
              setBranchName('');
              setBranchAddress('');
              setBranchError(null);
              setAddBranchOpen(true);
            }}
          >
            Add Branch
          </Button>
        }
      >
        <Table
          columns={branchColumns}
          data={branches}
          keyExtractor={(item) => item.id}
          emptyMessage="No branches are currently assigned to this client. Click '+ Add Branch' to create one."
        />
      </Card>

      {/* ─── Add Branch Modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={addBranchOpen}
        onClose={() => setAddBranchOpen(false)}
        title={`Add Branch for ${client.name}`}
      >
        <form onSubmit={handleAddBranchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {branchError && (
            <div
              style={{
                padding: '10px',
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              {branchError}
            </div>
          )}

          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--color-bg-darker)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Briefcase size={15} style={{ color: 'var(--color-primary)' }} />
            <span>Client: <strong>{client.name}</strong> ({client.code})</span>
          </div>

          <Input
            label="Branch Name *"
            placeholder="e.g. Canary Wharf Tower Hub"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            required
          />

          <Input
            label="Physical Address *"
            placeholder="e.g. 1 Canada Square, Canary Wharf, London"
            value={branchAddress}
            onChange={(e) => setBranchAddress(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Latitude Pin *"
              type="number"
              step="any"
              value={branchLat}
              onChange={(e) => setBranchLat(e.target.value)}
              required
            />
            <Input
              label="Longitude Pin *"
              type="number"
              step="any"
              value={branchLng}
              onChange={(e) => setBranchLng(e.target.value)}
              required
            />
          </div>

          <Input
            label="Geofence Radius (meters) *"
            type="number"
            min="10"
            max="10000"
            value={branchRadiusM}
            onChange={(e) => setBranchRadiusM(e.target.value)}
            helperText="Guards must check in within this perimeter radius."
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setAddBranchOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!branchName.trim() || addBranchMutation.isPending}
              isLoading={addBranchMutation.isPending}
            >
              Create Branch
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit Client Modal with Photo Upload Box ─────────────────────── */}
      <Modal
        isOpen={editClientOpen}
        onClose={() => setEditClientOpen(false)}
        title={`Edit Client: ${client.name}`}
      >
        <form
          onSubmit={handleEditSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxHeight: '75vh',
            overflowY: 'auto',
          }}
        >
          {editError && (
            <div
              style={{
                padding: '10px',
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              {editError}
            </div>
          )}

          {/* Profile Picture Upload Box */}
          <PhotoUploadBox
            label="Contact Profile Picture (Optional, JPG or PNG up to 2 MB)"
            photoUrl={editData.contact_photo || null}
            onPhotoChange={(url) => setEditData({ ...editData, contact_photo: url })}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Company Name"
              value={editData.name || ''}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              required
            />
            <Input
              label="Industry"
              value={editData.industry || ''}
              onChange={(e) => setEditData({ ...editData, industry: e.target.value })}
              required
            />
          </div>

          <Input
            label="Website"
            value={editData.website || ''}
            onChange={(e) => setEditData({ ...editData, website: e.target.value })}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Contact Name"
              value={editData.contact_name || ''}
              onChange={(e) => setEditData({ ...editData, contact_name: e.target.value })}
              required
            />
            <Input
              label="Contact Email"
              type="email"
              value={editData.contact_email || ''}
              onChange={(e) => setEditData({ ...editData, contact_email: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Contact Phone"
              value={editData.contact_phone || ''}
              onChange={(e) => setEditData({ ...editData, contact_phone: e.target.value })}
              required
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</label>
              <select
                value={editData.status || 'active'}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '9px 12px',
                  fontSize: '14px',
                  outline: 'none',
                  minHeight: '38px',
                }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <Input
            label="Billing Address"
            value={editData.billing_address || ''}
            onChange={(e) => setEditData({ ...editData, billing_address: e.target.value })}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="City"
              value={editData.billing_city || ''}
              onChange={(e) => setEditData({ ...editData, billing_city: e.target.value })}
              required
            />
            <Input
              label="State / Region"
              value={editData.billing_state || ''}
              onChange={(e) => setEditData({ ...editData, billing_state: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Country"
              value={editData.billing_country || ''}
              onChange={(e) => setEditData({ ...editData, billing_country: e.target.value })}
              required
            />
            <Input
              label="Zip / Postal Code"
              value={editData.billing_zip || ''}
              onChange={(e) => setEditData({ ...editData, billing_zip: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setEditClientOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={updateClientMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
