import cron, { ScheduledTask } from 'node-cron';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { recordAuditLog } from '../../utils/audit';
import {
  roundTimeToMinutes,
  getShiftScheduledMinutes,
} from './attendance.service';

/**
 * Scan for missed check-ins after the grace period, mark absent, and generate an alert.
 */
export const runAutoAbsentJob = async (): Promise<{ markedAbsent: number; alertsCreated: number }> => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const [currentH, currentM] = [now.getUTCHours(), now.getUTCMinutes()];
  const currentTotalMinutes = currentH * 60 + currentM;

  const today = new Date(`${todayStr}T00:00:00.000Z`);

  // Find all active shift assignments today
  const activeAssignments = await prisma.shiftAssignment.findMany({
    where: {
      start_date: { lte: today },
      OR: [{ end_date: null }, { end_date: { gte: today } }],
      user: { status: 'active' },
      shift: { is_active: true },
    },
    include: {
      user: true,
      shift: { include: { branch: true } },
    },
  });

  let markedAbsent = 0;
  let alertsCreated = 0;

  for (const assignment of activeAssignments) {
    // Check if today is excluded
    const excluded = Array.isArray(assignment.excluded_dates)
      ? (assignment.excluded_dates as string[])
      : [];
    if (excluded.includes(todayStr)) {
      continue;
    }

    const [startH, startM] = assignment.shift.start_time.split(':').map(Number);
    const shiftStartMinutes = startH * 60 + startM;

    // Check if grace period has passed (and not overnight wrapped)
    const thresholdMinutes = shiftStartMinutes + env.AUTO_ABSENT_GRACE_MINUTES;

    // If shift started today and current time passed the grace threshold
    if (currentTotalMinutes >= thresholdMinutes) {
      // Check if an attendance record already exists for this shift & user today
      const startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${todayStr}T23:59:59.999Z`);

      const existingRecord = await prisma.attendance.findFirst({
        where: {
          user_id: assignment.user_id,
          shift_id: assignment.shift_id,
          OR: [
            { check_in_at: { gte: startOfDay, lte: endOfDay } },
            { server_time: { gte: startOfDay, lte: endOfDay } },
          ],
        },
      });

      if (!existingRecord) {
        const requestId = `auto-absent-${assignment.user_id}-${assignment.shift_id}-${todayStr}`;

        // Create absent record
        await prisma.attendance.upsert({
          where: { request_id: requestId },
          update: {},
          create: {
            user_id: assignment.user_id,
            shift_id: assignment.shift_id,
            check_in_at: null,
            check_out_at: null,
            method: 'system',
            status: 'absent',
            request_id: requestId,
            device_time: now,
            server_time: now,
            system_generated: true,
            notes: `Auto-absent: No check-in after ${env.AUTO_ABSENT_GRACE_MINUTES} min grace period`,
          },
        });
        markedAbsent++;

        // Create alert record
        await prisma.alert.create({
          data: {
            branch_id: assignment.shift.branch_id,
            owner_id: assignment.user_id,
            type: 'missed_patrol',
            severity: 'medium',
            status: 'open',
            message: `Employee '${assignment.user.name}' missed check-in for shift '${assignment.shift.name}' (${assignment.shift.start_time} - ${assignment.shift.end_time}) at branch '${assignment.shift.branch.name}'. Marked absent.`,
          },
        });
        alertsCreated++;
      }
    }
  }

  return { markedAbsent, alertsCreated };
};

/**
 * Scan for active shifts where user has auto_checkout enabled and shift end time has passed.
 */
export const runAutoCheckoutJob = async (): Promise<{ autoCheckedOut: number }> => {
  const now = new Date();
  const [currentH, currentM] = [now.getUTCHours(), now.getUTCMinutes()];
  const currentTotalMinutes = currentH * 60 + currentM;

  // Find all active check-ins where user has auto_checkout flag
  const activeRecords = await prisma.attendance.findMany({
    where: {
      status: 'checked_in',
      check_out_at: null,
      user: { auto_checkout: true },
      shift: { isNot: null },
    },
    include: {
      user: true,
      shift: true,
    },
  });

  let autoCheckedOut = 0;

  for (const record of activeRecords) {
    if (!record.shift || !record.check_in_at) continue;

    const [endH, endM] = record.shift.end_time.split(':').map(Number);
    const [startH, startM] = record.shift.start_time.split(':').map(Number);
    const isOvernight = record.shift.end_time < record.shift.start_time;

    let shouldCheckout = false;
    if (!isOvernight) {
      const shiftEndMinutes = endH * 60 + endM;
      if (currentTotalMinutes >= shiftEndMinutes) {
        shouldCheckout = true;
      }
    } else {
      // Overnight shift: end time is in the morning
      const shiftEndMinutes = endH * 60 + endM;
      // If current time is morning past end time
      if (currentTotalMinutes >= shiftEndMinutes && currentTotalMinutes < startH * 60 + startM) {
        shouldCheckout = true;
      }
    }

    if (shouldCheckout) {
      const checkOutTime = roundTimeToMinutes(now, env.ATTENDANCE_ROUNDING_MINUTES);
      const grossMinutes = Math.max(
        0,
        Math.round((checkOutTime.getTime() - record.check_in_at.getTime()) / (1000 * 60))
      );

      let appliedLunch = 0;
      if (
        record.shift.lunch_deduction_minutes > 0 &&
        grossMinutes > record.shift.lunch_deduction_minutes
      ) {
        appliedLunch = record.shift.lunch_deduction_minutes;
      }

      const netMinutes = Math.max(0, grossMinutes - appliedLunch);
      const hoursWorked = Number((netMinutes / 60).toFixed(2));

      let overtimeHours = 0;
      if (record.shift.overtime_enabled) {
        const scheduledMinutes = getShiftScheduledMinutes(
          record.shift.start_time,
          record.shift.end_time
        );
        if (netMinutes > scheduledMinutes) {
          const extra = netMinutes - scheduledMinutes;
          const capped = Math.min(extra, record.shift.overtime_limit_hours * 60);
          overtimeHours = Number((capped / 60).toFixed(2));
        }
      }

      await prisma.attendance.update({
        where: { id: record.id },
        data: {
          check_out_at: checkOutTime,
          status: 'present',
          hours_worked: new Prisma.Decimal(hoursWorked),
          overtime_hours: new Prisma.Decimal(overtimeHours),
          lunch_deduction: appliedLunch,
          system_generated: true,
          notes: 'Auto check-out: Scheduled shift duration completed',
        },
      });

      await recordAuditLog({
        userId: record.user_id,
        action: 'ATTENDANCE_AUTO_CHECKOUT',
        entity: 'attendance',
        entityId: record.id,
        details: {
          system_generated: true,
          hours_worked: hoursWorked,
          overtime_hours: overtimeHours,
          lunch_deduction: appliedLunch,
        },
      });

      autoCheckedOut++;
    }
  }

  return { autoCheckedOut };
};

/**
 * Initialize cron jobs (runs every 5 minutes in production / development).
 */
export const initAttendanceCronJobs = (): ScheduledTask => {
  return cron.schedule('*/5 * * * *', async () => {
    try {
      await runAutoAbsentJob();
      await runAutoCheckoutJob();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[AttendanceCron] Error running scheduled attendance jobs:', err);
    }
  });
};
