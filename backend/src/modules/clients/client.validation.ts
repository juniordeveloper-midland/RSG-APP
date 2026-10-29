import { z } from 'zod';

export const createClientSchema = z.object({
  // Company fields
  name: z.string().trim().min(2, 'Company name must be at least 2 characters').max(150),
  code: z
    .string()
    .trim()
    .min(2, 'Client code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Client code may only contain letters, numbers, hyphens, and underscores'),
  website: z.string().trim().url('Invalid website URL').optional().or(z.literal('')).nullable(),
  industry: z.string().trim().min(2, 'Industry must be at least 2 characters').max(100),
  client_since: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Client since must be in YYYY-MM-DD format')
    .optional()
    .nullable(),

  // Contact person fields
  contact_photo: z.string().trim().optional().nullable(),
  contact_name: z.string().trim().min(2, 'Contact person name must be at least 2 characters').max(100),
  contact_email: z.string().trim().email('Invalid contact person email address'),
  contact_phone: z.string().trim().min(5, 'Contact phone must be at least 5 characters').max(30),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().nullable(),

  // Billing fields
  billing_address: z.string().trim().min(3, 'Billing address must be at least 3 characters').max(255),
  billing_city: z.string().trim().min(2, 'Billing city must be at least 2 characters').max(100),
  billing_state: z.string().trim().min(2, 'Billing state must be at least 2 characters').max(100),
  billing_country: z.string().trim().min(2, 'Billing country must be at least 2 characters').max(100),
  billing_zip: z.string().trim().min(2, 'Billing postal/zip code must be at least 2 characters').max(20),
  billing_phone: z.string().trim().min(5, 'Billing phone must be at least 5 characters').max(30),
  billing_email: z.string().trim().email('Invalid billing email address'),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  // Company fields
  name: z.string().trim().min(2, 'Company name must be at least 2 characters').max(150).optional(),
  code: z
    .string()
    .trim()
    .min(2, 'Client code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Client code may only contain letters, numbers, hyphens, and underscores')
    .optional(),
  website: z.string().trim().url('Invalid website URL').optional().or(z.literal('')).nullable(),
  industry: z.string().trim().min(2, 'Industry must be at least 2 characters').max(100).optional(),
  client_since: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Client since must be in YYYY-MM-DD format')
    .optional()
    .nullable(),

  // Contact person fields
  contact_photo: z.string().trim().optional().nullable(),
  contact_name: z.string().trim().min(2, 'Contact person name must be at least 2 characters').max(100).optional(),
  contact_email: z.string().trim().email('Invalid contact person email address').optional(),
  contact_phone: z.string().trim().min(5, 'Contact phone must be at least 5 characters').max(30).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().nullable(),

  // Billing fields
  billing_address: z.string().trim().min(3, 'Billing address must be at least 3 characters').max(255).optional(),
  billing_city: z.string().trim().min(2, 'Billing city must be at least 2 characters').max(100).optional(),
  billing_state: z.string().trim().min(2, 'Billing state must be at least 2 characters').max(100).optional(),
  billing_country: z.string().trim().min(2, 'Billing country must be at least 2 characters').max(100).optional(),
  billing_zip: z.string().trim().min(2, 'Billing postal/zip code must be at least 2 characters').max(20).optional(),
  billing_phone: z.string().trim().min(5, 'Billing phone must be at least 5 characters').max(30).optional(),
  billing_email: z.string().trim().email('Invalid billing email address').optional(),
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const listClientsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['active', 'inactive', 'archived', 'all']).optional(),
  industry: z.string().trim().optional(),
});

export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;

