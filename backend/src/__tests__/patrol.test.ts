import request from 'supertest';
import bcrypt from 'bcrypt';
import { Role, UserStatus } from '@prisma/client';
import app from '../app';
import { prisma } from '../config/prisma';
import { runMissedPatrolJob } from '../modules/patrol/patrol.cron';
import { generateSignedPatrolToken } from '../modules/patrol/patrol.token';

describe('RSG QR Patrol Engine', () => {
  const timestamp = Date.now();
  const managerEmail = `patrol.mgr.${timestamp}@rsg-security.co.uk`;
  const guardEmail = `patrol.guard.${timestamp}@rsg-security.co.uk`;
  const testPassword = 'PatrolPassword123!';

  let testBranchId: string;
  let managerToken: string;
  let guardToken: string;
  let guardId: string;

  let activeQrId: string;
  let activeSignedToken: string;
  let expiredQrId: string;
  let expiredSignedToken: string;

  const branchLat = 51.5073509;
  const branchLng = -0.1277583;
  const branchRadius = 150.0;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // 1. Create test branch
    const branch = await prisma.branch.create({
      data: {
        name: 'RSG Victoria Patrol Hub',
        address: '10 Victoria Station Yard, London',
        lat: branchLat,
        lng: branchLng,
        radius_m: branchRadius,
        is_active: true,
      },
    });
    testBranchId = branch.id;

    // 2. Create manager
    await prisma.user.create({
      data: {
        name: 'Patrol Operations Director',
        email: managerEmail,
        password_hash: passwordHash,
        role: Role.manager,
        status: UserStatus.active,
        branch_id: branch.id,
        managerial_access: true,
      },
    });

    // 3. Create guard
    const guard = await prisma.user.create({
      data: {
        name: 'Patrol Security Officer Dave',
        email: guardEmail,
        password_hash: passwordHash,
        role: Role.employee,
        status: UserStatus.active,
        branch_id: branch.id,
      },
    });
    guardId = guard.id;

    // 4. Log in to get tokens
    const mgrRes = await request(app)
      .post('/auth/login')
      .send({ email: managerEmail, password: testPassword });
    managerToken = mgrRes.body.data.accessToken;

    const guardRes = await request(app)
      .post('/auth/login')
      .send({ email: guardEmail, password: testPassword });
    guardToken = guardRes.body.data.accessToken;

    // 5. Create an expired QR in DB directly for expiration testing
    const expId = `exp-qr-${timestamp}`;
    const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const expToken = generateSignedPatrolToken({
      qr_id: expId,
      branch_id: testBranchId,
      name: 'Expired Storage Vault Gate',
      start_date: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      end_date: pastDate.toISOString(),
      issued_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    });

    const expQr = await prisma.patrolQr.create({
      data: {
        id: expId,
        branch_id: testBranchId,
        name: 'Expired Storage Vault Gate',
        signed_token: expToken,
        start_date: new Date(Date.now() - 72 * 60 * 60 * 1000),
        end_date: pastDate,
        interval_minutes: 60,
        is_active: true,
      },
    });
    expiredQrId = expQr.id;
    expiredSignedToken = expToken;
  });

  afterAll(async () => {
    await prisma.alert.deleteMany({ where: { branch_id: testBranchId } });
    await prisma.patrolScan.deleteMany({
      where: { qr: { branch_id: testBranchId } },
    });
    await prisma.patrolQr.deleteMany({ where: { branch_id: testBranchId } });
    await prisma.user.deleteMany({
      where: { email: { in: [managerEmail, guardEmail] } },
    });
    await prisma.branch.deleteMany({ where: { id: testBranchId } });
    await prisma.$disconnect();
  });

  describe('1. Patrol QR Creation & Image Generation', () => {
    it('should allow manager to create a patrol QR with HMAC signed token and return data URL', async () => {
      const res = await request(app)
        .post('/patrol/qrs')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          branch_id: testBranchId,
          name: 'Main Perimeter Gate Checkpoint',
          description: 'Front gate checkpoint next to guard booth',
          interval_minutes: 45,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Main Perimeter Gate Checkpoint');
      expect(res.body.data.interval_minutes).toBe(45);
      expect(res.body.data.signed_token).toContain('.');
      expect(res.body.data.qr_data_url).toContain('data:image/png;base64,');

      activeQrId = res.body.data.id;
      activeSignedToken = res.body.data.signed_token;

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'PATROL_QR_CREATED',
          entity: 'patrol_qrs',
          entity_id: activeQrId,
        },
      });
      expect(audit).toBeDefined();
    });

    it('should serve a high-resolution printable PNG QR image on GET /patrol/qrs/:id/image', async () => {
      const res = await request(app)
        .get(`/patrol/qrs/${activeQrId}/image`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toBe('image/png');
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(100);
    });

    it('should block non-managers from creating patrol QRs with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/patrol/qrs')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({
          branch_id: testBranchId,
          name: 'Unauthorized Checkpoint',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Patrol Scan Recording & Idempotency', () => {
    const scanRequestId = `req-scan-${timestamp}-001`;

    it('should record a valid patrol scan within geofence and store UTC device_time + server_time', async () => {
      const deviceTime = new Date().toISOString();

      const res = await request(app)
        .post('/patrol/scan')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({
          token: activeSignedToken,
          lat: branchLat, // Exactly at branch coordinates
          lng: branchLng,
          accuracy_m: 12.0,
          device_time: deviceTime,
          request_id: scanRequestId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.qr_id).toBe(activeQrId);
      expect(res.body.data.user_id).toBe(guardId);
      expect(res.body.data.is_anomaly).toBe(false);
      expect(res.body.data.request_id).toBe(scanRequestId);
      expect(res.body.data.device_time).toBeDefined();
      expect(res.body.data.server_time).toBeDefined();

      // Check audit log recorded without logging the raw signed token
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'PATROL_SCAN_RECORDED',
          entity: 'patrol_scans',
          entity_id: res.body.data.id,
        },
      });
      expect(audit).toBeDefined();
      expect(JSON.stringify(audit?.details)).not.toContain(activeSignedToken);
    });

    it('should return the original scan record when the same request_id is re-sent (Idempotent Rule 2)', async () => {
      const res = await request(app)
        .post('/patrol/scan')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({
          token: activeSignedToken,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 12.0,
          device_time: new Date().toISOString(),
          request_id: scanRequestId, // DUPLICATE REQUEST ID
        });

      expect(res.status).toBe(201);
      expect(res.body.data.request_id).toBe(scanRequestId);
    });
  });

  describe('3. Anomaly Detection (Duplicate Scans & Suspicious GPS)', () => {
    it('should flag a rapid duplicate scan within 5 minutes as an anomaly (is_anomaly = true)', async () => {
      // Rapid scan of the same checkpoint with a DIFFERENT request_id
      const res = await request(app)
        .post('/patrol/scan')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({
          token: activeSignedToken,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 10.0,
          device_time: new Date().toISOString(),
          request_id: `req-rapid-duplicate-${timestamp}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.is_anomaly).toBe(true);
      expect(res.body.data.anomaly_reason).toContain('DUPLICATE_SCAN');
    });

    it('should flag suspicious GPS location outside branch perimeter as an anomaly', async () => {
      // Guard scans from Manchester coordinates while branch is in London (300km away)
      const res = await request(app)
        .post('/patrol/scan')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({
          token: activeSignedToken,
          lat: 53.483959, // Manchester
          lng: -2.244644,
          accuracy_m: 15.0,
          device_time: new Date().toISOString(),
          request_id: `req-suspicious-gps-${timestamp}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.is_anomaly).toBe(true);
      expect(res.body.data.anomaly_reason).toContain('SUSPICIOUS_GPS');
    });
  });

  describe('4. Token Verification & Expired Checkpoint Validation', () => {
    it('should reject a scan with a tampered HMAC signature (400 INVALID_TOKEN)', async () => {
      // Tamper signature by changing last characters
      const parts = activeSignedToken.split('.');
      const tamperedToken = `${parts[0]}.bad_signature_deadbeef1234`;

      const res = await request(app)
        .post('/patrol/scan')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({
          token: tamperedToken,
          lat: branchLat,
          lng: branchLng,
          device_time: new Date().toISOString(),
          request_id: `req-tampered-${timestamp}`,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
      expect(res.body.error.message).toContain('signature');
    });

    it('should reject a malformed token (400 INVALID_TOKEN)', async () => {
      const res = await request(app)
        .post('/patrol/scan')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({
          token: 'not-a-valid-token-string',
          lat: branchLat,
          lng: branchLng,
          device_time: new Date().toISOString(),
          request_id: `req-malformed-${timestamp}`,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject scan of an expired QR checkpoint (400 QR_EXPIRED)', async () => {
      const res = await request(app)
        .post('/patrol/scan')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({
          token: expiredSignedToken,
          lat: branchLat,
          lng: branchLng,
          device_time: new Date().toISOString(),
          request_id: `req-expired-scan-${timestamp}`,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('QR_EXPIRED');
      expect(res.body.error.message).toContain('expired');
    });
  });

  describe('5. Patrol Logs Query & Excel Export', () => {
    it('should allow manager to query patrol logs with filters and pagination on GET /patrol/logs', async () => {
      const res = await request(app)
        .get(`/patrol/logs?branch_id=${testBranchId}&page=1&limit=10`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.scans)).toBe(true);
      expect(res.body.data.scans.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('should allow manager to filter patrol logs by anomaly status', async () => {
      const res = await request(app)
        .get(`/patrol/logs?branch_id=${testBranchId}&is_anomaly=true`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.scans)).toBe(true);
      res.body.data.scans.forEach((scan: { is_anomaly: boolean }) => {
        expect(scan.is_anomaly).toBe(true);
      });
    });

    it('should export patrol logs as an Excel (.xlsx) spreadsheet on GET /patrol/logs/export', async () => {
      const res = await request(app)
        .get(`/patrol/logs/export?branch_id=${testBranchId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .parse((response, callback) => {
          response.setEncoding('binary');
          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
          });
          response.on('end', () => {
            callback(null, Buffer.from(data, 'binary'));
          });
        });

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.header['content-disposition']).toContain('attachment; filename=');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('6. Missed Patrol Alert Cron Job', () => {
    it('should create an alert when an expected patrol checkpoint is overdue', async () => {
      // Create a checkpoint whose last activity was 120 minutes ago (interval 30 min)
      const overdueTime = new Date(Date.now() - 120 * 60 * 1000);
      const overdueId = `overdue-qr-${timestamp}`;

      const overdueToken = generateSignedPatrolToken({
        qr_id: overdueId,
        branch_id: testBranchId,
        name: 'Isolated Fuel Depo Checkpoint',
        issued_at: overdueTime.toISOString(),
      });

      await prisma.patrolQr.create({
        data: {
          id: overdueId,
          branch_id: testBranchId,
          name: 'Isolated Fuel Depo Checkpoint',
          signed_token: overdueToken,
          interval_minutes: 30,
          last_scanned_at: overdueTime,
          created_at: overdueTime,
          is_active: true,
        },
      });

      // Execute missed patrol detection job
      const report = await runMissedPatrolJob();

      expect(report.checkedCheckpoints).toBeGreaterThan(0);
      expect(report.missedAlertsCreated).toBeGreaterThanOrEqual(1);

      // Verify that the alert exists in database
      const alert = await prisma.alert.findFirst({
        where: {
          branch_id: testBranchId,
          type: 'missed_patrol',
          status: 'open',
          message: { contains: 'Isolated Fuel Depo Checkpoint' },
        },
      });

      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('medium');
    });
  });
});
