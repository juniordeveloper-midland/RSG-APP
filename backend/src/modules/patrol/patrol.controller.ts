import { Request, Response, NextFunction } from 'express';
import { patrolService } from './patrol.service';
import { sendSuccess } from '../../utils/response';
import {
  createPatrolQrSchema,
  patrolScanSchema,
  patrolLogsQuerySchema,
} from './patrol.validation';

export const createPatrolQrHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = createPatrolQrSchema.parse(req.body);
    const result = await patrolService.createPatrolQr(
      input,
      req.user!.id,
      req
    );
    return sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const getPatrolQrHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const result = await patrolService.getPatrolQrById(
      req.params.id,
      req.branchId
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const getPatrolQrImageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { buffer, qr } = await patrolService.getPatrolQrPngBuffer(
      req.params.id,
      req.branchId
    );

    const safeName = qr.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="qr-checkpoint-${safeName}.png"`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const listPatrolQrsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const branchId = req.query.branch_id as string | undefined;
    const isActiveParam = req.query.is_active as string | undefined;
    const isActive =
      isActiveParam !== undefined ? isActiveParam === 'true' : undefined;

    const result = await patrolService.listPatrolQrs(
      branchId,
      req.branchId,
      isActive
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const recordScanHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = patrolScanSchema.parse(req.body);
    const result = await patrolService.recordScan(
      input,
      req.user!.id,
      req.branchId,
      req
    );
    return sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const getPatrolLogsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const query = patrolLogsQuerySchema.parse(req.query);
    const result = await patrolService.getPatrolLogs(
      query,
      req.branchId
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const exportPatrolLogsExcelHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = patrolLogsQuerySchema.parse(req.query);
    const { buffer, filename } = await patrolService.exportPatrolLogsExcel(
      query,
      req.branchId
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};
