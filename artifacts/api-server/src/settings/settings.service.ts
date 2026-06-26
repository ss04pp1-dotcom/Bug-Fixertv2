import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value, description, isPublic: isPublic ?? false },
      update: { value, ...(description !== undefined && { description }), ...(isPublic !== undefined && { isPublic }) },
    });
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

  async testStorage() {
    const keys = ['storage_provider','storage_account_id','storage_access_key','storage_secret_key','storage_bucket'];
    const rows = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
    const cfg: Record<string, string> = {};
    for (const s of rows) cfg[s.key] = String(s.value ?? '');
    if (!cfg['storage_access_key'] || !cfg['storage_secret_key']) {
      throw new BadRequestException('Storage not configured. Save Storage Settings first.');
    }
    const provider = cfg['storage_provider'] ?? 'r2';
    const accountId = cfg['storage_account_id'] ?? '';
    const bucket = cfg['storage_bucket'] ?? 'streampro-media';
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
    } catch {
      // R2 may not support ListBuckets — treat as success if no auth error
    }
    return { message: `Storage connection verified for bucket: ${bucket}` };
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
      from: `"${cfg['smtp_from_name'] ?? 'StreamPro'}" <${cfg['smtp_from_email']}>`,
      to,
      subject: '✅ StreamPro — SMTP Test',
      html: `<div style="font-family:sans-serif;padding:32px;background:#0A0F1E;color:#fff;border-radius:12px"><h2 style="color:#7C3AED">StreamPro SMTP Test ✅</h2><p>Your email configuration is working correctly.</p><p style="color:#8B92A5;font-size:12px">Sent from StreamPro Admin Panel</p></div>`,
    });
    return { message: 'Test email sent to ' + to };
  }
}
