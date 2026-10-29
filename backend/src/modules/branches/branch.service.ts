import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/audit';
import {
  CreateBranchInput,
  UpdateBranchInput,
  ListBranchesQuery,
} from './branch.validation';

const DEFAULT_CLIENT_ID = '00000000-0000-0000-0000-000000000001';

export class BranchService {
  /**
   * Create a new branch with geolocation and geofence radius.
   * Associates with client_id (defaults to default client if not specified).
   * Logs BRANCH_CREATED in audit_logs.
   */
  async createBranch(input: CreateBranchInput, managerId: string, req?: Request) {
    const clientId = input.client_id || DEFAULT_CLIENT_ID;

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new AppError('CLIENT_NOT_FOUND', `Client with ID '${clientId}' was not found`, 404);
    }

    const branch = await prisma.branch.create({
      data: {
        client_id: clientId,
        name: input.name,
        address: input.address,
        lat: new Prisma.Decimal(input.lat),
        lng: new Prisma.Decimal(input.lng),
        radius_m: input.radius_m,
        is_active: input.is_active,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    await recordAuditLog({
      userId: managerId,
      action: 'BRANCH_CREATED',
      entity: 'branches',
      entityId: branch.id,
      details: {
        client_id: branch.client_id,
        name: branch.name,
        address: branch.address,
        lat: Number(branch.lat),
        lng: Number(branch.lng),
        radius_m: branch.radius_m,
        is_active: branch.is_active,
      },
      req,
    });

    return branch;
  }

  /**
   * List branches with search, active filter, client filter, and pagination.
   */
  async listBranches(query: ListBranchesQuery) {
    const { page, limit, search, client_id, is_active } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BranchWhereInput = {};

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    if (client_id) {
      where.client_id = client_id;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { address: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.branch.count({ where }),
      prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              users: true,
              shifts: true,
              patrol_qrs: true,
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
   * Get single branch by ID with related resource counts and client info.
   */
  async getBranchById(id: string) {
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
            contact_name: true,
            contact_email: true,
            contact_phone: true,
          },
        },
        _count: {
          select: {
            users: true,
            shifts: true,
            patrol_qrs: true,
            alerts: true,
          },
        },
      },
    });

    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', `Branch with ID '${id}' was not found`, 404);
    }

    return branch;
  }

  /**
   * Update branch metadata (address, lat/lng coordinates, radius_m, name, client_id).
   * Logs BRANCH_UPDATED in audit_logs.
   */
  async updateBranch(
    id: string,
    input: UpdateBranchInput,
    managerId: string,
    req?: Request
  ) {
    await this.getBranchById(id);

    const updateData: Prisma.BranchUpdateInput = {};

    if (input.client_id !== undefined) {
      const client = await prisma.client.findUnique({
        where: { id: input.client_id },
      });
      if (!client) {
        throw new AppError('CLIENT_NOT_FOUND', `Client with ID '${input.client_id}' was not found`, 404);
      }
      updateData.client = { connect: { id: input.client_id } };
    }

    if (input.name !== undefined) updateData.name = input.name;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.lat !== undefined) updateData.lat = new Prisma.Decimal(input.lat);
    if (input.lng !== undefined) updateData.lng = new Prisma.Decimal(input.lng);
    if (input.radius_m !== undefined) updateData.radius_m = input.radius_m;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const updated = await prisma.branch.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    await recordAuditLog({
      userId: managerId,
      action: 'BRANCH_UPDATED',
      entity: 'branches',
      entityId: id,
      details: {
        updatedFields: input,
      },
      req,
    });

    return updated;
  }

  /**
   * Disable or re-enable a branch.
   * Logs BRANCH_DISABLED / BRANCH_ENABLED in audit_logs.
   */
  async setBranchStatus(
    id: string,
    isActive: boolean,
    managerId: string,
    req?: Request
  ) {
    await this.getBranchById(id);

    const updated = await prisma.branch.update({
      where: { id },
      data: { is_active: isActive },
    });

    const action = isActive ? 'BRANCH_ENABLED' : 'BRANCH_DISABLED';

    await recordAuditLog({
      userId: managerId,
      action,
      entity: 'branches',
      entityId: id,
      details: { is_active: isActive },
      req,
    });

    return updated;
  }
}

export const branchService = new BranchService();
