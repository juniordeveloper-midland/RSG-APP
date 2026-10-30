import React, { useState, useRef } from 'react';
import { FileText, Image as ImageIcon, Upload, Trash2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from './Button';

export interface EmployeeDocumentItem {
  id?: string;
  name: string;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
}

export interface DocumentUploadBoxProps {
  label?: string;
  documents: EmployeeDocumentItem[];
  onChange: (docs: EmployeeDocumentItem[]) => void;
  onDeleteDocument?: (docId: string) => Promise<void>;
  maxFiles?: number;
}

export const DocumentUploadBox: React.FC<DocumentUploadBoxProps> = ({
  label = 'Employee Documents (Optional)',
  documents,
  onChange,
  onDeleteDocument,
  maxFiles = 10,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes === 0) return '—';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const validMimes = ['application/pdf', 'image/jpeg', 'image/png'];
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

    const filesToUpload: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();
      const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));
      const hasValidMime = validMimes.includes(file.type);

      if (!hasValidExt && !hasValidMime) {
        setError(`"${file.name}" has an unsupported format. Only PDF, JPG, and PNG files are allowed.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (file.size > MAX_SIZE) {
        setError(`"${file.name}" exceeds the 5 MB limit. Please choose files under 5 MB.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      filesToUpload.push(file);
    }

    try {
      setIsUploading(true);
      const newUploaded: EmployeeDocumentItem[] = [];

      for (const file of filesToUpload) {
        const res = await api.uploadEmployeeDocument(file);
        if (res?.documents && res.documents.length > 0) {
          const doc = res.documents[0];
          newUploaded.push({
            name: doc.name,
            file_url: doc.file_url,
            file_type: doc.file_type,
            file_size: doc.file_size,
          });
        }
      }

      onChange([...documents, ...newUploaded]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (index: number) => {
    const doc = documents[index];
    if (doc.id && onDeleteDocument) {
      try {
        await onDeleteDocument(doc.id);
      } catch (err: any) {
        setError(err.message || 'Failed to delete document from server.');
        return;
      }
    }
    const updated = documents.filter((_, i) => i !== index);
    onChange(updated);
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
          <span>{label}</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
            PDF, JPG, PNG up to 5 MB each
          </span>
        </label>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        style={{ display: 'none' }}
        onChange={handleFilesSelected}
      />

      {/* Upload Drop / Action Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          textAlign: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.2s',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
        }}
      >
        {isUploading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Uploading documents...</span>
          </div>
        ) : (
          <>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(235, 5, 5, 0.1)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Upload size={18} />
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>
                Click to upload documents
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {' '}or browse files (ID, SIA Licence, BRP, Contract)
              </span>
            </div>
          </>
        )}
      </div>

      {/* Error Message Banner */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: '#ef4444',
            fontSize: '12px',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
          {documents.map((doc, idx) => {
            const isPdf = doc.file_type?.includes('pdf') || doc.name.toLowerCase().endsWith('.pdf');
            return (
              <div
                key={doc.id || doc.file_url || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      backgroundColor: isPdf ? 'rgba(235, 5, 5, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                      color: isPdf ? 'var(--color-primary)' : '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isPdf ? <FileText size={16} /> : <ImageIcon size={16} />}
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
                        maxWidth: '300px',
                      }}
                      title={doc.name}
                    >
                      {doc.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                      {formatFileSize(doc.file_size)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {doc.file_url && (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--color-text-muted)',
                        padding: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                      }}
                      title="View document"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(idx);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-danger)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: '4px',
                    }}
                    title="Remove document"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

