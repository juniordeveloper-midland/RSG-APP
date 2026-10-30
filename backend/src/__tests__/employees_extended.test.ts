import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../app';
import { prisma } from '../config/prisma';
import { signAccessToken } from '../utils/jwt';
import { Role, UserStatus } from '@prisma/client';

describe('RSG Employee Module Extended Fields & Documents', () => {
  let managerToken: string;
  let guardToken: string;
  let testClientId: string;
  let testBranchId: string;
  let createdEmployeeId: string;

  beforeAll(async () => {
    // 1. Create or ensure test manager
    const manager = await prisma.user.upsert({
      where: { email: 'manager-emp-test@region.com' },
      update: { role: Role.manager, status: UserStatus.active },
      create: {
        name: 'Manager Emp Tester',
        email: 'manager-emp-test@region.com',
        password_hash: 'hashed_pw',
        role: Role.manager,
        status: UserStatus.active,
        managerial_access: true,
      },
    });

    // 2. Create or ensure test guard
    const guard = await prisma.user.upsert({
      where: { email: 'guard-emp-test@region.com' },
      update: { role: Role.employee, status: UserStatus.active },
      create: {
        name: 'Guard Emp Tester',
        email: 'guard-emp-test@region.com',
        password_hash: 'hashed_pw',
        role: Role.employee,
        status: UserStatus.active,
      },
    });

    managerToken = signAccessToken({
      sub: manager.id,
      role: Role.manager,
      email: manager.email,
      branch_id: null,
      managerial_access: true,
    });
    guardToken = signAccessToken({
      sub: guard.id,
      role: Role.employee,
      email: guard.email,
      branch_id: null,
      managerial_access: false,
    });

    // 3. Ensure test client exists
    const client = await prisma.client.upsert({
      where: { code: 'EMP-CLI-01' },
      update: {},
      create: {
        name: 'Apex Security Client',
        code: 'EMP-CLI-01',
        industry: 'Corporate Facilities',
        contact_name: 'David Apex',
        contact_email: 'david@apexsecurity.com',
        contact_phone: '+447700900999',
        billing_address: '100 Apex Way',
        billing_city: 'London',
        billing_state: 'Greater London',
        billing_country: 'United Kingdom',
        billing_zip: 'EC1A 1BB',
        billing_phone: '+447700900999',
        billing_email: 'billing@apexsecurity.com',
      },
    });
    testClientId = client.id;

    // 4. Ensure test branch exists
    const branch = await prisma.branch.upsert({
      where: { id: 'branch-emp-test-01' },
      update: { client_id: testClientId },
      create: {
        id: 'branch-emp-test-01',
        name: 'Apex City Branch',
        client_id: testClientId,
        lat: 51.5074,
        lng: -0.1278,
        radius_m: 150,
      },
    });
    testBranchId = branch.id;
  });

  afterAll(async () => {
    // Clean up created employee & documents
    if (createdEmployeeId) {
      await prisma.employeeDocument.deleteMany({ where: { user_id: createdEmployeeId } });
      await prisma.user.deleteMany({ where: { id: createdEmployeeId } });
    }
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'manager-emp-test@region.com',
            'guard-emp-test@region.com',
            'samuel.guard@region.com',
            'duplicate.user@region.com',
          ],
        },
      },
    });
    await prisma.branch.deleteMany({ where: { id: 'branch-emp-test-01' } });
    await prisma.client.deleteMany({ where: { code: 'EMP-CLI-01' } });
  });

  describe('1. Role-based Access Control', () => {
    it('should BLOCK non-manager employees from creating employees (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({
          name: 'Unauthorized Create',
          email: 'unauth@region.com',
          phone: '+447700900000',
          password: 'Password123!',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should BLOCK unauthenticated requests (401 UNAUTHORIZED)', async () => {
      const res = await request(app).get('/employees');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Add Employee with Personal, General, and Operational fields', () => {
    it('should create employee with all new fields and link to Client & Branch', async () => {
      const payload = {
        // Personal
        name: 'Samuel Guard Officer',
        email: 'samuel.guard@region.com',
        phone: '+447711223344',
        password: 'GuardStrongPass2026!',
        date_of_birth: '1990-08-25',
        address: '42 Security Lane, Manchester, M1 1AA',
        profile_image: '/uploads/employees/samuel-profile.jpg',
        documents: [
          {
            name: 'SIA_Licence.pdf',
            file_url: '/uploads/employees/documents/sia_samuel.pdf',
            file_type: 'application/pdf',
            file_size: 204800,
          },
          {
            name: 'Passport_Scan.jpg',
            file_url: '/uploads/employees/documents/passport_samuel.jpg',
            file_type: 'image/jpeg',
            file_size: 512000,
          },
        ],

        // General
        username: 'sguard2026',
        position: 'Senior Patrol Officer',

        // Operational
        pay_rate: 18.5,
        weekly_working_hours: 42.5,
        joining_date: '2026-02-01',
        brp_expiry_date: '2029-05-15',
        licence_expiry_date: '2028-11-30',
        licence_number: '1000998877665544',
        client_id: testClientId,
        branch_id: testBranchId,
      };

      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      createdEmployeeId = data.id;

      // Assert Personal fields
      expect(data.name).toBe('Samuel Guard Officer');
      expect(data.email).toBe('samuel.guard@region.com');
      expect(data.phone).toBe('+447711223344');
      expect(data.date_of_birth).toBe('1990-08-25');
      expect(data.address).toBe('42 Security Lane, Manchester, M1 1AA');
      expect(data.profile_image).toBe('/uploads/employees/samuel-profile.jpg');
      expect(data.photo_url).toBe('/uploads/employees/samuel-profile.jpg');

      // Assert General fields
      expect(data.username).toBe('sguard2026');
      expect(data.position).toBe('Senior Patrol Officer');

      // Assert Operational fields
      expect(data.pay_rate).toBe(18.5);
      expect(Number(data.hourly_rate)).toBe(18.5);
      expect(data.weekly_working_hours).toBe(42.5);
      expect(data.weekly_hours).toBe(42.5);
      expect(data.joining_date).toBe('2026-02-01');
      expect(data.brp_expiry_date).toBe('2029-05-15');
      expect(data.licence_expiry_date).toBe('2028-11-30');
      expect(data.licence_number).toBe('1000998877665544');

      // Assert Client & Branch relations
      expect(data.client_id).toBe(testClientId);
      expect(data.client?.id).toBe(testClientId);
      expect(data.client?.name).toBe('Apex Security Client');
      expect(data.branch_id).toBe(testBranchId);
      expect(data.branch?.id).toBe(testBranchId);

      // Assert attached documents
      expect(Array.isArray(data.documents)).toBe(true);
      expect(data.documents.length).toBe(2);
      expect(data.documents[0].name).toBeDefined();
    });

    it('should REJECT duplicate email with 409 EMAIL_EXISTS', async () => {
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Duplicate Email Guard',
          email: 'samuel.guard@region.com', // Already used
          username: 'unique_user_99',
          phone: '+447799887766',
          password: 'Password123!',
          pay_rate: 15.0,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('should REJECT duplicate username with 409 USERNAME_EXISTS', async () => {
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Duplicate User Guard',
          email: 'duplicate.user@region.com',
          username: 'sguard2026', // Already used by Samuel
          phone: '+447799887766',
          password: 'Password123!',
          pay_rate: 15.0,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USERNAME_EXISTS');
    });
  });

  describe('3. View Employee API (GET /employees/:id)', () => {
    it('should return employee with full details, company, branch, and documents', async () => {
      const res = await request(app)
        .get(`/employees/${createdEmployeeId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.id).toBe(createdEmployeeId);
      expect(data.position).toBe('Senior Patrol Officer');
      expect(data.client?.name).toBe('Apex Security Client');
      expect(data.documents.length).toBe(2);
    });

    it('should return 404 EMPLOYEE_NOT_FOUND for non-existent employee ID', async () => {
      const res = await request(app)
        .get('/employees/00000000-0000-0000-0000-000000000999')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });
  });

  describe('4. List Employees API with Filters (GET /employees)', () => {
    it('should filter employees by client_id', async () => {
      const res = await request(app)
        .get(`/employees?client_id=${testClientId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.items.some((e: any) => e.id === createdEmployeeId);
      expect(found).toBe(true);
    });

    it('should filter employees by search keyword (position / username / name)', async () => {
      const res = await request(app)
        .get('/employees?search=sguard2026')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].username).toBe('sguard2026');
    });
  });

  describe('5. Edit Employee API (PUT / PATCH /employees/:id)', () => {
    it('should update employee operational & personal fields', async () => {
      const res = await request(app)
        .put(`/employees/${createdEmployeeId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          position: 'Head of Branch Security',
          pay_rate: 22.0,
          weekly_working_hours: 45.0,
          licence_number: '9999000011112222',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.position).toBe('Head of Branch Security');
      expect(data.pay_rate).toBe(22.0);
      expect(data.weekly_working_hours).toBe(45.0);
      expect(data.licence_number).toBe('9999000011112222');
    });
  });

  describe('6. Documents Management & Direct Upload API', () => {
    let uploadedDocId: string;

    it('should attach additional documents directly to employee', async () => {
      const res = await request(app)
        .post(`/employees/${createdEmployeeId}/documents`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          documents: [
            {
              name: 'FirstAid_Certificate.pdf',
              file_url: '/uploads/employees/documents/firstaid.pdf',
              file_type: 'application/pdf',
              file_size: 102400,
            },
          ],
        });

      expect(res.status).toBe(200);
      const docs = res.body.data.documents;
      expect(docs.length).toBe(3);
      const newDoc = docs.find((d: any) => d.name === 'FirstAid_Certificate.pdf');
      expect(newDoc).toBeDefined();
      uploadedDocId = newDoc.id;
    });

    it('should delete an employee document by ID', async () => {
      const res = await request(app)
        .delete(`/employees/${createdEmployeeId}/documents/${uploadedDocId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deletion in GET
      const getRes = await request(app)
        .get(`/employees/${createdEmployeeId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      const remainingDocs = getRes.body.data.documents;
      expect(remainingDocs.some((d: any) => d.id === uploadedDocId)).toBe(false);
    });

    it('should upload a real test document file via multipart/form-data', async () => {
      const testBuffer = Buffer.from('%PDF-1.4 test document content');
      const res = await request(app)
        .post('/employees/upload-document')
        .set('Authorization', `Bearer ${managerToken}`)
        .attach('documents', testBuffer, 'compliance_check.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toBeDefined();
      expect(res.body.data.documents.length).toBe(1);
      expect(res.body.data.documents[0].name).toBe('compliance_check.pdf');
      expect(res.body.data.documents[0].file_url).toContain('/uploads/employees/documents/');
    });

    it('should REJECT document with disallowed extension (e.g. .txt or .exe)', async () => {
      const badBuffer = Buffer.from('hello plain text');
      const res = await request(app)
        .post('/employees/upload-document')
        .set('Authorization', `Bearer ${managerToken}`)
        .attach('documents', badBuffer, 'malicious.exe');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
      expect(res.body.error.message).toContain('PDF, JPG, and PNG');
    });
  });
});
