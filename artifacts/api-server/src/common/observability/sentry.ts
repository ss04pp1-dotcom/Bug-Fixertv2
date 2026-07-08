/**
 * Sentry hook — minimal, DSN-driven, no hard dependency at module load.
 * Set SENTRY_DSN env to enable; otherwise all calls become no-ops.
 *
 * To install: `pnpm add @sentry/node` in artifacts/api-server, then this
 * file lazily requires it. Absent the package it stays silent.
 */

let sentry: any | undefined;
let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require('@sentry/node');
    sentry.init({
      dsn,
      environment: process.env['NODE_ENV'] ?? 'development',
      release: process.env['RELEASE_SHA'] ?? undefined,
      tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),
    });
  } catch {
    // @sentry/node not installed — silently disabled
    sentry = undefined;
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!sentry) return;
  try {
    sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* swallow */
  }
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  if (!sentry) return;
  try {
    sentry.captureMessage(message, context ? { extra: context } : undefined);
  } catch {
    /* swallow */
  }
}
