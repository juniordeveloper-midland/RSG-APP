import { Request } from 'express';
import { CheckType, Prisma, Shift, ShiftAssignment, UserStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/audit';
import {
  CreateShiftInput,
  UpdateShiftInput,
  AssignShiftInput,
  ListShiftsQuery,
} from './shift.validation';

// Convert HH:mm to minutes from midnight
const parseTimeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Checks if two daily shift time ranges overlap.
 * Properly accounts for both daytime and overnight shifts (e.g. 22:00 - 06:00).
 */
export const doShiftTimesOverlap = (
  s1Start: string,
  s1End: string,
  s2Start: string,
  s2End: string
): boolean => {
  const start1 = parseTimeToMinutes(s1Start);
  const end1 = parseTimeToMinutes(s1End);
  const start2 = parseTimeToMinutes(s2Start);
  const end2 = parseTimeToMinutes(s2End);

  // Helper: Get interval ranges in a 24h window (0 - 1440)
  // If end <= start, the shift wraps past midnight into next morning
  const getIntervals = (s: number, e: number): [number, number][] => {
    if (s < e) {
      return [[s, e]];
    }
    return [
      [s, 1440],
      [0, e],
    ];
  };

  const intervals1 = getIntervals(start1, end1);
  const intervals2 = getIntervals(start2, end2);

  for (const [a1, b1] of intervals1) {
    for (const [a2, b2] of intervals2) {
      // Overlap if max(start) < min(end)
      if (Math.max(a1, a2) < Math.min(b1, b2)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Checks if two date ranges overlap.
 */
export const doDateRangesOverlap = (
  start1: Date,
  end1: Date | null,
  start2: Date,
  end2: Date | null
): boolean => {
  const s1 = start1.getTime();
  const e1 = end1 ? end1.getTime() : Infinity;
  const s2 = start2.getTime();
  const e2 = end2 ? end2.getTime() : Infinity;

  return s1 <= e2 && s2 <= e1;
};

export class ShiftService {
  /**
   * Create a new shift for a branch.
   */
  async createShift(input: CreateShiftInput, managerId: string, req?: Request) {
    // Verify branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: input.branch_id },
    });
    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', `Branch '${input.branch_id}' was not found`, 404);
    }

    const shift = await prisma.shift.create({
      data: {
        branch_id: input.branch_id,
        name: input.name,
        start_time: input.start_time,
        end_time: input.end_time,
        check_type: input.check_type,
        overtime_enabled: input.overtime_enabled,
        overtime_limit_hours: input.overtime_enabled ? input.overtime_limit_hours : 0,
        lunch_deduction_minutes: input.lunch_deduction_minutes,
        is_active: input.is_active,
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    await recordAuditLog({
      userId: managerId,
      action: 'SHIFT_CREATED',
      entity: 'shifts',
      entityId: shift.id,
      details: {
        name: shift.name,
        branch_id: shift.branch_id,
        start_time: shift.start_time,
        end_time: shift.end_time,
        check_type: shift.check_type,
      },
      req,
    });

    return shift;
  }

  /**
   * List shifts with pagination, search, branch filter, and active/disabled filter.
   */
  async listShifts(query: ListShiftsQuery) {
    const { page, limit, search, branch_id, is_active } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ShiftWhereInput = {};

    if (branch_id) where.branch_id = branch_id;
    if (is_active !== undefined) where.is_active = is_active;
    if (search) {
      where.name = { contains: search };
    }

    const [total, items] = await Promise.all([
      prisma.shift.count({ where }),
      prisma.shift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          branch: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              shift_assignments: true,
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

  /**
   * Get single shift by ID.
   */
  async getShiftById(id: string) {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        branch: true,
        _count: {
          select: {
            shift_assignments: true,
            attendance_records: true,
          },
        },
      },
    });

    if (!shift) {
      throw new AppError('SHIFT_NOT_FOUND', `Shift with ID '${id}' was not found`, 404);
    }

    return shift;
  }

  /**
   * Update shift details.
   */
  async updateShift(
    id: string,
    input: UpdateShiftInput,
    managerId: string,
    req?: Request
  ) {
    await this.getShiftById(id);

    if (input.branch_id) {
      const branch = await prisma.branch.findUnique({
        where: { id: input.branch_id },
      });
      if (!branch) {
        throw new AppError('BRANCH_NOT_FOUND', `Branch '${input.branch_id}' not found`, 404);
      }
    }

    const updateData: Prisma.ShiftUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.start_time !== undefined) updateData.start_time = input.start_time;
    if (input.end_time !== undefined) updateData.end_time = input.end_time;
    if (input.check_type !== undefined) updateData.check_type = input.check_type;
    if (input.overtime_enabled !== undefined) updateData.overtime_enabled = input.overtime_enabled;
    if (input.overtime_limit_hours !== undefined)
      updateData.overtime_limit_hours = input.overtime_limit_hours;
    if (input.lunch_deduction_minutes !== undefined)
      updateData.lunch_deduction_minutes = input.lunch_deduction_minutes;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const updated = await prisma.shift.update({
      where: { id },
      data: updateData,
      include: { branch: { select: { id: true, name: true } } },
    });

    await recordAuditLog({
      userId: managerId,
      action: 'SHIFT_UPDATED',
      entity: 'shifts',
      entityId: id,
      details: { updatedFields: input },
      req,
    });

    return updated;
  }

  /**
   * Enable or disable a shift.
   */
  async setShiftActive(id: string, isActive: boolean, managerId: string, req?: Request) {
    await this.getShiftById(id);

    const updated = await prisma.shift.update({
      where: { id },
      data: { is_active: isActive },
    });

    await recordAuditLog({
      userId: managerId,
      action: isActive ? 'SHIFT_ENABLED' : 'SHIFT_DISABLED',
      entity: 'shifts',
      entityId: id,
      details: { is_active: isActive },
      req,
    });

    return updated;
  }

  /**
   * Assign shift to one employee or all employees in the branch.
   * Checks for overlapping shifts and creates notification records.
   */
  async assignShift(
    shiftId: string,
    input: AssignShiftInput,
    managerId: string,
    req?: Request
  ) {
    const shift = await this.getShiftById(shiftId);

    const startDate = new Date(input.start_date);
    const endDate = input.end_date ? new Date(input.end_date) : null;
    const excludedDates = input.excluded_dates || [];

    // Target employees to assign
    let targetUsers: { id: string; name: string; email: string }[] = [];

    if (input.assign_all_branch) {
      targetUsers = await prisma.user.findMany({
        where: {
          branch_id: shift.branch_id,
          status: UserStatus.active,
        },
        select: { id: true, name: true, email: true },
      });

      if (targetUsers.length === 0) {
        throw new AppError(
          'NO_EMPLOYEES_IN_BRANCH',
          `No active employees found in branch '${shift.branch.name}' to assign`,
          400
        );
      }
    } else if (input.user_id) {
      const user = await prisma.user.findUnique({
        where: { id: input.user_id },
        select: { id: true, name: true, email: true, status: true },
      });

      if (!user) {
        throw new AppError('EMPLOYEE_NOT_FOUND', `Employee '${input.user_id}' was not found`, 404);
      }

      if (user.status === UserStatus.suspended) {
        throw new AppError(
          'EMPLOYEE_SUSPENDED',
          `Cannot assign shift to suspended employee '${user.name}'`,
          400
        );
      }

      targetUsers = [user];
    }

    // Overlapping Shift Detection:
    // Check each target employee's existing assignments for schedule overlaps
    for (const employee of targetUsers) {
      const existingAssignments = await prisma.shiftAssignment.findMany({
        where: {
          user_id: employee.id,
        },
        include: {
          shift: true,
        },
      });

      for (const existing of existingAssignments) {
        // 1. Check if date ranges overlap
        const dateOverlap = doDateRangesOverlap(
          existing.start_date,
          existing.end_date,
          startDate,
          endDate
        );

        if (!dateOverlap) continue;

        // 2. Check if daily shift hours overlap
        const timeOverlap = doShiftTimesOverlap(
          shift.start_time,
          shift.end_time,
          existing.shift.start_time,
          existing.shift.end_time
        );

        if (timeOverlap) {
          throw new AppError(
            'OVERLAPPING_SHIFT',
            `Overlapping shift detected for employee '${employee.name}': already assigned to shift '${existing.shift.name}' (${existing.shift.start_time} - ${existing.shift.end_time}) on overlapping dates`,
            409
          );
        }
      }
    }

    // Create assignments and notifications
    const createdAssignments = [];

    for (const employee of targetUsers) {
      const assignment = await prisma.shiftAssignment.create({
        data: {
          shift_id: shift.id,
          user_id: employee.id,
          start_date: startDate,
          end_date: endDate,
          excluded_dates: excludedDates.length > 0 ? excludedDates : Prisma.JsonNull,
        },
      });

      // Create Notification record for the employee
      const dateRangeStr = endDate
        ? `from ${input.start_date} to ${input.end_date}`
        : `starting ${input.start_date}`;

      await prisma.notification.create({
        data: {
          user_id: employee.id,
          title: `New Shift Assignment: ${shift.name}`,
          message: `You have been assigned to '${shift.name}' (${shift.start_time} - ${shift.end_time}) ${dateRangeStr} at ${shift.branch.name}.`,
          type: 'shift_assignment',
          data: {
            shift_id: shift.id,
            shift_name: shift.name,
            start_time: shift.start_time,
            end_time: shift.end_time,
            start_date: input.start_date,
            end_date: input.end_date || null,
            excluded_dates: excludedDates,
          },
        },
      });

      await recordAuditLog({
        userId: managerId,
        action: 'SHIFT_ASSIGNED',
        entity: 'shift_assignments',
        entityId: assignment.id,
        details: {
          shift_id: shift.id,
          shift_name: shift.name,
          employee_id: employee.id,
          employee_name: employee.name,
          start_date: input.start_date,
          end_date: input.end_date,
        },
        req,
      });

      createdAssignments.push({
        ...assignment,
        employee_name: employee.name,
        employee_email: employee.email,
      });
    }

    return {
      message: `Shift '${shift.name}' assigned to ${createdAssignments.length} employee(s)`,
      assignments: createdAssignments,
    };
  }

  /**
   * Generate demo Excel (.xlsx) template for bulk shift imports.
   */
  generateDemoTemplate(): Buffer {
    const headers = [
      'branch_name_or_id',
      'shift_name',
      'start_time',
      'end_time',
      'check_type',
      'overtime_enabled',
      'overtime_limit_hours',
      'lunch_deduction_minutes',
    ];

    const sampleRows = [
      {
        branch_name_or_id: 'RSG Central Headquarters',
        shift_name: 'Morning Gate Shift',
        start_time: '06:00',
        end_time: '14:00',
        check_type: 'gps',
        overtime_enabled: 'true',
        overtime_limit_hours: 4,
        lunch_deduction_minutes: 30,
      },
      {
        branch_name_or_id: 'RSG Central Headquarters',
        shift_name: 'Overnight Perimeter Patrol',
        start_time: '22:00',
        end_time: '06:00',
        check_type: 'qr',
        overtime_enabled: 'false',
        overtime_limit_hours: 0,
        lunch_deduction_minutes: 45,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shifts_Template');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Import shifts from an uploaded Excel (.xlsx) file with row-by-row validation report.
   */
  async importShiftsFromExcel(fileBuffer: Buffer, managerId: string, req?: Request) {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch {
      throw new AppError('INVALID_EXCEL_FILE', 'Unable to parse uploaded Excel file', 400);
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new AppError('EMPTY_WORKBOOK', 'Excel file contains no worksheets', 400);
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    if (rawData.length === 0) {
      throw new AppError('EMPTY_SHEET', 'No rows found in the Excel worksheet', 400);
    }

    // Cache existing branches for fast lookup
    const allBranches = await prisma.branch.findMany({
      select: { id: true, name: true },
    });

    const branchMap = new Map<string, string>();
    for (const b of allBranches) {
      branchMap.set(b.id.toLowerCase(), b.id);
      branchMap.set(b.name.toLowerCase().trim(), b.id);
    }

    const errors: { row: number; name?: string; errors: string[] }[] = [];
    const validShiftsToCreate: Prisma.ShiftCreateManyInput[] = [];

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 2; // +2 accounting for header row and 1-based indexing
      const rowErrors: string[] = [];

      const branchRef = String(
        row.branch_name_or_id || row['Branch Name or ID'] || row.branch_id || ''
      ).trim();
      const shiftName = String(row.shift_name || row['Shift Name'] || '').trim();
      const startTime = String(row.start_time || row['Start Time'] || '').trim();
      const endTime = String(row.end_time || row['End Time'] || '').trim();
      const checkTypeRaw = String(row.check_type || row['Check Type'] || 'gps')
        .toLowerCase()
        .trim();
      const overtimeRaw = String(row.overtime_enabled || row['Overtime Enabled'] || 'false')
        .toLowerCase()
        .trim();
      const overtimeLimit = Number(row.overtime_limit_hours || row['Overtime Limit Hours'] || 0);
      const lunchDeduction = Number(row.lunch_deduction_minutes || row['Lunch Deduction Minutes'] || 0);

      // Validate Branch
      const matchedBranchId = branchMap.get(branchRef.toLowerCase());
      if (!matchedBranchId) {
        rowErrors.push(`Branch '${branchRef}' not found`);
      }

      // Validate Name
      if (!shiftName || shiftName.length < 2) {
        rowErrors.push('Shift name must be at least 2 characters');
      }

      // Validate Start & End Times
      if (!timeRegex.test(startTime)) {
        rowErrors.push(`Start time '${startTime}' is invalid (expected HH:mm format)`);
      }
      if (!timeRegex.test(endTime)) {
        rowErrors.push(`End time '${endTime}' is invalid (expected HH:mm format)`);
      }

      // Validate Check Type
      const validCheckTypes = ['gps', 'qr', 'face', 'manual'];
      if (!validCheckTypes.includes(checkTypeRaw)) {
        rowErrors.push(
          `Invalid check_type '${checkTypeRaw}' (expected gps, qr, face, or manual)`
        );
      }

      // Validate Overtime
      const isOvertime = overtimeRaw === 'true' || overtimeRaw === 'yes' || overtimeRaw === '1';
      if (isOvertime && (overtimeLimit < 1 || overtimeLimit > 50)) {
        rowErrors.push('Overtime limit hours must be between 1 and 50 when overtime is enabled');
      }

      // Validate Lunch Deduction
      if (lunchDeduction < 0) {
        rowErrors.push('Lunch deduction minutes cannot be negative');
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          name: shiftName || undefined,
          errors: rowErrors,
        });
      } else if (matchedBranchId) {
        validShiftsToCreate.push({
          branch_id: matchedBranchId,
          name: shiftName,
          start_time: startTime,
          end_time: endTime,
          check_type: checkTypeRaw as CheckType,
          overtime_enabled: isOvertime,
          overtime_limit_hours: isOvertime ? overtimeLimit : 0,
          lunch_deduction_minutes: lunchDeduction,
          is_active: true,
        });
      }
    }

    let importedCount = 0;
    if (validShiftsToCreate.length > 0) {
      const created = await prisma.shift.createMany({
        data: validShiftsToCreate,
      });
      importedCount = created.count;

      await recordAuditLog({
        userId: managerId,
        action: 'SHIFTS_IMPORTED',
        entity: 'shifts',
        details: {
          totalRows: rawData.length,
          importedCount,
          failedCount: errors.length,
        },
        req,
      });
    }

    return {
      totalRows: rawData.length,
      importedCount,
      failedCount: errors.length,
      errors,
    };
  }

  /**
   * Get employee's personal rota (upcoming and active shift assignments).
   */
  async getEmployeeRota(userId: string) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        user_id: userId,
        OR: [
          { end_date: null },
          { end_date: { gte: today } },
        ],
      },
      orderBy: {
        start_date: 'asc',
      },
      include: {
        shift: {
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
        },
      },
    });

    const rota = assignments.map((a) => {
      const startStr =
        a.start_date instanceof Date
          ? a.start_date.toISOString().slice(0, 10)
          : String(a.start_date).slice(0, 10);
      const endStr = a.end_date
        ? a.end_date instanceof Date
          ? a.end_date.toISOString().slice(0, 10)
          : String(a.end_date).slice(0, 10)
        : null;

      return {
        id: a.id,
        assignment_id: a.id,
        shift_id: a.shift_id,
        user_id: a.user_id,
        start_date: startStr,
        end_date: endStr,
        excluded_dates: a.excluded_dates,
        days_of_week: a.days_of_week,
        shift: {
          id: a.shift.id,
          branch_id: a.shift.branch_id,
          name: a.shift.name,
          start_time: a.shift.start_time,
          end_time: a.shift.end_time,
          check_type: a.shift.check_type,
          overtime_enabled: a.shift.overtime_enabled,
          overtime_limit_hours: a.shift.overtime_limit_hours,
          lunch_deduction_minutes: a.shift.lunch_deduction_minutes,
          branch: a.shift.branch
            ? {
                id: a.shift.branch.id,
                name: a.shift.branch.name,
                address: a.shift.branch.address,
                lat: Number(a.shift.branch.lat),
                lng: Number(a.shift.branch.lng),
                radius_m: Number(a.shift.branch.radius_m),
              }
            : undefined,
        },
      };
    });

    return { rota };
  }
}

export const shiftService = new ShiftService();
