import swaggerJsDoc from 'swagger-jsdoc';
import path from 'path';

const swaggerOptions: swaggerJsDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Region Security Guarding Platform API',
      version: '1.0.0',
      description:
        'RESTful API documentation for Region Security Guarding - Mobile Guard Application & Managerial Web Portal.',
      contact: {
        name: 'Region Security Guarding Engineering',
        email: 'dev@regionsecurityguarding.co.uk',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current API Server',
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication, token refresh, password recovery, and profile',
      },
      {
        name: 'Clients',
        description: 'Client company profiles, contact persons, billing, and attached branches',
      },
      {
        name: 'Branches',
        description: 'Branch management, geofences, and site locations',
      },
      {
        name: 'Employees',
        description: 'Guard & staff management, SIA credentials, and roles',
      },
      {
        name: 'Shifts',
        description: 'Shift scheduling, assignment, rota, and Excel import/export',
      },
      {
        name: 'Attendance',
        description: 'Clock in/out, geofencing, overtime, and active duty',
      },
      {
        name: 'Patrol',
        description: 'QR checkpoint generation, HMAC signature verification, and scan logs',
      },
      {
        name: 'Alerts',
        description: 'Real-time operational alerts, missed patrols, and resolution workflow',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token (Bearer <token>) to authorize protected endpoints.',
        },
      },
      schemas: {
        ApiError: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Invalid input provided',
                },
                details: {
                  type: 'object',
                  nullable: true,
                  description: 'Detailed validation issues or metadata',
                },
              },
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad Request / Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized - Missing or invalid JWT access token',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError',
              },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden - Insufficient permissions or suspended account',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError',
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError',
              },
            },
          },
        },
        Conflict: {
          description: 'Conflict - Duplicate record or overlapping shift/assignment',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError',
              },
            },
          },
        },
      },
    },
  },
  apis: [
    path.resolve(__dirname, '../modules/**/*.routes.{ts,js}').replace(/\\/g, '/'),
    path.resolve(__dirname, '../modules/**/*.{ts,js}').replace(/\\/g, '/'),
  ],
};

export const swaggerSpec = swaggerJsDoc(swaggerOptions);
