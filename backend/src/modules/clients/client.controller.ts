import { Request, Response, NextFunction } from 'express';
import { clientService } from './client.service';
import {
  createClientSchema,
  updateClientSchema,
  listClientsQuerySchema,
} from './client.validation';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

export const createClientHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = createClientSchema.parse(req.body);
    const client = await clientService.createClient(input, req.user!.id, req);
    sendSuccess(res, client, 201);
  } catch (error) {
    next(error);
  }
};

export const listClientsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = listClientsQuerySchema.parse(req.query);
    const result = await clientService.listClients(query);
    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

export const getClientHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const client = await clientService.getClientById(req.params.id);
    sendSuccess(res, client, 200);
  } catch (error) {
    next(error);
  }
};

export const updateClientHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = updateClientSchema.parse(req.body);
    const client = await clientService.updateClient(req.params.id, input, req.user!.id, req);
    sendSuccess(res, client, 200);
  } catch (error) {
    next(error);
  }
};

export const archiveClientHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const client = await clientService.archiveClient(req.params.id, req.user!.id, req);
    sendSuccess(res, client, 200);
  } catch (error) {
    next(error);
  }
};

export const uploadClientPhotoHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new AppError('MISSING_FILE', 'Please select a photo file to upload', 400);
    }
    const photoUrl = `/uploads/clients/${req.file.filename}`;
    if (req.params.id) {
      const client = await clientService.updateClient(
        req.params.id,
        { contact_photo: photoUrl },
        req.user!.id,
        req
      );
      sendSuccess(res, { client, photo_url: photoUrl });
      return;
    }
    sendSuccess(res, { photo_url: photoUrl });
  } catch (error) {
    next(error);
  }
};
