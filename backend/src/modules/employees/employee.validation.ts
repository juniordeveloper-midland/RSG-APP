import { z } from 'zod';
import { Role, UserStatus } from '@prisma/client';

export const employeeDocumentSchema = z.object({
  id: z.string().optional(),
  name: z.string({ required_error: 'Document name is required' }).trim().min(1),
  file_url: z.string({ required_error: 'File URL is required' }).trim().min(1),
  file_type: z.string().trim().optional().nullable(),
  file_size: z.coerce.number().optional().nullable(),
});

export type EmployeeDocumentInput = z.infer<typeof employeeDocumentSchema>;

export const createEmployeeSchema = z
  .object({
    // Personal fields
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(4, 'Name must be at least 4 characters')
      .max(100),
    email: z
      .string({ required_error: 'Email is required' })
      .email('Valid email address is required')
      .toLowerCase()
      .trim(),
    phone: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .min(5, 'Phone number must be at least 5 characters'),
    date_of_birth: z.string().trim().optional().nullable(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters'),
    address: z.string().trim().optional().nullable(),
    photo_url: z.string().trim().optional().nullable(),
    profile_image: z.string().trim().optional().nullable(),
    documents: z.array(employeeDocumentSchema).optional(),

    // General fields
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .optional()
      .nullable(),
    position: z.string().trim().optional().nullable(),

    // Operational fields
    pay_rate: z.coerce
      .number()
      .positive('Pay rate must be a positive number')
      .optional(),
    hourly_rate: z.coerce
      .number()
      .positive('Hourly rate must be a positive number')
      .optional(),
    weekly_hours: z.coerce
      .number()
      .positive('Weekly working hours must be a positive number')
      .optional()
      .nullable(),
    weekly_working_hours: z.coerce
      .number()
      .positive('Weekly working hours must be a positive number')
      .optional()
      .nullable(),
    monthly_hours: z.coerce
      .number()
      .positive('Monthly hours must be a positive number')
      .optional(),
    joining_date: z.string().trim().optional().nullable(),
    brp_expiry_date: z.string().trim().optional().nullable(),
    licence_expiry_date: z.string().trim().optional().nullable(),
    licence_number: z.string().trim().optional().nullable(),
    id_number: z.string().trim().optional().nullable(),
    client_id: z.string().trim().optional().nullable(),
    company: z.string().trim().optional().nullable(), // alias for client_id
    branch_id: z.string().trim().optional().nullable(),

    // Role & Settings
    role: z.nativeEnum(Role).default(Role.employee),
    status: z.nativeEnum(UserStatus).default(UserStatus.active),
    managerial_access: z.boolean().default(false),
    restrict_early_start: z.boolean().default(false),
    auto_checkout: z.boolean().default(false),
  })
  .refine(
    (data) => data.hourly_rate !== undefined || data.pay_rate !== undefined,
    {
      message: 'Pay rate or hourly rate is required and must be positive',
      path: ['hourly_rate'],
    }
  );

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  // Personal fields
  name: z.string().trim().min(4, 'Name must be at least 4 characters').optional(),
  phone: z.string().trim().min(5).optional(),
  email: z.string().email('Valid email address is required').toLowerCase().trim().optional(),
  date_of_birth: z.string().trim().optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  address: z.string().trim().optional().nullable(),
  photo_url: z.string().trim().optional().nullable(),
  profile_image: z.string().trim().optional().nullable(),
  documents: z.array(employeeDocumentSchema).optional(),

  // General fields
  username: z.string().trim().min(3).optional().nullable(),
  position: z.string().trim().optional().nullable(),

  // Operational fields
  pay_rate: z.coerce.number().positive().optional(),
  hourly_rate: z.coerce.number().positive().optional(),
  weekly_hours: z.coerce.number().positive().optional().nullable(),
  weekly_working_hours: z.coerce.number().positive().optional().nullable(),
  monthly_hours: z.coerce.number().positive().optional(),
  joining_date: z.string().trim().optional().nullable(),
  brp_expiry_date: z.string().trim().optional().nullable(),
  licence_expiry_date: z.string().trim().optional().nullable(),
  licence_number: z.string().trim().optional().nullable(),
  id_number: z.string().trim().optional().nullable(),
  client_id: z.string().trim().optional().nullable(),
  company: z.string().trim().optional().nullable(),
  branch_id: z.string().trim().optional().nullable(),

  // Role & Settings
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
  client_id: z.string().trim().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(Role).optional(),
  position: z.string().trim().optional(),
});

export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
