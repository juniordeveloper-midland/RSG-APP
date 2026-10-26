import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { getEmployeeRotaHandler } from '../shifts/shift.controller';
import { getProfileHandler } from '../auth/auth.controller';

const router = Router();

// All /me endpoints require authentication
router.use(authenticate);

/**
 * @openapi
 * /me/rota:
 *   get:
 *     tags:
 *       - Shifts
 *     summary: Get upcoming assigned shifts for the logged-in employee
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upcoming rota schedule with shift and branch details
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/rota', getEmployeeRotaHandler);

/**
 * @openapi
 * /me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get current authenticated employee profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/', getProfileHandler);

export const meRoutes = router;
