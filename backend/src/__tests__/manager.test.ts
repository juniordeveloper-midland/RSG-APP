import request from 'supertest';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import app from '../app';
import { prisma } from '../config/prisma';
import { Role, UserStatus } from '@prisma/client';

describe('RSG Manager APIs: Branches & Employees', () => {
  const managerEmail = 'manager-admin@region.com';
  const guardEmail = 'guard-worker@region.com';
  const testPassword = 'Password123!';

  let managerToken: string;
  let guardToken: string;
  let testBranchId: string;
  let testEmployeeId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Seed test manager
    const manager = await prisma.user.upsert({
      where: { email: managerEmail },
      update: { password_hash: passwordHash, status: UserStatus.active },
      create: {
        id: 'mgr-test-admin-01',
        name: 'Head Manager Admin',
        email: managerEmail,
        password_hash: passwordHash,
        role: Role.manager,
        status: UserStatus.active,
        managerial_access: true,
      },
    });

    // Seed test regular guard
    await prisma.user.upsert({
      where: { email: guardEmail },
      update: { password_hash: passwordHash, status: UserStatus.active },
      create: {
        id: 'guard-test-worker-01',
        name: 'Regular Guard Worker',
        email: guardEmail,
        password_hash: passwordHash,
        role: Role.employee,
        status: UserStatus.active,
        managerial_access: false,
      },
    });

    // Obtain login tokens
    const mgrRes = await request(app)
      .post('/auth/login')
      .send({ email: managerEmail, password: testPassword });
    managerToken = mgrRes.body.data.accessToken;

    const guardRes = await request(app)
      .post('/auth/login')
      .send({ email: guardEmail, password: testPassword });
    guardToken = guardRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testEmployeeId) {
      await prisma.user.deleteMany({ where: { id: testEmployeeId } });
    }
    if (testBranchId) {
      await prisma.branch.deleteMany({ where: { id: testBranchId } });
    }
    await prisma.$disconnect();
  });

  describe('1. Access Control on Manager APIs', () => {
    it('should BLOCK non-manager guards from accessing /branches with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/branches')
        .set('Authorization', `Bearer ${guardToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should BLOCK non-manager guards from accessing /employees with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/employees')
        .set('Authorization', `Bearer ${guardToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should BLOCK unauthenticated access with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/branches');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Branches Management API', () => {
    it('should create a new branch and log BRANCH_CREATED in audit_logs', async () => {
      const res = await request(app)
        .post('/branches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Manchester North Hub',
          address: '42 Deansgate, Manchester',
          lat: 53.483959,
          lng: -2.244644,
          radius_m: 125,
          is_active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Manchester North Hub');
      expect(res.body.data.radius_m).toBe(125);

      testBranchId = res.body.data.id;

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'BRANCH_CREATED',
          entity: 'branches',
          entity_id: testBranchId,
        },
      });
      expect(audit).toBeDefined();
    });

    it('should reject branch creation with invalid coordinates via Zod', async () => {
      const res = await request(app)
        .post('/branches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Invalid Geo Branch',
          lat: 105.5, // Invalid > 90
          lng: -2.24,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should list branches with pagination and search', async () => {
      const res = await request(app)
        .get('/branches?page=1&limit=5&search=Manchester')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(5);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items[0].name).toContain('Manchester');
    });

    it('should get branch details by ID', async () => {
      const res = await request(app)
        .get(`/branches/${testBranchId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testBranchId);
      expect(res.body.data._count).toBeDefined();
    });

    it('should update branch address, lat/lng pin, and radius_m, logging to audit_logs', async () => {
      const res = await request(app)
        .put(`/branches/${testBranchId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          address: 'Updated Deansgate Suite 5',
          lat: 53.4841,
          lng: -2.2449,
          radius_m: 200,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.address).toBe('Updated Deansgate Suite 5');
      expect(res.body.data.radius_m).toBe(200);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'BRANCH_UPDATED',
          entity: 'branches',
          entity_id: testBranchId,
        },
        orderBy: { created_at: 'desc' },
      });
      expect(audit).toBeDefined();
    });

    it('should disable a branch and log to audit_logs', async () => {
      const res = await request(app)
        .patch(`/branches/${testBranchId}/disable`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(false);

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'BRANCH_DISABLED',
          entity: 'branches',
          entity_id: testBranchId,
        },
        orderBy: { created_at: 'desc' },
      });
      expect(audit).toBeDefined();
    });

    it('should re-enable a disabled branch and log to audit_logs', async () => {
      const res = await request(app)
        .patch(`/branches/${testBranchId}/enable`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(true);

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'BRANCH_ENABLED',
          entity: 'branches',
          entity_id: testBranchId,
        },
        orderBy: { created_at: 'desc' },
      });
      expect(audit).toBeDefined();
    });
  });

  describe('3. Employees Management API', () => {
    it('should create employee with required and optional fields, logging EMPLOYEE_CREATED', async () => {
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Marcus Rashford Guard',
          email: 'marcus.guard@region.com',
          phone: '+447700900222',
          password: 'GuardSecurePassword1!',
          monthly_hours: 160,
          hourly_rate: 16.75,
          id_number: 'SIA-99887766',
          branch_id: testBranchId,
          username: 'mrashford',
          address: '7 Old Trafford Way, Manchester',
          managerial_access: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Marcus Rashford Guard');
      expect(res.body.data.email).toBe('marcus.guard@region.com');
      expect(res.body.data.username).toBe('mrashford');
      expect(res.body.data).not.toHaveProperty('password_hash');

      testEmployeeId = res.body.data.id;

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'EMPLOYEE_CREATED',
          entity: 'users',
          entity_id: testEmployeeId,
        },
      });
      expect(audit).toBeDefined();
    });

    it('should reject employee creation if name has less than 4 characters', async () => {
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Bob', // 3 chars < 4
          email: 'bob@region.com',
          phone: '+447700900333',
          password: 'GuardSecurePassword1!',
          monthly_hours: 160,
          hourly_rate: 15.0,
          id_number: 'SIA-11112222',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should list employees with filter by branch, status, search, and pagination', async () => {
      const res = await request(app)
        .get(`/employees?page=1&limit=10&branch_id=${testBranchId}&status=active&search=Marcus`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].email).toBe('marcus.guard@region.com');
    });

    it('should get employee profile by ID', async () => {
      const res = await request(app)
        .get(`/employees/${testEmployeeId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testEmployeeId);
      expect(res.body.data.name).toBe('Marcus Rashford Guard');
    });

    it('should update employee profile and log EMPLOYEE_UPDATED to audit_logs', async () => {
      const res = await request(app)
        .put(`/employees/${testEmployeeId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          hourly_rate: 18.5,
          monthly_hours: 170,
          address: '8 Old Trafford Way, Manchester',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.hourly_rate).toBe('18.5');
      expect(res.body.data.monthly_hours).toBe(170);

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'EMPLOYEE_UPDATED',
          entity: 'users',
          entity_id: testEmployeeId,
        },
        orderBy: { created_at: 'desc' },
      });
      expect(audit).toBeDefined();
    });

    it('should suspend employee account and log EMPLOYEE_SUSPENDED to audit_logs', async () => {
      const res = await request(app)
        .patch(`/employees/${testEmployeeId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'suspended' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('suspended');

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'EMPLOYEE_SUSPENDED',
          entity: 'users',
          entity_id: testEmployeeId,
        },
        orderBy: { created_at: 'desc' },
      });
      expect(audit).toBeDefined();
    });

    it('should activate employee account and log EMPLOYEE_ACTIVATED to audit_logs', async () => {
      const res = await request(app)
        .patch(`/employees/${testEmployeeId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'EMPLOYEE_ACTIVATED',
          entity: 'users',
          entity_id: testEmployeeId,
        },
        orderBy: { created_at: 'desc' },
      });
      expect(audit).toBeDefined();
    });

    it('should grant and revoke managerial access, logging to audit_logs', async () => {
      const grantRes = await request(app)
        .patch(`/employees/${testEmployeeId}/managerial-access`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ managerial_access: true });

      expect(grantRes.status).toBe(200);
      expect(grantRes.body.data.managerial_access).toBe(true);

      const revokeRes = await request(app)
        .patch(`/employees/${testEmployeeId}/managerial-access`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ managerial_access: false });

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.data.managerial_access).toBe(false);

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'MANAGERIAL_ACCESS_UPDATED',
          entity: 'users',
          entity_id: testEmployeeId,
        },
        orderBy: { created_at: 'desc' },
      });
      expect(audit).toBeDefined();
    });

    it('should upload employee photo with multer and log to audit_logs', async () => {
      // Create a temporary test image file
      const tempImagePath = path.join(__dirname, 'temp-guard-photo.jpg');
      fs.writeFileSync(tempImagePath, Buffer.from('fake-image-bytes-jpeg-content'));

      try {
        const res = await request(app)
          .post(`/employees/${testEmployeeId}/photo`)
          .set('Authorization', `Bearer ${managerToken}`)
          .attach('photo', tempImagePath);

        expect(res.status).toBe(200);
        expect(res.body.data.photo_url).toMatch(/^\/uploads\/employees\/employee-.+\.jpg$/);

        const audit = await prisma.auditLog.findFirst({
          where: {
            action: 'EMPLOYEE_PHOTO_UPDATED',
            entity: 'users',
            entity_id: testEmployeeId,
          },
          orderBy: { created_at: 'desc' },
        });
        expect(audit).toBeDefined();
      } finally {
        if (fs.existsSync(tempImagePath)) {
          fs.unlinkSync(tempImagePath);
        }
      }
    });
  });
});
