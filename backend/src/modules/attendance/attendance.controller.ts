import { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service';
import { sendSuccess } from '../../utils/response';
import {
  checkInSchema,
  checkOutSchema,
  manualAttendanceSchema,
  listAttendanceQuerySchema,
} from './attendance.validation';

export const checkInHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = checkInSchema.parse(req.body);
    const result = await attendanceService.checkIn(input, req.user!.id, req);
    return sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const checkOutHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = checkOutSchema.parse(req.body);
    const result = await attendanceService.checkOut(input, req.user!.id, req);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const manualAttendanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = manualAttendanceSchema.parse(req.body);
    const result = await attendanceService.createManualEntry(
      input,
      req.user!.id,
      req
    );
    return sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const forceCheckoutHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const result = await attendanceService.forceCheckout(
      req.params.id,
      req.user!.id,
      req
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const deleteAttendanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const result = await attendanceService.deleteRecord(
      req.params.id,
      req.user!.id,
      req
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const getActiveEmployeesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const branchId =
      (req.query.branch_id as string | undefined) || req.branchId || undefined;
    const result = await attendanceService.getActiveCheckedInEmployees(branchId);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const listAttendanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const query = listAttendanceQuerySchema.parse(req.query);
    const result = await attendanceService.listAttendance(query);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};
