import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Navigation } from 'lucide-react';

// ---------------------------------------------------------------------------
// Draggable marker icon — red pin styled for RSG dark theme
// ---------------------------------------------------------------------------
const dragPin = L.divIcon({
  className: '',
  html: `<div style="
    position: relative;
    width: 32px;
    height: 42px;
    cursor: grab;
  ">
    <div style="
      width: 32px;
      height: 32px;
      background: #eb0505;
      border: 3px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 14px rgba(235,5,5,0.55);
    "></div>
    <div style="
      position: absolute;
      top: 8px;
      left: 8px;
      width: 12px;
      height: 12px;
      background: #ffffff;
      border-radius: 50%;
    "></div>
  </div>`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -42],
});

// ---------------------------------------------------------------------------
// Inner component: handles click-to-place and marker drag
// ---------------------------------------------------------------------------
interface ClickHandlerProps {
  onPositionChange: (lat: number, lng: number) => void;
}

const ClickHandler: React.FC<ClickHandlerProps> = ({ onPositionChange }) => {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// ---------------------------------------------------------------------------
// DraggableMarker — syncs drag end back to parent
// ---------------------------------------------------------------------------
interface DraggableMarkerProps {
  position: [number, number];
  onPositionChange: (lat: number, lng: number) => void;
  radiusM: number;
}

const DraggableMarker: React.FC<DraggableMarkerProps> = ({ position, onPositionChange, radiusM }) => {
  const markerRef = useRef<L.Marker | null>(null);

  return (
    <>
      <Circle
        center={position}
        radius={radiusM}
        pathOptions={{
          color: '#eb0505',
          fillColor: '#eb0505',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '5, 5',
        }}
      />
      <Marker
        position={position}
        icon={dragPin}
        draggable
        ref={markerRef}
        eventHandlers={{
          dragend() {
            const m = markerRef.current;
            if (m) {
              const { lat, lng } = m.getLatLng();
              onPositionChange(lat, lng);
            }
          },
        }}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface LocationPickerMapProps {
  lat: number;
  lng: number;
  radiusM?: number;
  onPositionChange: (lat: number, lng: number) => void;
  height?: string;
}

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  lat,
  lng,
  radiusM = 150,
  onPositionChange,
  height = '240px',
}) => {
  const hasPin = lat !== 0 || lng !== 0;

  // Geolocation helper
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onPositionChange(pos.coords.latitude, pos.coords.longitude),
      () => { /* silently ignore denied */ },
    );
  };

  return (
    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      <MapContainer
        key={`picker-${lat.toFixed(4)}-${lng.toFixed(4)}`}
        center={[hasPin ? lat : 51.5074, hasPin ? lng : -0.1278]}
        zoom={hasPin ? 15 : 5}
        scrollWheelZoom
        style={{ width: '100%', height, backgroundColor: '#262626' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPositionChange={onPositionChange} />
        {hasPin && (
          <DraggableMarker
            position={[lat, lng]}
            onPositionChange={onPositionChange}
            radiusM={radiusM}
          />
        )}
      </MapContainer>

      {/* Overlay hint */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.65)',
          color: '#ffffff',
          fontSize: '11px',
          padding: '4px 10px',
          borderRadius: '20px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 500,
        }}
      >
        {hasPin ? 'Drag the pin or click to reposition' : 'Click anywhere on the map to place a pin'}
      </div>

      {/* Locate me button */}
      <button
        type="button"
        onClick={handleLocateMe}
        title="Use my current location"
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          zIndex: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '12px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        <Navigation size={13} />
        My Location
      </button>
    </div>
  );
};
