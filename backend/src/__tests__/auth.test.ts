import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../app';
import { prisma } from '../config/prisma';
import { Role, UserStatus } from '@prisma/client';

describe('RSG Authentication & Authorization System', () => {
  const managerEmail = 'test-auth-mgr@region.com';
  const guardEmail = 'test-auth-guard@region.com';
  const suspendedEmail = 'test-auth-suspended@region.com';
  const testPassword = 'TestPassword123!';

  let managerToken: string;
  let guardToken: string;
  let managerRefreshToken: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Upsert HQ branch
    const branch = await prisma.branch.upsert({
      where: { id: 'branch-hq-001' },
      update: {},
      create: {
        id: 'branch-hq-001',
        name: 'RSG Central Headquarters',
        lat: 51.5073509,
        lng: -0.1277583,
        radius_m: 150.0,
        is_active: true,
      },
    });

    // Upsert Manager
    await prisma.user.upsert({
      where: { email: managerEmail },
      update: { password_hash: passwordHash, status: UserStatus.active },
      create: {
        id: 'test-manager-id',
        branch_id: branch.id,
        name: 'Test Operations Manager',
        email: managerEmail,
        password_hash: passwordHash,
        role: Role.manager,
        status: UserStatus.active,
        managerial_access: true,
      },
    });

    // Upsert Guard (Employee)
    await prisma.user.upsert({
      where: { email: guardEmail },
      update: { password_hash: passwordHash, status: UserStatus.active },
      create: {
        id: 'test-guard-id',
        branch_id: branch.id,
        name: 'Test Guard Employee',
        email: guardEmail,
        password_hash: passwordHash,
        role: Role.employee,
        status: UserStatus.active,
        managerial_access: false,
      },
    });

    // Upsert Suspended Guard
    await prisma.user.upsert({
      where: { email: suspendedEmail },
      update: { password_hash: passwordHash, status: UserStatus.suspended },
      create: {
        id: 'test-suspended-id',
        branch_id: branch.id,
        name: 'Test Suspended Guard',
        email: suspendedEmail,
        password_hash: passwordHash,
        role: Role.employee,
        status: UserStatus.suspended,
        managerial_access: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. POST /auth/login', () => {
    it('should successfully log in with valid manager credentials and write LOGIN_SUCCESS to audit_logs', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: managerEmail,
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toMatchObject({
        email: managerEmail,
        role: 'manager',
        status: 'active',
        managerial_access: true,
      });

      managerToken = response.body.data.accessToken;
      managerRefreshToken = response.body.data.refreshToken;

      // Verify audit log entry
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'LOGIN_SUCCESS',
          entity: 'users',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('LOGIN_SUCCESS');
      expect(auditLog?.entity).toBe('users');
    });

    it('should successfully log in guard and return valid employee access token', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: guardEmail,
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe('employee');
      guardToken = response.body.data.accessToken;
    });

    it('should reject login with wrong password and write LOGIN_FAILED to audit_logs', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: managerEmail,
          password: 'IncorrectPassword999!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });

      // Verify audit log entry
      const failedAudit = await prisma.auditLog.findFirst({
        where: {
          action: 'LOGIN_FAILED',
          entity: 'users',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(failedAudit).toBeDefined();
      expect(failedAudit?.action).toBe('LOGIN_FAILED');
    });

    it('should reject suspended user with 403 ACCOUNT_SUSPENDED and log audit entry', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: suspendedEmail,
          password: testPassword,
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Account is suspended. Please contact your administrator.',
      });

      // Verify audit log
      const suspendedAudit = await prisma.auditLog.findFirst({
        where: {
          action: 'LOGIN_FAILED',
          entity: 'users',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(suspendedAudit).toBeDefined();
    });
  });

  describe('2. Role and Branch Authorization Middleware', () => {
    it('should BLOCK employee from accessing manager-only route (/management/dashboard) with 403 FORBIDDEN', async () => {
      const response = await request(app)
        .get('/management/dashboard')
        .set('Authorization', `Bearer ${guardToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'FORBIDDEN',
        message: 'Access forbidden: Insufficient permissions',
      });
    });

    it('should ALLOW manager to access manager-only route (/management/dashboard) with 200 OK', async () => {
      const response = await request(app)
        .get('/management/dashboard')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Welcome to Manager Operations');
    });

    it('should reject unauthenticated requests to protected routes with 401 UNAUTHORIZED', async () => {
      const response = await request(app).get('/management/dashboard');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should enforce branchScope and reject cross-branch access with 403 BRANCH_ACCESS_DENIED', async () => {
      // User belongs to 'branch-hq-001', attempts to access 'branch-other-999'
      const response = await request(app)
        .get('/management/branches/branch-other-999')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('BRANCH_ACCESS_DENIED');
    });

    it('should permit branch access when branch matches user branchScope with 200 OK', async () => {
      const response = await request(app)
        .get('/management/branches/branch-hq-001')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.branch_id).toBe('branch-hq-001');
    });
  });

  describe('3. POST /auth/refresh & Token Rotation', () => {
    it('should refresh access token and rotate refresh token with 200 OK', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: managerRefreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      const rotatedRefreshToken = response.body.data.refreshToken;

      // Attempting to reuse old refresh token should be rejected (revoked by rotation)
      const reuseResponse = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: managerRefreshToken,
        });

      expect(reuseResponse.status).toBe(401);
      expect(reuseResponse.body.error.code).toBe('INVALID_TOKEN');

      // Update managerRefreshToken to the rotated one
      managerRefreshToken = rotatedRefreshToken;
    });
  });

  describe('4. POST /auth/logout', () => {
    it('should successfully log out and revoke refresh token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .send({
          refreshToken: managerRefreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Now the refresh token is revoked
      const refreshAfterLogout = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: managerRefreshToken,
        });

      expect(refreshAfterLogout.status).toBe(401);
    });
  });

  describe('5. Password Reset Flow (Forgot & Reset Password)', () => {
    it('should accept forgot password request, create 30-min token and write to audit_logs', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: guardEmail,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify token created in database with ~30 min expiry
      const resetRecord = await prisma.passwordReset.findFirst({
        where: {
          user: { email: guardEmail },
          used_at: null,
        },
        orderBy: { created_at: 'desc' },
      });

      expect(resetRecord).toBeDefined();
      expect(resetRecord?.expires_at.getTime()).toBeGreaterThan(Date.now());

      // Verify audit log for forgot password request
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'PASSWORD_RESET_REQUESTED',
          entity: 'users',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(audit).toBeDefined();
    });

    it('should reset password with valid token, update hash and allow login with new password', async () => {
      // In a real email, the raw token is sent. Let's create a known test token
      const crypto = await import('crypto');
      const { hashToken } = await import('../utils/jwt');

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      const user = await prisma.user.findUniqueOrThrow({ where: { email: guardEmail } });

      await prisma.passwordReset.create({
        data: {
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
        },
      });

      const newPassword = 'BrandNewPassword2026!';

      const resetResponse = await request(app)
        .post('/auth/reset-password')
        .send({
          token: rawToken,
          password: newPassword,
        });

      expect(resetResponse.status).toBe(200);
      expect(resetResponse.body.success).toBe(true);

      // Verify user can now log in with the new password
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: guardEmail,
          password: newPassword,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.email).toBe(guardEmail);

      // Verify audit log for password reset success
      const resetAudit = await prisma.auditLog.findFirst({
        where: {
          action: 'PASSWORD_RESET_SUCCESS',
          entity_id: user.id,
        },
        orderBy: { created_at: 'desc' },
      });

      expect(resetAudit).toBeDefined();
    });

    it('should reject reset password with invalid or expired token', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'completely-nonexistent-token',
          password: 'AnotherPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_RESET_TOKEN');
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: [managerEmail, guardEmail, suspendedEmail] },
      },
    });
    await prisma.$disconnect();
  });
});
