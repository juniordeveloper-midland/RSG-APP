import { Router } from 'express';
import {
  createEmployeeHandler,
  listEmployeesHandler,
  getEmployeeHandler,
  updateEmployeeHandler,
  updateEmployeeStatusHandler,
  updateManagerialAccessHandler,
  uploadPhotoHandler,
  uploadDocumentsHandler,
  addDocumentsHandler,
  deleteDocumentHandler,
} from './employee.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { photoUpload, employeeDocumentUpload } from '../../middleware/upload';

const router = Router();

// All employee management routes require authentication and manager role
router.use(authenticate, requireRole('manager'));

/**
 * @openapi
 * /employees/upload-photo:
 *   post:
 *     tags:
 *       - Employees
 *     summary: Standalone upload of employee profile photo (Manager only)
 *     description: Uploads an employee profile photo (JPG, PNG, WEBP, GIF up to 5 MB) and returns the public file URL.
 *     security:
 *       - bearerAuth: []
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
 *                     photo_url:
 *                       type: string
 *                       example: /uploads/employees/employee-123456789.jpg
 *       400:
 *         description: Invalid file format or size exceeds limit
 */
router.post('/upload-photo', photoUpload.single('photo'), uploadPhotoHandler);

/**
 * @openapi
 * /employees/upload-document:
 *   post:
 *     tags:
 *       - Employees
 *     summary: Upload employee document files (Manager only)
 *     description: Uploads one or multiple employee documents (PDF, JPG, PNG up to 5 MB each) and returns uploaded file metadata.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Documents uploaded successfully
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
 *                     documents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: passport_scan.pdf
 *                           file_name:
 *                             type: string
 *                             example: doc-passport_scan-1730000000.pdf
 *                           file_url:
 *                             type: string
 *                             example: /uploads/employees/documents/doc-passport_scan-1730000000.pdf
 *                           file_type:
 *                             type: string
 *                             example: application/pdf
 *                           file_size:
 *                             type: number
 *                             example: 1048576
 *       400:
 *         description: Invalid file type (only PDF, JPG, PNG up to 5MB allowed)
 */
router.post(
  '/upload-document',
  employeeDocumentUpload.array('documents', 10),
  uploadDocumentsHandler
);

/**
 * @openapi
 * /employees:
 *   post:
 *     tags:
 *       - Employees
 *     summary: Create a new employee (Manager only)
 *     description: Creates an employee or manager with Personal, General, and Operational records. Accepts JSON or multipart/form-data with optional photo.
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
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 example: "1992-06-15"
 *               address:
 *                 type: string
 *                 example: 12 Guard Avenue, Birmingham
 *               profile_image:
 *                 type: string
 *                 example: /uploads/employees/employee-123.jpg
 *               photo_url:
 *                 type: string
 *                 example: /uploads/employees/employee-123.jpg
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - file_url
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: SIA_Licence.pdf
 *                     file_url:
 *                       type: string
 *                       example: /uploads/employees/documents/doc-sia-123.pdf
 *                     file_type:
 *                       type: string
 *                       example: application/pdf
 *                     file_size:
 *                       type: number
 *                       example: 524288
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 example: amorgan
 *               position:
 *                 type: string
 *                 example: Security Guard
 *               pay_rate:
 *                 type: number
 *                 example: 15.50
 *               hourly_rate:
 *                 type: number
 *                 example: 15.50
 *               weekly_working_hours:
 *                 type: number
 *                 example: 40
 *               weekly_hours:
 *                 type: number
 *                 example: 40
 *               monthly_hours:
 *                 type: number
 *                 example: 160
 *               joining_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-01-10"
 *               brp_expiry_date:
 *                 type: string
 *                 format: date
 *                 example: "2028-05-20"
 *               licence_expiry_date:
 *                 type: string
 *                 format: date
 *                 example: "2027-12-31"
 *               licence_number:
 *                 type: string
 *                 example: "1000123456789012"
 *               id_number:
 *                 type: string
 *                 example: "SIA-123456789"
 *               client_id:
 *                 type: string
 *                 format: uuid
 *                 example: "00000000-0000-0000-0000-000000000001"
 *               company:
 *                 type: string
 *                 example: "00000000-0000-0000-0000-000000000001"
 *               branch_id:
 *                 type: string
 *                 format: uuid
 *                 example: "branch-hq-001"
 *               role:
 *                 type: string
 *                 enum: [employee, manager]
 *                 default: employee
 *               status:
 *                 type: string
 *                 enum: [active, suspended]
 *                 default: active
 *               managerial_access:
 *                 type: boolean
 *                 default: false
 *               restrict_early_start:
 *                 type: boolean
 *                 default: false
 *               auto_checkout:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Employee successfully created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Manager role required
 *       409:
 *         description: Email or username already exists
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
 *         description: Search by name, email, phone, username, position, licence number, or ID
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: string
 *         description: Filter by client/company ID
 *       - in: query
 *         name: position
 *         schema:
 *           type: string
 *         description: Filter by position
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
 *       403:
 *         description: Forbidden - Manager role required
 */
router.get('/', listEmployeesHandler);

/**
 * @openapi
 * /employees/{id}:
 *   get:
 *     tags:
 *       - Employees
 *     summary: Get employee profile by ID (Manager only)
 *     description: Returns employee Personal, General, and Operational details, client, branch, and attached documents.
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
 *       403:
 *         description: Forbidden - Manager role required
 *       404:
 *         description: Employee not found
 */
router.get('/:id', getEmployeeHandler);

/**
 * @openapi
 * /employees/{id}:
 *   put:
 *     tags:
 *       - Employees
 *     summary: Update employee profile (Manager only)
 *     description: Updates Personal, General, or Operational fields, company, branch, and documents.
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
 *               username:
 *                 type: string
 *                 example: amorgan2
 *               position:
 *                 type: string
 *                 example: Senior Patrol Officer
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 example: "1992-06-15"
 *               address:
 *                 type: string
 *                 example: 45 High Street, Birmingham
 *               profile_image:
 *                 type: string
 *                 example: /uploads/employees/employee-999.jpg
 *               pay_rate:
 *                 type: number
 *                 example: 16.50
 *               hourly_rate:
 *                 type: number
 *                 example: 16.50
 *               weekly_working_hours:
 *                 type: number
 *                 example: 42
 *               weekly_hours:
 *                 type: number
 *                 example: 42
 *               monthly_hours:
 *                 type: number
 *                 example: 168
 *               joining_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-01-10"
 *               brp_expiry_date:
 *                 type: string
 *                 format: date
 *                 example: "2028-05-20"
 *               licence_expiry_date:
 *                 type: string
 *                 format: date
 *                 example: "2027-12-31"
 *               licence_number:
 *                 type: string
 *                 example: "1000123456789012"
 *               id_number:
 *                 type: string
 *                 example: SIA-987654321
 *               client_id:
 *                 type: string
 *                 example: "00000000-0000-0000-0000-000000000001"
 *               branch_id:
 *                 type: string
 *                 example: branch-hq-001
 *     responses:
 *       200:
 *         description: Employee successfully updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Manager role required
 *       404:
 *         description: Employee not found
 *       409:
 *         description: Email or username already exists
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Manager role required
 *       404:
 *         description: Employee not found
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Manager role required
 *       404:
 *         description: Employee not found
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Manager role required
 *       404:
 *         description: Employee not found
 */
router.post('/:id/photo', photoUpload.single('photo'), uploadPhotoHandler);

/**
 * @openapi
 * /employees/{id}/documents:
 *   post:
 *     tags:
 *       - Employees
 *     summary: Attach documents to employee (Manager only)
 *     description: Uploads and attaches multiple documents (PDF, JPG, PNG up to 5 MB each) directly to an employee record.
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
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documents
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - file_url
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: RightToWork_BRP.pdf
 *                     file_url:
 *                       type: string
 *                       example: /uploads/employees/documents/doc-brp-123.pdf
 *                     file_type:
 *                       type: string
 *                       example: application/pdf
 *                     file_size:
 *                       type: number
 *                       example: 1048576
 *     responses:
 *       200:
 *         description: Documents attached successfully
 *       400:
 *         description: Invalid input or file format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Manager role required
 *       404:
 *         description: Employee not found
 */
router.post(
  '/:id/documents',
  employeeDocumentUpload.array('documents', 10),
  addDocumentsHandler
);

/**
 * @openapi
 * /employees/{id}/documents/{documentId}:
 *   delete:
 *     tags:
 *       - Employees
 *     summary: Delete an employee document (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Manager role required
 *       404:
 *         description: Employee or document not found
 */
router.delete('/:id/documents/:documentId', deleteDocumentHandler);

export const employeeRoutes = router;
