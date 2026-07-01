import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory cache service with TTL support.
 * Interface is designed to be Redis-compatible — swap implementation for Redis
 * by implementing the same get/set/del/flush interface with ioredis.
 *
 * Keys prefixed by module (e.g. "categories:list", "settings:app_config").
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private cleanupTimer?: NodeJS.Timeout;

  onModuleInit() {
    // A-027: This is a single-process in-memory cache backed by a plain Map. It does NOT
    // scale horizontally: in a multi-instance deployment each pod maintains its own cache,
    // so writes performed on instance A are invisible to instance B (stale reads, cache
    // stampedes, duplicate work). For production, swap this implementation for Redis
    // (ioredis) using the same get/set/del/delByPrefix/flush/getOrSet interface.
    if (process.env.REDIS_URL) {
      this.logger.warn(
        'REDIS_URL is set but the in-memory CacheService is being used — ' +
          'cache will not be shared across instances. Migrate CacheService to Redis for production.',
      );
    }
    this.cleanupTimer = setInterval(() => {
      const removed = this.cleanup();
      if (removed > 0) this.logger.debug(`Cache cleanup: removed ${removed} expired entries`);
    }, 5 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs = 60_000): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delByPrefix(prefix: string): Promise<number> {
    let removed = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  async flush(): Promise<void> {
    this.store.clear();
    this.logger.log('Cache flushed');
  }

  /**
   * Get from cache or execute fn, cache result, return value.
   * Drop-in replacement for Redis getOrSet pattern.
   */
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttlMs = 60_000): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fn();
    await this.set(key, value, ttlMs);
    return value;
  }

  /** Returns cache size (approximate, includes not-yet-expired entries) */
  size(): number {
    return this.store.size;
  }

  private cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }
}
