import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  allowAdmins: boolean;
}

const CACHE_TTL_MS = 30_000;

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MaintenanceMiddleware.name);
  private cachedConfig: MaintenanceConfig | null = null;
  private cacheExpiresAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const url = req.url ?? '';
    const pathname = new URL(url, 'http://localhost').pathname;

    // Strip optional global prefix so checks work both with and without /api
    const stripped = pathname.replace(/^\/api/, '');

    if (
      stripped === '/healthz' ||
      stripped === '/health' ||
      stripped === '/ready' ||
      stripped === '/live' ||
      stripped.startsWith('/health/') ||
      pathname.endsWith('/payments/webhook')
    ) {
      return next();
    }

    const config = await this.getConfig();
    if (!config.enabled) return next();

    // Allow admins through — VERIFY the JWT signature (not just base64-decode the payload).
    // The previous implementation decoded the payload without checking the HMAC, which meant
    // any client could forge a `role: 'super_admin'` claim and bypass maintenance mode.
    if (config.allowAdmins) {
      const authHeader = req.headers['authorization'] as string | undefined;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          // verifyAsync throws if the signature is invalid or the token is expired —
          // any failure falls through to the maintenance block below.
          const payload = await this.jwtService.verifyAsync<{ role?: string }>(token, {
            secret: process.env.JWT_ACCESS_SECRET,
          });
          if (payload.role === 'super_admin' || payload.role === 'admin') {
            return next();
          }
        } catch {
          // Invalid/expired token — treat as non-admin (fall through to maintenance block).
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
        enabled:     val.enabled     ?? false,
        message:     val.message     ?? '',
        allowAdmins: val.allowAdmins ?? true,
      };
    } catch {
      this.cachedConfig = { enabled: false, message: '', allowAdmins: true };
    }

    this.cacheExpiresAt = now + CACHE_TTL_MS;
    return this.cachedConfig;
  }
}
