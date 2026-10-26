import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Request } from 'express';
import { UserStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middleware/errorHandler';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateSecureToken,
} from '../../utils/jwt';
import { recordAuditLog } from '../../utils/audit';
import { mailService } from '../../services/mail.service';
import {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth.validation';

export class AuthService {
  /**
   * Authenticate user with email and password.
   * Logs every attempt (success/failure) to audit_logs.
   * Rejects suspended accounts with 403 ACCOUNT_SUSPENDED.
   */
  async login(input: LoginInput, req: Request) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { branch: true },
    });

    if (!user) {
      await recordAuditLog({
        action: 'LOGIN_FAILED',
        entity: 'users',
        details: { email: input.email, reason: 'USER_NOT_FOUND' },
        req,
      });
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    if (user.status === UserStatus.suspended) {
      await recordAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'users',
        entityId: user.id,
        details: { email: input.email, reason: 'ACCOUNT_SUSPENDED' },
        req,
      });
      throw new AppError(
        'ACCOUNT_SUSPENDED',
        'Account is suspended. Please contact your administrator.',
        403
      );
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isPasswordValid) {
      await recordAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'users',
        entityId: user.id,
        details: { email: input.email, reason: 'INVALID_PASSWORD' },
        req,
      });
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // 15-minute Access Token
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      managerial_access: user.managerial_access,
    });

    // 7-day Refresh Token
    const tokenId = crypto.randomUUID();
    const refreshToken = signRefreshToken({
      sub: user.id,
      tokenId,
    });

    // Store hashed refresh token in database
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days UTC

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    // Record successful login in audit logs
    await recordAuditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entity: 'users',
      entityId: user.id,
      details: { email: user.email, role: user.role, branch_id: user.branch_id },
      req,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        branch_id: user.branch_id,
        branch_name: user.branch?.name ?? null,
        managerial_access: user.managerial_access,
      },
    };
  }

  /**
   * Refreshes access token and rotates refresh token.
   */
  async refreshToken(rawRefreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new AppError('INVALID_TOKEN', 'Refresh token is invalid or expired', 401);
    }

    const tokenHash = hashToken(rawRefreshToken);

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.revoked || tokenRecord.expires_at < new Date()) {
      throw new AppError('INVALID_TOKEN', 'Refresh token is invalid, revoked, or expired', 401);
    }

    if (tokenRecord.user.status === UserStatus.suspended) {
      throw new AppError(
        'ACCOUNT_SUSPENDED',
        'Account is suspended. Please contact your administrator.',
        403
      );
    }

    // Revoke old refresh token (token rotation)
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    });

    // Generate new access and refresh tokens
    const newAccessToken = signAccessToken({
      sub: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.role,
      branch_id: tokenRecord.user.branch_id,
      managerial_access: tokenRecord.user.managerial_access,
    });

    const newTokenId = crypto.randomUUID();
    const newRefreshToken = signRefreshToken({
      sub: tokenRecord.user.id,
      tokenId: newTokenId,
    });

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        user_id: tokenRecord.user.id,
        token_hash: hashToken(newRefreshToken),
        expires_at: newExpiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Revoke refresh token and log audit entry.
   */
  async logout(rawRefreshToken?: string, userId?: string, req?: Request) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { token_hash: tokenHash },
        data: { revoked: true },
      });
    }

    if (userId) {
      await recordAuditLog({
        userId,
        action: 'USER_LOGOUT',
        entity: 'users',
        entityId: userId,
        req,
      });
    }

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Request password reset token with 30-minute expiration.
   * Sends token to user's email via Nodemailer.
   */
  async forgotPassword(input: ForgotPasswordInput, req: Request) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (user && user.status !== UserStatus.suspended) {
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes in UTC

      // Save reset token in DB
      await prisma.passwordReset.create({
        data: {
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
        },
      });

      // Send email via Nodemailer
      await mailService.sendPasswordResetEmail({
        to: user.email,
        userName: user.name,
        resetToken: rawToken,
      });

      // Log request in audit_logs (never logging the raw token)
      await recordAuditLog({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'users',
        entityId: user.id,
        details: { email: user.email },
        req,
      });
    }

    // Always return standard message to prevent email enumeration
    return {
      success: true,
      message: 'If an account with that email exists, password reset instructions have been sent.',
    };
  }

  /**
   * Reset password with valid 30-minute token.
   * Invalidate token and revoke refresh sessions upon success.
   */
  async resetPassword(input: ResetPasswordInput, req: Request) {
    const tokenHash = hashToken(input.token);

    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        token_hash: tokenHash,
        used_at: null,
        expires_at: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetRecord) {
      throw new AppError(
        'INVALID_RESET_TOKEN',
        'Password reset token is invalid or has expired',
        400
      );
    }

    if (resetRecord.user.status === UserStatus.suspended) {
      throw new AppError(
        'ACCOUNT_SUSPENDED',
        'Account is suspended. Please contact your administrator.',
        403
      );
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(input.password, saltRounds);

    // Atomically update user password, mark reset token used, and revoke existing sessions
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.user_id },
        data: { password_hash: newPasswordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used_at: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { user_id: resetRecord.user_id },
        data: { revoked: true },
      }),
    ]);

    // Record password reset in audit logs
    await recordAuditLog({
      userId: resetRecord.user_id,
      action: 'PASSWORD_RESET_SUCCESS',
      entity: 'users',
      entityId: resetRecord.user_id,
      details: { email: resetRecord.user.email },
      req,
    });

    return {
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }
}

export const authService = new AuthService();
