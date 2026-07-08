import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { initSentry, captureException as sentryCapture } from './common/observability/sentry';
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

  // Refuse to boot with the .env.example placeholder secrets — trivially forgeable JWTs.
  for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = process.env[k] ?? '';
    if (v.startsWith('CHANGE_THIS') || v.length < 32) {
      logger.error(`${k} is a placeholder or too short. Generate with: openssl rand -hex 32`);
      process.exit(1);
    }
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

  // --- DIRECT_URL (Prisma migrations — non-pooled direct connection) ---
  // Prisma's `prisma migrate deploy` uses DIRECT_URL so it bypasses PgBouncer
  // and can run DDL statements. If DIRECT_URL is missing or unreachable,
  // migrations will fail silently at deploy time while the app still boots.
  const directUrl = process.env['DIRECT_URL'];
  if (directUrl) {
    try {
      const { PrismaClient: PrismaClientDirect } = await import('@prisma/client');
      const prismaD = new PrismaClientDirect({
        datasources: { db: { url: directUrl } },
      });
      await prismaD.$connect();
      await prismaD.$queryRaw`SELECT 1`;
      await prismaD.$disconnect();
      logger.log('[BOOT] DIRECT_URL ✓ reachable (Prisma migrations will work)');
    } catch (err) {
      logger.warn('[BOOT] DIRECT_URL ✗ FAILED — ' + (err instanceof Error ? err.message : String(err)));
      logger.warn('[BOOT] Migrations use DIRECT_URL — if unset/wrong, `prisma migrate deploy` will fail');
      logger.warn('[BOOT] Expected: postgresql://user:pass@host:5432/postgres (non-pooled, direct)');
    }
  } else {
    logger.warn('[BOOT] DIRECT_URL not set — Prisma migrations fall back to DATABASE_URL');
    logger.warn('[BOOT] For Supabase/PgBouncer pooler, set DIRECT_URL to the non-pooled connection string');
  }

  logger.log('=== Boot diagnostics complete ===');
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  initSentry();

  validateEnvironment(logger);

  await diagnoseBoot(logger);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Cap JSON/urlencoded body size so an unbounded payload can't spike memory.
  // Multipart uploads still flow through @UploadedFile / Multer limits.
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  // Attach a correlation ID to every request so LoggingInterceptor + downstream services can trace.
  const { randomUUID } = await import('crypto');
  app.use((req: { headers: Record<string, string | string[] | undefined> }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const incoming = req.headers['x-request-id'];
    const raw = Array.isArray(incoming) ? incoming[0] : incoming;
    // Only accept a well-formed UUID from clients; otherwise mint a fresh one to prevent header injection / log-forging.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const id = raw && UUID_RE.test(raw) ? raw : randomUUID();
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-ID', id);
    next();
  });

  // Security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: process.env['CSP_DISABLED'] === 'true' ? false : undefined,
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

    // In production, protect Swagger UI with basic auth (set SWAGGER_USER / SWAGGER_PASS).
    if (process.env.NODE_ENV === 'production') {
      const user = process.env.SWAGGER_USER;
      const pass = process.env.SWAGGER_PASS;
      if (!user || !pass) {
        logger.warn('SWAGGER_ENABLED=true in production but SWAGGER_USER/SWAGGER_PASS not set — refusing to expose /docs.');
      } else {
        const expected = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
        app.use('/docs', (req: { headers: Record<string, string | string[] | undefined> }, res: { setHeader: (k: string, v: string) => void; status: (n: number) => { end: (b?: string) => void } }, next: () => void) => {
          if (req.headers['authorization'] === expected) return next();
          res.setHeader('WWW-Authenticate', 'Basic realm="Swagger"');
          res.status(401).end('Authentication required');
        });
        SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
      }
    } else {
      SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
    }
  }

  app.enableShutdownHooks();

  // Root route — satisfies Render/load-balancer health checks that hit GET /
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/', (_req: unknown, res: any) => {
    res.json({ status: 'ok' });
  });

  const port = process.env['PORT'] ?? 8080;
  runningApp = app;
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
  sentryCapture(reason, { source: 'unhandledRejection' });
  logger.error(
    'Unhandled promise rejection (non-fatal):',
    reason instanceof Error ? reason.stack : String(reason),
  );
  // Do NOT exit — keep the server running; the offending subsystem (e.g. Redis)
  // will retry or degrade gracefully.
});

// Track the running Nest app so we can close it before exit (drain in-flight requests, DB, queues).
let runningApp: { close: () => Promise<void> } | undefined;
process.on('uncaughtException', (err: Error) => {
  const logger = new Logger('Process');
  sentryCapture(err, { source: 'uncaughtException' });
  logger.error('Uncaught exception — attempting graceful shutdown:', err.stack);
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out (10s) — forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();
  Promise.resolve(runningApp?.close()).catch(() => undefined).finally(() => process.exit(1));
});
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    const logger = new Logger('Process');
    logger.log(`Received ${sig}, closing app gracefully…`);
    Promise.resolve(runningApp?.close()).catch(() => undefined).finally(() => process.exit(0));
  });
}

bootstrap().catch((err: unknown) => {
  // Use console.error directly — a Nest Logger may not be available if
  // NestFactory.create() itself threw, and bufferLogs would hide the message.
  console.error('[Bootstrap] FATAL startup error:');
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
