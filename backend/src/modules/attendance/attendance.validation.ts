import { z } from 'zod';

export const checkInSchema = z.object({
  shift_id: z.string({ required_error: 'shift_id is required' }).min(1),
  lat: z
    .number({ required_error: 'lat is required' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  lng: z
    .number({ required_error: 'lng is required' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  accuracy_m: z.number({ required_error: 'accuracy_m is required' }).positive(),
  device_time: z
    .string({ required_error: 'device_time is required' })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'device_time must be a valid ISO 8601 date string',
    }),
  method: z.enum(['gps', 'qr', 'face', 'manual']).default('gps'),
  request_id: z
    .string({ required_error: 'request_id is required for idempotency' })
    .trim()
    .min(1, 'request_id cannot be empty'),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

export const checkOutSchema = z.object({
  shift_id: z.string({ required_error: 'shift_id is required' }).min(1),
  lat: z
    .number({ required_error: 'lat is required' })
    .min(-90)
    .max(90),
  lng: z
    .number({ required_error: 'lng is required' })
    .min(-180)
    .max(180),
  accuracy_m: z.number({ required_error: 'accuracy_m is required' }).positive(),
  device_time: z
    .string({ required_error: 'device_time is required' })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'device_time must be a valid ISO 8601 date string',
    }),
  method: z.enum(['gps', 'qr', 'face', 'manual']).default('gps'),
  request_id: z
    .string({ required_error: 'request_id is required for idempotency' })
    .trim()
    .min(1, 'request_id cannot be empty'),
});

export type CheckOutInput = z.infer<typeof checkOutSchema>;

export const manualAttendanceSchema = z.object({
  user_id: z.string({ required_error: 'user_id is required' }).min(1),
  shift_id: z.string({ required_error: 'shift_id is required' }).min(1),
  check_in_at: z
    .string({ required_error: 'check_in_at is required' })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'check_in_at must be a valid date string',
    }),
  check_out_at: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'check_out_at must be a valid date string',
    }),
  status: z
    .enum(['present', 'late', 'absent', 'half_day', 'checked_in'])
    .default('present'),
  notes: z.string().optional(),
  request_id: z.string().trim().min(1),
});

export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  branch_id: z.string().trim().optional(),
  user_id: z.string().trim().optional(),
  start_date: z.string().trim().optional(),
  end_date: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
