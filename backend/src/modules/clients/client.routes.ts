import { Router } from 'express';
import {
  createClientHandler,
  listClientsHandler,
  getClientHandler,
  updateClientHandler,
  archiveClientHandler,
  uploadClientPhotoHandler,
} from './client.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { clientPhotoUpload } from '../../middleware/upload';

const router = Router();

// All client management endpoints require manager role
router.use(authenticate, requireRole('manager'));

/**
 * @openapi
 * /clients/upload-photo:
 *   post:
 *     tags:
 *       - Clients
 *     summary: Upload client contact photo (Manager only, JPG/PNG up to 2MB)
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
 *                 description: Image file (JPG or PNG up to 2MB)
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
 *                       example: /uploads/clients/client-1730200000-123456789.jpg
 *       400:
 *         description: Invalid file type or exceeds 2MB limit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/upload-photo', clientPhotoUpload.single('photo'), uploadClientPhotoHandler);

/**
 * @openapi
 * /clients:
 *   post:
 *     tags:
 *       - Clients
 *     summary: Add a new client company profile (Manager only)
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
 *               - code
 *               - industry
 *               - contact_name
 *               - contact_email
 *               - contact_phone
 *               - billing_address
 *               - billing_city
 *               - billing_state
 *               - billing_country
 *               - billing_zip
 *               - billing_phone
 *               - billing_email
 *             properties:
 *               name:
 *                 type: string
 *                 example: Barclays Retail Group
 *               code:
 *                 type: string
 *                 example: BARC-001
 *               website:
 *                 type: string
 *                 format: uri
 *                 example: https://www.barclays.co.uk
 *               industry:
 *                 type: string
 *                 example: Banking & Financial Services
 *               client_since:
 *                 type: string
 *                 example: 2024-01-15
 *               contact_photo:
 *                 type: string
 *                 example: /uploads/clients/contact-barclays.jpg
 *               contact_name:
 *                 type: string
 *                 example: Robert Sterling
 *               contact_email:
 *                 type: string
 *                 format: email
 *                 example: r.sterling@barclays.co.uk
 *               contact_phone:
 *                 type: string
 *                 example: +442071161000
 *               status:
 *                 type: string
 *                 enum: [active, inactive, archived]
 *                 default: active
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecureClientPass123!
 *               billing_address:
 *                 type: string
 *                 example: 1 Churchill Place, Canary Wharf
 *               billing_city:
 *                 type: string
 *                 example: London
 *               billing_state:
 *                 type: string
 *                 example: Greater London
 *               billing_country:
 *                 type: string
 *                 example: United Kingdom
 *               billing_zip:
 *                 type: string
 *                 example: E14 5HP
 *               billing_phone:
 *                 type: string
 *                 example: +442071161000
 *               billing_email:
 *                 type: string
 *                 format: email
 *                 example: billing-facilities@barclays.co.uk
 *     responses:
 *       201:
 *         description: Client successfully created
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
 *         description: Conflict - Client code already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/', createClientHandler);

/**
 * @openapi
 * /clients:
 *   get:
 *     tags:
 *       - Clients
 *     summary: List clients with pagination, search, status, and industry filter (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by company name, code, contact name, contact email, or city
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, archived, all]
 *         description: Filter by client status
 *       - in: query
 *         name: industry
 *         schema:
 *           type: string
 *         description: Filter by industry keyword
 *     responses:
 *       200:
 *         description: Paginated list of clients
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
router.get('/', listClientsHandler);

/**
 * @openapi
 * /clients/{id}:
 *   get:
 *     tags:
 *       - Clients
 *     summary: View client details and attached branches by ID (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client unique ID
 *     responses:
 *       200:
 *         description: Client profile and attached branches
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/:id', getClientHandler);

/**
 * @openapi
 * /clients/{id}:
 *   put:
 *     tags:
 *       - Clients
 *     summary: Edit client company, contact, or billing details (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client unique ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               website:
 *                 type: string
 *               industry:
 *                 type: string
 *               client_since:
 *                 type: string
 *               contact_photo:
 *                 type: string
 *               contact_name:
 *                 type: string
 *               contact_email:
 *                 type: string
 *               contact_phone:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive, archived]
 *               password:
 *                 type: string
 *                 format: password
 *               billing_address:
 *                 type: string
 *               billing_city:
 *                 type: string
 *               billing_state:
 *                 type: string
 *               billing_country:
 *                 type: string
 *               billing_zip:
 *                 type: string
 *               billing_phone:
 *                 type: string
 *               billing_email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated client profile
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       409:
 *         description: Conflict - Client code already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.put('/:id', updateClientHandler);
router.patch('/:id', updateClientHandler);

/**
 * @openapi
 * /clients/{id}/photo:
 *   post:
 *     tags:
 *       - Clients
 *     summary: Upload and update client profile photo directly (Manager only)
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
 *         description: Photo uploaded and client updated
 */
router.post('/:id/photo', clientPhotoUpload.single('photo'), uploadClientPhotoHandler);

/**
 * @openapi
 * /clients/{id}/archive:
 *   patch:
 *     tags:
 *       - Clients
 *     summary: Archive a client (Manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client unique ID
 *     responses:
 *       200:
 *         description: Client archived successfully (status set to archived)
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.patch('/:id/archive', archiveClientHandler);
router.post('/:id/archive', archiveClientHandler);
router.delete('/:id', archiveClientHandler);

export const clientRoutes = router;
