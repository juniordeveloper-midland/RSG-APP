import { Router } from 'express';
import { getHealth } from './health.controller';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - System
 *     summary: System health check
 *     description: Returns operational status, uptime, and database connectivity.
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     service:
 *                       type: string
 *                       example: rsg-backend
 *                     timestamp_utc:
 *                       type: string
 *                       format: date-time
 *                     uptime_seconds:
 *                       type: number
 *                     database:
 *                       type: string
 *                       example: connected
 */
router.get('/', getHealth);

export const healthRoutes = router;
