import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildPoolerUrl(raw: string | undefined): string {
  if (!raw) return '';
  // PgBouncer / Render pooler in transaction mode does not support prepared
  // statements. Appending pgbouncer=true tells Prisma to use simple queries.
  if (raw.includes('pgbouncer=true')) return raw;
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}pgbouncer=true`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = buildPoolerUrl(process.env.DATABASE_URL);
    super({
      datasources: { db: { url } },
      log: process.env.NODE_ENV === 'development'
        ? [{ emit: 'stdout', level: 'query' }, { emit: 'stdout', level: 'warn' }]
        : [{ emit: 'stdout', level: 'warn' }],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
