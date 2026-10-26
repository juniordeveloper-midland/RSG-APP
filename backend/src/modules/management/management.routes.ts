import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { authenticate, requireRole, branchScope } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AlertStatus, Prisma } from '@prisma/client';

const router = Router();

/**
 * @openapi
 * /management/dashboard:
 *   get:
 *     tags:
 *       - Alerts
 *     summary: Managerial overview dashboard with live operational stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Management dashboard operational metrics
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
  '/dashboard',
  authenticate,
  requireRole('manager'),
  branchScope(),
  async (req, res, next) => {
    try {
      const branchFilter: Prisma.AlertWhereInput = req.branchId
        ? { branch_id: req.branchId }
        : {};

      const attendanceBranchFilter: Prisma.AttendanceWhereInput = req.branchId
        ? { shift: { branch_id: req.branchId } }
        : {};

      const [
        onDutyCount,
        lateCount,
        absentCount,
        missedPatrolsCount,
        openAlertsCount,
        recentAlerts,
        activeEmployees,
      ] = await Promise.all([
        prisma.attendance.count({
          where: {
            ...attendanceBranchFilter,
            status: 'checked_in',
            check_out_at: null,
          },
        }),
        prisma.attendance.count({
          where: {
            ...attendanceBranchFilter,
            status: 'late',
          },
        }),
        prisma.attendance.count({
          where: {
            ...attendanceBranchFilter,
            status: 'absent',
          },
        }),
        prisma.alert.count({
          where: {
            ...branchFilter,
            type: 'missed_patrol',
            status: AlertStatus.open,
          },
        }),
        prisma.alert.count({
          where: {
            ...branchFilter,
            status: AlertStatus.open,
          },
        }),
        prisma.alert.findMany({
          where: {
            ...branchFilter,
            status: AlertStatus.open,
          },
          take: 6,
          orderBy: { created_at: 'desc' },
          include: { branch: { select: { id: true, name: true } } },
        }),
        prisma.attendance.findMany({
          where: {
            ...attendanceBranchFilter,
            status: 'checked_in',
            check_out_at: null,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            shift: { include: { branch: true } },
          },
          take: 10,
          orderBy: { check_in_at: 'desc' },
        }),
      ]);

      return sendSuccess(res, {
        message: 'Welcome to Manager Operations Dashboard',
        manager_id: req.user?.id,
        branch_scope: req.branchId,
        onDutyCount,
        lateCount,
        absentCount,
        missedPatrolsCount,
        openAlertsCount,
        recentAlerts,
        activeEmployees,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /management/alerts:
 *   get:
 *     tags:
 *       - Alerts
 *     summary: List system and operational alerts (open, acknowledged, resolved)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, acknowledged, resolved]
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of alerts
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
  '/alerts',
  authenticate,
  requireRole('manager'),
  branchScope(),
  async (req, res, next) => {
    try {
      const targetBranchId = req.branchId || (req.query.branch_id as string | undefined);
      const statusParam = req.query.status as string | undefined;

      const where: Prisma.AlertWhereInput = {
        ...(targetBranchId ? { branch_id: targetBranchId } : {}),
        ...(statusParam && Object.values(AlertStatus).includes(statusParam as AlertStatus)
          ? { status: statusParam as AlertStatus }
          : {}),
      };

      const alerts = await prisma.alert.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: {
          branch: { select: { id: true, name: true, address: true } },
          owner: { select: { id: true, name: true, email: true } },
        },
      });

      return sendSuccess(res, alerts);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /management/alerts/{id}/status:
 *   patch:
 *     tags:
 *       - Alerts
 *     summary: Update alert status (acknowledge or resolve)
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
 *                 enum: [acknowledged, resolved]
 *                 example: acknowledged
 *     responses:
 *       200:
 *         description: Alert status updated
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
 *         description: Forbidden - Branch mismatch or Manager role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Alert not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.patch(
  '/alerts/:id/status',
  authenticate,
  requireRole('manager'),
  branchScope(),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['acknowledged', 'resolved'].includes(status)) {
        return sendError(res, 'VALIDATION_ERROR', 'Valid status (acknowledged or resolved) is required', 400);
      }

      const alert = await prisma.alert.findUnique({
        where: { id },
      });

      if (!alert) {
        return sendError(res, 'NOT_FOUND', 'Alert record not found', 404);
      }

      if (req.branchId && alert.branch_id !== req.branchId) {
        return sendError(res, 'BRANCH_ACCESS_DENIED', 'Forbidden: Branch scope mismatch', 403);
      }

      const updated = await prisma.alert.update({
        where: { id },
        data: {
          status: status as AlertStatus,
          owner_id: req.user?.id,
        },
        include: {
          branch: { select: { id: true, name: true } },
        },
      });

      return sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /management/branches/{branchId}:
 *   get:
 *     tags:
 *       - Branches
 *     summary: Access branch-specific management data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Branch data
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Branch access denied or insufficient privileges
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get(
  '/branches/:branchId',
  authenticate,
  requireRole('manager'),
  branchScope(),
  (req, res) => {
    return sendSuccess(res, {
      message: `Branch management access granted for ${req.params.branchId}`,
      branch_id: req.params.branchId,
      user_id: req.user?.id,
    });
  }
);

export const managementRoutes = router;
