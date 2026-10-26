import { z } from 'zod';
import { Role, UserStatus } from '@prisma/client';

export const createEmployeeSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(4, 'Name must be at least 4 characters')
    .max(100),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(5, 'Phone number must be at least 5 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Valid email address is required')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters'),
  monthly_hours: z.coerce
    .number({ required_error: 'Monthly hours is required' })
    .positive('Monthly hours must be a positive number'),
  hourly_rate: z.coerce
    .number({ required_error: 'Hourly rate is required' })
    .positive('Hourly rate must be a positive number'),
  id_number: z
    .string({ required_error: 'ID number (SIA/NI/other) is required' })
    .trim()
    .min(2, 'ID number must be provided'),
  branch_id: z.string().trim().optional().nullable(),
  username: z.string().trim().min(3).optional().nullable(),
  address: z.string().trim().optional().nullable(),
  role: z.nativeEnum(Role).default(Role.employee),
  status: z.nativeEnum(UserStatus).default(UserStatus.active),
  managerial_access: z.boolean().default(false),
  restrict_early_start: z.boolean().default(false),
  auto_checkout: z.boolean().default(false),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(4, 'Name must be at least 4 characters').optional(),
  phone: z.string().trim().min(5).optional(),
  email: z.string().email('Valid email address is required').toLowerCase().trim().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  monthly_hours: z.coerce.number().positive().optional(),
  hourly_rate: z.coerce.number().positive().optional(),
  id_number: z.string().trim().min(2).optional(),
  branch_id: z.string().trim().optional().nullable(),
  username: z.string().trim().min(3).optional().nullable(),
  address: z.string().trim().optional().nullable(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  managerial_access: z.boolean().optional(),
  restrict_early_start: z.boolean().optional(),
  auto_checkout: z.boolean().optional(),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const updateEmployeeStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    required_error: "Status must be either 'active' or 'suspended'",
  }),
});

export type UpdateEmployeeStatusInput = z.infer<typeof updateEmployeeStatusSchema>;

export const updateManagerialAccessSchema = z.object({
  managerial_access: z.boolean({
    required_error: 'managerial_access must be a boolean',
  }),
});

export type UpdateManagerialAccessInput = z.infer<typeof updateManagerialAccessSchema>;

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  branch_id: z.string().trim().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(Role).optional(),
});

export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
