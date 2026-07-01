/**
 * Jest manual mock for @prisma/client.
 *
 * The generated Prisma client is not available in the test environment.
 * This file provides:
 *   • A minimal PrismaClient stub so PrismaService can extend it safely.
 *   • Prisma error classes used with `instanceof` in the exception filter.
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

// ─── Enums ────────────────────────────────────────────────────────────────────

export const UserRole = {
  user:        'user',
  admin:       'admin',
  super_admin: 'super_admin',
  moderator:   'moderator',
} as const;

/** Alias — some services import Role, others import UserRole */
export const Role = UserRole;

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

export const DownloadStatus = {
  pending:     'pending',
  downloading: 'downloading',
  completed:   'completed',
  failed:      'failed',
  paused:      'paused',
  cancelled:   'cancelled',
} as const;

// ─── Prisma error classes (used by exception filter with `instanceof`) ─────────

class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: Record<string, unknown>;
  clientVersion: string;
  constructor(
    message: string,
    { code, clientVersion, meta }: { code: string; clientVersion: string; meta?: Record<string, unknown> },
  ) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.clientVersion = clientVersion;
    this.meta = meta;
  }
}

class PrismaClientValidationError extends Error {
  clientVersion: string;
  constructor(message: string, opts: { clientVersion: string }) {
    super(message);
    this.name = 'PrismaClientValidationError';
    this.clientVersion = opts.clientVersion;
  }
}

class PrismaClientInitializationError extends Error {
  clientVersion: string;
  constructor(message: string, opts: { clientVersion: string }) {
    super(message);
    this.name = 'PrismaClientInitializationError';
    this.clientVersion = opts.clientVersion;
  }
}

// ─── Prisma namespace ─────────────────────────────────────────────────────────

export const Prisma = {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientInitializationError,

  DbNull:  'DbNull',
  JsonNull: 'JsonNull',
  AnyNull:  'AnyNull',

  sql:                (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  join:               (values: unknown[]) => values,
  raw:                (s: string) => s,
  validator:          () => (x: unknown) => x,
  getExtensionContext: () => ({}),
};
