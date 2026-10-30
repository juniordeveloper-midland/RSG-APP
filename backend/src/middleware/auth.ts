import { Request, Response, NextFunction } from 'express';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/response';

/**
 * Verifies JWT Bearer token and attaches the authenticated active user to req.user.
 * Rejects suspended users with 403 ACCOUNT_SUSPENDED.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Missing or malformed Authorization header', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);

    // Verify user exists and check account status in DB
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        branch_id: true,
        managerial_access: true,
      },
    });

    if (!user) {
      return sendError(res, 'UNAUTHORIZED', 'User account not found', 401);
    }

    if (user.status === UserStatus.suspended) {
      return sendError(
        res,
        'ACCOUNT_SUSPENDED',
        'Account is suspended. Please contact your administrator.',
        403
      );
    }

    req.user = user;
    return next();
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'TOKEN_EXPIRED', 'Access token has expired', 401);
    }
    return sendError(res, 'INVALID_TOKEN', 'Invalid access token', 401);
  }
};

/**
 * Middleware to restrict access based on user role.
 * For role 'manager', users with role === 'manager' or managerial_access === true are permitted.
 */
export const requireRole = (role: Role | Role[] | 'manager' | 'employee' | 'admin') => {
  const requiredRoles = Array.isArray(role) ? role : [role];

  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    // Admin has full managerial access across all management routes
    if (req.user.role === Role.admin) {
      return next();
    }

    // Manager role allows either Role.manager or managerial_access flag
    const isManager = req.user.role === Role.manager || req.user.managerial_access === true;

    if (requiredRoles.includes('manager' as Role) && isManager) {
      return next();
    }

    if (requiredRoles.includes(req.user.role)) {
      return next();
    }

    return sendError(res, 'FORBIDDEN', 'Access forbidden: Insufficient permissions', 403);
  };
};

/**
 * Branch scoping middleware.
 * Verifies that the employee/manager is operating within their assigned branch.
 * If a branch is specified in params/query/body, verifies that user's branch_id matches.
 * Sets req.branchId for downstream queries.
 */
export const branchScope = (
  extractBranchId?: (req: Request) => string | undefined
) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    // Resolve target branch from custom extractor, params, query, or body
    const targetBranchId =
      (extractBranchId ? extractBranchId(req) : undefined) ||
      req.params.branchId ||
      req.params.branch_id ||
      (req.query.branch_id as string | undefined) ||
      (req.query.branchId as string | undefined) ||
      (req.body && (req.body.branch_id || req.body.branchId));

    // If a specific branch target is requested and user is assigned to a branch
    if (targetBranchId && req.user.branch_id && targetBranchId !== req.user.branch_id) {
      return sendError(
        res,
        'BRANCH_ACCESS_DENIED',
        'You do not have permission to access resources in this branch',
        403
      );
    }

    // Attach resolved branch scope to request
    req.branchId = targetBranchId || req.user.branch_id || null;
    return next();
  };
};
