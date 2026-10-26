import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';

export const getHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;

    const healthData = {
      status: 'ok',
      service: 'rsg-backend',
      timestamp_utc: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      database: 'connected',
    };

    sendSuccess(res, healthData);
  } catch (error) {
    next(error);
  }
};
