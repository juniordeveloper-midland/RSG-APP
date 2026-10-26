import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().default('rsg_jwt_super_secret_access_key_2026_dev'),
  JWT_REFRESH_SECRET: z.string().default('rsg_jwt_super_secret_refresh_key_2026_dev'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Region Security Guarding <no-reply@regionsecurityguarding.co.uk>'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  MAX_GPS_ACCURACY_METERS: z.coerce.number().default(150),
  ATTENDANCE_ROUNDING_MINUTES: z.coerce.number().default(5),
  EARLY_START_ALLOWED_MINUTES: z.coerce.number().default(15),
  AUTO_ABSENT_GRACE_MINUTES: z.coerce.number().default(30),
  PATROL_HMAC_SECRET: z.string().default('rsg_patrol_checkpoint_hmac_secret_2026'),
  PATROL_RAPID_SCAN_THRESHOLD_MINUTES: z.coerce.number().default(5),
  PATROL_MISSED_GRACE_MINUTES: z.coerce.number().default(15),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
