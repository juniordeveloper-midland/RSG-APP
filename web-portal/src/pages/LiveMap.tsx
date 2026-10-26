import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Shield, Building2, QrCode, Users, Layers, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { Card } from '../components/common/Card';
import { ErrorBanner } from '../components/common/ErrorBanner';

// Custom SVG HTML div icons styled for RSG dark theme
const branchIcon = L.divIcon({
  className: 'rsg-map-icon-branch',
  html: `<div style="
    width: 32px;
    height: 32px;
    background-color: #eb0505;
    border: 2px solid #ffffff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    box-shadow: 0 0 10px rgba(235,5,5,0.6);
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const guardIcon = L.divIcon({
  className: 'rsg-map-icon-guard',
  html: `<div style="
    width: 28px;
    height: 28px;
    background-color: #10b981;
    border: 2px solid #ffffff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    box-shadow: 0 0 10px rgba(16,185,129,0.7);
    animation: pulse 2s infinite;
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const checkpointIcon = L.divIcon({
  className: 'rsg-map-icon-qr',
  html: `<div style="
    width: 24px;
    height: 24px;
    background-color: #3b82f6;
    border: 2px solid #ffffff;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    box-shadow: 0 0 8px rgba(59,130,246,0.5);
  ">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/>
    </svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export const LiveMap: React.FC = () => {
  const [selectedBranchId, setSelectedBranchId] = useState('');

  // 1. Fetch Branches
  const { data: branchesData, error: branchError } = useQuery({
    queryKey: ['branchesMap'],
    queryFn: () => api.getBranches({ limit: 100 }),
  });
  // Backend returns { items: [...], pagination: {...} }
  const allBranches = branchesData?.items ?? [];

  // Filtered branch or default center (London)
  const activeBranch = allBranches.find((b: any) => b.id === selectedBranchId) || allBranches[0];
  const centerLat = activeBranch ? Number(activeBranch.lat) : 51.5074;
  const centerLng = activeBranch ? Number(activeBranch.lng) : -0.1278;

  // 2. Fetch Active On-Duty Attendance
  const { data: activeAttendance = [] } = useQuery({
    queryKey: ['activeAttendanceMap', selectedBranchId],
    queryFn: () => api.getActiveAttendance(selectedBranchId || undefined),
    refetchInterval: 10000, // Live poll guards every 10s
  });

  // 3. Fetch Patrol Checkpoints
  const { data: checkpoints = [] } = useQuery({
    queryKey: ['checkpointsMap', selectedBranchId],
    queryFn: () => api.getPatrolQrs(selectedBranchId || undefined),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 120px)' }}>
      <ErrorBanner message={branchError ? (branchError as any).message : null} />
      {/* Controls Bar */}
      <Card style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
              Live Tactical Operations Map
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Real-time geofence radiuses, patrol posts, and guard tracking.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: 'var(--color-primary)' }} />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{
                  height: '38px',
                  backgroundColor: 'var(--color-bg-darker)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  padding: '0 12px',
                  fontSize: '13px',
                }}
              >
                <option value="">All Operational Branches</option>
                {allBranches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eb0505', display: 'inline-block' }} />
                Branch Hub ({allBranches.length})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                Officer On Duty ({activeAttendance.length})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3b82f6', display: 'inline-block' }} />
                QR Checkpoint ({checkpoints.length})
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Interactive Map */}
      <div
        style={{
          flex: 1,
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
        }}
      >
        <MapContainer
          key={`${centerLat}-${centerLng}`}
          center={[centerLat, centerLng]}
          zoom={14}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', backgroundColor: '#262626' }}
        >
          {/* CartoDB Dark Matter tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Render Branches with Geofence Rings */}
          {allBranches.map((branch: any) => {
            const bLat = Number(branch.lat);
            const bLng = Number(branch.lng);
            if (!bLat || !bLng) return null;

            return (
              <React.Fragment key={branch.id}>
                {/* Geofence Perimeter Radius Circle */}
                <Circle
                  center={[bLat, bLng]}
                  radius={branch.radius_m || 150}
                  pathOptions={{
                    color: '#eb0505',
                    fillColor: '#eb0505',
                    fillOpacity: 0.12,
                    weight: 2,
                    dashArray: '4, 4',
                  }}
                />

                <Marker position={[bLat, bLng]} icon={branchIcon}>
                  <Popup className="rsg-map-popup">
                    <div style={{ color: '#ffffff', padding: '4px' }}>
                      <strong style={{ fontSize: '14px', color: '#eb0505' }}>{branch.name}</strong>
                      <div style={{ fontSize: '12px', marginTop: '2px', color: '#bdbdbd' }}>{branch.address}</div>
                      <div style={{ fontSize: '11px', marginTop: '4px', color: '#ffffff' }}>
                        Geofence: <strong>{branch.radius_m}m radius</strong>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}

          {/* Render Active On-Duty Guards */}
          {activeAttendance.map((att: any) => {
            const gLat = att.in_lat ? Number(att.in_lat) : Number(att.shift?.branch?.lat);
            const gLng = att.in_lng ? Number(att.in_lng) : Number(att.shift?.branch?.lng);
            if (!gLat || !gLng) return null;

            return (
              <Marker key={att.id} position={[gLat, gLng]} icon={guardIcon}>
                <Popup>
                  <div style={{ color: '#ffffff', padding: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="badge badge-success">On Duty</span>
                      <strong style={{ fontSize: '13px' }}>{att.user?.name}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#bdbdbd', marginTop: '4px' }}>
                      Shift: {att.shift?.name || 'Assigned Shift'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888888', marginTop: '2px', fontFamily: 'monospace' }}>
                      Clocked In: {att.check_in_at ? new Date(att.check_in_at).toLocaleTimeString() : 'Active'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Render Checkpoints (approximate near branch) */}
          {checkpoints.map((cp: any, idx: number) => {
            const branch = allBranches.find((b: any) => b.id === cp.branch_id);
            if (!branch || !branch.lat) return null;

            // Offset checkpoints slightly around branch coordinates for visual clarity
            const offsetLat = Number(branch.lat) + (idx % 2 === 0 ? 0.0006 : -0.0006) * (idx + 1);
            const offsetLng = Number(branch.lng) + (idx % 2 === 0 ? -0.0006 : 0.0006) * (idx + 1);

            return (
              <Marker key={cp.id} position={[offsetLat, offsetLng]} icon={checkpointIcon}>
                <Popup>
                  <div style={{ color: '#ffffff', padding: '4px' }}>
                    <strong style={{ fontSize: '13px', color: '#3b82f6' }}>{cp.name}</strong>
                    <div style={{ fontSize: '12px', color: '#bdbdbd' }}>
                      Expected Interval: every {cp.interval_minutes}m
                    </div>
                    <div style={{ fontSize: '11px', color: '#888888', marginTop: '2px' }}>
                      {cp.last_scanned_at ? `Last scanned: ${new Date(cp.last_scanned_at).toLocaleTimeString()}` : 'Not scanned today'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <style>{`
        .leaflet-popup-content-wrapper {
          background-color: var(--color-surface) !important;
          border: 1px solid var(--color-border) !important;
          border-radius: var(--radius-md) !important;
          box-shadow: var(--shadow-lg) !important;
        }
        .leaflet-popup-tip {
          background-color: var(--color-surface) !important;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
};
