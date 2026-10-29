import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Building2, Briefcase, Edit2, Ban, CheckCircle2, MapPin } from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Table } from '../components/common/Table';
import type { Column } from '../components/common/Table';
import { Modal } from '../components/common/Modal';
import { ErrorBanner } from '../components/common/ErrorBanner';

export const Branches: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<any | null>(null);

  // Form states for Create Branch
  const [selectedClientId, setSelectedClientId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('51.5074');
  const [lng, setLng] = useState('-0.1278');
  const [radiusM, setRadiusM] = useState('150');
  const [formError, setFormError] = useState<string | null>(null);

  // Query all clients for selection
  const { data: clientsData } = useQuery({
    queryKey: ['clients-lookup'],
    queryFn: () => api.getClients({ page: 1, limit: 100 }),
  });
  const clientsList: any[] = clientsData?.items ?? [];

  // Set default client when clients are loaded
  useEffect(() => {
    if (clientsList.length > 0 && !selectedClientId) {
      setSelectedClientId(clientsList[0].id);
    }
  }, [clientsList, selectedClientId]);

  // Query branches with client and search filter
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['branches', page, search, clientFilter],
    queryFn: () =>
      api.getBranches({
        page,
        limit: 10,
        search: search.trim() || undefined,
        client_id: clientFilter !== 'all' ? clientFilter : undefined,
      }),
  });

  const branches = data?.items ?? [];
  const pagination = data?.pagination;

  const createMutation = useMutation({
    mutationFn: (newBranch: any) => api.createBranch(newBranch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setCreateModalOpen(false);
      setName('');
      setAddress('');
      setFormError(null);
    },
    onError: (err: any) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateBranch(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditBranch(null);
    },
    onError: (err: any) => setFormError(err.message),
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => api.disableBranch(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => api.enableBranch(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate({
      client_id: selectedClientId || undefined,
      name,
      address,
      lat: Number(lat),
      lng: Number(lng),
      radius_m: Number(radiusM),
      is_active: true,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBranch) return;
    updateMutation.mutate({
      id: editBranch.id,
      data: {
        client_id: editBranch.client_id || undefined,
        address: editBranch.address,
        lat: Number(editBranch.lat),
        lng: Number(editBranch.lng),
        radius_m: Number(editBranch.radius_m),
      },
    });
  };

  const columns: Column<any>[] = [
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
      key: 'client',
      header: 'Client Account',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Briefcase size={14} style={{ color: 'var(--color-primary)' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
              {row.client?.name || 'Region Security Guarding'}
            </div>
            {row.client?.code && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-dim)', fontFamily: 'monospace' }}>
                {row.client.code}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Address',
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
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditBranch({ ...row })}
            leftIcon={<Edit2 size={13} />}
          >
            Edit
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
              Re-enable
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
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0' }}>
            Branch Operations & Hubs
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>
            Configure client sites, coordinates pin, and Haversine geofencing radiuses.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => {
            if (clientsList.length > 0 && !selectedClientId) {
              setSelectedClientId(clientsList[0].id);
            }
            setCreateModalOpen(true);
          }}
        >
          Add New Branch
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <Input
              placeholder="Search branch by name or location..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search size={16} />}
            />
          </div>

          {/* Client Filter */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Client:</span>
            <select
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setPage(1);
              }}
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="all">All Clients</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Branches Table */}
      <Table
        columns={columns}
        data={branches}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="No branches found matching your search criteria."
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

      {/* Create Branch Modal: Pick Client First, Then Branch Fields */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Establish New Branch / Site"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div
              style={{
                padding: '10px',
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              {formError}
            </div>
          )}

          {/* Pick Client First */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              1. Select Client *
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              required
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
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
              Branches must belong to an established client account.
            </span>
          </div>

          <Input
            label="2. Branch Name *"
            placeholder="e.g. Manchester North Hub"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="3. Physical Address *"
            placeholder="e.g. 45 Deansgate, Manchester"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Latitude Pin *"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
            <Input
              label="Longitude Pin *"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
            />
          </div>

          <Input
            label="Geofence Radius (meters) *"
            type="number"
            min="10"
            max="10000"
            value={radiusM}
            onChange={(e) => setRadiusM(e.target.value)}
            helperText="Guards must check in within this perimeter radius."
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Create Branch
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Branch Modal */}
      <Modal
        isOpen={!!editBranch}
        onClose={() => setEditBranch(null)}
        title={`Edit Branch: ${editBranch?.name}`}
      >
        {editBranch && (
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Reassign Client if needed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Client Account
              </label>
              <select
                value={editBranch.client_id || ''}
                onChange={(e) => setEditBranch({ ...editBranch, client_id: e.target.value })}
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
                {clientsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Address"
              value={editBranch.address || ''}
              onChange={(e) => setEditBranch({ ...editBranch, address: e.target.value })}
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Latitude"
                type="number"
                step="any"
                value={editBranch.lat}
                onChange={(e) => setEditBranch({ ...editBranch, lat: e.target.value })}
                required
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                value={editBranch.lng}
                onChange={(e) => setEditBranch({ ...editBranch, lng: e.target.value })}
                required
              />
            </div>

            <Input
              label="Radius (m)"
              type="number"
              value={editBranch.radius_m}
              onChange={(e) => setEditBranch({ ...editBranch, radius_m: e.target.value })}
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button type="button" variant="secondary" onClick={() => setEditBranch(null)}>
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
