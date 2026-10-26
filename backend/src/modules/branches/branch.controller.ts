import { Request, Response, NextFunction } from 'express';
import { branchService } from './branch.service';
import { sendSuccess } from '../../utils/response';
import {
  createBranchSchema,
  updateBranchSchema,
  listBranchesQuerySchema,
} from './branch.validation';

export const createBranchHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = createBranchSchema.parse(req.body);
    const branch = await branchService.createBranch(input, req.user!.id, req);
    return sendSuccess(res, branch, 201);
  } catch (error) {
    next(error);
  }
};

export const listBranchesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const query = listBranchesQuerySchema.parse(req.query);
    const result = await branchService.listBranches(query);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const getBranchHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const branch = await branchService.getBranchById(req.params.id);
    return sendSuccess(res, branch, 200);
  } catch (error) {
    next(error);
  }
};

export const updateBranchHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = updateBranchSchema.parse(req.body);
    const branch = await branchService.updateBranch(
      req.params.id,
      input,
      req.user!.id,
      req
    );
    return sendSuccess(res, branch, 200);
  } catch (error) {
    next(error);
  }
};

export const disableBranchHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const branch = await branchService.setBranchStatus(
      req.params.id,
      false,
      req.user!.id,
      req
    );
    return sendSuccess(res, branch, 200);
  } catch (error) {
    next(error);
  }
};

export const enableBranchHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const branch = await branchService.setBranchStatus(
      req.params.id,
      true,
      req.user!.id,
      req
    );
    return sendSuccess(res, branch, 200);
  } catch (error) {
    next(error);
  }
};
