import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../app';
import { prisma } from '../config/prisma';
import { Role, UserStatus } from '@prisma/client';

describe('RSG Client Module APIs (Manager Only)', () => {
  const managerEmail = 'manager-client-test@region.com';
  const guardEmail = 'guard-client-test@region.com';
  const testPassword = 'Password123!';

  let managerToken: string;
  let guardToken: string;
  let createdClientId: string;
  let testBranchId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Seed test manager
    await prisma.user.upsert({
      where: { email: managerEmail },
      update: { password_hash: passwordHash, status: UserStatus.active },
      create: {
        id: 'mgr-client-test-01',
        name: 'Client Test Manager',
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
        id: 'guard-client-test-01',
        name: 'Client Test Guard',
        email: guardEmail,
        password_hash: passwordHash,
        role: Role.employee,
        status: UserStatus.active,
        managerial_access: false,
      },
    });

    // Obtain access tokens
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
    if (testBranchId) {
      await prisma.branch.deleteMany({ where: { id: testBranchId } });
    }
    if (createdClientId) {
      await prisma.branch.deleteMany({ where: { client_id: createdClientId } });
      await prisma.client.deleteMany({ where: { id: createdClientId } });
    }
    await prisma.client.deleteMany({
      where: { code: { in: ['TEST-ACME', 'TEST-ACME2', 'TEST-UPDATED'] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [managerEmail, guardEmail] } },
    });
    await prisma.$disconnect();
  });

  describe('1. Role-Based Access Control', () => {
    it('should BLOCK non-manager guards from adding clients (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({
          name: 'Unauthorized Corp',
          code: 'UNAUTH-01',
          industry: 'Finance',
          contact_name: 'Bob',
          contact_email: 'bob@unauth.com',
          contact_phone: '+441234567890',
          billing_address: '123 Fake St',
          billing_city: 'London',
          billing_state: 'London',
          billing_country: 'UK',
          billing_zip: 'EC1A 1BB',
          billing_phone: '+441234567890',
          billing_email: 'accounts@unauth.com',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should BLOCK non-manager guards from listing clients (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/clients')
        .set('Authorization', `Bearer ${guardToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should BLOCK unauthenticated requests (401 UNAUTHORIZED)', async () => {
      const res = await request(app).get('/clients');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Add Client API (POST /clients)', () => {
    it('should successfully create a new client with all company, contact, and billing fields', async () => {
      const payload = {
        name: 'Acme Logistics Ltd',
        code: 'TEST-ACME',
        website: 'https://www.acmelogistics.co.uk',
        industry: 'Transportation & Logistics',
        client_since: '2023-05-10',
        contact_photo: 'https://cdn.example.com/photos/john-acme.jpg',
        contact_name: 'John Doe',
        contact_email: 'john.doe@acmelogistics.co.uk',
        contact_phone: '+442081234567',
        status: 'active',
        password: 'ContactSecurePass123!',
        billing_address: '50 Logistics Way',
        billing_city: 'Birmingham',
        billing_state: 'West Midlands',
        billing_country: 'United Kingdom',
        billing_zip: 'B1 1AA',
        billing_phone: '+442081234500',
        billing_email: 'billing@acmelogistics.co.uk',
      };

      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Acme Logistics Ltd');
      expect(res.body.data.code).toBe('TEST-ACME');
      expect(res.body.data.industry).toBe('Transportation & Logistics');
      expect(res.body.data.contact_name).toBe('John Doe');
      expect(res.body.data.contact_email).toBe('john.doe@acmelogistics.co.uk');
      expect(res.body.data.billing_city).toBe('Birmingham');
      expect(res.body.data.status).toBe('active');

      // Password and password_hash must NEVER be exposed in response body
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.password_hash).toBeUndefined();

      createdClientId = res.body.data.id;

      // Verify password was properly hashed in DB
      const dbClient = await prisma.client.findUnique({
        where: { id: createdClientId },
      });
      expect(dbClient).not.toBeNull();
      expect(dbClient?.password_hash).not.toBeNull();
      const match = await bcrypt.compare('ContactSecurePass123!', dbClient!.password_hash!);
      expect(match).toBe(true);

      // Verify audit log entry
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'CLIENT_CREATED',
          entity: 'clients',
          entity_id: createdClientId,
        },
      });
      expect(auditLog).not.toBeNull();
      // Ensure password was stripped from audit details
      expect(JSON.stringify(auditLog?.details)).not.toContain('ContactSecurePass123!');
    });

    it('should REJECT duplicate client code with 409 CLIENT_CODE_EXISTS', async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Acme Duplicate',
          code: 'TEST-ACME', // Duplicate code
          industry: 'Logistics',
          contact_name: 'Jane Doe',
          contact_email: 'jane@acmelogistics.co.uk',
          contact_phone: '+442089999999',
          billing_address: '99 Road',
          billing_city: 'London',
          billing_state: 'London',
          billing_country: 'UK',
          billing_zip: 'EC1A 1AA',
          billing_phone: '+442089999999',
          billing_email: 'jane@acmelogistics.co.uk',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CLIENT_CODE_EXISTS');
    });

    it('should REJECT client creation with invalid email format (422/400)', async () => {
      const res = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Bad Email Client',
          code: 'TEST-BAD',
          industry: 'Retail',
          contact_name: 'Alice',
          contact_email: 'not-an-email',
          contact_phone: '+44111222333',
          billing_address: '1 Main St',
          billing_city: 'Bristol',
          billing_state: 'Avon',
          billing_country: 'UK',
          billing_zip: 'BS1 1AA',
          billing_phone: '+44111222333',
          billing_email: 'also-not-an-email',
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('3. List Clients API (GET /clients)', () => {
    it('should list clients with pagination and branch count', async () => {
      const res = await request(app)
        .get('/clients?page=1&limit=10')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);

      // Verify each item includes branch count
      const createdItem = res.body.data.items.find((c: any) => c.id === createdClientId);
      expect(createdItem).toBeDefined();
      expect(createdItem._count).toBeDefined();
      expect(typeof createdItem._count.branches).toBe('number');
    });

    it('should filter clients by search keyword', async () => {
      const res = await request(app)
        .get('/clients?search=Acme')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].name).toContain('Acme');
    });

    it('should filter clients by status', async () => {
      const res = await request(app)
        .get('/clients?status=active')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      res.body.data.items.forEach((c: any) => {
        expect(c.status).toBe('active');
      });
    });
  });

  describe('4. View Client API (GET /clients/:id)', () => {
    it('should return client details with attached branches list', async () => {
      const res = await request(app)
        .get(`/clients/${createdClientId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdClientId);
      expect(res.body.data.name).toBe('Acme Logistics Ltd');
      expect(Array.isArray(res.body.data.branches)).toBe(true);
      expect(res.body.data._count.branches).toBe(0);
      expect(res.body.data.password_hash).toBeUndefined();
    });

    it('should return 404 CLIENT_NOT_FOUND for non-existent client ID', async () => {
      const res = await request(app)
        .get('/clients/non-existent-uuid-00000000')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CLIENT_NOT_FOUND');
    });
  });

  describe('5. Edit Client API (PUT/PATCH /clients/:id)', () => {
    it('should update client company, contact, and billing details and log to audit_logs', async () => {
      const updatePayload = {
        name: 'Acme Global Logistics Ltd',
        contact_phone: '+442089990000',
        billing_city: 'Manchester',
        billing_zip: 'M1 1AA',
      };

      const res = await request(app)
        .put(`/clients/${createdClientId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Acme Global Logistics Ltd');
      expect(res.body.data.contact_phone).toBe('+442089990000');
      expect(res.body.data.billing_city).toBe('Manchester');
      expect(res.body.data.billing_zip).toBe('M1 1AA');

      // Verify audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'CLIENT_UPDATED',
          entity: 'clients',
          entity_id: createdClientId,
        },
        orderBy: { created_at: 'desc' },
      });
      expect(auditLog).not.toBeNull();
    });

    it('should update contact password securely', async () => {
      const res = await request(app)
        .patch(`/clients/${createdClientId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ password: 'NewContactPassword456!' });

      expect(res.status).toBe(200);
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.password_hash).toBeUndefined();

      const dbClient = await prisma.client.findUnique({
        where: { id: createdClientId },
      });
      const match = await bcrypt.compare('NewContactPassword456!', dbClient!.password_hash!);
      expect(match).toBe(true);
    });
  });

  describe('6. Archive Client API (PATCH/POST /clients/:id/archive & DELETE /clients/:id)', () => {
    it('should archive a client (setting status to archived) and record audit log', async () => {
      const res = await request(app)
        .patch(`/clients/${createdClientId}/archive`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('archived');

      // Verify in DB
      const dbClient = await prisma.client.findUnique({
        where: { id: createdClientId },
      });
      expect(dbClient?.status).toBe('archived');

      // Verify audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'CLIENT_ARCHIVED',
          entity: 'clients',
          entity_id: createdClientId,
        },
        orderBy: { created_at: 'desc' },
      });
      expect(auditLog).not.toBeNull();
    });

    it('should also support DELETE /clients/:id as archive alias', async () => {
      // Create a second client to test DELETE
      const createRes = await request(app)
        .post('/clients')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Temporary Client',
          code: 'TEMP-DEL',
          industry: 'Services',
          contact_name: 'Temp Contact',
          contact_email: 'temp@test.com',
          contact_phone: '+441112223334',
          billing_address: '1 Temp St',
          billing_city: 'London',
          billing_state: 'London',
          billing_country: 'UK',
          billing_zip: 'SW1A 1AA',
          billing_phone: '+441112223334',
          billing_email: 'temp@test.com',
        });

      const tempId = createRes.body.data.id;

      const delRes = await request(app)
        .delete(`/clients/${tempId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.data.status).toBe('archived');

      await prisma.client.deleteMany({ where: { id: tempId } });
    });
  });

  describe('7. Branch and Client Integration', () => {
    it('should attach a new branch to a client and reflect in view client', async () => {
      // Create branch attached to createdClientId
      const branchRes = await request(app)
        .post('/branches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          client_id: createdClientId,
          name: 'Acme Central Depot Branch',
          address: 'Unit 5, Industrial Estate, Birmingham',
          lat: 52.486243,
          lng: -1.890401,
          radius_m: 120,
          is_active: true,
        });

      expect(branchRes.status).toBe(201);
      testBranchId = branchRes.body.data.id;
      expect(branchRes.body.data.client_id).toBe(createdClientId);

      // Verify view client includes this branch
      const clientRes = await request(app)
        .get(`/clients/${createdClientId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(clientRes.status).toBe(200);
      expect(clientRes.body.data._count.branches).toBe(1);
      const attachedBranch = clientRes.body.data.branches.find(
        (b: any) => b.id === testBranchId
      );
      expect(attachedBranch).toBeDefined();
      expect(attachedBranch.name).toBe('Acme Central Depot Branch');
    });

    it('should verify all default branches belong to default client "Region Security Guarding"', async () => {
      const defaultClient = await prisma.client.findUnique({
        where: { id: '00000000-0000-0000-0000-000000000001' },
        include: {
          branches: true,
        },
      });

      expect(defaultClient).not.toBeNull();
      expect(defaultClient?.name).toBe('Region Security Guarding');
      expect(defaultClient?.branches.length).toBeGreaterThanOrEqual(1);

      // Branch HQ must belong to default client
      const hq = defaultClient?.branches.find((b) => b.id === 'branch-hq-001');
      expect(hq).toBeDefined();
      expect(hq?.client_id).toBe('00000000-0000-0000-0000-000000000001');
    });
  });
});

