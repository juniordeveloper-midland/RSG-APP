import { Router } from 'express';
import {
  checkInHandler,
  checkOutHandler,
  manualAttendanceHandler,
  forceCheckoutHandler,
  deleteAttendanceHandler,
  getActiveEmployeesHandler,
  listAttendanceHandler,
} from './attendance.controller';
import { authenticate, requireRole, branchScope } from '../../middleware/auth';

const router = Router();

// All attendance routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /attendance/check-in:
 *   post:
 *     tags:
 *       - Attendance
 *     summary: Employee shift check-in
 *     description: Checks in to an assigned shift. Enforces geofencing, single active shift, early start restrictions, and 5-minute clock rounding. Idempotent via request_id.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shift_id
 *               - lat
 *               - lng
 *               - accuracy_m
 *               - device_time
 *               - method
 *               - request_id
 *             properties:
 *               shift_id:
 *                 type: string
 *                 example: shift-day-001
 *               lat:
 *                 type: number
 *                 example: 51.50735
 *               lng:
 *                 type: number
 *                 example: -0.12775
 *               accuracy_m:
 *                 type: number
 *                 example: 12.5
 *               device_time:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-11-01T07:58:00Z"
 *               method:
 *                 type: string
 *                 enum: [gps, qr, face, manual]
 *                 example: gps
 *               request_id:
 *                 type: string
 *                 example: "req-checkin-001"
 *     responses:
 *       201:
 *         description: Check-in successful
 *       400:
 *         description: Validation or GPS accuracy error
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
 *         description: Outside geofence, unassigned shift, or early start restricted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Shift not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       409:
 *         description: Active shift already in progress or duplicate request_id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/check-in', checkInHandler);

/**
 * @openapi
 * /attendance/check-out:
 *   post:
 *     tags:
 *       - Attendance
 *     summary: Employee shift check-out
 *     description: Clocks out of active shift, calculates gross and net duration, deducts lunch, and credits overtime according to shift rules. Idempotent via request_id.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shift_id
 *               - lat
 *               - lng
 *               - accuracy_m
 *               - device_time
 *               - method
 *               - request_id
 *             properties:
 *               shift_id:
 *                 type: string
 *                 example: shift-day-001
 *               lat:
 *                 type: number
 *                 example: 51.50735
 *               lng:
 *                 type: number
 *                 example: -0.12775
 *               accuracy_m:
 *                 type: number
 *                 example: 15.0
 *               device_time:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-11-01T16:03:00Z"
 *               method:
 *                 type: string
 *                 enum: [gps, qr, face, manual]
 *                 example: gps
 *               request_id:
 *                 type: string
 *                 example: "req-checkout-001"
 *     responses:
 *       200:
 *         description: Check-out successful with payroll calculations
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
 *         description: Forbidden or branch mismatch
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: No active shift found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/check-out', checkOutHandler);

/**
 * @openapi
 * /attendance/active:
 *   get:
 *     tags:
 *       - Attendance
 *     summary: List currently active checked-in employees
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of active checked-in employees
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
router.get('/active', branchScope(), getActiveEmployeesHandler);

/**
 * @openapi
 * /attendance:
 *   get:
 *     tags:
 *       - Attendance
 *     summary: List attendance records with filters and pagination
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
 *           default: 10
 *       - in: query
 *         name: branch_id
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
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated attendance records
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
router.get('/', branchScope(), listAttendanceHandler);

/**
 * @openapi
 * /attendance/manual:
 *   post:
 *     tags:
 *       - Attendance
 *     summary: Manual attendance entry (Manager only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - shift_id
 *               - check_in_at
 *               - request_id
 *             properties:
 *               user_id:
 *                 type: string
 *                 example: usr-emp-001
 *               shift_id:
 *                 type: string
 *                 example: shift-day-001
 *               check_in_at:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-11-01T08:00:00Z"
 *               check_out_at:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-11-01T16:00:00Z"
 *               status:
 *                 type: string
 *                 enum: [present, late, absent, half_day]
 *                 default: present
 *               notes:
 *                 type: string
 *                 example: Approved manual entry due to device outage
 *               request_id:
 *                 type: string
 *                 example: "req-manual-att-001"
 *     responses:
 *       201:
 *         description: Manual attendance entry recorded
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
 *         description: Forbidden - Manager role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: User or shift not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/manual', requireRole('manager'), manualAttendanceHandler);

/**
 * @openapi
 * /attendance/{id}/force-checkout:
 *   post:
 *     tags:
 *       - Attendance
 *     summary: Force check-out an active employee (Manager only)
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
 *         description: Employee successfully checked out by manager
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
 *       404:
 *         description: Record not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/:id/force-checkout', requireRole('manager'), forceCheckoutHandler);

/**
 * @openapi
 * /attendance/{id}:
 *   delete:
 *     tags:
 *       - Attendance
 *     summary: Delete attendance record (Manager only)
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
 *         description: Record deleted and logged to audit_logs
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
 *       404:
 *         description: Record not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.delete('/:id', requireRole('manager'), deleteAttendanceHandler);

export const attendanceRoutes = router;
