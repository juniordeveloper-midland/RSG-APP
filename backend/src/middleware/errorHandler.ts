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
    return sendError(res, 'VALIDATION_ERROR', 'Input validation failed', 422, err.format());
  }

  // Handle Prisma / Database errors - never leak internal schema, queries, or paths to users
  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
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

  // Fallback internal server error (never leak sensitive stack traces or file paths to client)
  console.error('Unhandled Server Error [Logged on server only]:', err);

  return sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    'An unexpected internal server error occurred.',
    500
  );
};
