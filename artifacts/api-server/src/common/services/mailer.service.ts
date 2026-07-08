import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

export interface MailOptions {
  to: string;
  subject: string;
  template: 'otp' | 'welcome' | 'reset-password';
  context: Record<string, unknown>;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async resolveSmtpConfig(): Promise<SmtpConfig | null> {
    // 1. Try env vars first (fastest path, no DB round-trip)
    const envHost = process.env['SMTP_HOST'];
    const envUser = process.env['SMTP_USER'] ?? process.env['SMTP_USERNAME'];
    const envPass = process.env['SMTP_PASSWORD'];
    if (envHost && envUser && envPass) {
      return {
        host: envHost,
        port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
        secure: process.env['SMTP_SECURE'] === 'true',
        user: envUser,
        pass: envPass,
        from: process.env['SMTP_FROM'] ?? `SOL TV <noreply@soltv.app>`,
      };
    }

    // 2. Fall back to DB settings saved from Admin Panel
    try {
      const rows = await this.prisma.setting.findMany({
        where: { key: { in: ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_encryption', 'smtp_from_email', 'smtp_from_name'] } },
      });
      const cfg: Record<string, string> = {};
      for (const r of rows) cfg[r.key] = String(r.value ?? '');

      if (!cfg['smtp_host'] || !cfg['smtp_username'] || !cfg['smtp_password']) return null;

      const fromEmail = cfg['smtp_from_email'] || 'noreply@soltv.app';
      const fromName  = cfg['smtp_from_name']  || 'SOL TV';

      return {
        host: cfg['smtp_host'],
        port: parseInt(cfg['smtp_port'] ?? '587', 10),
        secure: cfg['smtp_encryption'] === 'ssl',
        user: cfg['smtp_username'],
        pass: cfg['smtp_password'],
        from: `"${fromName}" <${fromEmail}>`,
      };
    } catch (err) {
      this.logger.warn('Could not read SMTP settings from DB', err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  async sendMail(opts: MailOptions): Promise<void> {
    const config = await this.resolveSmtpConfig();
    const html   = this.render(opts.template, opts.context);

    if (!config) {
      // SECURITY: never log the OTP in production — log scrapers (ELK, Datadog, CloudWatch)
      // would persist it indefinitely and turn every "I forgot my password" email into a
      // credential leak. In dev it's useful for local testing without a real SMTP server.
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`[SMTP unconfigured] To: ${opts.to} | Subject: ${opts.subject}${opts.context['otp'] ? ` | OTP: ${String(opts.context['otp'])}` : ''}`);
      } else {
        this.logger.warn('SMTP not configured, email skipped');
      }
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.pass },
      });
      await transporter.sendMail({ from: config.from, to: opts.to, subject: opts.subject, html });
      this.logger.log(`Email sent → ${opts.to}`);
    } catch (err) {
      this.logger.error(`Email send failed → ${opts.to}`, err instanceof Error ? err.stack : String(err));
    }
  }

  private render(template: string, ctx: Record<string, unknown>): string {
    switch (template) {
      case 'otp':
        return `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:#1a1a2e;margin-bottom:8px">SOL TV Verification Code</h2>
            <p style="color:#444">Enter this code to verify your identity:</p>
            <div style="font-size:40px;font-weight:bold;letter-spacing:10px;color:#e94560;
              padding:20px;background:#f8f8f8;border-radius:8px;text-align:center;margin:24px 0">
              ${ctx['otp'] ?? '------'}
            </div>
            <p style="color:#888;font-size:13px">Expires in 10 minutes. Never share this with anyone.</p>
          </div>`;
      case 'welcome':
        return `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:#1a1a2e">Welcome to SOL TV, ${ctx['name'] ?? 'there'}!</h2>
            <p>Your account is ready. Start streaming live TV, movies and series.</p>
          </div>`;
      case 'reset-password':
        return `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:#1a1a2e">Reset Your Password</h2>
            <p>Use this code to reset your password:</p>
            <div style="font-size:40px;font-weight:bold;letter-spacing:10px;color:#e94560;
              padding:20px;background:#f8f8f8;border-radius:8px;text-align:center;margin:24px 0">
              ${ctx['otp'] ?? '------'}
            </div>
            <p style="color:#888;font-size:13px">Expires in 10 minutes. If you did not request this, ignore this email.</p>
          </div>`;
      default:
        return `<p>${String(ctx['message'] ?? '')}</p>`;
    }
  }
}
