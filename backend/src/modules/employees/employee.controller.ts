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
  employeeDocumentSchema,
} from './employee.validation';
import { z } from 'zod';

/**
 * Helper to safely parse JSON field if received as string from multipart form
 */
function parseJsonField(val: any) {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

export const createEmployeeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const rawBody = { ...req.body };
    if (rawBody.documents) {
      rawBody.documents = parseJsonField(rawBody.documents);
    }
    const input = createEmployeeSchema.parse(rawBody);
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
    const rawBody = { ...req.body };
    if (rawBody.documents) {
      rawBody.documents = parseJsonField(rawBody.documents);
    }
    const input = updateEmployeeSchema.parse(rawBody);
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

    // If an ID is present in params, update employee directly
    if (req.params.id) {
      const employee = await employeeService.updatePhoto(
        req.params.id,
        photoUrl,
        req.user!.id,
        req
      );
      return sendSuccess(res, employee, 200);
    }

    // Otherwise, standalone photo upload
    return sendSuccess(res, { photo_url: photoUrl }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Upload single or multiple employee documents (PDF, JPG, PNG up to 5MB each).
 * Returns array of uploaded document metadata.
 */
export const uploadDocumentsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const files = req.files
      ? (req.files as Express.Multer.File[])
      : req.file
      ? [req.file]
      : [];

    if (files.length === 0) {
      throw new AppError('MISSING_FILE', 'Please select at least one document file to upload', 400);
    }

    const uploaded = files.map((file) => ({
      name: file.originalname,
      file_name: file.filename,
      file_url: `/uploads/employees/documents/${file.filename}`,
      file_type: file.mimetype,
      file_size: file.size,
    }));

    return sendSuccess(res, { documents: uploaded }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Attach documents directly to an existing employee.
 */
export const addDocumentsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const rawFiles = req.files
      ? (req.files as Express.Multer.File[])
      : req.file
      ? [req.file]
      : [];

    let documentsToAttach: Array<{
      name: string;
      file_url: string;
      file_type?: string | null;
      file_size?: number | null;
    }> = [];

    if (rawFiles.length > 0) {
      documentsToAttach = rawFiles.map((file) => ({
        name: file.originalname,
        file_url: `/uploads/employees/documents/${file.filename}`,
        file_type: file.mimetype,
        file_size: file.size,
      }));
    } else if (req.body.documents) {
      const parsed = parseJsonField(req.body.documents);
      const validated = z.array(employeeDocumentSchema).parse(parsed);
      documentsToAttach = validated;
    } else {
      throw new AppError('MISSING_DATA', 'No documents provided to attach', 400);
    }

    const updatedEmployee = await employeeService.addDocuments(
      req.params.id,
      documentsToAttach,
      req.user!.id,
      req
    );

    return sendSuccess(res, updatedEmployee, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a document from an employee.
 */
export const deleteDocumentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const result = await employeeService.deleteDocument(
      req.params.id,
      req.params.documentId,
      req.user!.id,
      req
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};
