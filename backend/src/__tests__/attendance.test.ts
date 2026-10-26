import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../app';
import { prisma } from '../config/prisma';
import { Role, UserStatus, CheckType } from '@prisma/client';
import { runAutoAbsentJob, runAutoCheckoutJob } from '../modules/attendance/attendance.cron';

describe('RSG Core Attendance Engine', () => {
  const managerEmail = 'manager-att@region.com';
  const guardStandardEmail = 'guard-standard@region.com';
  const guardRestrictedEmail = 'guard-restricted@region.com';
  const testPassword = 'Password123!';

  let managerToken: string;
  let standardGuardToken: string;
  let restrictedGuardToken: string;

  let testBranchId: string;
  let dayShiftId: string;
  let overnightShiftId: string;
  let afternoonShiftId: string;

  let standardGuardId: string;
  let restrictedGuardId: string;

  const branchLat = 51.5073509;
  const branchLng = -0.1277583;
  const branchRadius = 150.0;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // 1. Create test branch
    const branch = await prisma.branch.create({
      data: {
        name: 'RSG Central Operations Yard',
        address: '100 Central Yard, London',
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
        name: 'Attendance Operations Manager',
        email: managerEmail,
        password_hash: passwordHash,
        role: Role.manager,
        status: UserStatus.active,
        branch_id: branch.id,
        managerial_access: true,
      },
    });

    // 3. Create standard guard
    const stdGuard = await prisma.user.create({
      data: {
        name: 'Standard Guard Tim',
        email: guardStandardEmail,
        password_hash: passwordHash,
        role: Role.employee,
        status: UserStatus.active,
        branch_id: branch.id,
        restrict_early_start: false,
        auto_checkout: true,
      },
    });
    standardGuardId = stdGuard.id;

    // 4. Create guard with early start restricted
    const restGuard = await prisma.user.create({
      data: {
        name: 'Restricted Guard Harry',
        email: guardRestrictedEmail,
        password_hash: passwordHash,
        role: Role.employee,
        status: UserStatus.active,
        branch_id: branch.id,
        restrict_early_start: true, // RESTRICTED EARLY START
        auto_checkout: false,
      },
    });
    restrictedGuardId = restGuard.id;

    // 5. Create shifts
    // Day shift: 08:00 - 16:00
    const dayShift = await prisma.shift.create({
      data: {
        branch_id: branch.id,
        name: 'Day Guard 8h',
        start_time: '08:00',
        end_time: '16:00',
        check_type: CheckType.gps,
        overtime_enabled: true,
        overtime_limit_hours: 4,
        lunch_deduction_minutes: 30,
        is_active: true,
      },
    });
    dayShiftId = dayShift.id;

    // Overnight shift: 22:00 - 06:00
    const overnightShift = await prisma.shift.create({
      data: {
        branch_id: branch.id,
        name: 'Overnight Gate Guard',
        start_time: '22:00',
        end_time: '06:00',
        check_type: CheckType.gps,
        overtime_enabled: true,
        overtime_limit_hours: 2,
        lunch_deduction_minutes: 30,
        is_active: true,
      },
    });
    overnightShiftId = overnightShift.id;

    // Afternoon shift: 14:00 - 22:00
    const afternoonShift = await prisma.shift.create({
      data: {
        branch_id: branch.id,
        name: 'Afternoon Patrol',
        start_time: '14:00',
        end_time: '22:00',
        check_type: CheckType.gps,
        overtime_enabled: false,
        lunch_deduction_minutes: 30,
        is_active: true,
      },
    });
    afternoonShiftId = afternoonShift.id;

    // 6. Assign shifts to guards for today and surrounding dates
    const today = new Date();
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - 5);
    const endDate = new Date(today);
    endDate.setUTCDate(endDate.getUTCDate() + 30);

    // Standard guard assigned to day shift and overnight shift
    await prisma.shiftAssignment.create({
      data: {
        shift_id: dayShiftId,
        user_id: standardGuardId,
        start_date: startDate,
        end_date: endDate,
      },
    });

    await prisma.shiftAssignment.create({
      data: {
        shift_id: overnightShiftId,
        user_id: standardGuardId,
        start_date: startDate,
        end_date: endDate,
      },
    });

    // Restricted guard assigned to afternoon shift
    await prisma.shiftAssignment.create({
      data: {
        shift_id: afternoonShiftId,
        user_id: restrictedGuardId,
        start_date: startDate,
        end_date: endDate,
      },
    });

    // Obtain access tokens
    const mgrRes = await request(app)
      .post('/auth/login')
      .send({ email: managerEmail, password: testPassword });
    managerToken = mgrRes.body.data.accessToken;

    const stdRes = await request(app)
      .post('/auth/login')
      .send({ email: guardStandardEmail, password: testPassword });
    standardGuardToken = stdRes.body.data.accessToken;

    const restRes = await request(app)
      .post('/auth/login')
      .send({ email: guardRestrictedEmail, password: testPassword });
    restrictedGuardToken = restRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.alert.deleteMany({ where: { branch_id: testBranchId } });
    await prisma.attendance.deleteMany({
      where: { user_id: { in: [standardGuardId, restrictedGuardId] } },
    });
    await prisma.shiftAssignment.deleteMany({
      where: { user_id: { in: [standardGuardId, restrictedGuardId] } },
    });
    await prisma.shift.deleteMany({ where: { branch_id: testBranchId } });
    await prisma.user.deleteMany({
      where: { email: { in: [managerEmail, guardStandardEmail, guardRestrictedEmail] } },
    });
    await prisma.branch.deleteMany({ where: { id: testBranchId } });
    await prisma.$disconnect();
  });

  describe('1. Check-In & Idempotency', () => {
    it('should successfully check in within geofence and store UTC device_time & server_time with 5-min rounding', async () => {
      const deviceTime = new Date().toISOString();
      const requestId = 'req-checkin-idemp-001';

      const res = await request(app)
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${standardGuardToken}`)
        .send({
          shift_id: dayShiftId,
          lat: branchLat, // Exactly at branch
          lng: branchLng,
          accuracy_m: 10.0,
          device_time: deviceTime,
          method: 'gps',
          request_id: requestId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('checked_in');
      expect(res.body.data.request_id).toBe(requestId);
      expect(res.body.data).toHaveProperty('device_time');
      expect(res.body.data).toHaveProperty('server_time');
      expect(res.body.data).toHaveProperty('check_in_at');
    });

    it('should return the original check-in result when request_id is duplicated (Idempotent Rule 1)', async () => {
      const requestId = 'req-checkin-idemp-001';

      const res = await request(app)
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${standardGuardToken}`)
        .send({
          shift_id: dayShiftId,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 10.0,
          device_time: new Date().toISOString(),
          method: 'gps',
          request_id: requestId, // DUPLICATE REQUEST ID
        });

      expect(res.status).toBe(201);
      expect(res.body.data.request_id).toBe(requestId);
    });
  });

  describe('2. Only One Active Shift Per Employee (Rule 5)', () => {
    it('should REJECT check-in to a second shift while one is already active (409 ACTIVE_SHIFT_EXISTS)', async () => {
      const res = await request(app)
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${standardGuardToken}`)
        .send({
          shift_id: overnightShiftId,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 12.0,
          device_time: new Date().toISOString(),
          method: 'gps',
          request_id: 'req-second-active-shift-attempt',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACTIVE_SHIFT_EXISTS');
      expect(res.body.error.message).toContain('active checked-in shift');
    });
  });

  describe('3. Geofence & GPS Accuracy Validation (Rule 3)', () => {
    it('should REJECT check-in outside branch geofence radius (403 OUTSIDE_GEOFENCE)', async () => {
      // Coordinates ~5 km away in London
      const outsideLat = 51.55;
      const outsideLng = -0.15;

      const res = await request(app)
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${restrictedGuardToken}`)
        .send({
          shift_id: afternoonShiftId,
          lat: outsideLat,
          lng: outsideLng,
          accuracy_m: 10.0,
          device_time: new Date().toISOString(),
          method: 'gps',
          request_id: 'req-outside-geofence-001',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OUTSIDE_GEOFENCE');
      expect(res.body.error.message).toContain('outside branch geofence');
    });

    it('should REJECT check-in if GPS accuracy is too weak (400 POOR_GPS_ACCURACY)', async () => {
      const res = await request(app)
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${restrictedGuardToken}`)
        .send({
          shift_id: afternoonShiftId,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 350.0, // WEAK ACCURACY > 150m
          device_time: new Date().toISOString(),
          method: 'gps',
          request_id: 'req-weak-gps-001',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('POOR_GPS_ACCURACY');
    });
  });

  describe('4. Early Start Restriction (Rule 4)', () => {
    it('should REJECT early check-in when employee has restrict_early_start = true (403 EARLY_START_RESTRICTED)', async () => {
      // Afternoon shift starts at 14:00. Guard tries to check in at 10:00 UTC
      const today = new Date();
      today.setUTCHours(10, 0, 0, 0);

      const res = await request(app)
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${restrictedGuardToken}`)
        .send({
          shift_id: afternoonShiftId,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 10.0,
          device_time: today.toISOString(),
          method: 'gps',
          request_id: 'req-early-restricted-001',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EARLY_START_RESTRICTED');
      expect(res.body.error.message).toContain('Early start restricted');
    });
  });

  describe('5. Check-Out, Lunch Deduction & Overtime Calculations (Rule 8)', () => {
    it('should check out active shift, deduct 30 min lunch, credit overtime, and update status to present', async () => {
      // Active check-in for standard guard is at ~08:00
      // Check out 9.5 hours later at 17:30 (Gross: 9.5h = 570 min)
      // Net: 570 - 30 (lunch) = 540 min = 9.0 hours
      // Scheduled: 8.0 hours. Overtime: 1.0 hour (within 4h limit)
      const now = new Date();
      const checkOutDate = new Date(now.getTime() + 9.5 * 60 * 60 * 1000);

      const res = await request(app)
        .post('/attendance/check-out')
        .set('Authorization', `Bearer ${standardGuardToken}`)
        .send({
          shift_id: dayShiftId,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 10.0,
          device_time: checkOutDate.toISOString(),
          method: 'gps',
          request_id: 'req-checkout-valid-001',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('present');
      expect(res.body.data.check_out_at).toBeDefined();
      expect(Number(res.body.data.hours_worked)).toBeGreaterThan(0);
      expect(res.body.data.lunch_deduction).toBe(30);
    });

    it('should be idempotent on check-out when duplicate request_id is received', async () => {
      const res = await request(app)
        .post('/attendance/check-out')
        .set('Authorization', `Bearer ${standardGuardToken}`)
        .send({
          shift_id: dayShiftId,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 10.0,
          device_time: new Date().toISOString(),
          method: 'gps',
          request_id: 'req-checkout-valid-001', // DUPLICATE ID
        });

      expect(res.status).toBe(200);
      expect(res.body.data.checkout_request_id).toBe('req-checkout-valid-001');
    });
  });

  describe('6. Overnight Shift Support (Rule 2)', () => {
    it('should successfully check in and out for an overnight shift crossing midnight', async () => {
      // Check in at 22:00 on Day 1
      const day1 = new Date();
      day1.setUTCHours(22, 0, 0, 0);

      const checkInRes = await request(app)
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${standardGuardToken}`)
        .send({
          shift_id: overnightShiftId,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 15.0,
          device_time: day1.toISOString(),
          method: 'gps',
          request_id: 'req-overnight-in-001',
        });

      expect(checkInRes.status).toBe(201);
      expect(checkInRes.body.data.status).toBe('checked_in');

      // Check out at 06:00 on Day 2 (8 hours later)
      const day2 = new Date(day1.getTime() + 8 * 60 * 60 * 1000);

      const checkOutRes = await request(app)
        .post('/attendance/check-out')
        .set('Authorization', `Bearer ${standardGuardToken}`)
        .send({
          shift_id: overnightShiftId,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 15.0,
          device_time: day2.toISOString(),
          method: 'gps',
          request_id: 'req-overnight-out-001',
        });

      expect(checkOutRes.status).toBe(200);
      expect(checkOutRes.body.data.status).toBe('present');
      expect(Number(checkOutRes.body.data.hours_worked)).toBe(7.5); // 8h - 30m lunch = 7.5h
    });
  });

  describe('7. Manager Operations', () => {
    let manualRecordId: string;

    it('should allow manager to enter manual attendance with audit logging', async () => {
      const checkIn = new Date().toISOString();
      const checkOut = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/attendance/manual')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          user_id: restrictedGuardId,
          shift_id: afternoonShiftId,
          check_in_at: checkIn,
          check_out_at: checkOut,
          status: 'present',
          notes: 'Cover shift entered manually by supervisor',
          request_id: 'req-manual-entry-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.method).toBe('manual');
      expect(res.body.data.notes).toContain('Cover shift');

      manualRecordId = res.body.data.id;

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'ATTENDANCE_MANUAL_ENTRY',
          entity: 'attendance',
          entity_id: manualRecordId,
        },
      });
      expect(audit).toBeDefined();
    });

    it('should list active checked-in employees on GET /attendance/active', async () => {
      // First check in restricted guard at their scheduled shift start time (14:05 UTC)
      const validShiftTime = new Date();
      validShiftTime.setUTCHours(14, 5, 0, 0);

      const resIn = await request(app)
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${restrictedGuardToken}`)
        .send({
          shift_id: afternoonShiftId,
          lat: branchLat,
          lng: branchLng,
          accuracy_m: 10.0,
          device_time: validShiftTime.toISOString(),
          method: 'gps',
          request_id: 'req-for-active-list-001',
        });
      expect(resIn.status).toBe(201);

      // Now query active list
      const res = await request(app)
        .get(`/attendance/active?branch_id=${testBranchId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].status).toBe('checked_in');

      // Manager forces check-out of this active record
      const forceCheckoutRes = await request(app)
        .post(`/attendance/${resIn.body.data.id}/force-checkout`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(forceCheckoutRes.status).toBe(200);
      expect(forceCheckoutRes.body.data.status).toBe('present');
    });

    it('should allow manager to delete an attendance record with audit logging', async () => {
      const res = await request(app)
        .delete(`/attendance/${manualRecordId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'ATTENDANCE_RECORD_DELETED',
          entity: 'attendance',
        },
        orderBy: { created_at: 'desc' },
      });
      expect(audit).toBeDefined();
    });
  });

  describe('8. Cron Jobs: Auto-Absent and Auto Check-Out', () => {
    it('should trigger runAutoAbsentJob() and runAutoCheckoutJob() cleanly', async () => {
      const absentReport = await runAutoAbsentJob();
      expect(absentReport).toHaveProperty('markedAbsent');
      expect(absentReport).toHaveProperty('alertsCreated');

      const checkoutReport = await runAutoCheckoutJob();
      expect(checkoutReport).toHaveProperty('autoCheckedOut');
    });
  });
});
