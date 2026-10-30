import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: () => process.env.NODE_ENV === 'test',
  handler: (_req, res) => {
    sendError(res, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later.', 429);
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (_req, res) => {
    sendError(
      res,
      'RATE_LIMIT_EXCEEDED',
      'Too many authentication attempts. Please wait 15 minutes before trying again.',
      429
    );
  },
});

