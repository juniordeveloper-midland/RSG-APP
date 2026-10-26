import bcrypt from 'bcrypt';
import { Request } from 'express';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/audit';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  ListEmployeesQuery,
} from './employee.validation';

const USER_SELECT_SAFE = {
  id: true,
  branch_id: true,
  name: true,
  email: true,
  username: true,
  phone: true,
  address: true,
  photo_url: true,
  role: true,
  status: true,
  hourly_rate: true,
  monthly_hours: true,
  id_number: true,
  restrict_early_start: true,
  auto_checkout: true,
  managerial_access: true,
  created_at: true,
  updated_at: true,
  branch: {
    select: {
      id: true,
      name: true,
    },
  },
};

export class EmployeeService {
  /**
   * Create a new employee with required and optional credentials.
   * Hashes password, checks uniqueness, and records in audit_logs.
   */
  async createEmployee(
    input: CreateEmployeeInput,
    photoUrl?: string,
    managerId?: string,
    req?: Request
  ) {
    // Check email conflict
    const existingEmail = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingEmail) {
      throw new AppError('EMAIL_EXISTS', 'An employee with this email already exists', 409);
    }

    // Check username conflict if provided
    if (input.username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: input.username },
      });
      if (existingUsername) {
        throw new AppError('USERNAME_EXISTS', 'This username is already taken', 409);
      }
    }

    // Verify branch if provided
    if (input.branch_id) {
      const branch = await prisma.branch.findUnique({
        where: { id: input.branch_id },
      });
      if (!branch) {
        throw new AppError('BRANCH_NOT_FOUND', `Branch '${input.branch_id}' does not exist`, 404);
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    const employee = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        password_hash: passwordHash,
        monthly_hours: input.monthly_hours,
        hourly_rate: new Prisma.Decimal(input.hourly_rate),
        id_number: input.id_number,
        branch_id: input.branch_id || null,
        username: input.username || null,
        address: input.address || null,
        photo_url: photoUrl || null,
        role: input.role || Role.employee,
        status: input.status || UserStatus.active,
        managerial_access: input.managerial_access || false,
        restrict_early_start: input.restrict_early_start || false,
        auto_checkout: input.auto_checkout || false,
      },
      select: USER_SELECT_SAFE,
    });

    await recordAuditLog({
      userId: managerId,
      action: 'EMPLOYEE_CREATED',
      entity: 'users',
      entityId: employee.id,
      details: {
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        branch_id: employee.branch_id,
        id_number: employee.id_number,
        managerial_access: employee.managerial_access,
      },
      req,
    });

    return employee;
  }

  /**
   * List employees with filtering by branch, status, role, search, and pagination.
   */
  async listEmployees(query: ListEmployeesQuery) {
    const { page, limit, search, branch_id, status, role } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (branch_id) where.branch_id = branch_id;
    if (status) where.status = status;
    if (role) where.role = role;

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { id_number: { contains: search } },
        { username: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: USER_SELECT_SAFE,
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
   * Get single employee by ID.
   */
  async getEmployeeById(id: string) {
    const employee = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT_SAFE,
    });

    if (!employee) {
      throw new AppError('EMPLOYEE_NOT_FOUND', `Employee with ID '${id}' was not found`, 404);
    }

    return employee;
  }

  /**
   * Update employee profile.
   * Logs EMPLOYEE_UPDATED in audit_logs.
   */
  async updateEmployee(
    id: string,
    input: UpdateEmployeeInput,
    managerId?: string,
    req?: Request
  ) {
    await this.getEmployeeById(id);

    // Email conflict check
    if (input.email) {
      const emailConflict = await prisma.user.findFirst({
        where: { email: input.email, NOT: { id } },
      });
      if (emailConflict) {
        throw new AppError('EMAIL_EXISTS', 'An employee with this email already exists', 409);
      }
    }

    // Username conflict check
    if (input.username) {
      const usernameConflict = await prisma.user.findFirst({
        where: { username: input.username, NOT: { id } },
      });
      if (usernameConflict) {
        throw new AppError('USERNAME_EXISTS', 'This username is already taken', 409);
      }
    }

    // Branch existence check
    if (input.branch_id) {
      const branch = await prisma.branch.findUnique({
        where: { id: input.branch_id },
      });
      if (!branch) {
        throw new AppError('BRANCH_NOT_FOUND', `Branch '${input.branch_id}' does not exist`, 404);
      }
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.monthly_hours !== undefined) updateData.monthly_hours = input.monthly_hours;
    if (input.hourly_rate !== undefined)
      updateData.hourly_rate = new Prisma.Decimal(input.hourly_rate);
    if (input.id_number !== undefined) updateData.id_number = input.id_number;
    if (input.branch_id !== undefined) updateData.branch = input.branch_id ? { connect: { id: input.branch_id } } : { disconnect: true };
    if (input.username !== undefined) updateData.username = input.username;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.managerial_access !== undefined) updateData.managerial_access = input.managerial_access;
    if (input.restrict_early_start !== undefined) updateData.restrict_early_start = input.restrict_early_start;
    if (input.auto_checkout !== undefined) updateData.auto_checkout = input.auto_checkout;

    if (input.password) {
      updateData.password_hash = await bcrypt.hash(input.password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT_SAFE,
    });

    await recordAuditLog({
      userId: managerId,
      action: 'EMPLOYEE_UPDATED',
      entity: 'users',
      entityId: id,
      details: {
        updatedFields: Object.keys(input),
      },
      req,
    });

    return updated;
  }

  /**
   * Suspend or activate employee account.
   * Revokes refresh tokens on suspension and logs in audit_logs.
   */
  async setEmployeeStatus(
    id: string,
    status: UserStatus,
    managerId?: string,
    req?: Request
  ) {
    await this.getEmployeeById(id);

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
      select: USER_SELECT_SAFE,
    });

    // If suspended, revoke all active sessions immediately
    if (status === UserStatus.suspended) {
      await prisma.refreshToken.updateMany({
        where: { user_id: id },
        data: { revoked: true },
      });
    }

    const action =
      status === UserStatus.suspended ? 'EMPLOYEE_SUSPENDED' : 'EMPLOYEE_ACTIVATED';

    await recordAuditLog({
      userId: managerId,
      action,
      entity: 'users',
      entityId: id,
      details: { status },
      req,
    });

    return updated;
  }

  /**
   * Set or revoke managerial access privilege.
   */
  async setManagerialAccess(
    id: string,
    managerialAccess: boolean,
    managerId?: string,
    req?: Request
  ) {
    await this.getEmployeeById(id);

    const updated = await prisma.user.update({
      where: { id },
      data: { managerial_access: managerialAccess },
      select: USER_SELECT_SAFE,
    });

    await recordAuditLog({
      userId: managerId,
      action: 'MANAGERIAL_ACCESS_UPDATED',
      entity: 'users',
      entityId: id,
      details: { managerial_access: managerialAccess },
      req,
    });

    return updated;
  }

  /**
   * Update employee profile photo.
   */
  async updatePhoto(
    id: string,
    photoUrl: string,
    managerId?: string,
    req?: Request
  ) {
    await this.getEmployeeById(id);

    const updated = await prisma.user.update({
      where: { id },
      data: { photo_url: photoUrl },
      select: USER_SELECT_SAFE,
    });

    await recordAuditLog({
      userId: managerId,
      action: 'EMPLOYEE_PHOTO_UPDATED',
      entity: 'users',
      entityId: id,
      details: { photo_url: photoUrl },
      req,
    });

    return updated;
  }
}

export const employeeService = new EmployeeService();
