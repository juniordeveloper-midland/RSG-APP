import { Router } from 'express';
import {
  createEmployeeHandler,
  listEmployeesHandler,
  getEmployeeHandler,
  updateEmployeeHandler,
  updateEmployeeStatusHandler,
  updateManagerialAccessHandler,
  uploadPhotoHandler,
} from './employee.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { photoUpload } from '../../middleware/upload';

const router = Router();

// All employee management routes require authentication and manager role
router.use(authenticate, requireRole('manager'));

/**
 * @openapi
 * /employees:
 *   post:
 *     tags:
 *       - Employees
 *     summary: Create a new employee (Manager only)
 *     description: Creates an employee or manager. Accepts JSON or multipart/form-data for optional photo.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - email
 *               - password
 *               - monthly_hours
 *               - hourly_rate
 *               - id_number
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 4
 *                 example: Alex Morgan Guard
 *               phone:
 *                 type: string
 *                 example: "+447700900111"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alex.guard@region.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurityGuard2026!
 *               monthly_hours:
 *                 type: number
 *                 example: 160
 *               hourly_rate:
 *                 type: number
 *                 example: 15.50
 *               id_number:
 *                 type: string
 *                 example: SIA-123456789
 *               branch_id:
 *                 type: string
 *                 example: branch-hq-001
 *               username:
 *                 type: string
 *                 example: amorgan
 *               address:
 *                 type: string
 *                 example: 12 Guard Avenue, Birmingham
 *               role:
 *                 type: string
 *                 enum: [employee, manager]
 *                 default: employee
 *               managerial_access:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Employee successfully created
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
 *       409:
 *         description: Email or username already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/', photoUpload.single('photo'), createEmployeeHandler);

/**
 * @openapi
 * /employees:
 *   get:
 *     tags:
 *       - Employees
 *     summary: List employees with filtering and search (Manager only)
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, phone, SIA/ID number, or username
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended]
 *         description: Filter by account status
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [employee, manager]
 *     responses:
 *       200:
 *         description: Paginated list of employees
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
router.get('/', listEmployeesHandler);

/**
 * @openapi
 * /employees/{id}:
 *   get:
 *     tags:
 *       - Employees
 *     summary: Get employee profile by ID (Manager only)
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
 *         description: Employee details
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
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/:id', getEmployeeHandler);

/**
 * @openapi
 * /employees/{id}:
 *   put:
 *     tags:
 *       - Employees
 *     summary: Update employee profile (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Alex M. Guard
 *               phone:
 *                 type: string
 *                 example: "+447700900222"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alex.guard.updated@region.com
 *               hourly_rate:
 *                 type: number
 *                 example: 16.50
 *               monthly_hours:
 *                 type: number
 *                 example: 160
 *               branch_id:
 *                 type: string
 *                 example: branch-hq-001
 *               id_number:
 *                 type: string
 *                 example: SIA-987654321
 *     responses:
 *       200:
 *         description: Employee successfully updated
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
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.put('/:id', updateEmployeeHandler);
router.patch('/:id', updateEmployeeHandler);

/**
 * @openapi
 * /employees/{id}/status:
 *   patch:
 *     tags:
 *       - Employees
 *     summary: Suspend or activate employee account (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, suspended]
 *                 example: suspended
 *     responses:
 *       200:
 *         description: Employee status updated
 *       400:
 *         description: Invalid status value
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
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.patch('/:id/status', updateEmployeeStatusHandler);

/**
 * @openapi
 * /employees/{id}/managerial-access:
 *   patch:
 *     tags:
 *       - Employees
 *     summary: Grant or revoke managerial access (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - managerial_access
 *             properties:
 *               managerial_access:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Managerial access updated
 *       400:
 *         description: Invalid payload
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
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.patch('/:id/managerial-access', updateManagerialAccessHandler);

/**
 * @openapi
 * /employees/{id}/photo:
 *   post:
 *     tags:
 *       - Employees
 *     summary: Upload employee profile photo (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - photo
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Photo uploaded successfully
 *       400:
 *         description: Invalid file type or size
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
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/:id/photo', photoUpload.single('photo'), uploadPhotoHandler);

export const employeeRoutes = router;
