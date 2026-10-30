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
  EmployeeDocumentInput,
} from './employee.validation';

export const USER_SELECT_SAFE = {
  id: true,
  branch_id: true,
  client_id: true,
  name: true,
  email: true,
  username: true,
  phone: true,
  address: true,
  date_of_birth: true,
  photo_url: true,
  position: true,
  role: true,
  status: true,
  hourly_rate: true,
  monthly_hours: true,
  weekly_hours: true,
  joining_date: true,
  brp_expiry_date: true,
  licence_expiry_date: true,
  licence_number: true,
  id_number: true,
  restrict_early_start: true,
  auto_checkout: true,
  managerial_access: true,
  created_at: true,
  updated_at: true,
  client: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  branch: {
    select: {
      id: true,
      name: true,
      client_id: true,
    },
  },
  documents: {
    select: {
      id: true,
      name: true,
      file_url: true,
      file_type: true,
      file_size: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' as const },
  },
};

export function formatEmployee(user: any) {
  if (!user) return user;
  const payRateNum = user.hourly_rate !== null && user.hourly_rate !== undefined
    ? Number(user.hourly_rate)
    : null;
  return {
    ...user,
    pay_rate: payRateNum,
    profile_image: user.photo_url || null,
    weekly_working_hours: user.weekly_hours ?? null,
  };
}

export class EmployeeService {
  /**
   * Create a new employee with Personal, General, and Operational fields.
   * Hashes password, verifies email & username uniqueness, checks client/branch,
   * stores attached documents, and logs to audit_logs.
   */
  async createEmployee(
    input: CreateEmployeeInput,
    photoUrl?: string,
    managerId?: string,
    req?: Request
  ) {
    // 1. Check email uniqueness
    const existingEmail = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingEmail) {
      throw new AppError('EMAIL_EXISTS', 'An employee with this email already exists', 409);
    }

    // 2. Check username uniqueness
    if (input.username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: input.username },
      });
      if (existingUsername) {
        throw new AppError('USERNAME_EXISTS', 'This username is already taken', 409);
      }
    }

    // 3. Verify client if provided
    let clientId = input.client_id || input.company || null;
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });
      if (!client) {
        throw new AppError('CLIENT_NOT_FOUND', `Client '${clientId}' does not exist`, 404);
      }
    }

    // 4. Verify branch if provided
    if (input.branch_id) {
      const branch = await prisma.branch.findUnique({
        where: { id: input.branch_id },
      });
      if (!branch) {
        throw new AppError('BRANCH_NOT_FOUND', `Branch '${input.branch_id}' does not exist`, 404);
      }
      // If client_id was not explicitly specified, inherit client from branch
      if (!clientId && branch.client_id) {
        clientId = branch.client_id;
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    const effectiveRate = input.pay_rate !== undefined ? input.pay_rate : input.hourly_rate;
    const effectiveWeeklyHours =
      input.weekly_working_hours !== undefined
        ? input.weekly_working_hours
        : input.weekly_hours;

    const profilePic = photoUrl || input.profile_image || input.photo_url || null;

    const employee = await prisma.user.create({
      data: {
        // Personal
        name: input.name,
        email: input.email,
        phone: input.phone,
        password_hash: passwordHash,
        address: input.address || null,
        date_of_birth: input.date_of_birth || null,
        photo_url: profilePic,

        // General
        username: input.username || null,
        position: input.position || null,

        // Operational
        hourly_rate: effectiveRate !== undefined ? new Prisma.Decimal(effectiveRate) : null,
        weekly_hours: effectiveWeeklyHours !== undefined ? effectiveWeeklyHours : null,
        monthly_hours: input.monthly_hours !== undefined ? input.monthly_hours : null,
        joining_date: input.joining_date || null,
        brp_expiry_date: input.brp_expiry_date || null,
        licence_expiry_date: input.licence_expiry_date || null,
        licence_number: input.licence_number || null,
        id_number: input.id_number || input.licence_number || null,
        client_id: clientId,
        branch_id: input.branch_id || null,

        // Roles & settings
        role: input.role || Role.employee,
        status: input.status || UserStatus.active,
        managerial_access: input.managerial_access || false,
        restrict_early_start: input.restrict_early_start || false,
        auto_checkout: input.auto_checkout || false,

        // Documents
        documents:
          input.documents && input.documents.length > 0
            ? {
                create: input.documents.map((doc) => ({
                  name: doc.name,
                  file_url: doc.file_url,
                  file_type: doc.file_type || null,
                  file_size: doc.file_size ? Number(doc.file_size) : null,
                })),
              }
            : undefined,
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
        username: employee.username,
        role: employee.role,
        position: employee.position,
        client_id: employee.client_id,
        branch_id: employee.branch_id,
        pay_rate: effectiveRate,
      },
      req,
    });

    return formatEmployee(employee);
  }

  /**
   * List employees with filtering by branch, client, status, role, position, search, and pagination.
   */
  async listEmployees(query: ListEmployeesQuery) {
    const { page, limit, search, branch_id, client_id, status, role, position } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (branch_id) where.branch_id = branch_id;
    if (client_id) where.client_id = client_id;
    if (status) where.status = status;
    if (role) where.role = role;
    if (position) where.position = { contains: position };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { username: { contains: search } },
        { position: { contains: search } },
        { licence_number: { contains: search } },
        { id_number: { contains: search } },
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
      items: items.map(formatEmployee),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single employee by ID with client, branch, and documents.
   */
  async getEmployeeById(id: string) {
    const employee = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT_SAFE,
    });

    if (!employee) {
      throw new AppError('EMPLOYEE_NOT_FOUND', `Employee with ID '${id}' was not found`, 404);
    }

    return formatEmployee(employee);
  }

  /**
   * Update employee profile (Personal, General, Operational).
   * Verifies email & username uniqueness, hashes password if provided,
   * updates relations and logs EMPLOYEE_UPDATED to audit_logs.
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

    // Client check
    const targetClientId = input.client_id !== undefined ? input.client_id : input.company;
    if (targetClientId) {
      const client = await prisma.client.findUnique({
        where: { id: targetClientId },
      });
      if (!client) {
        throw new AppError('CLIENT_NOT_FOUND', `Client '${targetClientId}' does not exist`, 404);
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

    // Personal
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.date_of_birth !== undefined) updateData.date_of_birth = input.date_of_birth;
    if (input.profile_image !== undefined) updateData.photo_url = input.profile_image;
    if (input.photo_url !== undefined) updateData.photo_url = input.photo_url;

    // General
    if (input.username !== undefined) updateData.username = input.username;
    if (input.position !== undefined) updateData.position = input.position;

    // Operational
    if (input.pay_rate !== undefined) {
      updateData.hourly_rate = new Prisma.Decimal(input.pay_rate);
    } else if (input.hourly_rate !== undefined) {
      updateData.hourly_rate = new Prisma.Decimal(input.hourly_rate);
    }

    if (input.weekly_working_hours !== undefined) {
      updateData.weekly_hours = input.weekly_working_hours;
    } else if (input.weekly_hours !== undefined) {
      updateData.weekly_hours = input.weekly_hours;
    }

    if (input.monthly_hours !== undefined) updateData.monthly_hours = input.monthly_hours;
    if (input.joining_date !== undefined) updateData.joining_date = input.joining_date;
    if (input.brp_expiry_date !== undefined) updateData.brp_expiry_date = input.brp_expiry_date;
    if (input.licence_expiry_date !== undefined) updateData.licence_expiry_date = input.licence_expiry_date;
    if (input.licence_number !== undefined) updateData.licence_number = input.licence_number;
    if (input.id_number !== undefined) updateData.id_number = input.id_number;

    // Relations
    if (targetClientId !== undefined) {
      updateData.client = targetClientId
        ? { connect: { id: targetClientId } }
        : { disconnect: true };
    }

    if (input.branch_id !== undefined) {
      updateData.branch = input.branch_id
        ? { connect: { id: input.branch_id } }
        : { disconnect: true };
    }

    // Role & settings
    if (input.role !== undefined) updateData.role = input.role;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.managerial_access !== undefined) updateData.managerial_access = input.managerial_access;
    if (input.restrict_early_start !== undefined) updateData.restrict_early_start = input.restrict_early_start;
    if (input.auto_checkout !== undefined) updateData.auto_checkout = input.auto_checkout;

    // Password update
    if (input.password) {
      updateData.password_hash = await bcrypt.hash(input.password, 10);
    }

    // Documents update if provided
    if (input.documents && Array.isArray(input.documents)) {
      for (const doc of input.documents) {
        if (!doc.id) {
          await prisma.employeeDocument.create({
            data: {
              user_id: id,
              name: doc.name,
              file_url: doc.file_url,
              file_type: doc.file_type || null,
              file_size: doc.file_size ? Number(doc.file_size) : null,
            },
          });
        }
      }
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

    return formatEmployee(updated);
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

    return formatEmployee(updated);
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

    return formatEmployee(updated);
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

    return formatEmployee(updated);
  }

  /**
   * Add documents to employee.
   */
  async addDocuments(
    id: string,
    documents: EmployeeDocumentInput[],
    managerId?: string,
    req?: Request
  ) {
    await this.getEmployeeById(id);

    const createdDocs = await Promise.all(
      documents.map((doc) =>
        prisma.employeeDocument.create({
          data: {
            user_id: id,
            name: doc.name,
            file_url: doc.file_url,
            file_type: doc.file_type || null,
            file_size: doc.file_size ? Number(doc.file_size) : null,
          },
        })
      )
    );

    await recordAuditLog({
      userId: managerId,
      action: 'EMPLOYEE_DOCUMENTS_ADDED',
      entity: 'users',
      entityId: id,
      details: { count: documents.length, documents: createdDocs.map((d) => d.name) },
      req,
    });

    return this.getEmployeeById(id);
  }

  /**
   * Delete an employee document.
   */
  async deleteDocument(
    id: string,
    documentId: string,
    managerId?: string,
    req?: Request
  ) {
    await this.getEmployeeById(id);

    const doc = await prisma.employeeDocument.findFirst({
      where: { id: documentId, user_id: id },
    });

    if (!doc) {
      throw new AppError('DOCUMENT_NOT_FOUND', `Document '${documentId}' not found for this employee`, 404);
    }

    await prisma.employeeDocument.delete({
      where: { id: documentId },
    });

    await recordAuditLog({
      userId: managerId,
      action: 'EMPLOYEE_DOCUMENT_DELETED',
      entity: 'employee_documents',
      entityId: documentId,
      details: { user_id: id, document_name: doc.name },
      req,
    });

    return { success: true, message: 'Document deleted successfully' };
  }
}

export const employeeService = new EmployeeService();
