import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as crypto from 'crypto';

// A-033: Allow-list of object key prefixes that the DELETE endpoint may target.
// Without this guard, an attacker (or a compromised admin token) could delete
// arbitrary objects by passing any key — including infrastructure-critical files
// like backups or CDN root assets. Only well-known upload folders are deletable.
const ALLOWED_DELETE_PREFIXES = [
  'avatars/',
  'logos/',
  'banners/',
  'posters/',
  'categories/',
  'ads/',
  'uploads/',
];

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface StorageUploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
  contentType: string;
}

interface StorageConfig {
  provider: string;
  accountId: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  endpoint?: string;
  cdnUrl?: string;
  region?: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  generateKey(folder: string, filename: string): string {
    const rawExt = path.extname(filename);
    const ext = rawExt.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
    const hash = crypto.randomBytes(12).toString('hex');
    const timestamp = Date.now();
    return `${folder}/${timestamp}-${hash}${ext}`;
  }

  private async getConfig(): Promise<StorageConfig | null> {
    try {
      const keys = [
        'storage_provider', 'storage_account_id', 'storage_access_key',
        'storage_secret_key', 'storage_bucket', 'storage_endpoint',
        'storage_cdn_url', 'storage_region',
      ];
      const rows = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
      const cfg: Record<string, string> = {};
      for (const r of rows) cfg[r.key] = String(r.value ?? '');

      if (cfg['storage_provider'] && cfg['storage_provider'] !== 'local' && cfg['storage_access_key'] && cfg['storage_secret_key']) {
        return {
          provider: cfg['storage_provider'],
          accountId: cfg['storage_account_id'] ?? '',
          accessKey: cfg['storage_access_key'],
          secretKey: cfg['storage_secret_key'],
          bucket: cfg['storage_bucket'] ?? 'streampro-media',
          endpoint: cfg['storage_endpoint'] || undefined,
          cdnUrl: cfg['storage_cdn_url'] || undefined,
          region: cfg['storage_region'] || undefined,
        };
      }
    } catch {
      this.logger.warn('Could not read storage settings from DB, falling back to env vars');
    }

    const r2AccountId = this.configService.get<string>('storage.r2AccountId');
    const r2AccessKeyId = this.configService.get<string>('storage.r2AccessKeyId');
    const r2SecretAccessKey = this.configService.get<string>('storage.r2SecretAccessKey');

    if (r2AccountId && r2AccessKeyId && r2SecretAccessKey) {
      return {
        provider: 'r2',
        accountId: r2AccountId,
        accessKey: r2AccessKeyId,
        secretKey: r2SecretAccessKey,
        bucket: this.configService.get<string>('storage.r2BucketName') ?? 'streampro-media',
        cdnUrl: this.configService.get<string>('storage.r2PublicUrl') || undefined,
      };
    }

    return null;
  }

  async getPublicUrl(key: string): Promise<string> {
    const cfg = await this.getConfig();
    if (cfg?.cdnUrl) return `${cfg.cdnUrl.replace(/\/$/, '')}/${key}`;
    if (cfg?.provider === 'r2' && cfg.accountId) return `https://pub-${cfg.accountId}.r2.dev/${key}`;
    return `/v1/storage/${key}`;
  }

  async isConfigured(): Promise<boolean> {
    const cfg = await this.getConfig();
    return !!(cfg?.accessKey && cfg?.secretKey);
  }

  private buildS3Client(cfg: StorageConfig) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client } = require('@aws-sdk/client-s3');
    let endpoint: string;
    switch (cfg.provider) {
      case 'r2':
        endpoint = `https://${cfg.accountId}.r2.cloudflarestorage.com`;
        break;
      case 's3':
        endpoint = cfg.endpoint ?? `https://s3.${cfg.region ?? 'us-east-1'}.amazonaws.com`;
        break;
      case 'do_spaces':
        endpoint = cfg.endpoint ?? `https://${cfg.region ?? 'nyc3'}.digitaloceanspaces.com`;
        break;
      case 'wasabi':
        endpoint = cfg.endpoint ?? 'https://s3.wasabisys.com';
        break;
      case 'backblaze':
        endpoint = cfg.endpoint ?? 'https://s3.us-west-002.backblazeb2.com';
        break;
      case 'minio':
        endpoint = cfg.endpoint ?? 'http://localhost:9000';
        break;
      default:
        endpoint = cfg.endpoint ?? 'https://s3.amazonaws.com';
    }
    return new S3Client({
      region: cfg.region ?? 'auto',
      endpoint,
      credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
    });
  }

  async upload(file: UploadedFile, folder = 'uploads'): Promise<StorageUploadResult> {
    const key = this.generateKey(folder, file.originalname);
    const cfg = await this.getConfig();

    if (!cfg) {
      this.logger.warn('Storage not configured — configure in Admin → Settings → Storage');
      return { key, url: `/v1/storage/${key}`, bucket: 'local', size: file.size, contentType: file.mimetype };
    }

    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = this.buildS3Client(cfg);
      await client.send(new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }));
      const url = cfg.cdnUrl ? `${cfg.cdnUrl.replace(/\/$/, '')}/${key}` : `/v1/storage/${key}`;
      return { key, url, bucket: cfg.bucket, size: file.size, contentType: file.mimetype };
    } catch (err) {
      this.logger.error('Storage upload failed', err);
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    // A-033: validate key prefix before issuing the delete to the storage backend.
    const isAllowed = ALLOWED_DELETE_PREFIXES.some(prefix => key.startsWith(prefix));
    if (!isAllowed) {
      throw new ForbiddenException(`Delete not allowed for this path (key prefix not in allow-list)`);
    }
    const cfg = await this.getConfig();
    if (!cfg) {
      this.logger.warn(`Storage not configured — delete skipped for key: ${key}`);
      return;
    }
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = this.buildS3Client(cfg);
      await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
    } catch (err) {
      this.logger.error('Storage delete failed', err);
      throw err;
    }
  }
}
