import { Request } from 'express';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  req?: Request;
}

// Strip out any sensitive fields to guarantee tokens/passwords never leak into audit logs
const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'accesstoken',
  'refreshtoken',
  'newpassword',
  'oldpassword',
  'secret',
  'authorization',
]);

const sanitizeDetails = (obj?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!obj) return undefined;
  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      continue; // Skip sensitive values completely
    }
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      sanitized[key] = sanitizeDetails(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
};

/**
 * Append-only audit logger.
 * Never logs passwords, tokens, or secrets.
 */
export const recordAuditLog = async ({
  userId,
  action,
  entity,
  entityId,
  details = {},
  req,
}: AuditLogParams): Promise<void> => {
  try {
    const meta: Record<string, unknown> = { ...details };

    if (req) {
      meta.ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      meta.userAgent = req.headers['user-agent'];
    }

    const cleanDetails = sanitizeDetails(meta);

    await prisma.auditLog.create({
      data: {
        user_id: userId ?? null,
        action,
        entity,
        entity_id: entityId ?? null,
        details: cleanDetails ? (cleanDetails as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch (error) {
    // Audit log write failure should be reported but not break the primary response flow
    // eslint-disable-next-line no-console
    console.error('Failed to create audit log entry:', error);
  }
};
