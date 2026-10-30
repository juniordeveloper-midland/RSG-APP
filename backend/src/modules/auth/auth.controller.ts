import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess } from '../../utils/response';
import {
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.validation';

export const loginHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input, req);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const refreshHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = refreshTokenSchema.parse(req.body);
    const result = await authService.refreshToken(input.refreshToken);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const logoutHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = logoutSchema.parse(req.body);
    const result = await authService.logout(input.refreshToken, req.user?.id, req);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const forgotPasswordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(input, req);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const resetPasswordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(input, req);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const getProfileHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    return sendSuccess(res, { user: req.user }, 200);
  } catch (error) {
    next(error);
  }
};

export const changePasswordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const input = changePasswordSchema.parse(req.body);
    const result = await authService.changePassword(req.user!.id, input, req);
    return sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};
