import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { sendError } from '../utils/response';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.statusCode, err.details);
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues?.[0];
    const message = firstIssue?.message || 'Input validation failed';
    return sendError(res, 'VALIDATION_ERROR', message, 422, err.format());
  }

  // Handle specific Prisma database errors with clear, actionable messages
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`Prisma Error [${err.code}]:`, err.message);

    // Value too long for column (e.g. address)
    if (err.code === 'P2000') {
      return sendError(
        res,
        'VALUE_TOO_LONG',
        'Address or field value is too long. Please shorten your input.',
        400
      );
    }

    // Unique constraint violation
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(', ')
        : 'field';
      return sendError(
        res,
        'DUPLICATE_ENTRY',
        `A record with this ${target} already exists.`,
        409
      );
    }

    // Foreign key constraint failure
    if (err.code === 'P2003') {
      const constraint = String(err.meta?.constraint || err.meta?.field_name || '');
      if (constraint.toLowerCase().includes('client')) {
        return sendError(res, 'CLIENT_NOT_FOUND', 'Client not found', 404);
      }
      if (constraint.toLowerCase().includes('branch')) {
        return sendError(res, 'BRANCH_NOT_FOUND', 'Branch not found', 404);
      }
      if (constraint.toLowerCase().includes('project')) {
        return sendError(res, 'PROJECT_NOT_FOUND', 'Referenced project not found', 404);
      }
      return sendError(
        res,
        'FOREIGN_KEY_ERROR',
        'Referenced record not found. Please verify your selection.',
        400
      );
    }

    // Record to update/delete does not exist
    if (err.code === 'P2025') {
      return sendError(
        res,
        'RECORD_NOT_FOUND',
        'The requested record was not found.',
        404
      );
    }

    return sendError(
      res,
      'DATABASE_ERROR',
      'A database error occurred while processing your request.',
      500
    );
  }

  // Other Prisma client errors
  if (
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err.name?.startsWith('PrismaClient') ||
    err.message?.toLowerCase().includes('prisma')
  ) {
    console.error('Prisma Database Error [Logged on server only]:', err);
    return sendError(
      res,
      'DATABASE_ERROR',
      'A database error occurred while processing your request.',
      500
    );
  }

  // Fallback internal server error
  console.error('Unhandled Server Error [Logged on server only]:', err);

  return sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    'An unexpected internal server error occurred.',
    500
  );
};
