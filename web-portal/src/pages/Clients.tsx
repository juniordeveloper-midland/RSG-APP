import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Building2,
  Briefcase,
  CheckCircle2,
  Archive,
  Globe,
  Mail,
  Phone,
  ArrowRight,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { PhotoUploadBox } from '../components/common/PhotoUploadBox';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const Clients: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Add Client Form State ─────────────────────────────────────────────────
  // 1. Company Details
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [clientSince, setClientSince] = useState(new Date().toISOString().split('T')[0]);

  // 2. Contact Person
  const [contactPhoto, setContactPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactStatus, setContactStatus] = useState<'active' | 'inactive' | 'archived'>('active');
  const [password, setPassword] = useState('');

  // 3. Billing Information
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingCountry, setBillingCountry] = useState('United Kingdom');
  const [billingZip, setBillingZip] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [billingEmail, setBillingEmail] = useState('');

  // ─── Query Clients ─────────────────────────────────────────────────────────
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['clients', search, statusFilter],
    queryFn: () =>
      api.getClients({
        page: 1,
        limit: 100,
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }),
  });

  const clients: any[] = data?.items ?? [];

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === 'active').length;
    const inactive = clients.filter((c) => c.status === 'inactive' || c.status === 'archived').length;
    return { total, active, inactive };
  }, [clients]);

  // ─── Form Validation ───────────────────────────────────────────────────────
  // All fields required EXCEPT website and contactPhoto
  const isFormValid = useMemo(() => {
    return (
      companyName.trim().length >= 2 &&
      companyCode.trim().length >= 2 &&
      industry.trim().length >= 2 &&
      clientSince.trim().length >= 8 &&
      contactName.trim().length >= 2 &&
      isValidEmail(contactEmail) &&
      contactPhone.trim().length >= 5 &&
      password.length >= 6 &&
      billingAddress.trim().length >= 3 &&
      billingCity.trim().length >= 2 &&
      billingState.trim().length >= 2 &&
      billingCountry.trim().length >= 2 &&
      billingZip.trim().length >= 2 &&
      billingPhone.trim().length >= 5 &&
      isValidEmail(billingEmail) &&
      !photoError
    );
  }, [
    companyName,
    companyCode,
    industry,
    clientSince,
    contactName,
    contactEmail,
    contactPhone,
    password,
    billingAddress,
    billingCity,
    billingState,
    billingCountry,
    billingZip,
    billingPhone,
    billingEmail,
    photoError,
  ]);

  // ─── Create Mutation ───────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (newClient: any) => api.createClient(newClient),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setCreateModalOpen(false);
      resetForm();
      if (created?.id) {
        navigate(`/clients/${created.id}`);
      }
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create client'),
  });

  const resetForm = () => {
    setCompanyName('');
    setCompanyCode('');
    setWebsite('');
    setIndustry('');
    setClientSince(new Date().toISOString().split('T')[0]);
    setContactPhoto(null);
    setPhotoError(null);
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setContactStatus('active');
    setPassword('');
    setBillingAddress('');
    setBillingCity('');
    setBillingState('');
    setBillingCountry('United Kingdom');
    setBillingZip('');
    setBillingPhone('');
    setBillingEmail('');
    setFormError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setFormError(null);

    createMutation.mutate({
      name: companyName.trim(),
      code: companyCode.trim().toUpperCase(),
      website: website.trim() || undefined,
      industry: industry.trim(),
      client_since: clientSince.trim(),
      contact_photo: contactPhoto ? contactPhoto.trim() : undefined,
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim().toLowerCase(),
      contact_phone: contactPhone.trim(),
      status: contactStatus,
      password: password,
      billing_address: billingAddress.trim(),
      billing_city: billingCity.trim(),
      billing_state: billingState.trim(),
      billing_country: billingCountry.trim(),
      billing_zip: billingZip.trim(),
      billing_phone: billingPhone.trim(),
      billing_email: billingEmail.trim().toLowerCase(),
    });
  };

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
            Clients & Accounts
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>
            Manage client company profiles, branch assignments, and designated contact persons.
          </p>
        </div>

        {/* 1. Add Client Button: Plus icon rendered only once via leftIcon */}
        <Button
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => {
            resetForm();
            setCreateModalOpen(true);
          }}
        >
          Add Client
        </Button>
      </div>

      {/* Metric Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                TOTAL CLIENTS
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px' }}>
                {metrics.total}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-darker)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <Briefcase size={22} />
            </div>
          </div>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                ACTIVE CLIENTS
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>
                {metrics.active}
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
              <CheckCircle2 size={22} />
            </div>
          </div>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                INACTIVE / ARCHIVED
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text-dim)', marginTop: '4px' }}>
                {metrics.inactive}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-darker)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-dim)',
              }}
            >
              <Archive size={22} />
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <Input
              placeholder="Search by company name, code, contact name, email, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={16} />}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="archived">Archived Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Client Cards Grid */}
      {isLoading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px',
            color: 'var(--color-text-muted)',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--color-border)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      ) : clients.length === 0 ? (
        <Card style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Briefcase size={40} style={{ color: 'var(--color-text-dim)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0' }}>No clients found</h3>
          <p style={{ color: 'var(--color-text-muted)', margin: '0 0 16px 0', fontSize: '14px' }}>
            {search
              ? 'No client accounts match your search filters.'
              : 'Get started by creating your first corporate client profile.'}
          </p>
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setCreateModalOpen(true)}>
            Add Client
          </Button>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {clients.map((client) => {
            const branchCount = client._count?.branches ?? 0;
            const initials = client.name
              ? client.name
                .split(' ')
                .map((w: string) => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase()
              : 'CL';

            const statusColors: Record<string, { bg: string; color: string; label: string }> = {
              active: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', label: 'Active' },
              inactive: { bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)', label: 'Inactive' },
              archived: { bg: 'var(--color-bg-darker)', color: 'var(--color-text-dim)', label: 'Archived' },
            };
            const statusConfig = statusColors[client.status] || statusColors.active;

            return (
              <Card
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                style={{
                  cursor: 'pointer',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  border: '1px solid var(--color-border)',
                  transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
                }}
                className="client-card"
              >
                {/* Card Top: Small Round Profile Picture / Default Avatar */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  {client.contact_photo ? (
                    <img
                      src={client.contact_photo}
                      alt={client.name}
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--color-border)',
                        boxShadow: 'var(--shadow-sm)',
                        flexShrink: 0,
                      }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}

                  {/* Fallback Round Default Avatar */}
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-bg-darker)',
                      border: '2px solid var(--color-border)',
                      color: 'var(--color-primary)',
                      display: client.contact_photo ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '15px',
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '16px',
                          color: 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={client.name}
                      >
                        {client.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-bg-darker)',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {client.code}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: statusConfig.bg,
                          color: statusConfig.color,
                        }}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Middle: Industry & Contact Person */}
                <div
                  style={{
                    backgroundColor: 'var(--color-bg-darker)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                    <span>Industry:</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{client.industry}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                    <span>Contact:</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{client.contact_name}</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--color-text-dim)',
                      fontSize: '12px',
                      marginTop: '2px',
                    }}
                  >
                    <Mail size={12} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.contact_email}
                    </span>
                  </div>
                </div>

                {/* Card Footer: Branches Count & Action */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--color-text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    <Building2 size={16} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{branchCount}</span>
                    <span>{branchCount === 1 ? 'Branch' : 'Branches'}</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '13px',
                      color: 'var(--color-primary)',
                      fontWeight: 600,
                    }}
                  >
                    <span>View Client</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Add Client Modal (3 Sections) ─────────────────────────────────── */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register New Client Account"
      >
        <form
          onSubmit={handleCreateSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            maxHeight: '75vh',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {formError && (
            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              {formError}
            </div>
          )}

          {/* Section 1: Company Details */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-bg-darker)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              <Briefcase size={18} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>1. Company Details</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Company Name *"
                placeholder="e.g. Barclays Retail Group"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
              <Input
                label="Client Code *"
                placeholder="e.g. BARC-001"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
                helperText="Unique uppercase identifier"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Industry *"
                placeholder="e.g. Banking & Financial Services"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
              />
              <Input
                label="Client Since *"
                type="date"
                value={clientSince}
                onChange={(e) => setClientSince(e.target.value)}
                required
              />
            </div>

            <Input
              label="Website (Optional)"
              placeholder="https://www.example.com"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              leftIcon={<Globe size={15} />}
            />
          </div>

          {/* Section 2: Contact Person */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-bg-darker)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              <UserCheck size={18} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>2. Contact Person</h3>
            </div>

            {/* Profile Picture Upload Box with Round Preview, Replace & Remove */}
            <PhotoUploadBox
              label="Contact Profile Picture (Optional, JPG or PNG up to 2 MB)"
              photoUrl={contactPhoto}
              onPhotoChange={(url) => setContactPhoto(url)}
              error={photoError}
              onErrorChange={setPhotoError}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Contact Name *"
                placeholder="e.g. Robert Sterling"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
              <Input
                label="Contact Email *"
                type="email"
                placeholder="r.sterling@barclays.co.uk"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                leftIcon={<Mail size={15} />}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Contact Phone *"
                placeholder="+442071161000"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                leftIcon={<Phone size={15} />}
                required
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Initial Status *
                </label>
                <select
                  value={contactStatus}
                  onChange={(e) => setContactStatus(e.target.value as any)}
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
              label="Client Portal Password *"
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Password for client contact login"
              required
            />
          </div>

          {/* Section 3: Billing Information */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-bg-darker)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              <CreditCard size={18} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>3. Billing & Invoicing Information</h3>
            </div>

            <Input
              label="Billing Address *"
              placeholder="e.g. 1 Churchill Place, Canary Wharf"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="City *"
                placeholder="e.g. London"
                value={billingCity}
                onChange={(e) => setBillingCity(e.target.value)}
                required
              />
              <Input
                label="State / Region *"
                placeholder="e.g. Greater London"
                value={billingState}
                onChange={(e) => setBillingState(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Country *"
                placeholder="e.g. United Kingdom"
                value={billingCountry}
                onChange={(e) => setBillingCountry(e.target.value)}
                required
              />
              <Input
                label="Zip / Postal Code *"
                placeholder="e.g. E14 5HP"
                value={billingZip}
                onChange={(e) => setBillingZip(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                label="Billing Phone *"
                placeholder="+442071161000"
                value={billingPhone}
                onChange={(e) => setBillingPhone(e.target.value)}
                leftIcon={<Phone size={15} />}
                required
              />
              <Input
                label="Billing Email *"
                type="email"
                placeholder="billing@barclays.co.uk"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                leftIcon={<Mail size={15} />}
                required
              />
            </div>
          </div>

          {/* Validation note & Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div style={{ fontSize: '12px', color: isFormValid ? 'var(--color-success)' : 'var(--color-text-dim)' }}>
              {isFormValid ? '✓ All required fields complete' : 'Please fill all required fields to enable Save'}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!isFormValid || createMutation.isPending}
                isLoading={createMutation.isPending}
              >
                Save Client
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
