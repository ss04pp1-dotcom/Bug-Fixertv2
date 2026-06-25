import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  allowAdmins: boolean;
}

const CACHE_TTL_MS = 30_000; // re-read DB every 30 seconds

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MaintenanceMiddleware.name);
  private cachedConfig: MaintenanceConfig | null = null;
  private cacheExpiresAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Always allow health check endpoints
    const url = req.url ?? '';
    const pathname = new URL(url, 'http://localhost').pathname;
    if (
      pathname === '/healthz' ||
      pathname === '/health' ||
      pathname === '/ready' ||
      pathname === '/live' ||
      pathname.endsWith('/payments/webhook')
    ) {
      return next();
    }

    const config = await this.getConfig();
    if (!config.enabled) return next();

    // Allow admins through if configured — verify JWT signature before trusting role claim
    if (config.allowAdmins) {
      const authHeader = req.headers['authorization'] as string | undefined;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.slice(7);
          const secret = this.configService.get<string>('jwt.accessSecret') || process.env.JWT_ACCESS_SECRET;
          const payload = await this.jwtService.verifyAsync<{ role?: string }>(token, secret ? { secret } : undefined);
          if (payload.role === 'super_admin' || payload.role === 'admin') {
            return next();
          }
        } catch {
          // Invalid or expired token — fall through to maintenance block
        }
      }
    }

    this.logger.warn(`Maintenance mode blocked request: ${req.method} ${url}`);
    res.status(503).json({
      statusCode: 503,
      error: 'Service Unavailable',
      message: config.message || 'The system is under maintenance. Please try again later.',
      maintenance: true,
      timestamp: new Date().toISOString(),
    });
  }

  private async getConfig(): Promise<MaintenanceConfig> {
    const now = Date.now();
    if (this.cachedConfig && now < this.cacheExpiresAt) {
      return this.cachedConfig;
    }

    try {
      const setting = await this.prisma.setting.findUnique({ where: { key: 'maintenance' } });
      const val = (setting?.value ?? {}) as { enabled?: boolean; message?: string; allowAdmins?: boolean };
      this.cachedConfig = {
        enabled: val.enabled ?? false,
        message: val.message ?? '',
        allowAdmins: val.allowAdmins ?? true,
      };
    } catch {
      this.cachedConfig = { enabled: false, message: '', allowAdmins: true };
    }

    this.cacheExpiresAt = now + CACHE_TTL_MS;
    return this.cachedConfig;
  }
}
