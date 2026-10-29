import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { sendError } from './utils/response';
import { healthRoutes } from './modules/health/health.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { managementRoutes } from './modules/management/management.routes';
import { branchRoutes } from './modules/branches/branch.routes';
import { clientRoutes } from './modules/clients/client.routes';
import { employeeRoutes } from './modules/employees/employee.routes';
import { shiftRoutes } from './modules/shifts/shift.routes';
import { meRoutes } from './modules/me/me.routes';
import { attendanceRoutes } from './modules/attendance/attendance.routes';
import { patrolRoutes } from './modules/patrol/patrol.routes';

const app: Application = express();

// Security and utility middleware
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production',
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter);

// Serve uploaded assets
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Swagger API documentation (served only when NODE_ENV is not production)
if (env.NODE_ENV !== 'production') {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      swaggerOptions: {
        persistAuthorization: true,
      },
      customSiteTitle: 'Region Security Guarding API Documentation',
    })
  );

  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

// Application routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/management', managementRoutes);
app.use('/clients', clientRoutes);
app.use('/branches', branchRoutes);
app.use('/employees', employeeRoutes);
app.use('/shifts', shiftRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/patrol', patrolRoutes);

// Management route aliases for portal consistency
app.use('/management/clients', clientRoutes);
app.use('/management/branches', branchRoutes);
app.use('/management/employees', employeeRoutes);
app.use('/management/shifts', shiftRoutes);
app.use('/management/attendance', attendanceRoutes);
app.use('/management/patrol', patrolRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  sendError(res, 'NOT_FOUND', 'Endpoint not found', 404);
});

// Centralized error handler
app.use(errorHandler);

export default app;
