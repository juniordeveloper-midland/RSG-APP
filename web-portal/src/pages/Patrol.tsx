import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCodeLib from 'qrcode';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  QrCode,
  Plus,
  Download,
  Search,
  AlertTriangle,
  MapPin,
  Clock,
  Printer,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Table } from '../components/common/Table';
import type { Column } from '../components/common/Table';
import { Modal } from '../components/common/Modal';
import { ErrorBanner } from '../components/common/ErrorBanner';

export const Patrol: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'checkpoints' | 'logs'>('checkpoints');

  // Checkpoints State
  const [branchFilter, setBranchFilter] = useState('');
  const [createQrModalOpen, setCreateQrModalOpen] = useState(false);
  const [viewQrItem, setViewQrItem] = useState<any | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR onto canvas whenever the modal opens with a new item
  useEffect(() => {
    if (!viewQrItem?.signed_token) return;
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    QRCodeLib.toCanvas(canvas, viewQrItem.signed_token, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
  }, [viewQrItem]);

  // Download the canvas as PNG (same image shown in modal)
  const handleDownloadQrCanvas = useCallback((name: string) => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `rsg-qr-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  // Print just the QR canvas
  const handlePrintQr = useCallback((name: string, branchName: string) => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Checkpoint – ${name}</title>
          <style>
            body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; background: #fff; }
            img { width: 512px; height: 512px; display: block; }
            h2 { margin: 16px 0 4px; font-size: 22px; }
            p  { margin: 0; font-size: 14px; color: #555; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="${name}" />
          <h2>${name}</h2>
          <p>${branchName}</p>
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  }, []);

  // Form state for creating Checkpoint
  const [qrName, setQrName] = useState('');
  const [qrBranchId, setQrBranchId] = useState('');
  const [qrDescription, setQrDescription] = useState('');
  const [qrInterval, setQrInterval] = useState('60');
  const [qrStartDate, setQrStartDate] = useState('');
  const [qrEndDate, setQrEndDate] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Logs State
  const [logsPage, setLogsPage] = useState(1);
  const [anomalyOnly, setAnomalyOnly] = useState(false);

  // Load branches
  const { data: branchesData } = useQuery({
    queryKey: ['branchesList'],
    queryFn: () => api.getBranches({ limit: 100 }),
  });
  // Backend returns { items: [...], pagination: {...} }
  const allBranches = branchesData?.items ?? [];

  // Checkpoints Query
  const { data: checkpoints = [], isLoading: isLoadingCheckpoints, error: checkpointsError } = useQuery({
    queryKey: ['patrolQrs', branchFilter],
    queryFn: () => api.getPatrolQrs(branchFilter || undefined),
  });

  // Scan Logs Query
  const { data: logsData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['patrolLogs', logsPage, branchFilter, anomalyOnly],
    queryFn: () =>
      api.getPatrolLogs({
        page: logsPage,
        limit: 15,
        branch_id: branchFilter || undefined,
        is_anomaly: anomalyOnly ? true : undefined,
      }),
  });

  const scanLogs = logsData?.scans || [];
  const logsPagination = logsData?.pagination;

  const createQrMutation = useMutation({
    mutationFn: (body: any) => api.createPatrolQr(body),
    onSuccess: (newQr: any) => {
      queryClient.invalidateQueries({ queryKey: ['patrolQrs'] });
      setCreateQrModalOpen(false);
      setQrName('');
      setQrDescription('');
      setCreateError(null);
      // Auto-preview created QR
      setViewQrItem(newQr);
    },
    onError: (err: any) => setCreateError(err.message),
  });

  const handleCreateQrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrBranchId) {
      setCreateError('Please select a branch hub');
      return;
    }
    setCreateError(null);
    createQrMutation.mutate({
      name: qrName,
      branch_id: qrBranchId,
      description: qrDescription || undefined,
      interval_minutes: Number(qrInterval),
      start_date: qrStartDate ? new Date(qrStartDate).toISOString() : undefined,
      end_date: qrEndDate ? new Date(qrEndDate).toISOString() : undefined,
    });
  };

  const handleDownloadQrPng = async (qrId: string, name: string) => {
    try {
      const blob = await api.getPatrolQrImageBlob(qrId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rsg-qr-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleExportLogsExcel = async () => {
    try {
      const blob = await api.exportPatrolLogsExcel({
        branch_id: branchFilter || undefined,
        is_anomaly: anomalyOnly ? true : undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patrol-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const checkpointColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Checkpoint & Details',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
            {row.description || 'No specific mounting notes'}
          </div>
        </div>
      ),
    },
    {
      key: 'branch',
      header: 'Branch Hub',
      render: (row) => row.branch?.name || 'N/A',
    },
    {
      key: 'interval',
      header: 'Expected Interval',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>
            Every {row.interval_minutes || 60}m
          </span>
        </div>
      ),
    },
    {
      key: 'last_scanned',
      header: 'Last Scanned',
      render: (row) => (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {row.last_scanned_at
            ? new Date(row.last_scanned_at).toLocaleString()
            : 'Never scanned yet'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`badge ${row.is_active ? 'badge-success' : 'badge-danger'}`}>
          {row.is_active ? 'Active' : 'Disabled'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Print / QR',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setViewQrItem(row)}
            leftIcon={<Printer size={13} />}
          >
            Print QR
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDownloadQrPng(row.id, row.name)}
            leftIcon={<Download size={13} />}
          >
            PNG
          </Button>
        </div>
      ),
    },
  ];

  const logColumns: Column<any>[] = [
    {
      key: 'checkpoint',
      header: 'Checkpoint',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.qr?.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{row.qr?.branch?.name}</div>
        </div>
      ),
    },
    {
      key: 'guard',
      header: 'Officer',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.user?.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{row.user?.email}</div>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Scan Time (UTC)',
      render: (row) => (
        <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          <div>{new Date(row.server_time).toLocaleTimeString()}</div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '11px' }}>
            {new Date(row.server_time).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'coordinates',
      header: 'GPS Coordinates',
      render: (row) => (
        <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
          {row.lat ? `${Number(row.lat).toFixed(4)}, ${Number(row.lng).toFixed(4)}` : 'No GPS'}
          {row.accuracy_m && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
              ±{Math.round(row.accuracy_m)}m accuracy
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'anomaly',
      header: 'Integrity & Verification',
      render: (row) => (
        <div>
          {row.is_anomaly ? (
            <div>
              <span className="badge badge-danger">Anomaly Flagged</span>
              <div style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '2px' }}>
                {row.anomaly_reason}
              </div>
            </div>
          ) : (
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} /> Verified Scan
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ErrorBanner message={checkpointsError ? (checkpointsError as any).message : null} />
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
            QR Patrol & Perimeter Checkpoints
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>
            Cryptographically signed HMAC tokens, physical printable QR codes, and tamper/duplicate anomaly detection.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'logs' && (
            <Button
              variant="secondary"
              leftIcon={<Download size={16} />}
              onClick={handleExportLogsExcel}
            >
              Export Logs (.xlsx)
            </Button>
          )}
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => setCreateQrModalOpen(true)}
          >
            Create Checkpoint
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: '8px' }}>
        <button
          onClick={() => setActiveTab('checkpoints')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'checkpoints' ? 'var(--color-text)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'checkpoints' ? '3px solid var(--color-primary)' : '3px solid transparent',
            transition: 'all var(--transition-fast)',
          }}
        >
          Checkpoints & Physical QRs
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'logs' ? 'var(--color-text)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'logs' ? '3px solid var(--color-primary)' : '3px solid transparent',
            transition: 'all var(--transition-fast)',
          }}
        >
          Patrol Scan Logs & Anomalies
        </button>
      </div>

      {/* Filters Card */}
      <Card>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
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

          {activeTab === 'logs' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="anomalyOnly"
                checked={anomalyOnly}
                onChange={(e) => {
                  setAnomalyOnly(e.target.checked);
                  setLogsPage(1);
                }}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
              />
              <label htmlFor="anomalyOnly" style={{ fontSize: '13px', color: 'var(--color-danger)', fontWeight: 600 }}>
                Show Anomalies Only (Suspicious GPS & Rapid Duplicates)
              </label>
            </div>
          )}
        </div>
      </Card>

      {/* Tab 1: Checkpoints Table */}
      {activeTab === 'checkpoints' && (
        <Table
          columns={checkpointColumns}
          data={checkpoints}
          keyExtractor={(item) => item.id}
          isLoading={isLoadingCheckpoints}
          emptyMessage="No QR checkpoints configured yet. Click 'Create Checkpoint' to generate a signed QR."
        />
      )}

      {/* Tab 2: Logs Table */}
      {activeTab === 'logs' && (
        <Table
          columns={logColumns}
          data={scanLogs}
          keyExtractor={(item) => item.id}
          isLoading={isLoadingLogs}
          emptyMessage="No patrol scans recorded matching your filters."
          pagination={
            logsPagination
              ? {
                  currentPage: logsPagination.page,
                  totalPages: logsPagination.totalPages,
                  onPageChange: (p) => setLogsPage(p),
                }
              : undefined
          }
        />
      )}

      {/* Create Checkpoint Modal */}
      <Modal
        isOpen={createQrModalOpen}
        onClose={() => setCreateQrModalOpen(false)}
        title="Generate Signed Patrol QR Checkpoint"
      >
        <form onSubmit={handleCreateQrSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {createError && (
            <div style={{ padding: '10px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              {createError}
            </div>
          )}

          <Input
            label="Checkpoint Name"
            placeholder="e.g. North Perimeter Gate Checkpoint 3"
            value={qrName}
            onChange={(e) => setQrName(e.target.value)}
            required
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Branch Site
            </label>
            <select
              value={qrBranchId}
              onChange={(e) => setQrBranchId(e.target.value)}
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
              <option value="">Select Branch...</option>
              {allBranches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Location Description / Notes"
            placeholder="e.g. Mounted on exterior fence 2m from main road"
            value={qrDescription}
            onChange={(e) => setQrDescription(e.target.value)}
          />

          <Input
            label="Expected Patrol Interval (minutes)"
            type="number"
            min="5"
            max="1440"
            value={qrInterval}
            onChange={(e) => setQrInterval(e.target.value)}
            helperText="If no officer scans this QR within this interval, a missed patrol alert will trigger."
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Active From (Optional)"
              type="datetime-local"
              value={qrStartDate}
              onChange={(e) => setQrStartDate(e.target.value)}
            />
            <Input
              label="Expires On (Optional)"
              type="datetime-local"
              value={qrEndDate}
              onChange={(e) => setQrEndDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button type="button" variant="secondary" onClick={() => setCreateQrModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createQrMutation.isPending}>
              Generate Checkpoint
            </Button>
          </div>
        </form>
      </Modal>

      {/* View & Print QR Modal */}
      <Modal
        isOpen={!!viewQrItem}
        onClose={() => setViewQrItem(null)}
        title="Printable QR Checkpoint"
        maxWidth="460px"
      >
        {viewQrItem && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
            {/* QR canvas – black on white, 512px native, scaled to fit modal */}
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)',
                width: '260px',
                height: '260px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <canvas
                ref={qrCanvasRef}
                style={{ width: '228px', height: '228px', display: 'block', imageRendering: 'pixelated' }}
              />
            </div>

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                {viewQrItem.name}
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {viewQrItem.branch?.name || 'Branch Checkpoint'}
              </p>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '8px', fontFamily: 'monospace' }}>
                Signed HMAC Checkpoint ID: {viewQrItem.id}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                leftIcon={<Printer size={16} />}
                onClick={() => handlePrintQr(viewQrItem.name, viewQrItem.branch?.name || 'Branch Checkpoint')}
              >
                Print
              </Button>
              <Button
                variant="primary"
                style={{ flex: 1 }}
                leftIcon={<Download size={16} />}
                onClick={() => handleDownloadQrCanvas(viewQrItem.name)}
              >
                Download PNG
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
