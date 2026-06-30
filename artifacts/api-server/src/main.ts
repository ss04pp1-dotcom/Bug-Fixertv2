import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

function validateEnvironment(logger: Logger): void {
  const critical = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = critical.filter(k => !process.env[k]);
  if (missing.length > 0) {
    logger.error(`Missing critical environment variables: ${missing.join(', ')}`);
    logger.error('Application cannot start without these variables. Check your .env file.');
    process.exit(1);
  }

  // SMTP, Firebase, and Storage (R2/S3/etc.) are all configurable from
  // Admin → Settings and stored in the database. No env vars required for them.
  // Env vars are still supported as an override if preferred.
}

async function diagnoseBoot(logger: Logger): Promise<void> {
  // Run connectivity checks BEFORE NestJS initialises modules so we can log
  // the exact failing service in Render's deployment logs.
  logger.log('=== Boot diagnostics ===');

  // --- Database ---
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env['DATABASE_URL'] } },
    });
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    logger.log('[BOOT] Database ✓ connected');
  } catch (err) {
    logger.error('[BOOT] Database ✗ FAILED — ' + (err instanceof Error ? err.message : String(err)));
    logger.error('[BOOT] Check DATABASE_URL — expected: postgresql://user:pass@host:6543/postgres');
  }

  // --- Redis ---
  const redisUrl = process.env['REDIS_URL'];
  if (redisUrl) {
    try {
      const { Redis } = await import('ioredis');
      const client = new Redis(redisUrl, { connectTimeout: 4000, lazyConnect: true, maxRetriesPerRequest: 0 });
      await client.connect();
      await client.ping();
      await client.quit();
      logger.log('[BOOT] Redis ✓ connected');
    } catch (err) {
      logger.warn('[BOOT] Redis ✗ FAILED (queues disabled) — ' + (err instanceof Error ? err.message : String(err)));
      logger.warn('[BOOT] Fix: Render Dashboard → Redis service → Info → copy "Internal URL" → set as REDIS_URL');
      logger.warn('[BOOT] Expected format: redis://default:PASSWORD@red-xxxxx:6379');
    }
  } else {
    logger.warn('[BOOT] Redis — REDIS_URL not set (queues disabled)');
  }

  logger.log('=== Boot diagnostics complete ===');
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  validateEnvironment(logger);

  await diagnoseBoot(logger);

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: process.env['NODE_ENV'] === 'production',
  }));
  app.use(compression());

  const rawOrigins = process.env['CORS_ORIGIN'];
  const allowedOrigins: string[] = rawOrigins
    ? rawOrigins.split(',').map(o => o.trim()).filter(Boolean)
    : [];

  // Convert wildcard entries like "https://*.replit.dev" into RegExp patterns.
  // Use [^.]+ (single subdomain level) instead of .+ so "https://*.example.com"
  // matches "https://api.example.com" but NOT "https://attacker.example.com.evil.com".
  // If multi-level wildcard matching is genuinely needed, configure each level explicitly.
  const originPatterns: Array<string | RegExp> = allowedOrigins.map(o => {
    if (o.includes('*')) {
      // Escape all regex special chars first, then replace * with [^.]+ for single-level wildcard.
      const escaped = o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+');
      return new RegExp(`^${escaped}$`);
    }
    return o;
  });

  function isOriginAllowed(origin: string): boolean {
    return originPatterns.some(p =>
      typeof p === 'string' ? p === origin : p.test(origin),
    );
  }

  // SECURITY: when no allowed origins are configured, reject ALL cross-origin requests
  // (returning `false` from the origin callback sets CORS `Access-Control-Allow-Origin: null`).
  // `CORS_ORIGIN` must be set explicitly in every environment — including staging/preview —
  // because the previous "open in development" default leaked the API to any localhost port.
  app.enableCors({
    origin: allowedOrigins.length > 0
      ? (origin, callback) => {
          if (!origin || isOriginAllowed(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS: origin not allowed — ${origin}`));
          }
        }
      : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Client', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['X-Request-ID'],
    credentials: true,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global error handling and response shaping
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Swagger — disabled in production unless explicitly enabled via SWAGGER_ENABLED=true
  const swaggerEnabled = process.env.NODE_ENV !== 'production'
    || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('StreamPro API')
      .setDescription(
        'Enterprise TV Streaming Platform API — Live TV, VOD, Subscriptions, Ads',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addServer('/api-server', 'API Server (proxied)')
      .build();

    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  app.enableShutdownHooks();

  // Root route — satisfies Render/load-balancer health checks that hit GET /
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/', (_req: unknown, res: { json: (d: unknown) => void }) => {
    res.json({ status: 'ok', service: 'StreamPro API', version: '1.0' });
  });

  const port = process.env['PORT'] ?? 8080;
  await app.listen(port, '0.0.0.0');

  const env = process.env['NODE_ENV'] ?? 'development';
  logger.log(`StreamPro API [${env}] running on port ${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/docs`);
  logger.log(`Health: http://localhost:${port}/healthz`);
  logger.log(`Full health: http://localhost:${port}/health/full`);
}

// Catch unhandled rejections (e.g. BullMQ / ioredis connection errors emitted
// asynchronously after bootstrap) so they are logged instead of silently
// crashing the process with exit code 1.
process.on('unhandledRejection', (reason: unknown) => {
  const logger = new Logger('Process');
  logger.error(
    'Unhandled promise rejection (non-fatal):',
    reason instanceof Error ? reason.stack : String(reason),
  );
  // Do NOT exit — keep the server running; the offending subsystem (e.g. Redis)
  // will retry or degrade gracefully.
});

process.on('uncaughtException', (err: Error) => {
  const logger = new Logger('Process');
  logger.error('Uncaught exception — server will continue:', err.stack);
  // Only truly fatal errors (OOM, SIGKILL) should terminate the process.
  // Log and continue so Render does not restart the container unnecessarily.
});

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('Fatal startup error', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
