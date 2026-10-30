import bcrypt from 'bcrypt';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

export async function bootstrapAdmin(): Promise<void> {
  try {
    // 1. Remove old demo manager account if present
    const oldDemoManager = await prisma.user.findUnique({
      where: { email: 'manager@region.com' },
    });

    if (oldDemoManager) {
      await prisma.$transaction([
        prisma.shiftAssignment.deleteMany({ where: { user_id: oldDemoManager.id } }),
        prisma.attendance.deleteMany({ where: { user_id: oldDemoManager.id } }),
        prisma.patrolScan.deleteMany({ where: { user_id: oldDemoManager.id } }),
        prisma.alert.deleteMany({ where: { owner_id: oldDemoManager.id } }),
        prisma.employeeDocument.deleteMany({ where: { user_id: oldDemoManager.id } }),
        prisma.refreshToken.deleteMany({ where: { user_id: oldDemoManager.id } }),
        prisma.passwordReset.deleteMany({ where: { user_id: oldDemoManager.id } }),
        prisma.notification.deleteMany({ where: { user_id: oldDemoManager.id } }),
        prisma.user.delete({ where: { id: oldDemoManager.id } }),
      ]);
      // eslint-disable-next-line no-console
      console.log('🗑️ Removed legacy demo manager account (manager@region.com)');
    }

    // 2. Ensure admin account exists
    const adminEmail = env.ADMIN_EMAIL.toLowerCase().trim();
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
      await prisma.user.create({
        data: {
          name: 'System Administrator',
          email: adminEmail,
          username: 'admin',
          role: Role.admin,
          status: UserStatus.active,
          password_hash: passwordHash,
          managerial_access: true,
        },
      });
      // eslint-disable-next-line no-console
      console.log(`🛡️ Admin account created: ${adminEmail}`);
    } else if (existingAdmin.role !== Role.admin || !existingAdmin.managerial_access) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          role: Role.admin,
          managerial_access: true,
        },
      });
      // eslint-disable-next-line no-console
      console.log(`🛡️ Admin account verified/updated: ${adminEmail}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('⚠️ Admin bootstrap encountered an error:', error);
  }
}

