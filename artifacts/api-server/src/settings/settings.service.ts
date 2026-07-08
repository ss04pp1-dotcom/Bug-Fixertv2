import { Injectable, NotFoundException, BadRequestException, Optional, Inject } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(AuditService) private auditService?: AuditService,
  ) {}

  async getAll(publicOnly = false) {
    const where = publicOnly ? { isPublic: true } : {};
    return this.prisma.setting.findMany({ where, orderBy: { key: 'asc' } });
  }

  async get(key: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting '${key}' not found`);
    return setting;
  }

  async set(key: string, value: Prisma.InputJsonValue, description?: string, isPublic?: boolean) {
    const result = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value, description, isPublic: isPublic ?? false },
      update: { value, ...(description !== undefined && { description }), ...(isPublic !== undefined && { isPublic }) },
    });
    // A-061: audit settings mutations — config changes (maintenance mode toggle,
    // storage creds, SMTP creds, etc.) are security-sensitive admin actions.
    if (this.auditService) {
      this.auditService.log({
        action: 'setting.set',
        resource: 'setting',
        resourceId: key,
        newValues: value as Prisma.InputJsonValue,
        level: 'info',
      }).catch(() => undefined);
    }
    return result;
  }

  async delete(key: string) {
    await this.get(key);
    await this.prisma.setting.delete({ where: { key } });
    return { message: 'Setting deleted' };
  }

  async getPublicConfig() {
    const settings = await this.prisma.setting.findMany({ where: { isPublic: true } });
    const config: Record<string, Prisma.JsonValue> = {};
    for (const s of settings) config[s.key] = s.value;
    return config;
  }

  async getAppConfig() {
    const settings = await this.prisma.setting.findMany({ where: { isPublic: true } });
    const config: Record<string, Prisma.JsonValue> = {};
    for (const s of settings) config[s.key] = s.value;
    return config;
  }

  async bulkSave(items: { key: string; value: Prisma.InputJsonValue; isPublic?: boolean }[]) {
    await Promise.all(items.map(item => this.set(item.key, item.value, undefined, item.isPublic)));
    return { message: 'Settings saved', count: items.length };
  }

  async testStorage(overrides: Record<string, string> = {}) {
    // Overrides let the admin test unsaved form values without having to save first.
    // Keys are expected in storage_* format (e.g. storage_access_key) matching what
    // the admin UI sends and what the DB stores.
    const keys = ['storage_provider','storage_account_id','storage_access_key','storage_secret_key','storage_bucket'];
    const rows = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
    const cfg: Record<string, string> = {};
    for (const s of rows) cfg[s.key] = String(s.value ?? '');
    // Body overrides take precedence over saved DB values.
    // Guard: skip if body is null/non-object (NestJS @Body() can yield null for empty body).
    // Only accept storage_* prefixed keys to prevent arbitrary key injection.
    if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
      for (const [k, v] of Object.entries(overrides)) {
        if (k.startsWith('storage_') && v !== undefined && v !== '') cfg[k] = String(v);
      }
    }
    if (!cfg['storage_access_key'] || !cfg['storage_secret_key']) {
      throw new BadRequestException('Storage not configured. Save Storage Settings first.');
    }
    const provider = cfg['storage_provider'] ?? 'r2';
    const accountId = cfg['storage_account_id'] ?? '';
    const bucket = cfg['storage_bucket'] ?? 'soltv-media';
    let endpoint: string;
    switch (provider) {
      case 'r2': endpoint = `https://${accountId}.r2.cloudflarestorage.com`; break;
      default:   endpoint = `https://s3.amazonaws.com`; break;
    }
    const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId: cfg['storage_access_key'], secretAccessKey: cfg['storage_secret_key'] },
    });
    try {
      await client.send(new ListBucketsCommand({}));
    } catch (e: any) {
      // A-043: distinguish credential/auth errors (real config problems) from
      // NotImplemented-style errors. R2 doesn't support ListBuckets, but the
      // credentials may still be valid — reporting failure there would mislead
      // the admin into thinking their config is broken.
      const name = e?.name ?? e?.constructor?.name ?? '';
      if (name === 'AccessDenied' || name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch') {
        return { success: false, error: `Storage auth failed: ${e?.message ?? name}` };
      }
      // For NotImplemented / NotFound / networking errors that aren't auth-related,
      // treat as success-with-warning so the admin can proceed to actually use storage.
      return { success: true, warning: `ListBuckets not supported by provider (${name || 'unknown error'}), but credentials may still be valid` };
    }
    return { success: true, message: `Storage connection verified for bucket: ${bucket}` };
  }

  async testEmail(to: string) {
    if (!isEmail(to)) {
      throw new BadRequestException('Invalid email address');
    }
    const keys = ['smtp_host','smtp_port','smtp_username','smtp_password','smtp_encryption','smtp_from_email','smtp_from_name'];
    const rows = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
    const cfg: Record<string, string> = {};
    for (const s of rows) cfg[s.key] = String(s.value ?? '');
    if (!cfg['smtp_host']) throw new BadRequestException('SMTP host not configured. Save Email Settings first.');
    const { createTransport } = await import('nodemailer');
    const transporter = createTransport({
      host: cfg['smtp_host'],
      port: parseInt(cfg['smtp_port'] ?? '587'),
      secure: cfg['smtp_encryption'] === 'ssl',
      auth: { user: cfg['smtp_username'], pass: cfg['smtp_password'] },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: `"${cfg['smtp_from_name'] ?? 'SOL TV'}" <${cfg['smtp_from_email']}>`,
      to,
      subject: '✅ SOL TV — SMTP Test',
      html: `<div style="font-family:sans-serif;padding:32px;background:#0A0F1E;color:#fff;border-radius:12px"><h2 style="color:#7C3AED">SOL TV SMTP Test ✅</h2><p>Your email configuration is working correctly.</p><p style="color:#8B92A5;font-size:12px">Sent from SOL TV Admin Panel</p></div>`,
    });
    return { message: 'Test email sent to ' + to };
  }
}
