import { Router } from 'express';
import multer from 'multer';
import {
  createShiftHandler,
  listShiftsHandler,
  getShiftHandler,
  updateShiftHandler,
  disableShiftHandler,
  enableShiftHandler,
  assignShiftHandler,
  downloadDemoTemplateHandler,
  importShiftsHandler,
  getEmployeeRotaHandler,
} from './shift.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const isXlsx =
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls');

    if (isXlsx) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          'INVALID_FILE_TYPE',
          'Only Excel spreadsheets (.xlsx, .xls) are accepted',
          400
        )
      );
    }
  },
});

const router = Router();

/**
 * @openapi
 * /shifts/template:
 *   get:
 *     tags:
 *       - Shifts
 *     summary: Download demo Excel (.xlsx) template for bulk shift import
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel template binary stream
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
  '/template',
  authenticate,
  requireRole('manager'),
  downloadDemoTemplateHandler
);

/**
 * @openapi
 * /shifts/import:
 *   post:
 *     tags:
 *       - Shifts
 *     summary: Bulk import shifts from an Excel (.xlsx) file
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Shift import summary and row-by-row error report
 *       400:
 *         description: Invalid Excel file or parsing error
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
 */
router.post(
  '/import',
  authenticate,
  requireRole('manager'),
  excelUpload.single('file'),
  importShiftsHandler
);

/**
 * @openapi
 * /shifts/rota:
 *   get:
 *     tags:
 *       - Shifts
 *     summary: Get logged-in employee upcoming rota
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upcoming shift assignments
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/rota', authenticate, getEmployeeRotaHandler);

/**
 * @openapi
 * /shifts:
 *   post:
 *     tags:
 *       - Shifts
 *     summary: Create a new shift (Manager only)
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
 *               - start_time
 *               - end_time
 *             properties:
 *               branch_id:
 *                 type: string
 *                 example: branch-hq-001
 *               name:
 *                 type: string
 *                 example: Day Guard Shift
 *               start_time:
 *                 type: string
 *                 example: "08:00"
 *               end_time:
 *                 type: string
 *                 example: "16:00"
 *               check_type:
 *                 type: string
 *                 enum: [gps, qr, face, manual]
 *                 default: gps
 *               overtime_enabled:
 *                 type: boolean
 *                 default: false
 *               overtime_limit_hours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *                 example: 4
 *               lunch_deduction_minutes:
 *                 type: integer
 *                 example: 30
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Shift created successfully
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
 */
router.post('/', authenticate, requireRole('manager'), createShiftHandler);

/**
 * @openapi
 * /shifts:
 *   get:
 *     tags:
 *       - Shifts
 *     summary: List shifts with search, branch filter, and active/disabled filter (Manager only)
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
 *         description: Search by shift name
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *     responses:
 *       200:
 *         description: Paginated list of shifts
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
router.get('/', authenticate, requireRole('manager'), listShiftsHandler);

/**
 * @openapi
 * /shifts/{id}:
 *   get:
 *     tags:
 *       - Shifts
 *     summary: Get shift details by ID (Manager only)
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
 *         description: Shift details
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
 *         description: Shift not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/:id', authenticate, requireRole('manager'), getShiftHandler);

/**
 * @openapi
 * /shifts/{id}:
 *   put:
 *     tags:
 *       - Shifts
 *     summary: Update shift configuration (Manager only)
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
 *                 example: Night Guard Shift
 *               start_time:
 *                 type: string
 *                 example: "22:00"
 *               end_time:
 *                 type: string
 *                 example: "06:00"
 *               check_type:
 *                 type: string
 *                 enum: [gps, qr, face, manual]
 *               overtime_enabled:
 *                 type: boolean
 *               overtime_limit_hours:
 *                 type: integer
 *               lunch_deduction_minutes:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Shift updated successfully
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
 *         description: Shift not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.put('/:id', authenticate, requireRole('manager'), updateShiftHandler);
router.patch('/:id', authenticate, requireRole('manager'), updateShiftHandler);

/**
 * @openapi
 * /shifts/{id}/disable:
 *   patch:
 *     tags:
 *       - Shifts
 *     summary: Disable shift (Manager only)
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
 *         description: Shift disabled
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
 *         description: Shift not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.patch('/:id/disable', authenticate, requireRole('manager'), disableShiftHandler);

/**
 * @openapi
 * /shifts/{id}/enable:
 *   patch:
 *     tags:
 *       - Shifts
 *     summary: Re-enable shift (Manager only)
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
 *         description: Shift re-enabled
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
 *         description: Shift not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.patch('/:id/enable', authenticate, requireRole('manager'), enableShiftHandler);

/**
 * @openapi
 * /shifts/{id}/assign:
 *   post:
 *     tags:
 *       - Shifts
 *     summary: Assign shift to one employee or all branch employees with overlap detection (Manager only)
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
 *               - start_date
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: Employee ID (or use assign_all_branch)
 *                 example: usr-emp-001
 *               assign_all_branch:
 *                 type: boolean
 *                 description: Set true to assign all employees in the branch
 *                 example: false
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-11-01"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-11-30"
 *               excluded_dates:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["2026-11-05", "2026-11-12"]
 *     responses:
 *       200:
 *         description: Shift assigned and notifications generated
 *       400:
 *         description: Invalid assignment parameters
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
 *         description: Shift or employee not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       409:
 *         description: Overlapping shift conflict detected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/:id/assign', authenticate, requireRole('manager'), assignShiftHandler);

export const shiftRoutes = router;
