import { Request, Response, NextFunction } from 'express';
import { shiftService } from './shift.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
  createShiftSchema,
  updateShiftSchema,
  assignShiftSchema,
  listShiftsQuerySchema,
} from './shift.validation';

export const createShiftHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = createShiftSchema.parse(req.body);
    const shift = await shiftService.createShift(input, req.user!.id, req);
    return sendSuccess(res, shift, 201);
  } catch (error) {
    next(error);
  }
};

export const listShiftsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const query = listShiftsQuerySchema.parse(req.query);
    const result = await shiftService.listShifts(query);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const getShiftHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const shift = await shiftService.getShiftById(req.params.id);
    return sendSuccess(res, shift, 200);
  } catch (error) {
    next(error);
  }
};

export const updateShiftHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = updateShiftSchema.parse(req.body);
    const shift = await shiftService.updateShift(
      req.params.id,
      input,
      req.user!.id,
      req
    );
    return sendSuccess(res, shift, 200);
  } catch (error) {
    next(error);
  }
};

export const disableShiftHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const shift = await shiftService.setShiftActive(
      req.params.id,
      false,
      req.user!.id,
      req
    );
    return sendSuccess(res, shift, 200);
  } catch (error) {
    next(error);
  }
};

export const enableShiftHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const shift = await shiftService.setShiftActive(
      req.params.id,
      true,
      req.user!.id,
      req
    );
    return sendSuccess(res, shift, 200);
  } catch (error) {
    next(error);
  }
};

export const assignShiftHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = assignShiftSchema.parse(req.body);
    const result = await shiftService.assignShift(
      req.params.id,
      input,
      req.user!.id,
      req
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const downloadDemoTemplateHandler = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const buffer = shiftService.generateDemoTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="shifts-template.xlsx"'
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const importShiftsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.file) {
      throw new AppError('MISSING_FILE', 'Please select an Excel (.xlsx) file to upload', 400);
    }
    const report = await shiftService.importShiftsFromExcel(
      req.file.buffer,
      req.user!.id,
      req
    );
    return sendSuccess(res, report, 200);
  } catch (error) {
    next(error);
  }
};

export const getEmployeeRotaHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const rota = await shiftService.getEmployeeRota(req.user!.id);
    return sendSuccess(res, rota, 200);
  } catch (error) {
    next(error);
  }
};
