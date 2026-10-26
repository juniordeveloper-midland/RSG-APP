import { z } from 'zod';
import { CheckType } from '@prisma/client';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}/;

export const createShiftSchema = z
  .object({
    branch_id: z.string({ required_error: 'Branch ID is required' }).min(1),
    name: z
      .string({ required_error: 'Shift name is required' })
      .trim()
      .min(2, 'Shift name must be at least 2 characters')
      .max(100),
    start_time: z
      .string({ required_error: 'Start time is required' })
      .regex(TIME_REGEX, 'Start time must be in 24-hour HH:mm format (e.g., 08:00)'),
    end_time: z
      .string({ required_error: 'End time is required' })
      .regex(TIME_REGEX, 'End time must be in 24-hour HH:mm format (e.g., 16:00)'),
    check_type: z.nativeEnum(CheckType).default(CheckType.gps),
    overtime_enabled: z.boolean().default(false),
    overtime_limit_hours: z.number().int().min(0).max(50).default(0),
    lunch_deduction_minutes: z.number().int().min(0).max(180).default(0),
    is_active: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.overtime_enabled && (data.overtime_limit_hours < 1 || data.overtime_limit_hours > 50)) {
        return false;
      }
      return true;
    },
    {
      message: 'When overtime is enabled, overtime limit hours must be between 1 and 50',
      path: ['overtime_limit_hours'],
    }
  );

export type CreateShiftInput = z.infer<typeof createShiftSchema>;

export const updateShiftSchema = z
  .object({
    branch_id: z.string().min(1).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    start_time: z.string().regex(TIME_REGEX).optional(),
    end_time: z.string().regex(TIME_REGEX).optional(),
    check_type: z.nativeEnum(CheckType).optional(),
    overtime_enabled: z.boolean().optional(),
    overtime_limit_hours: z.number().int().min(0).max(50).optional(),
    lunch_deduction_minutes: z.number().int().min(0).max(180).optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.overtime_enabled === true && (data.overtime_limit_hours === undefined || data.overtime_limit_hours < 1 || data.overtime_limit_hours > 50)) {
        return false;
      }
      return true;
    },
    {
      message: 'When overtime is enabled, overtime limit hours must be between 1 and 50',
      path: ['overtime_limit_hours'],
    }
  );

export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;

export const assignShiftSchema = z
  .object({
    user_id: z.string().optional().nullable(),
    assign_all_branch: z.boolean().default(false),
    start_date: z
      .string({ required_error: 'start_date is required' })
      .regex(DATE_REGEX, 'start_date must be in YYYY-MM-DD format'),
    end_date: z
      .string()
      .regex(DATE_REGEX, 'end_date must be in YYYY-MM-DD format')
      .optional()
      .nullable(),
    excluded_dates: z
      .array(z.string().regex(DATE_REGEX, 'Each excluded date must be in YYYY-MM-DD format'))
      .optional()
      .default([]),
  })
  .refine((data) => Boolean(data.user_id) || data.assign_all_branch, {
    message: 'Either user_id or assign_all_branch must be specified',
    path: ['user_id'],
  })
  .refine(
    (data) => {
      if (!data.end_date) return true;
      return new Date(data.end_date) >= new Date(data.start_date);
    },
    {
      message: 'end_date cannot be earlier than start_date',
      path: ['end_date'],
    }
  );

export type AssignShiftInput = z.infer<typeof assignShiftSchema>;

export const listShiftsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  branch_id: z.string().trim().optional(),
  is_active: z
    .enum(['true', 'false', 'all'])
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});

export type ListShiftsQuery = z.infer<typeof listShiftsQuerySchema>;
