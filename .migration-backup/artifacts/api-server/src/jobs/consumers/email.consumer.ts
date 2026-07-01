import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { QUEUE_EMAIL } from '../jobs.constants';

export interface SendEmailJob {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, unknown>;
  html?: string;
}

@Processor(QUEUE_EMAIL)
export class EmailQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(EmailQueueConsumer.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    super();
    const host = process.env['SMTP_HOST'];
    const user = process.env['SMTP_USER'];
    const pass = process.env['SMTP_PASSWORD'];
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
        secure: process.env['SMTP_SECURE'] === 'true',
        auth: { user, pass },
      });
      this.logger.log('SMTP transport initialized');
    } else {
      this.logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  async process(job: Job<SendEmailJob>): Promise<void> {
    this.logger.log(`Processing email job ${job.id} to ${job.data.to}`);
    await this.sendEmail(job.data);
  }

  async sendEmail(data: SendEmailJob): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`[SMTP not configured] Would send to: ${data.to} | Subject: ${data.subject}`);
      return;
    }
    try {
      const html = data.html ?? this.renderTemplate(data.template, data.context ?? {});
      await this.transporter.sendMail({
        from: process.env['SMTP_FROM'] ?? 'noreply@streampro.app',
        to: data.to,
        subject: data.subject,
        html,
      });
      this.logger.log(`Email sent to ${data.to}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${data.to}`, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  private renderTemplate(template: string, ctx: Record<string, unknown>): string {
    switch (template) {
      case 'otp':
        return `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#1a1a2e">StreamPro Verification Code</h2>
            <p>Your one-time verification code is:</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#e94560;padding:16px;background:#f4f4f4;border-radius:8px;text-align:center">
              ${ctx['otp'] ?? '------'}
            </div>
            <p style="color:#666;font-size:13px">This code expires in 10 minutes. Do not share it with anyone.</p>
          </div>`;
      case 'welcome':
        return `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#1a1a2e">Welcome to StreamPro, ${ctx['name'] ?? 'there'}!</h2>
            <p>Your account has been created successfully. Enjoy unlimited streaming.</p>
          </div>`;
      case 'reset-password':
        return `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#1a1a2e">Reset Your Password</h2>
            <p>Your password reset code is:</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#e94560;padding:16px;background:#f4f4f4;border-radius:8px;text-align:center">
              ${ctx['otp'] ?? '------'}
            </div>
            <p style="color:#666;font-size:13px">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
          </div>`;
      default:
        return `<p>${String(ctx['message'] ?? template)}</p>`;
    }
  }
}
