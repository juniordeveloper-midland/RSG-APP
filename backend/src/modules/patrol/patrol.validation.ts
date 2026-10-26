import { z } from 'zod';

export const createPatrolQrSchema = z
  .object({
    branch_id: z.string().min(1, 'Branch ID is required'),
    name: z.string().min(2, 'Checkpoint name must be at least 2 characters').max(100),
    description: z.string().max(255).optional(),
    start_date: z
      .string()
      .datetime({ message: 'start_date must be a valid ISO datetime' })
      .optional()
      .nullable(),
    end_date: z
      .string()
      .datetime({ message: 'end_date must be a valid ISO datetime' })
      .optional()
      .nullable(),
    interval_minutes: z.coerce
      .number()
      .int()
      .min(5, 'Patrol interval must be at least 5 minutes')
      .max(1440, 'Patrol interval cannot exceed 24 hours')
      .default(60),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.start_date) <= new Date(data.end_date);
      }
      return true;
    },
    {
      message: 'start_date must be before or equal to end_date',
      path: ['end_date'],
    }
  );

export type CreatePatrolQrInput = z.infer<typeof createPatrolQrSchema>;

export const patrolScanSchema = z.object({
  token: z.string().min(10, 'QR signed token is required'),
  lat: z.coerce.number().min(-90).max(90, 'Invalid latitude coordinates'),
  lng: z.coerce.number().min(-180).max(180, 'Invalid longitude coordinates'),
  accuracy_m: z.coerce.number().min(0).optional().default(10.0),
  device_time: z
    .string()
    .datetime({ message: 'device_time must be a valid ISO UTC datetime' }),
  request_id: z.string().min(1, 'Unique request_id is required for idempotency'),
});

export type PatrolScanInput = z.infer<typeof patrolScanSchema>;

export const patrolLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  branch_id: z.string().optional(),
  qr_id: z.string().optional(),
  user_id: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_anomaly: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().optional(),
});

export type PatrolLogsQuery = z.infer<typeof patrolLogsQuerySchema>;
