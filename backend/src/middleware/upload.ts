import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { AppError } from './errorHandler';

// ─── Employee Photo Upload ───────────────────────────────────────────────────
const uploadDir = path.resolve(__dirname, '../../uploads/employees');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `employee-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'INVALID_FILE_TYPE',
        'Only image files (JPEG, PNG, WEBP, GIF) are allowed',
        400
      )
    );
  }
};

export const photoUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});

// ─── Client Photo Upload (Strict JPG/PNG up to 2MB) ──────────────────────────
const clientUploadDir = path.resolve(__dirname, '../../uploads/clients');
if (!fs.existsSync(clientUploadDir)) {
  fs.mkdirSync(clientUploadDir, { recursive: true });
}

const clientStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, clientUploadDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `client-${uniqueSuffix}${ext}`);
  },
});

const clientFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'INVALID_FILE_TYPE',
        'Only JPG and PNG image files up to 2 MB are allowed',
        400
      )
    );
  }
};

export const clientPhotoUpload = multer({
  storage: clientStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: clientFileFilter,
});

// ─── Employee Document Upload (PDF, JPG, PNG up to 5MB each) ─────────────────
const docUploadDir = path.resolve(__dirname, '../../uploads/employees/documents');
if (!fs.existsSync(docUploadDir)) {
  fs.mkdirSync(docUploadDir, { recursive: true });
}

const docStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, docUploadDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `doc-${sanitizedBase}-${uniqueSuffix}${ext}`);
  },
});

const docFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'INVALID_FILE_TYPE',
        'Only PDF, JPG, and PNG documents up to 5 MB each are allowed',
        400
      )
    );
  }
};

export const employeeDocumentUpload = multer({
  storage: docStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: docFileFilter,
});

