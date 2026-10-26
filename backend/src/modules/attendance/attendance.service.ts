import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/audit';
import { verifyGeofence } from './attendance.geofence';
import {
  CheckInInput,
  CheckOutInput,
  ManualAttendanceInput,
  ListAttendanceQuery,
} from './attendance.validation';

/**
 * Rounds a date to the nearest N minutes (default 5 minutes).
 */
export const roundTimeToMinutes = (date: Date, minutes = 5): Date => {
  const ms = 1000 * 60 * minutes;
  return new Date(Math.round(date.getTime() / ms) * ms);
};

/**
 * Convert time string "HH:mm" to total minutes from midnight.
 */
const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Calculate scheduled duration of a shift in minutes, supporting overnight shifts.
 */
export const getShiftScheduledMinutes = (startTime: string, endTime: string): number => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end >= start) {
    return end - start;
  }
  // Overnight shift (crosses midnight)
  return 1440 - start + end;
};

export class AttendanceService {
  /**
   * Process employee check-in.
   * Enforces idempotency, geofence, early start restriction, single active shift,
   * UTC timestamps, and 5-minute clock rounding.
   */
  async checkIn(input: CheckInInput, userId: string, req?: Request) {
    // 1. Idempotency Check: return original result if request_id already exists
    const existing = await prisma.attendance.findUnique({
      where: { request_id: input.request_id },
      include: { shift: { include: { branch: true } } },
    });
    if (existing) {
      return existing;
    }

    // 2. Load user and verify active status
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }
    if (user.status === 'suspended') {
      throw new AppError(
        'ACCOUNT_SUSPENDED',
        'Account is suspended. Please contact your administrator.',
        403
      );
    }

    // 3. Rule 5: Only one active shift per employee
    const activeShift = await prisma.attendance.findFirst({
      where: {
        user_id: userId,
        status: 'checked_in',
        check_out_at: null,
      },
    });
    if (activeShift) {
      throw new AppError(
        'ACTIVE_SHIFT_EXISTS',
        'Employee already has an active checked-in shift. You must check out before checking into another shift.',
        409
      );
    }

    // 4. Load shift and verify branch
    const shift = await prisma.shift.findUnique({
      where: { id: input.shift_id },
      include: { branch: true },
    });
    if (!shift) {
      throw new AppError('SHIFT_NOT_FOUND', `Shift '${input.shift_id}' not found`, 404);
    }
    if (!shift.is_active) {
      throw new AppError('SHIFT_INACTIVE', 'This shift has been deactivated', 400);
    }

    // 5. Rule 2: Verify shift is assigned to employee for today (supporting overnight shifts)
    const deviceDate = new Date(input.device_time);
    const todayStr = deviceDate.toISOString().split('T')[0];

    const yesterday = new Date(deviceDate);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const isOvernight = shift.end_time < shift.start_time;

    // Check assignment for today (or yesterday if overnight check-in in the early morning)
    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        shift_id: shift.id,
        user_id: userId,
      },
    });

    const isDateAssigned = (targetDateStr: string) => {
      const targetDate = new Date(`${targetDateStr}T00:00:00.000Z`);
      return assignments.some((a) => {
        const start = new Date(a.start_date.toISOString().split('T')[0] + 'T00:00:00.000Z');
        const end = a.end_date
          ? new Date(a.end_date.toISOString().split('T')[0] + 'T23:59:59.999Z')
          : null;

        const dateInRange = targetDate >= start && (!end || targetDate <= end);
        if (!dateInRange) return false;

        // Check excluded dates
        const excluded = Array.isArray(a.excluded_dates) ? (a.excluded_dates as string[]) : [];
        return !excluded.includes(targetDateStr);
      });
    };

    const hasAssignmentToday = isDateAssigned(todayStr);
    const hasAssignmentYesterday = isOvernight && isDateAssigned(yesterdayStr);

    if (!hasAssignmentToday && !hasAssignmentYesterday) {
      throw new AppError(
        'SHIFT_NOT_ASSIGNED',
        `You are not assigned to shift '${shift.name}' for today`,
        403
      );
    }

    // 6. Rule 3: Geofence and GPS Accuracy Check
    if (shift.check_type === 'gps' || input.method === 'gps') {
      if (input.accuracy_m > env.MAX_GPS_ACCURACY_METERS) {
        throw new AppError(
          'POOR_GPS_ACCURACY',
          `GPS signal accuracy is too weak (±${Math.round(input.accuracy_m)}m). Maximum allowed is ±${env.MAX_GPS_ACCURACY_METERS}m.`,
          400
        );
      }

      const { isWithin, distanceMeters } = verifyGeofence(
        input.lat,
        input.lng,
        Number(shift.branch.lat),
        Number(shift.branch.lng),
        shift.branch.radius_m
      );

      if (!isWithin) {
        throw new AppError(
          'OUTSIDE_GEOFENCE',
          `Location is outside branch geofence radius. You are ${distanceMeters}m away (maximum allowed: ${shift.branch.radius_m}m).`,
          403
        );
      }
    }

    // 7. Rule 4: Restrict Early Start
    if (user.restrict_early_start) {
      const [startH, startM] = shift.start_time.split(':').map(Number);
      const scheduledStart = new Date(deviceDate);
      scheduledStart.setUTCHours(startH, startM, 0, 0);

      const earliestAllowed = new Date(
        scheduledStart.getTime() - env.EARLY_START_ALLOWED_MINUTES * 60 * 1000
      );

      if (deviceDate.getTime() < earliestAllowed.getTime()) {
        throw new AppError(
          'EARLY_START_RESTRICTED',
          `Early start restricted: You cannot check in before ${shift.start_time} (early check-in permitted only within ${env.EARLY_START_ALLOWED_MINUTES} minutes prior).`,
          403
        );
      }
    }

    // 8. Rules 6 & 7: 5-minute Clock Rounding & UTC Storage
    const roundedCheckIn = roundTimeToMinutes(
      deviceDate,
      env.ATTENDANCE_ROUNDING_MINUTES
    );
    const serverTime = new Date();

    const attendance = await prisma.attendance.create({
      data: {
        user_id: userId,
        shift_id: shift.id,
        check_in_at: roundedCheckIn,
        in_lat: new Prisma.Decimal(input.lat),
        in_lng: new Prisma.Decimal(input.lng),
        accuracy_m: input.accuracy_m,
        method: input.method,
        status: 'checked_in',
        request_id: input.request_id,
        device_time: deviceDate,
        server_time: serverTime,
        system_generated: false,
        sync_status: 'synced',
      },
      include: {
        shift: { include: { branch: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await recordAuditLog({
      userId,
      action: 'ATTENDANCE_CHECKIN',
      entity: 'attendance',
      entityId: attendance.id,
      details: {
        shift_id: shift.id,
        shift_name: shift.name,
        method: input.method,
        check_in_at: roundedCheckIn.toISOString(),
      },
      req,
    });

    return attendance;
  }

  /**
   * Process employee check-out.
   * Applies 5-minute clock rounding, lunch deduction, and overtime rules.
   */
  async checkOut(input: CheckOutInput, userId: string, req?: Request) {
    // 1. Idempotency Check
    const existing = await prisma.attendance.findFirst({
      where: {
        OR: [
          { checkout_request_id: input.request_id },
          { request_id: input.request_id },
        ],
      },
      include: {
        shift: { include: { branch: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (existing && existing.check_out_at) {
      return existing;
    }

    // 2. Find active attendance record
    let activeRecord = await prisma.attendance.findFirst({
      where: {
        user_id: userId,
        shift_id: input.shift_id,
        check_out_at: null,
        status: 'checked_in',
      },
      include: {
        shift: { include: { branch: true } },
        user: true,
      },
    });

    if (!activeRecord) {
      // Fallback: check any active record for this user
      activeRecord = await prisma.attendance.findFirst({
        where: {
          user_id: userId,
          check_out_at: null,
          status: 'checked_in',
        },
        include: {
          shift: { include: { branch: true } },
          user: true,
        },
      });
    }

    if (!activeRecord || !activeRecord.check_in_at) {
      throw new AppError(
        'NO_ACTIVE_SHIFT',
        'No active checked-in shift found for this employee to check out of',
        404
      );
    }

    const shift = activeRecord.shift;
    const deviceDate = new Date(input.device_time);

    // 3. Geofence & GPS Accuracy check on check-out
    if (shift && (shift.check_type === 'gps' || input.method === 'gps')) {
      if (input.accuracy_m > env.MAX_GPS_ACCURACY_METERS) {
        throw new AppError(
          'POOR_GPS_ACCURACY',
          `GPS signal accuracy is too weak (±${Math.round(input.accuracy_m)}m).`,
          400
        );
      }

      const { isWithin, distanceMeters } = verifyGeofence(
        input.lat,
        input.lng,
        Number(shift.branch.lat),
        Number(shift.branch.lng),
        shift.branch.radius_m
      );

      if (!isWithin) {
        throw new AppError(
          'OUTSIDE_GEOFENCE',
          `Check-out location is outside branch geofence radius (${distanceMeters}m away).`,
          403
        );
      }
    }

    // 4. Rule 7: Round clock time to 5 minutes
    const roundedCheckOut = roundTimeToMinutes(
      deviceDate,
      env.ATTENDANCE_ROUNDING_MINUTES
    );

    // 5. Rule 8: Apply Lunch Deduction and Overtime Calculations
    const grossMinutes = Math.max(
      0,
      Math.round(
        (roundedCheckOut.getTime() - activeRecord.check_in_at.getTime()) / (1000 * 60)
      )
    );

    let appliedLunchDeduction = 0;
    if (shift && shift.lunch_deduction_minutes > 0) {
      // Only deduct lunch if the guard worked longer than the deduction duration
      if (grossMinutes > shift.lunch_deduction_minutes) {
        appliedLunchDeduction = shift.lunch_deduction_minutes;
      }
    }

    const netMinutes = Math.max(0, grossMinutes - appliedLunchDeduction);
    const hoursWorked = Number((netMinutes / 60).toFixed(2));

    let overtimeHours = 0;
    if (shift && shift.overtime_enabled) {
      const scheduledMinutes = getShiftScheduledMinutes(
        shift.start_time,
        shift.end_time
      );

      if (netMinutes > scheduledMinutes) {
        const extraMinutes = netMinutes - scheduledMinutes;
        const maxOvertimeMinutes = shift.overtime_limit_hours * 60;
        const creditedOvertimeMinutes = Math.min(extraMinutes, maxOvertimeMinutes);
        overtimeHours = Number((creditedOvertimeMinutes / 60).toFixed(2));
      }
    }

    // Update attendance record
    const updated = await prisma.attendance.update({
      where: { id: activeRecord.id },
      data: {
        checkout_request_id: input.request_id,
        check_out_at: roundedCheckOut,
        out_lat: new Prisma.Decimal(input.lat),
        out_lng: new Prisma.Decimal(input.lng),
        status: 'present',
        hours_worked: new Prisma.Decimal(hoursWorked),
        overtime_hours: new Prisma.Decimal(overtimeHours),
        lunch_deduction: appliedLunchDeduction,
      },
      include: {
        shift: { include: { branch: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await recordAuditLog({
      userId,
      action: 'ATTENDANCE_CHECKOUT',
      entity: 'attendance',
      entityId: updated.id,
      details: {
        shift_id: shift?.id,
        hours_worked: hoursWorked,
        overtime_hours: overtimeHours,
        lunch_deduction: appliedLunchDeduction,
        check_out_at: roundedCheckOut.toISOString(),
      },
      req,
    });

    return updated;
  }

  /**
   * Manager manual attendance creation.
   */
  async createManualEntry(input: ManualAttendanceInput, managerId: string, req?: Request) {
    const existing = await prisma.attendance.findUnique({
      where: { request_id: input.request_id },
    });
    if (existing) {
      return existing;
    }

    const user = await prisma.user.findUnique({ where: { id: input.user_id } });
    if (!user) throw new AppError('USER_NOT_FOUND', 'Employee not found', 404);

    const shift = await prisma.shift.findUnique({ where: { id: input.shift_id } });
    if (!shift) throw new AppError('SHIFT_NOT_FOUND', 'Shift not found', 404);

    const checkInDate = new Date(input.check_in_at);
    const checkOutDate = input.check_out_at ? new Date(input.check_out_at) : null;

    let hoursWorked = 0;
    let overtimeHours = 0;
    let appliedLunchDeduction = 0;

    if (checkOutDate) {
      const grossMinutes = Math.max(
        0,
        Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60))
      );

      if (shift.lunch_deduction_minutes > 0 && grossMinutes > shift.lunch_deduction_minutes) {
        appliedLunchDeduction = shift.lunch_deduction_minutes;
      }

      const netMinutes = Math.max(0, grossMinutes - appliedLunchDeduction);
      hoursWorked = Number((netMinutes / 60).toFixed(2));

      if (shift.overtime_enabled) {
        const scheduled = getShiftScheduledMinutes(shift.start_time, shift.end_time);
        if (netMinutes > scheduled) {
          const extra = netMinutes - scheduled;
          const capped = Math.min(extra, shift.overtime_limit_hours * 60);
          overtimeHours = Number((capped / 60).toFixed(2));
        }
      }
    }

    const entry = await prisma.attendance.create({
      data: {
        user_id: input.user_id,
        shift_id: input.shift_id,
        check_in_at: checkInDate,
        check_out_at: checkOutDate,
        method: 'manual',
        status: input.status,
        request_id: input.request_id,
        device_time: checkInDate,
        server_time: new Date(),
        hours_worked: checkOutDate ? new Prisma.Decimal(hoursWorked) : null,
        overtime_hours: checkOutDate ? new Prisma.Decimal(overtimeHours) : null,
        lunch_deduction: appliedLunchDeduction,
        notes: input.notes || 'Manual entry by manager',
        system_generated: false,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        shift: { select: { id: true, name: true } },
      },
    });

    await recordAuditLog({
      userId: managerId,
      action: 'ATTENDANCE_MANUAL_ENTRY',
      entity: 'attendance',
      entityId: entry.id,
      details: {
        employee_id: input.user_id,
        shift_id: input.shift_id,
        check_in_at: input.check_in_at,
        check_out_at: input.check_out_at,
        status: input.status,
      },
      req,
    });

    return entry;
  }

  /**
   * Manager forces check-out of an active employee.
   */
  async forceCheckout(attendanceId: string, managerId: string, req?: Request) {
    const record = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { shift: true, user: true },
    });

    if (!record) {
      throw new AppError('ATTENDANCE_NOT_FOUND', 'Attendance record not found', 404);
    }
    if (record.check_out_at || record.status !== 'checked_in') {
      throw new AppError('NOT_ACTIVE', 'This attendance record is already checked out', 400);
    }

    const checkOutTime = roundTimeToMinutes(new Date(), env.ATTENDANCE_ROUNDING_MINUTES);
    const grossMinutes = Math.max(
      0,
      Math.round((checkOutTime.getTime() - record.check_in_at!.getTime()) / (1000 * 60))
    );

    let appliedLunch = 0;
    if (record.shift && record.shift.lunch_deduction_minutes > 0 && grossMinutes > record.shift.lunch_deduction_minutes) {
      appliedLunch = record.shift.lunch_deduction_minutes;
    }

    const netMinutes = Math.max(0, grossMinutes - appliedLunch);
    const hoursWorked = Number((netMinutes / 60).toFixed(2));

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        check_out_at: checkOutTime,
        status: 'present',
        hours_worked: new Prisma.Decimal(hoursWorked),
        lunch_deduction: appliedLunch,
        notes: 'Force checked-out by operations manager',
      },
      include: { user: true, shift: true },
    });

    await recordAuditLog({
      userId: managerId,
      action: 'ATTENDANCE_FORCE_CHECKOUT',
      entity: 'attendance',
      entityId: attendanceId,
      details: {
        employee_id: record.user_id,
        forced_check_out_at: checkOutTime.toISOString(),
      },
      req,
    });

    return updated;
  }

  /**
   * Manager deletes an attendance record (audit logged).
   */
  async deleteRecord(attendanceId: string, managerId: string, req?: Request) {
    const record = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { user: true, shift: true },
    });

    if (!record) {
      throw new AppError('ATTENDANCE_NOT_FOUND', 'Attendance record not found', 404);
    }

    await prisma.attendance.delete({
      where: { id: attendanceId },
    });

    await recordAuditLog({
      userId: managerId,
      action: 'ATTENDANCE_RECORD_DELETED',
      entity: 'attendance',
      entityId: attendanceId,
      details: {
        deleted_record_id: attendanceId,
        user_id: record.user_id,
        employee_name: record.user.name,
        shift_name: record.shift?.name,
        check_in_at: record.check_in_at?.toISOString(),
        check_out_at: record.check_out_at?.toISOString(),
        status: record.status,
      },
      req,
    });

    return { success: true, message: 'Attendance record deleted successfully' };
  }

  /**
   * Get active checked-in employees.
   */
  async getActiveCheckedInEmployees(branchId?: string) {
    const where: Prisma.AttendanceWhereInput = {
      status: 'checked_in',
      check_out_at: null,
    };

    if (branchId) {
      where.shift = { branch_id: branchId };
    }

    const activeList = await prisma.attendance.findMany({
      where,
      orderBy: { check_in_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            photo_url: true,
            id_number: true,
          },
        },
        shift: {
          include: {
            branch: {
              select: { id: true, name: true, address: true },
            },
          },
        },
      },
    });

    return activeList;
  }

  /**
   * List attendance with filters and pagination.
   */
  async listAttendance(query: ListAttendanceQuery) {
    const { page, limit, branch_id, user_id, start_date, end_date, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceWhereInput = {};

    if (user_id) where.user_id = user_id;
    if (status) where.status = status;

    if (branch_id) {
      where.shift = { branch_id };
    }

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at.gte = new Date(`${start_date}T00:00:00.000Z`);
      }
      if (end_date) {
        where.created_at.lte = new Date(`${end_date}T23:59:59.999Z`);
      }
    }

    const [total, items] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          shift: {
            select: {
              id: true,
              name: true,
              start_time: true,
              end_time: true,
              branch: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export const attendanceService = new AttendanceService();
