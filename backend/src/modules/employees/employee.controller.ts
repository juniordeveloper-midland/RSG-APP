import { Request, Response, NextFunction } from 'express';
import { employeeService } from './employee.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
  updateManagerialAccessSchema,
  listEmployeesQuerySchema,
} from './employee.validation';

export const createEmployeeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = createEmployeeSchema.parse(req.body);
    const photoUrl = req.file ? `/uploads/employees/${req.file.filename}` : undefined;
    const employee = await employeeService.createEmployee(
      input,
      photoUrl,
      req.user!.id,
      req
    );
    return sendSuccess(res, employee, 201);
  } catch (error) {
    next(error);
  }
};

export const listEmployeesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const query = listEmployeesQuerySchema.parse(req.query);
    const result = await employeeService.listEmployees(query);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const getEmployeeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const employee = await employeeService.getEmployeeById(req.params.id);
    return sendSuccess(res, employee, 200);
  } catch (error) {
    next(error);
  }
};

export const updateEmployeeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = updateEmployeeSchema.parse(req.body);
    const employee = await employeeService.updateEmployee(
      req.params.id,
      input,
      req.user!.id,
      req
    );
    return sendSuccess(res, employee, 200);
  } catch (error) {
    next(error);
  }
};

export const updateEmployeeStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = updateEmployeeStatusSchema.parse(req.body);
    const employee = await employeeService.setEmployeeStatus(
      req.params.id,
      input.status,
      req.user!.id,
      req
    );
    return sendSuccess(res, employee, 200);
  } catch (error) {
    next(error);
  }
};

export const updateManagerialAccessHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = updateManagerialAccessSchema.parse(req.body);
    const employee = await employeeService.setManagerialAccess(
      req.params.id,
      input.managerial_access,
      req.user!.id,
      req
    );
    return sendSuccess(res, employee, 200);
  } catch (error) {
    next(error);
  }
};

export const uploadPhotoHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.file) {
      throw new AppError('MISSING_FILE', 'Please select a photo file to upload', 400);
    }
    const photoUrl = `/uploads/employees/${req.file.filename}`;
    const employee = await employeeService.updatePhoto(
      req.params.id,
      photoUrl,
      req.user!.id,
      req
    );
    return sendSuccess(res, employee, 200);
  } catch (error) {
    next(error);
  }
};
