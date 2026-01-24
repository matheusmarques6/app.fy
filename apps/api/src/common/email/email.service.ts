import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend email service initialized');
    } else {
      this.resend = null;
      this.logger.warn('RESEND_API_KEY not configured - emails will be logged only');
    }

    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'AppFy <noreply@appfy.com.br>');
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
    const subject = 'Reset your AppFy password';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 24px; text-align: center;">
              AppFy
            </h1>

            <h2 style="color: #18181b; font-size: 20px; margin: 0 0 16px;">
              Reset your password
            </h2>

            <p style="color: #52525b; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
              We received a request to reset your password. Click the button below to create a new password:
            </p>

            <a href="${resetUrl}" style="display: block; background: #2563eb; color: white; text-decoration: none; padding: 14px 24px; border-radius: 8px; text-align: center; font-weight: 600; font-size: 16px; margin: 0 0 24px;">
              Reset Password
            </a>

            <p style="color: #71717a; font-size: 14px; line-height: 20px; margin: 0 0 16px;">
              This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>

            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">

            <p style="color: #a1a1aa; font-size: 12px; line-height: 18px; margin: 0; text-align: center;">
              AppFy - E-commerce App Builder
            </p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, subject, html);
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    // If Resend is not configured, log the email
    if (!this.resend) {
      this.logger.log(`=================================================`);
      this.logger.log(`EMAIL (not sent - Resend not configured)`);
      this.logger.log(`To: ${to}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`=================================================`);
      return true;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      if (error) {
        this.logger.error(`Failed to send email to ${to}: ${error.message}`);
        return false;
      }

      this.logger.log(`Email sent successfully to ${to} (ID: ${data?.id})`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}:`, err);
      return false;
    }
  }
}
