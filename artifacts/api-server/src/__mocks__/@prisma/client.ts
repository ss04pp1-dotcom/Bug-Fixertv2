/**
 * Jest manual mock for @prisma/client.
 *
 * The generated Prisma client is not available in the test environment
 * (it requires `prisma generate` and a live schema). This file provides:
 *   • A minimal PrismaClient stub so PrismaService can extend it safely.
 *   • All enum values used by application code.
 *
 * NOTE: Keep enum values in sync with schema.prisma.
 */

/** Minimal stub so PrismaService can extend PrismaClient without crashing. */
export class PrismaClient {
  constructor(_opts?: unknown) {}
  $connect()    { return Promise.resolve(); }
  $disconnect() { return Promise.resolve(); }
  $on()         { return this; }
}

export const GitHubSyncStatus = {
  running: 'running',
  success: 'success',
  failed:  'failed',
} as const;

export const ServerSourceType = {
  GITHUB: 'GITHUB',
  ADMIN:  'ADMIN',
  MANUAL: 'MANUAL',
} as const;

export const Role = {
  user:      'user',
  admin:     'admin',
  moderator: 'moderator',
} as const;

export const SubscriptionStatus = {
  active:    'active',
  expired:   'expired',
  cancelled: 'cancelled',
  pending:   'pending',
} as const;

export const PaymentStatus = {
  pending:   'pending',
  completed: 'completed',
  failed:    'failed',
  refunded:  'refunded',
} as const;

export const NotificationType = {
  info:    'info',
  warning: 'warning',
  error:   'error',
  success: 'success',
} as const;

/** Stub for Prisma.DbNull — used for nullable JSON fields */
export const Prisma = {
  DbNull:     'DbNull',
  JsonNull:   'JsonNull',
  AnyNull:    'AnyNull',
  sql:        (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  join:       (values: unknown[]) => values,
  raw:        (s: string) => s,
  validator:  () => (x: unknown) => x,
  getExtensionContext: () => ({}),
};
