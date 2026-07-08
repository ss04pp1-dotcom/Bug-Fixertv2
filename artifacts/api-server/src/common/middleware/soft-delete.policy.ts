import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * SoftDelete Policy — StreamPro Unified Soft Delete Pattern
 * ══════════════════════════════════════════════════════════
 *
 * PROBLEM: The schema uses three overlapping soft-delete signals:
 *   - `deletedAt DateTime?`   — nullable timestamp; null = active, set = deleted
 *   - `isActive Boolean`      — true = active, false = inactive / soft-deleted
 *   - Both fields together    — some models have both (Channel, Movie, Series, …)
 *
 * This inconsistency creates orphan-data risk: a record with deletedAt set but
 * isActive = true (or vice versa) is in an undefined state.
 *
 * RESOLUTION: Follow this rule for ALL service queries going forward:
 *
 * 1. For models with BOTH fields (Channel, Movie, Series, Match, …):
 *    ```ts
 *    where: { isActive: true, deletedAt: null }
 *    ```
 *    On soft-delete: set BOTH → `isActive: false, deletedAt: new Date()`
 *
 * 2. For models with ONLY deletedAt (Category, …):
 *    ```ts
 *    where: { deletedAt: null }
 *    ```
 *
 * 3. For models with ONLY isActive (Season, Episode, SubscriptionPlan, …):
 *    ```ts
 *    where: { isActive: true }
 *    ```
 *
 * 4. GDPR right-to-delete: when a User is deleted, Cascade FK rules handle
 *    child records. For content records the user created (channels etc.) owned
 *    by admin, only anonymise (set userId = null) rather than cascading delete.
 *
 * MIGRATION PATH: A future migration can normalise to a single strategy but
 * that requires careful backfill. Until then, use this guidance consistently.
 *
 * This file is a documentation placeholder — no runtime behaviour.
 * See: https://www.notion.so/streampro/soft-delete-policy (internal)
 */
@Injectable()
export class SoftDeleteDocumentation implements NestMiddleware {
  // This middleware is intentionally a no-op. It exists only to surface
  // the soft-delete policy as a discoverable, importable TypeScript file.
  use(_req: Request, _res: Response, next: NextFunction): void {
    next();
  }
}

/**
 * Shared soft-delete filter helpers — import these in services instead of
 * duplicating `{ isActive: true, deletedAt: null }` everywhere.
 */

/** For models with BOTH isActive and deletedAt */
export const ACTIVE_FILTER = { isActive: true, deletedAt: null } as const;

/** For models with ONLY deletedAt (e.g. Category) */
export const NOT_DELETED_FILTER = { deletedAt: null } as const;

/** For models with ONLY isActive (e.g. Season, Episode) */
export const IS_ACTIVE_FILTER = { isActive: true } as const;

/** Build a soft-delete payload: marks both signals consistently */
export function softDeletePayload(): { isActive: false; deletedAt: Date } {
  return { isActive: false, deletedAt: new Date() };
}

/** Build a restore payload: clears both signals */
export function restorePayload(): { isActive: true; deletedAt: null } {
  return { isActive: true, deletedAt: null };
}
