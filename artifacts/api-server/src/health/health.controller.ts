import { Controller, Get, VERSION_NEUTRAL, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

interface HealthStatus {
  status: 'ok' | 'error' | 'degraded';
  message?: string;
  responseTimeMs?: number;
  [key: string]: unknown;
}

@ApiTags('Health')
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async checkDatabase(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', responseTimeMs: Date.now() - start };
    } catch (err) {
      return { status: 'error', message: (err as Error).message, responseTimeMs: Date.now() - start };
    }
  }

  private async checkStorage(): Promise<HealthStatus> {
    if (await this.storage.isConfigured()) {
      return { status: 'ok', configured: true };
    }
    return {
      status: 'degraded',
      message: 'Storage not configured — configure in Admin → Settings → Storage',
      configured: false,
    };
  }

  private checkWebSocket(): HealthStatus {
    return { status: 'ok', namespace: '/ws', protocol: 'Socket.IO' };
  }

  private systemInfo() {
    const mem = process.memoryUsage();
    return {
      version: process.env['npm_package_version'] ?? '1.0.0',
      environment: process.env['NODE_ENV'] ?? 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
    };
  }

  @Get('healthz')
  @ApiOperation({ summary: 'Basic liveness probe' })
  healthz() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health overview' })
  async health() {
    // PUBLIC: do not leak heap/uptime/version/environment info to anonymous callers —
    // those details are an attacker recon vector (helps fingerprint exact build & restart
    // patterns). The full system report stays behind /health/full (admin only).
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health/database')
  @ApiOperation({ summary: 'Database connectivity check — 503 if unhealthy' })
  async healthDatabase() {
    const result = await this.checkDatabase();
    if (result.status === 'error') {
      throw new HttpException(
        { ...result, timestamp: new Date().toISOString() },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { ...result, timestamp: new Date().toISOString() };
  }

  @Get('health/storage')
  @ApiOperation({ summary: 'Storage check — 503 if unreachable' })
  async healthStorage() {
    const result = await this.checkStorage();
    if (result.status === 'error') {
      throw new HttpException(
        { ...result, timestamp: new Date().toISOString() },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { ...result, timestamp: new Date().toISOString() };
  }

  @Get('health/websocket')
  @ApiOperation({ summary: 'WebSocket gateway health check' })
  healthWebSocket() {
    return { ...this.checkWebSocket(), timestamp: new Date().toISOString() };
  }

  @Get('health/full')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Full system health report — 503 if any critical service is down (admin only)' })
  async healthFull() {
    const [db, storage, websocket] = await Promise.all([
      this.checkDatabase(),
      this.checkStorage(),
      Promise.resolve(this.checkWebSocket()),
    ]);

    const critical = db.status === 'error';
    const overallStatus = critical ? 'error' : (storage.status === 'degraded' ? 'degraded' : 'ok');

    const result = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      ...this.systemInfo(),
      services: { database: db, storage, websocket },
    };

    if (critical) throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }

  @Get('ready')
  @ApiOperation({ summary: 'Kubernetes readiness probe — 503 until DB is reachable' })
  async ready() {
    const db = await this.checkDatabase();
    if (db.status === 'error') {
      throw new HttpException(
        { status: 'not_ready', reason: 'Database unavailable', timestamp: new Date().toISOString() },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Get('live')
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  live() { return { status: 'live', timestamp: new Date().toISOString() }; }

  @Get('status')
  @ApiOperation({ summary: 'Status (alias for /health)' })
  status() { return this.health(); }
}
