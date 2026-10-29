import React, { useState, useRef, useEffect } from 'react';
import { User, Upload, X, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from './Button';

export interface PhotoUploadBoxProps {
  label?: string;
  photoUrl?: string | null;
  onPhotoChange: (url: string | null) => void;
  error?: string | null;
  onErrorChange?: (err: string | null) => void;
}

export const PhotoUploadBox: React.FC<PhotoUploadBoxProps> = ({
  label = 'Profile Picture / Contact Photo (Optional)',
  photoUrl,
  onPhotoChange,
  error: externalError,
  onErrorChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(photoUrl || null);
  }, [photoUrl]);

  const activeError = externalError || internalError;

  const setError = (msg: string | null) => {
    setInternalError(msg);
    if (onErrorChange) {
      onErrorChange(msg);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file triggers onChange
    e.target.value = '';
    setError(null);

    // Validate file type (JPG or PNG only)
    const validTypes = ['image/jpeg', 'image/png'];
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const hasValidExt = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!validTypes.includes(file.type) && !hasValidExt) {
      setError('Invalid file type. Only JPG and PNG image files are allowed.');
      return;
    }

    // Validate file size (up to 2 MB)
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB in bytes
    if (file.size > MAX_SIZE) {
      setError('File exceeds 2 MB limit. Please choose a JPG or PNG image under 2 MB.');
      return;
    }

    try {
      setIsUploading(true);
      // Instant local preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      // Upload to server
      const res = await api.uploadClientPhoto(file);
      if (res?.photo_url) {
        onPhotoChange(res.photo_url);
        setPreview(res.photo_url);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo. Please ensure it is JPG or PNG under 2 MB.');
      setPreview(photoUrl || null);
      onPhotoChange(photoUrl || null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    setError(null);
    onPhotoChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {label && (
        <label
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          {label}
        </label>
      )}

      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '14px 16px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          flexWrap: 'wrap',
        }}
      >
        {/* Round Preview / Default Avatar */}
        <div style={{ position: 'relative', width: '68px', height: '68px', flexShrink: 0 }}>
          {preview ? (
            <img
              src={preview}
              alt="Profile Preview"
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--color-primary)',
                boxShadow: 'var(--shadow-sm)',
              }}
              onError={() => {
                setPreview(null);
              }}
            />
          ) : (
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-bg-darker)',
                border: '2px dashed var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-dim)',
              }}
            >
              <User size={30} />
            </div>
          )}

          {isUploading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            </div>
          )}
        </div>

        {/* Upload Controls & Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {preview ? 'Change Photo' : 'Choose Photo'}
            </Button>

            {preview && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                leftIcon={<X size={14} />}
                onClick={handleRemove}
                disabled={isUploading}
                style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                Remove
              </Button>
            )}
          </div>

          <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
            Only JPG or PNG format. Maximum file size: 2 MB.
          </span>
        </div>
      </div>

      {/* Error Message */}
      {activeError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--color-danger)',
            marginTop: '2px',
          }}
        >
          <AlertCircle size={14} />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  );
};

