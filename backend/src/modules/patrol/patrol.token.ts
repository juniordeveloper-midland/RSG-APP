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

/**
 * Generate HMAC-SHA256 signature for the given payload string.
 */
function signPayload(serializedPayload: string): string {
  return crypto
    .createHmac('sha256', env.PATROL_HMAC_SECRET)
    .update(serializedPayload)
    .digest('hex');
}

/**
 * Generate a tamper-proof signed token containing the patrol QR payload and HMAC signature.
 * Format: base64url(payloadJson) + "." + signatureHex
 */
export function generateSignedPatrolToken(payload: PatrolQrPayload): string {
  const json = JSON.stringify(payload);
  const encodedPayload = Buffer.from(json, 'utf8').toString('base64url');
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies the integrity and authenticity of a signed patrol token.
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

  // Compute expected signature
  const expectedSignature = signPayload(encodedPayload);

  // Use timingSafeEqual to avoid timing attacks
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
  } catch (err) {
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
