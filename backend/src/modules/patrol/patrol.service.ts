import crypto from 'crypto';
import { Request } from 'express';
import * as XLSX from 'xlsx';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/audit';
import { verifyGeofence } from '../attendance/attendance.geofence';
import {
  generateShortPatrolToken,
  verifyShortPatrolToken,
  generateQrCodePngBuffer,
  generateQrCodeDataUrl,
} from './patrol.token';
import {
  CreatePatrolQrInput,
  PatrolScanInput,
  PatrolLogsQuery,
} from './patrol.validation';

export class PatrolService {
  /**
   * Manager creates a patrol QR checkpoint.
   * Generates a tamper-proof HMAC-signed token, saves to database, and produces QR image representations.
   */
  async createPatrolQr(
    input: CreatePatrolQrInput,
    userId: string,
    req?: Request
  ) {
    const branch = await prisma.branch.findUnique({
      where: { id: input.branch_id },
    });

    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Target branch was not found', 404);
    }

    if (!branch.is_active) {
      throw new AppError('BRANCH_DISABLED', 'Cannot create patrol QR for a disabled branch', 400);
    }

    const qrId = crypto.randomUUID();

    const signedToken = generateShortPatrolToken(qrId);
    const qrDataUrl = await generateQrCodeDataUrl(signedToken);

    const patrolQr = await prisma.patrolQr.create({
      data: {
        id: qrId,
        branch_id: branch.id,
        name: input.name,
        description: input.description,
        signed_token: signedToken,
        start_date: input.start_date ? new Date(input.start_date) : null,
        end_date: input.end_date ? new Date(input.end_date) : null,
        interval_minutes: input.interval_minutes,
        is_active: true,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            lat: true,
            lng: true,
            radius_m: true,
          },
        },
      },
    });

    await recordAuditLog({
      userId,
      action: 'PATROL_QR_CREATED',
      entity: 'patrol_qrs',
      entityId: patrolQr.id,
      details: {
        name: patrolQr.name,
        branch_id: patrolQr.branch_id,
        interval_minutes: patrolQr.interval_minutes,
        start_date: patrolQr.start_date?.toISOString(),
        end_date: patrolQr.end_date?.toISOString(),
      },
      req,
    });

    return {
      ...patrolQr,
      qr_data_url: qrDataUrl,
    };
  }

  /**
   * Get a single patrol QR details.
   */
  async getPatrolQrById(id: string, branchScopeId?: string | null) {
    const qr = await prisma.patrolQr.findUnique({
      where: { id },
      include: {
        branch: true,
        _count: { select: { scans: true } },
      },
    });

    if (!qr) {
      throw new AppError('QR_NOT_FOUND', 'Patrol QR checkpoint not found', 404);
    }

    if (branchScopeId && qr.branch_id !== branchScopeId) {
      throw new AppError('BRANCH_ACCESS_DENIED', 'Forbidden: Branch scope mismatch', 403);
    }

    const qrDataUrl = await generateQrCodeDataUrl(qr.signed_token);

    return {
      ...qr,
      qr_data_url: qrDataUrl,
    };
  }

  /**
   * Get raw PNG buffer for printable/downloadable QR code.
   */
  async getPatrolQrPngBuffer(id: string, branchScopeId?: string | null): Promise<{
    buffer: Buffer;
    qr: { id: string; name: string };
  }> {
    const qr = await prisma.patrolQr.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!qr) {
      throw new AppError('QR_NOT_FOUND', 'Patrol QR checkpoint not found', 404);
    }

    if (branchScopeId && qr.branch_id !== branchScopeId) {
      throw new AppError('BRANCH_ACCESS_DENIED', 'Forbidden: Branch scope mismatch', 403);
    }

    const buffer = await generateQrCodePngBuffer(qr.signed_token);
    return { buffer, qr: { id: qr.id, name: qr.name } };
  }

  /**
   * List patrol QRs for manager.
   */
  async listPatrolQrs(
    branchId?: string,
    branchScopeId?: string | null,
    isActive?: boolean
  ) {
    const targetBranchId = branchScopeId || branchId;

    const where: Prisma.PatrolQrWhereInput = {
      ...(targetBranchId ? { branch_id: targetBranchId } : {}),
      ...(isActive !== undefined ? { is_active: isActive } : {}),
    };

    return prisma.patrolQr.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, address: true } },
        _count: { select: { scans: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Process and record a QR patrol scan.
   * - Idempotent via request_id.
   * - Verifies HMAC signature.
   * - Verifies branch and active dates.
   * - Detects rapid duplicate scans and suspicious GPS outside perimeter as anomalies.
   * - Stores device_time AND server_time in UTC.
   */
  async recordScan(
    input: PatrolScanInput,
    userId: string,
    userBranchScopeId?: string | null,
    req?: Request
  ) {
    // 1. Idempotency Check (Rule 2)
    const existing = await prisma.patrolScan.findUnique({
      where: { request_id: input.request_id },
      include: {
        qr: { include: { branch: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (existing) {
      return existing;
    }

    // 2. Verify token cryptographic signature (short format: RSG1.<qr_id>.<16-char hmac>)
    const verification = verifyShortPatrolToken(input.token);
    if (!verification.isValid || !verification.qrId) {
      throw new AppError(
        'INVALID_TOKEN',
        verification.error || 'Patrol QR token is invalid or has been tampered with',
        400
      );
    }

    const qrId = verification.qrId;

    // 3. Database checkpoint lookup (all metadata comes from DB, not the token)
    const qr = await prisma.patrolQr.findUnique({
      where: { id: qrId },
      include: { branch: true },
    });

    if (!qr) {
      throw new AppError('QR_NOT_FOUND', 'Patrol QR checkpoint does not exist in system', 404);
    }

    if (!qr.is_active) {
      throw new AppError('QR_INACTIVE', 'Patrol QR checkpoint has been deactivated', 400);
    }

    // 4. Branch Scope Validation (Rule 3)
    if (userBranchScopeId && userBranchScopeId !== qr.branch_id) {
      throw new AppError(
        'BRANCH_ACCESS_DENIED',
        'You are not authorized to scan checkpoints for this branch',
        403
      );
    }

    // 5. Active Dates Check
    const deviceDate = new Date(input.device_time);
    const serverTime = new Date();

    if (qr.start_date && deviceDate < qr.start_date) {
      throw new AppError(
        'QR_NOT_YET_ACTIVE',
        `This QR checkpoint is not valid until ${qr.start_date.toISOString()}`,
        400
      );
    }

    if (qr.end_date && deviceDate > qr.end_date) {
      throw new AppError(
        'QR_EXPIRED',
        `This QR checkpoint expired on ${qr.end_date.toISOString()}`,
        400
      );
    }

    // 6. Anomalies Detection (Suspicious GPS & Duplicate Rapid Scans)
    let isAnomaly = false;
    const anomalyReasons: string[] = [];

    // Check duplicate rapid scan (within PATROL_RAPID_SCAN_THRESHOLD_MINUTES)
    const rapidThreshold = new Date(
      serverTime.getTime() - env.PATROL_RAPID_SCAN_THRESHOLD_MINUTES * 60 * 1000
    );

    const recentScan = await prisma.patrolScan.findFirst({
      where: {
        qr_id: qr.id,
        server_time: { gte: rapidThreshold },
      },
      orderBy: { server_time: 'desc' },
      include: { user: { select: { name: true } } },
    });

    if (recentScan) {
      isAnomaly = true;
      const minsAgo = Math.max(
        0,
        Math.round((serverTime.getTime() - recentScan.server_time.getTime()) / 60000)
      );
      anomalyReasons.push(
        `DUPLICATE_SCAN: Checkpoint was already scanned ${minsAgo}m ago by ${recentScan.user.name}`
      );
    }

    // Check suspicious GPS against branch coordinates
    const branchLat = Number(qr.branch.lat);
    const branchLng = Number(qr.branch.lng);
    const { isWithin, distanceMeters } = verifyGeofence(
      input.lat,
      input.lng,
      branchLat,
      branchLng,
      qr.branch.radius_m
    );

    if (!isWithin) {
      isAnomaly = true;
      anomalyReasons.push(
        `SUSPICIOUS_GPS: Location is ${distanceMeters}m outside branch perimeter (allowed: ${qr.branch.radius_m}m)`
      );
    }

    if (input.accuracy_m && input.accuracy_m > env.MAX_GPS_ACCURACY_METERS) {
      isAnomaly = true;
      anomalyReasons.push(
        `POOR_GPS_ACCURACY: GPS accuracy is ±${Math.round(input.accuracy_m)}m (exceeds threshold ${env.MAX_GPS_ACCURACY_METERS}m)`
      );
    }

    // 7. Store scan record
    const scan = await prisma.patrolScan.create({
      data: {
        qr_id: qr.id,
        user_id: userId,
        device_time: deviceDate,
        server_time: serverTime,
        lat: new Prisma.Decimal(input.lat),
        lng: new Prisma.Decimal(input.lng),
        accuracy_m: input.accuracy_m,
        is_anomaly: isAnomaly,
        anomaly_reason: anomalyReasons.length > 0 ? anomalyReasons.join('; ') : null,
        request_id: input.request_id,
      },
      include: {
        qr: {
          include: {
            branch: {
              select: { id: true, name: true, address: true, radius_m: true },
            },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // 8. Update last_scanned_at on QR record
    await prisma.patrolQr.update({
      where: { id: qr.id },
      data: { last_scanned_at: serverTime },
    });

    // 9. Append-only audit log
    await recordAuditLog({
      userId,
      action: 'PATROL_SCAN_RECORDED',
      entity: 'patrol_scans',
      entityId: scan.id,
      details: {
        qr_id: qr.id,
        checkpoint_name: qr.name,
        branch_id: qr.branch_id,
        is_anomaly: isAnomaly,
        anomaly_reason: scan.anomaly_reason,
      },
      req,
    });

    return scan;
  }

  /**
   * Get paginated patrol logs with filters.
   */
  async getPatrolLogs(query: PatrolLogsQuery, branchScopeId?: string | null) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const targetBranchId = branchScopeId || query.branch_id;

    const where: Prisma.PatrolScanWhereInput = {
      user: { role: { not: Role.admin } },
      ...(targetBranchId ? { qr: { branch_id: targetBranchId } } : {}),
      ...(query.qr_id ? { qr_id: query.qr_id } : {}),
      ...(query.user_id ? { user_id: query.user_id } : {}),
      ...(query.is_anomaly !== undefined ? { is_anomaly: query.is_anomaly } : {}),
      ...(query.start_date || query.end_date
        ? {
            server_time: {
              ...(query.start_date ? { gte: new Date(query.start_date) } : {}),
              ...(query.end_date ? { lte: new Date(query.end_date) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { qr: { name: { contains: query.search } } },
              { user: { name: { contains: query.search } } },
              { user: { email: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const [scans, total] = await Promise.all([
      prisma.patrolScan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { server_time: 'desc' },
        include: {
          qr: {
            include: {
              branch: { select: { id: true, name: true, address: true } },
            },
          },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.patrolScan.count({ where }),
    ]);

    return {
      scans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Export patrol logs as formatted Excel spreadsheet (.xlsx).
   */
  async exportPatrolLogsExcel(
    query: PatrolLogsQuery,
    branchScopeId?: string | null
  ): Promise<{ buffer: Buffer; filename: string }> {
    const targetBranchId = branchScopeId || query.branch_id;

    const where: Prisma.PatrolScanWhereInput = {
      user: { role: { not: Role.admin } },
      ...(targetBranchId ? { qr: { branch_id: targetBranchId } } : {}),
      ...(query.qr_id ? { qr_id: query.qr_id } : {}),
      ...(query.user_id ? { user_id: query.user_id } : {}),
      ...(query.is_anomaly !== undefined ? { is_anomaly: query.is_anomaly } : {}),
      ...(query.start_date || query.end_date
        ? {
            server_time: {
              ...(query.start_date ? { gte: new Date(query.start_date) } : {}),
              ...(query.end_date ? { lte: new Date(query.end_date) } : {}),
            },
          }
        : {}),
    };

    const scans = await prisma.patrolScan.findMany({
      where,
      orderBy: { server_time: 'desc' },
      include: {
        qr: {
          include: {
            branch: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const rows = scans.map((s: (typeof scans)[number]) => ({
      'Scan ID': s.id,
      'Checkpoint Name': s.qr.name,
      'Branch Name': s.qr.branch.name,
      'Guard Name': s.user.name,
      'Guard Email': s.user.email,
      'Device Time (UTC)': s.device_time.toISOString(),
      'Server Time (UTC)': s.server_time.toISOString(),
      'Latitude': s.lat ? Number(s.lat) : '',
      'Longitude': s.lng ? Number(s.lng) : '',
      'GPS Accuracy (m)': s.accuracy_m ?? '',
      'Is Anomaly': s.is_anomaly ? 'YES' : 'NO',
      'Anomaly Reason': s.anomaly_reason || '',
      'Request ID': s.request_id,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Patrol Logs');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `patrol-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return { buffer, filename };
  }
}

export const patrolService = new PatrolService();
