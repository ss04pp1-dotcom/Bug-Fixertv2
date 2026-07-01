import { Injectable, Logger } from '@nestjs/common';

export interface PresenceEntry {
  socketId:       string;
  userId:         string;
  displayName:    string;
  email:          string;
  avatarUrl?:     string;
  role:           string;
  deviceType:     'android' | 'ios' | 'web' | 'unknown';
  appVersion?:    string;
  platform?:      string;
  ipAddress?:     string;
  connectedAt:    Date;
  lastActivityAt: Date;
  currentScreen?: string;
  watchingType?:  'live' | 'movie' | 'series';
  watchingId?:    string;
  watchingTitle?: string;
}

export interface PresenceStats {
  totalOnline:     number;
  watchingLive:    number;
  watchingMovies:  number;
  watchingSeries:  number;
  totalDevices:    number;
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly HEARTBEAT_TIMEOUT_MS = 90_000; // 90s — mark offline

  /** socketId → PresenceEntry */
  private readonly store = new Map<string, PresenceEntry>();
  /** socketId → heartbeat kill-timer */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  // ── Write ──────────────────────────────────────────────────────────────────

  add(entry: PresenceEntry): void {
    this.store.set(entry.socketId, entry);
    this.resetTimer(entry.socketId);
    this.logger.log(`[+] ${entry.displayName} (${entry.deviceType}) | Online: ${this.store.size}`);
  }

  update(socketId: string, patch: Partial<Omit<PresenceEntry, 'socketId' | 'userId'>>): PresenceEntry | null {
    const existing = this.store.get(socketId);
    if (!existing) return null;
    const updated: PresenceEntry = { ...existing, ...patch, lastActivityAt: new Date() };
    this.store.set(socketId, updated);
    this.resetTimer(socketId);
    return updated;
  }

  remove(socketId: string): PresenceEntry | null {
    const entry = this.store.get(socketId) ?? null;
    this.store.delete(socketId);
    this.clearTimer(socketId);
    if (entry) {
      this.logger.log(`[-] ${entry.displayName} disconnected | Online: ${this.store.size}`);
    }
    return entry;
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  getAll(): PresenceEntry[] {
    return Array.from(this.store.values());
  }

  getOnlineCount(): number {
    return this.store.size;
  }

  getStats(): PresenceStats {
    const all = this.getAll();
    return {
      totalOnline:    all.length,
      watchingLive:   all.filter(e => e.watchingType === 'live').length,
      watchingMovies: all.filter(e => e.watchingType === 'movie').length,
      watchingSeries: all.filter(e => e.watchingType === 'series').length,
      totalDevices:   all.length,
    };
  }

  // ── Heartbeat timer ────────────────────────────────────────────────────────

  private resetTimer(socketId: string): void {
    this.clearTimer(socketId);
    const t = setTimeout(() => {
      const entry = this.remove(socketId);
      if (entry) {
        this.logger.warn(`Heartbeat timeout — ${entry.displayName} (${socketId})`);
        // Callers listen via onTimeout callback
        this.timeoutCallbacks.forEach(cb => cb(socketId, entry));
      }
    }, this.HEARTBEAT_TIMEOUT_MS);
    this.timers.set(socketId, t);
  }

  private clearTimer(socketId: string): void {
    const t = this.timers.get(socketId);
    if (t) { clearTimeout(t); this.timers.delete(socketId); }
  }

  // Allow gateway to register a callback for heartbeat timeouts
  private readonly timeoutCallbacks: Array<(socketId: string, entry: PresenceEntry) => void> = [];
  onHeartbeatTimeout(cb: (socketId: string, entry: PresenceEntry) => void): void {
    this.timeoutCallbacks.push(cb);
  }
}
