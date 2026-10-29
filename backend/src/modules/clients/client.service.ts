import { Request } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/audit';
import {
  CreateClientInput,
  UpdateClientInput,
  ListClientsQuery,
} from './client.validation';

const CLIENT_SAFE_SELECT = {
  id: true,
  name: true,
  code: true,
  website: true,
  industry: true,
  client_since: true,
  contact_photo: true,
  contact_name: true,
  contact_email: true,
  contact_phone: true,
  status: true,
  billing_address: true,
  billing_city: true,
  billing_state: true,
  billing_country: true,
  billing_zip: true,
  billing_phone: true,
  billing_email: true,
  created_at: true,
  updated_at: true,
} as const;

export class ClientService {
  /**
   * Create a new client profile.
   * Enforces unique client code and securely hashes contact person password if provided.
   * Logs CLIENT_CREATED in audit_logs.
   */
  async createClient(input: CreateClientInput, managerId: string, req?: Request) {
    const formattedCode = input.code.trim().toUpperCase();

    // Check code uniqueness
    const existingCode = await prisma.client.findUnique({
      where: { code: formattedCode },
    });

    if (existingCode) {
      throw new AppError(
        'CLIENT_CODE_EXISTS',
        `A client with code '${formattedCode}' already exists`,
        409
      );
    }

    // Hash password if provided
    let passwordHash: string | null = null;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, 10);
    }

    const client = await prisma.client.create({
      data: {
        name: input.name,
        code: formattedCode,
        website: input.website || null,
        industry: input.industry,
        client_since: input.client_since || null,
        contact_photo: input.contact_photo || null,
        contact_name: input.contact_name,
        contact_email: input.contact_email,
        contact_phone: input.contact_phone,
        status: input.status,
        password_hash: passwordHash,
        billing_address: input.billing_address,
        billing_city: input.billing_city,
        billing_state: input.billing_state,
        billing_country: input.billing_country,
        billing_zip: input.billing_zip,
        billing_phone: input.billing_phone,
        billing_email: input.billing_email,
      },
      select: CLIENT_SAFE_SELECT,
    });

    await recordAuditLog({
      userId: managerId,
      action: 'CLIENT_CREATED',
      entity: 'clients',
      entityId: client.id,
      details: {
        name: client.name,
        code: client.code,
        industry: client.industry,
        contact_name: client.contact_name,
        contact_email: client.contact_email,
        status: client.status,
      },
      req,
    });

    return client;
  }

  /**
   * List clients with pagination, search, status, and industry filtering.
   * Includes branch count for each client.
   */
  async listClients(query: ListClientsQuery) {
    const { page, limit, search, status, industry } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (industry) {
      where.industry = { contains: industry };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { contact_name: { contains: search } },
        { contact_email: { contains: search } },
        { billing_city: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          ...CLIENT_SAFE_SELECT,
          _count: {
            select: {
              branches: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * View single client by ID.
   * Returns complete client profile and attached branches list.
   */
  async getClientById(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        ...CLIENT_SAFE_SELECT,
        _count: {
          select: {
            branches: true,
          },
        },
        branches: {
          select: {
            id: true,
            name: true,
            address: true,
            lat: true,
            lng: true,
            radius_m: true,
            timezone: true,
            is_active: true,
            created_at: true,
            _count: {
              select: {
                users: true,
                shifts: true,
                patrol_qrs: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!client) {
      throw new AppError('CLIENT_NOT_FOUND', `Client with ID '${id}' was not found`, 404);
    }

    return client;
  }

  /**
   * Update client company, contact person, or billing details.
   * Logs CLIENT_UPDATED in audit_logs.
   */
  async updateClient(
    id: string,
    input: UpdateClientInput,
    managerId: string,
    req?: Request
  ) {
    // Verify client exists
    const existing = await prisma.client.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('CLIENT_NOT_FOUND', `Client with ID '${id}' was not found`, 404);
    }

    const updateData: Prisma.ClientUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.code !== undefined) {
      const formattedCode = input.code.trim().toUpperCase();
      if (formattedCode !== existing.code) {
        const codeCheck = await prisma.client.findUnique({
          where: { code: formattedCode },
        });
        if (codeCheck && codeCheck.id !== id) {
          throw new AppError(
            'CLIENT_CODE_EXISTS',
            `A client with code '${formattedCode}' already exists`,
            409
          );
        }
      }
      updateData.code = formattedCode;
    }
    if (input.website !== undefined) updateData.website = input.website || null;
    if (input.industry !== undefined) updateData.industry = input.industry;
    if (input.client_since !== undefined) updateData.client_since = input.client_since || null;
    if (input.contact_photo !== undefined) updateData.contact_photo = input.contact_photo || null;
    if (input.contact_name !== undefined) updateData.contact_name = input.contact_name;
    if (input.contact_email !== undefined) updateData.contact_email = input.contact_email;
    if (input.contact_phone !== undefined) updateData.contact_phone = input.contact_phone;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.password) {
      updateData.password_hash = await bcrypt.hash(input.password, 10);
    }

    if (input.billing_address !== undefined) updateData.billing_address = input.billing_address;
    if (input.billing_city !== undefined) updateData.billing_city = input.billing_city;
    if (input.billing_state !== undefined) updateData.billing_state = input.billing_state;
    if (input.billing_country !== undefined) updateData.billing_country = input.billing_country;
    if (input.billing_zip !== undefined) updateData.billing_zip = input.billing_zip;
    if (input.billing_phone !== undefined) updateData.billing_phone = input.billing_phone;
    if (input.billing_email !== undefined) updateData.billing_email = input.billing_email;

    const updated = await prisma.client.update({
      where: { id },
      data: updateData,
      select: CLIENT_SAFE_SELECT,
    });

    await recordAuditLog({
      userId: managerId,
      action: 'CLIENT_UPDATED',
      entity: 'clients',
      entityId: id,
      details: {
        updatedFields: Object.keys(input).filter((k) => k !== 'password'),
      },
      req,
    });

    return updated;
  }

  /**
   * Archive a client. Sets status to 'archived'.
   * Logs CLIENT_ARCHIVED in audit_logs.
   */
  async archiveClient(id: string, managerId: string, req?: Request) {
    const existing = await prisma.client.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('CLIENT_NOT_FOUND', `Client with ID '${id}' was not found`, 404);
    }

    const archived = await prisma.client.update({
      where: { id },
      data: { status: 'archived' },
      select: CLIENT_SAFE_SELECT,
    });

    await recordAuditLog({
      userId: managerId,
      action: 'CLIENT_ARCHIVED',
      entity: 'clients',
      entityId: id,
      details: {
        previousStatus: existing.status,
        newStatus: 'archived',
      },
      req,
    });

    return archived;
  }
}

export const clientService = new ClientService();

