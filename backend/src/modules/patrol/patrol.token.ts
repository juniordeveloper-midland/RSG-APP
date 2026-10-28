import crypto from 'crypto';
import QRCode from 'qrcode';
import { env } from '../../config/env';

export interface PatrolQrPayload {
  qr_id: string;
  branch_id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  issued_at: string;
}

/** Number of hex characters kept from the full HMAC-SHA256 digest (8 bytes = 16 hex chars). */
const HMAC_PREFIX_LEN = 16;

/**
 * Compute HMAC-SHA256(secret, data) and return the full hex digest.
 */
function hmacHex(data: string): string {
  return crypto
    .createHmac('sha256', env.PATROL_HMAC_SECRET)
    .update(data)
    .digest('hex');
}

// ─── Short token (new format) ───────────────────────────────────────────────

/**
 * Generate a short, scannable patrol token.
 * Format: "RSG1.<qr_id>.<first 16 hex chars of HMAC-SHA256(qr_id)>"
 *
 * The qr_id alone is the signed payload — all other metadata (branch, dates)
 * are looked up from the database during scan verification.
 * This keeps the QR payload short (~60 chars) so the QR code stays sparse and scannable.
 */
export function generateShortPatrolToken(qrId: string): string {
  const sig = hmacHex(qrId).slice(0, HMAC_PREFIX_LEN);
  return `RSG1.${qrId}.${sig}`;
}

/**
 * Parse and verify a short patrol token without a DB call.
 * Returns the qr_id if valid, otherwise returns an error string.
 */
export function verifyShortPatrolToken(token: string): {
  isValid: boolean;
  qrId?: string;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Token is required' };
  }

  const parts = token.split('.');
  // Must be exactly "RSG1", "<uuid>", "<16-char hex>"
  if (parts.length !== 3 || parts[0] !== 'RSG1') {
    return { isValid: false, error: 'Unrecognised token format — expected RSG1.<id>.<sig>' };
  }

  const [, qrId, receivedSig] = parts;

  if (!qrId || receivedSig.length !== HMAC_PREFIX_LEN) {
    return { isValid: false, error: 'Malformed token fields' };
  }

  const expectedSig = hmacHex(qrId).slice(0, HMAC_PREFIX_LEN);

  // Constant-time comparison padded to full length to avoid timing leaks
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const receivedBuf = Buffer.from(receivedSig, 'utf8');

  if (expectedBuf.length !== receivedBuf.length) {
    return { isValid: false, error: 'Signature length mismatch' };
  }

  if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return { isValid: false, error: 'Token signature invalid (tampered or wrong secret)' };
  }

  return { isValid: true, qrId };
}

// ─── Legacy long token (kept for reference / migration only) ────────────────

/**
 * @deprecated Use generateShortPatrolToken instead.
 * Kept so existing rows with the old signed_token can still be regenerated if needed.
 */
export function generateSignedPatrolToken(payload: PatrolQrPayload): string {
  const json = JSON.stringify(payload);
  const encodedPayload = Buffer.from(json, 'utf8').toString('base64url');
  const signature = hmacHex(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * @deprecated Verify the old long token format. New scans must use verifyShortPatrolToken.
 */
export function verifySignedPatrolToken(token: string): {
  isValid: boolean;
  payload?: PatrolQrPayload;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Token string is required' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Invalid token structure' };
  }

  const [encodedPayload, receivedSignature] = parts;
  const expectedSignature = hmacHex(encodedPayload);

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const receivedBuf = Buffer.from(receivedSignature, 'utf8');

  if (expectedBuf.length !== receivedBuf.length) {
    return { isValid: false, error: 'Invalid token signature length' };
  }

  if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return { isValid: false, error: 'Token signature mismatch (tampered token)' };
  }

  try {
    const json = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as PatrolQrPayload;

    if (!payload.qr_id || !payload.branch_id || !payload.name) {
      return { isValid: false, error: 'Malformed token payload: missing required fields' };
    }

    return { isValid: true, payload };
  } catch {
    return { isValid: false, error: 'Failed to decode token payload JSON' };
  }
}

/**
 * Generate a printable/downloadable PNG QR code Buffer for the given signed token.
 */
export async function generateQrCodePngBuffer(token: string): Promise<Buffer> {
  return QRCode.toBuffer(token, {
    type: 'png',
    margin: 2,
    width: 400,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

/**
 * Generate a Data URL (base64 image/png) for displaying in frontend UI.
 */
export async function generateQrCodeDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    margin: 2,
    width: 400,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}
