import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

interface SendPasswordResetParams {
  to: string;
  userName: string;
  resetToken: string;
}

class MailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    } else {
      // In development/test mode without SMTP settings, use stream/json transport or ethereal fallback
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  /**
   * Sends password reset email with 30-minute expiration notice.
   */
  async sendPasswordResetEmail({ to, userName, resetToken }: SendPasswordResetParams): Promise<void> {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #333333; color: #ffffff; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #3d3d3d; border-radius: 8px; border: 1px solid #4a4a4a; padding: 32px; }
          .brand { color: #eb0505; font-size: 22px; font-weight: bold; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px; }
          h2 { color: #ffffff; font-size: 20px; margin-top: 0; }
          p { color: #bdbdbd; font-size: 15px; line-height: 1.6; }
          .btn-container { margin: 28px 0; }
          .btn { background-color: #eb0505; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; }
          .token-box { background-color: #2b2b2b; border: 1px solid #4a4a4a; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 14px; color: #ffffff; word-break: break-all; margin: 16px 0; }
          .footer { margin-top: 32px; font-size: 12px; color: #888888; border-top: 1px solid #4a4a4a; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brand">Region Security Guarding</div>
          <h2>Password Reset Request</h2>
          <p>Hello ${userName || 'User'},</p>
          <p>We received a request to reset your password for your RSG Guard Management account. Click the button below to set a new password. This link will expire in <strong>30 minutes</strong>.</p>
          <div class="btn-container">
            <a href="${resetUrl}" class="btn" target="_blank">Reset My Password</a>
          </div>
          <p>Or use this token directly in the mobile app / portal:</p>
          <div class="token-box">${resetToken}</div>
          <p>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Region Security Guarding Ltd. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hello ${userName || 'User'},

We received a request to reset your password for your RSG Guard Management account.
This request expires in 30 minutes.

Reset your password here:
${resetUrl}

Or enter this reset token:
${resetToken}

If you did not request this, please ignore this email.
    `.trim();

    try {
      if (this.transporter) {
        const info = await this.transporter.sendMail({
          from: env.SMTP_FROM,
          to,
          subject: 'RSG Guard Management - Password Reset Request',
          text: textContent,
          html: htmlContent,
        });

        if (!env.SMTP_HOST && env.NODE_ENV !== 'test') {
          // In development without real SMTP, log confirmation
          // eslint-disable-next-line no-console
          console.log(`[MailService] Mock email sent to ${to}. Message info:`, info.messageId || 'OK');
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[MailService] Failed to send password reset email to ${to}:`, err);
      // We log error but don't crash password reset request flow
    }
  }
}

export const mailService = new MailService();
