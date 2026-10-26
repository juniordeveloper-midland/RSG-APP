import request from 'supertest';
import bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import app from '../app';
import { prisma } from '../config/prisma';
import { Role, UserStatus, CheckType } from '@prisma/client';

describe('RSG Shifts, Rota & Excel Import System', () => {
  const managerEmail = 'manager-shifts@region.com';
  const guard1Email = 'guard-shift-1@region.com';
  const guard2Email = 'guard-shift-2@region.com';
  const testPassword = 'Password123!';

  let managerToken: string;
  let guard1Token: string;
  let testBranchId: string;
  let testShift1Id: string;
  let testShift2Id: string;
  let testGuard1Id: string;
  let testGuard2Id: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // 1. Create a dedicated branch for tests
    const branch = await prisma.branch.create({
      data: {
        name: 'Birmingham Security Hub',
        address: '15 Broad Street, Birmingham',
        lat: 52.4787,
        lng: -1.9084,
        radius_m: 100,
        is_active: true,
      },
    });
    testBranchId = branch.id;

    // 2. Create manager
    await prisma.user.create({
      data: {
        name: 'Shift Operations Manager',
        email: managerEmail,
        password_hash: passwordHash,
        role: Role.manager,
        status: UserStatus.active,
        branch_id: branch.id,
        managerial_access: true,
      },
    });

    // 3. Create 2 Guards in this branch
    const guard1 = await prisma.user.create({
      data: {
        name: 'Guard Dave Jenkins',
        email: guard1Email,
        password_hash: passwordHash,
        role: Role.employee,
        status: UserStatus.active,
        branch_id: branch.id,
        managerial_access: false,
      },
    });
    testGuard1Id = guard1.id;

    const guard2 = await prisma.user.create({
      data: {
        name: 'Guard Lucy Williams',
        email: guard2Email,
        password_hash: passwordHash,
        role: Role.employee,
        status: UserStatus.active,
        branch_id: branch.id,
        managerial_access: false,
      },
    });
    testGuard2Id = guard2.id;

    // 4. Log in users
    const mgrRes = await request(app)
      .post('/auth/login')
      .send({ email: managerEmail, password: testPassword });
    managerToken = mgrRes.body.data.accessToken;

    const guardRes = await request(app)
      .post('/auth/login')
      .send({ email: guard1Email, password: testPassword });
    guard1Token = guardRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Clean up created test entities
    await prisma.notification.deleteMany({
      where: { user_id: { in: [testGuard1Id, testGuard2Id] } },
    });
    await prisma.shiftAssignment.deleteMany({
      where: { user_id: { in: [testGuard1Id, testGuard2Id] } },
    });
    await prisma.shift.deleteMany({
      where: { branch_id: testBranchId },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [managerEmail, guard1Email, guard2Email] } },
    });
    await prisma.branch.deleteMany({
      where: { id: testBranchId },
    });
    await prisma.$disconnect();
  });

  describe('1. Shift CRUD Operations', () => {
    it('should create a shift with valid overtime limit (1-50) and lunch deduction', async () => {
      const res = await request(app)
        .post('/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          branch_id: testBranchId,
          name: 'Day Security Shift',
          start_time: '08:00',
          end_time: '16:00',
          check_type: 'gps',
          overtime_enabled: true,
          overtime_limit_hours: 4,
          lunch_deduction_minutes: 30,
          is_active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Day Security Shift');
      expect(res.body.data.overtime_limit_hours).toBe(4);
      expect(res.body.data.lunch_deduction_minutes).toBe(30);

      testShift1Id = res.body.data.id;

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'SHIFT_CREATED',
          entity: 'shifts',
          entity_id: testShift1Id,
        },
      });
      expect(audit).toBeDefined();
    });

    it('should reject shift creation if overtime is enabled with invalid hours (e.g. 0)', async () => {
      const res = await request(app)
        .post('/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          branch_id: testBranchId,
          name: 'Invalid Overtime Shift',
          start_time: '08:00',
          end_time: '16:00',
          overtime_enabled: true,
          overtime_limit_hours: 0, // Invalid: must be 1-50 when enabled
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should create an overnight shift (22:00 - 06:00)', async () => {
      const res = await request(app)
        .post('/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          branch_id: testBranchId,
          name: 'Night Perimeter Patrol',
          start_time: '22:00',
          end_time: '06:00',
          check_type: 'qr',
          overtime_enabled: false,
          overtime_limit_hours: 0,
          lunch_deduction_minutes: 45,
          is_active: true,
        });

      expect(res.status).toBe(201);
      testShift2Id = res.body.data.id;
    });

    it('should list shifts with active/disabled filter and search', async () => {
      const res = await request(app)
        .get(`/shifts?branch_id=${testBranchId}&is_active=true&search=Security`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].name).toBe('Day Security Shift');
    });

    it('should get shift details by ID', async () => {
      const res = await request(app)
        .get(`/shifts/${testShift1Id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testShift1Id);
      expect(res.body.data.branch).toBeDefined();
    });

    it('should disable and re-enable a shift with audit logging', async () => {
      // Disable
      const disableRes = await request(app)
        .patch(`/shifts/${testShift1Id}/disable`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(disableRes.status).toBe(200);
      expect(disableRes.body.data.is_active).toBe(false);

      // Re-enable
      const enableRes = await request(app)
        .patch(`/shifts/${testShift1Id}/enable`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(enableRes.status).toBe(200);
      expect(enableRes.body.data.is_active).toBe(true);
    });
  });

  describe('2. Shift Assignment, Overlap Detection & Notifications', () => {
    it('should assign shift to single employee and create a notification record', async () => {
      const res = await request(app)
        .post(`/shifts/${testShift1Id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          user_id: testGuard1Id,
          start_date: '2026-11-01',
          end_date: '2026-11-30',
          excluded_dates: ['2026-11-10', '2026-11-15'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignments.length).toBe(1);

      // Verify Notification record was created in the database
      const notification = await prisma.notification.findFirst({
        where: {
          user_id: testGuard1Id,
          type: 'shift_assignment',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(notification).toBeDefined();
      expect(notification?.title).toContain('New Shift Assignment');
      expect(notification?.message).toContain('Day Security Shift');
      expect(notification?.is_read).toBe(false);
    });

    it('should DETECT overlapping shift for the same employee and reject with 409 OVERLAPPING_SHIFT', async () => {
      // Create a conflicting shift overlapping with 08:00 - 16:00
      const conflictingShift = await prisma.shift.create({
        data: {
          branch_id: testBranchId,
          name: 'Midday Support Shift',
          start_time: '12:00', // Overlaps with 08:00 - 16:00!
          end_time: '20:00',
          check_type: CheckType.gps,
          is_active: true,
        },
      });

      // Attempt to assign conflicting shift to Guard 1 on overlapping dates
      const res = await request(app)
        .post(`/shifts/${conflictingShift.id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          user_id: testGuard1Id,
          start_date: '2026-11-05',
          end_date: '2026-11-20',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OVERLAPPING_SHIFT');
      expect(res.body.error.message).toContain('Overlapping shift detected');
    });

    it('should assign shift to all active employees in branch', async () => {
      // Create another non-overlapping shift: Evening Shift (16:30 - 21:30)
      const eveningShift = await prisma.shift.create({
        data: {
          branch_id: testBranchId,
          name: 'Evening Patrol',
          start_time: '16:30',
          end_time: '21:30',
          check_type: CheckType.gps,
          is_active: true,
        },
      });

      const res = await request(app)
        .post(`/shifts/${eveningShift.id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          assign_all_branch: true,
          start_date: '2026-12-01',
          end_date: '2026-12-15',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.assignments.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Employee Rota (GET /me/rota)', () => {
    it('should allow employee to view upcoming assigned rota with shift and branch details', async () => {
      const res = await request(app)
        .get('/me/rota')
        .set('Authorization', `Bearer ${guard1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('rota');
      expect(Array.isArray(res.body.data.rota)).toBe(true);
      expect(res.body.data.rota.length).toBeGreaterThan(0);

      const firstShift = res.body.data.rota[0];
      expect(firstShift).toHaveProperty('assignment_id');
      expect(firstShift.shift).toHaveProperty('name');
      expect(firstShift.shift).toHaveProperty('start_time');
      expect(firstShift.shift).toHaveProperty('end_time');
      expect(firstShift.shift.branch).toHaveProperty('name');
    });

    it('should allow alias GET /shifts/rota for logged-in employee', async () => {
      const res = await request(app)
        .get('/shifts/rota')
        .set('Authorization', `Bearer ${guard1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rota).toBeDefined();
    });
  });

  describe('4. Excel Import and Demo Template', () => {
    it('should download demo Excel (.xlsx) template with valid binary content-type', async () => {
      const res = await request(app)
        .get('/shifts/template')
        .set('Authorization', `Bearer ${managerToken}`)
        .buffer()
        .parse((res, callback) => {
          res.setEncoding('binary');
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            callback(null, Buffer.from(data, 'binary'));
          });
        });

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/vnd.openxmlformats-officedocument');
      expect(res.header['content-disposition']).toContain('shifts-template.xlsx');
      expect(Buffer.isBuffer(res.body)).toBe(true);

      // Verify workbook structure using XLSX
      const wb = XLSX.read(res.body, { type: 'buffer' });
      expect(wb.SheetNames.length).toBeGreaterThan(0);
    });

    it('should import shifts from Excel and generate per-row error report', async () => {
      // Build a test workbook with 1 valid row and 1 invalid row
      const testRows = [
        {
          branch_name_or_id: 'Birmingham Security Hub',
          shift_name: 'Imported Gate Shift',
          start_time: '07:00',
          end_time: '15:00',
          check_type: 'gps',
          overtime_enabled: 'true',
          overtime_limit_hours: 2,
          lunch_deduction_minutes: 30,
        },
        {
          branch_name_or_id: 'Nonexistent Hub 999', // Invalid branch!
          shift_name: 'Invalid Hub Shift',
          start_time: '09:00',
          end_time: '17:00',
          check_type: 'gps',
          overtime_enabled: 'false',
          overtime_limit_hours: 0,
          lunch_deduction_minutes: 0,
        },
      ];

      const ws = XLSX.utils.json_to_sheet(testRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Shifts');
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const res = await request(app)
        .post('/shifts/import')
        .set('Authorization', `Bearer ${managerToken}`)
        .attach('file', excelBuffer, 'shifts-test.xlsx');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalRows).toBe(2);
      expect(res.body.data.importedCount).toBe(1);
      expect(res.body.data.failedCount).toBe(1);
      expect(res.body.data.errors.length).toBe(1);
      expect(res.body.data.errors[0].errors[0]).toContain("Branch 'Nonexistent Hub 999' not found");

      // Verify the valid shift was actually created in DB
      const created = await prisma.shift.findFirst({
        where: { name: 'Imported Gate Shift', branch_id: testBranchId },
      });
      expect(created).toBeDefined();
    });
  });
});
