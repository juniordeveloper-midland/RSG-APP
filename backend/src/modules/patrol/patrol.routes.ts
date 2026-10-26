import { Router } from 'express';
import {
  createPatrolQrHandler,
  getPatrolQrHandler,
  getPatrolQrImageHandler,
  listPatrolQrsHandler,
  recordScanHandler,
  getPatrolLogsHandler,
  exportPatrolLogsExcelHandler,
} from './patrol.controller';
import { authenticate, requireRole, branchScope } from '../../middleware/auth';

const router = Router();

// All patrol routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /patrol/qrs:
 *   post:
 *     tags:
 *       - Patrol
 *     summary: Create a patrol QR checkpoint (Manager only)
 *     description: Creates a new patrol QR checkpoint, generates an HMAC-SHA256 signed token, and returns QR image representations.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - branch_id
 *               - name
 *             properties:
 *               branch_id:
 *                 type: string
 *                 example: branch-hq-001
 *               name:
 *                 type: string
 *                 example: North Perimeter Checkpoint A
 *               description:
 *                 type: string
 *                 example: Mounted on perimeter gate 3
 *               start_date:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-11-01T00:00:00Z"
 *               end_date:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-12-31T23:59:59Z"
 *               interval_minutes:
 *                 type: integer
 *                 default: 60
 *                 example: 45
 *     responses:
 *       201:
 *         description: Patrol QR created with signed token and data URL
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Manager role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/qrs', requireRole('manager'), branchScope(), createPatrolQrHandler);

/**
 * @openapi
 * /patrol/qrs:
 *   get:
 *     tags:
 *       - Patrol
 *     summary: List patrol QR checkpoints
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of patrol checkpoints
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/qrs', branchScope(), listPatrolQrsHandler);

/**
 * @openapi
 * /patrol/qrs/{id}:
 *   get:
 *     tags:
 *       - Patrol
 *     summary: Get patrol QR checkpoint details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Checkpoint details
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Checkpoint not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/qrs/:id', branchScope(), getPatrolQrHandler);

/**
 * @openapi
 * /patrol/qrs/{id}/image:
 *   get:
 *     tags:
 *       - Patrol
 *     summary: Download printable PNG QR code image
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: High-resolution PNG QR image
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Checkpoint not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/qrs/:id/image', branchScope(), getPatrolQrImageHandler);

/**
 * @openapi
 * /patrol/scan:
 *   post:
 *     tags:
 *       - Patrol
 *     summary: Record a patrol QR checkpoint scan
 *     description: Verifies HMAC signature, checks active dates and branch scope, stores UTC timestamps, flags rapid duplicates and suspicious GPS as anomalies. Idempotent via request_id.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - lat
 *               - lng
 *               - device_time
 *               - request_id
 *             properties:
 *               token:
 *                 type: string
 *                 description: HMAC signed token read from the physical QR checkpoint
 *                 example: "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InFyLTAwMSJ9.signature"
 *               lat:
 *                 type: number
 *                 example: 51.50735
 *               lng:
 *                 type: number
 *                 example: -0.12775
 *               accuracy_m:
 *                 type: number
 *                 example: 8.5
 *               device_time:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-11-01T23:15:00Z"
 *               request_id:
 *                 type: string
 *                 example: "req-patrol-scan-001"
 *     responses:
 *       201:
 *         description: Patrol scan recorded successfully
 *       400:
 *         description: Invalid or tampered token, or expired QR
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Branch scope unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Checkpoint not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       409:
 *         description: Duplicate request_id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/scan', recordScanHandler);

/**
 * @openapi
 * /patrol/logs:
 *   get:
 *     tags:
 *       - Patrol
 *     summary: Get patrol scan logs (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: qr_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: is_anomaly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated scan logs
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Manager role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/logs', requireRole('manager'), branchScope(), getPatrolLogsHandler);

/**
 * @openapi
 * /patrol/logs/export:
 *   get:
 *     tags:
 *       - Patrol
 *     summary: Export patrol scan logs as Excel spreadsheet (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_anomaly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *     responses:
 *       200:
 *         description: Excel spreadsheet download (.xlsx)
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Forbidden - Manager role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get(
  '/logs/export',
  requireRole('manager'),
  branchScope(),
  exportPatrolLogsExcelHandler
);

export const patrolRoutes = router;
