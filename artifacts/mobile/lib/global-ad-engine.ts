/**
 * Global Ad Engine
 *
 * Replaces per-channel ad config with a single Global Rule Engine that
 * determines which ad to show based on a persistent, app-restart-safe
 * channel-switch counter stored in AsyncStorage.
 *
 * Cycle (defaults smartlink=3, vast=3 → cycle length 6):
 *   Switch 1 → Nothing
 *   Switch 2 → Nothing
 *   Switch 3 → Smartlink
 *   Switch 4 → Nothing
 *   Switch 5 → Nothing
 *   Switch 6 → VAST
 *   Switch 7 → Nothing  …repeat
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '@/constants/config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GlobalAdConfig {
  isEnabled: boolean;
  testMode: boolean;
  smartlink: {
    enabled: boolean;
    url: string;
    frequency: number;        // show smartlink after every N-th switch in cycle
    delaySeconds: number;     // wait this long before opening browser
    cooldownMinutes: number;  // minimum time between consecutive smartlinks
  };
  vast: {
    enabled: boolean;
    url: string;
    skipAfterSeconds: number;
    frequency: number;        // vast fires after smartlink cycle completes, every N more switches
    timeoutSeconds: number;
  };
  banner: {
    enabled: boolean;
    htmlCode: string;
    height: number;
    positions: {
      home: boolean;
      player: boolean;
      playerPosition: 'below' | 'above' | 'floating-bottom' | 'floating-top';
      categories: boolean;
      movies: boolean;
      sports: boolean;
      search: boolean;
      channelGrid: boolean;
      channelGridFrequency: number; // insert a banner row every N channel cards
    };
  };
}

export const DEFAULT_GLOBAL_AD_CONFIG: GlobalAdConfig = {
  isEnabled: true,
  testMode: false,
  smartlink: {
    enabled: false,
    url: '',
    frequency: 3,
    delaySeconds: 0,
    cooldownMinutes: 30,
  },
  vast: {
    enabled: false,
    url: '',
    skipAfterSeconds: 5,
    frequency: 3,
    timeoutSeconds: 10,
  },
  banner: {
    enabled: false,
    htmlCode: '',
    height: 90,
    positions: {
      home: true,
      player: true,
      playerPosition: 'below',
      categories: false,
      movies: true,
      sports: false,
      search: false,
      channelGrid: false,
      channelGridFrequency: 6,
    },
  },
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_SWITCH_COUNT   = 'ad_engine_switch_count';
const KEY_LAST_SMARTLINK = 'ad_engine_last_smartlink_ts';
const KEY_CONFIG_CACHE   = 'ad_engine_config_cache';
const CONFIG_TTL_MS      = 5 * 60 * 1000; // 5 minutes

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _cachedConfig: GlobalAdConfig = DEFAULT_GLOBAL_AD_CONFIG;
let _configFetchedAt = 0;

// ─── Config helpers ───────────────────────────────────────────────────────────

function mergeWithDefaults(raw: Partial<GlobalAdConfig>): GlobalAdConfig {
  return {
    ...DEFAULT_GLOBAL_AD_CONFIG,
    ...raw,
    smartlink: { ...DEFAULT_GLOBAL_AD_CONFIG.smartlink, ...(raw.smartlink ?? {}) },
    vast:      { ...DEFAULT_GLOBAL_AD_CONFIG.vast,      ...(raw.vast      ?? {}) },
    banner: {
      ...DEFAULT_GLOBAL_AD_CONFIG.banner,
      ...(raw.banner ?? {}),
      positions: {
        ...DEFAULT_GLOBAL_AD_CONFIG.banner.positions,
        ...(raw.banner?.positions ?? {}),
      },
    },
  };
}

/**
 * Fetches global ad config from the API (with 5-minute in-memory cache).
 * Falls back to AsyncStorage cache, then to DEFAULT_GLOBAL_AD_CONFIG.
 */
export async function fetchGlobalAdConfig(): Promise<GlobalAdConfig> {
  const now = Date.now();

  // Return in-memory cache if fresh
  if (_configFetchedAt > 0 && now - _configFetchedAt < CONFIG_TTL_MS) {
    return _cachedConfig;
  }

  // Try network
  try {
    const res = await fetch(`${Config.API_BASE}/ads/config`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      const raw =
        json?.data?.globalConfig ??
        json?.globalConfig ??
        null;
      if (raw && typeof raw === 'object') {
        _cachedConfig = mergeWithDefaults(raw as Partial<GlobalAdConfig>);
        _configFetchedAt = now;
        // Persist for offline use
        try {
          await AsyncStorage.setItem(KEY_CONFIG_CACHE, JSON.stringify({ config: _cachedConfig, ts: now }));
        } catch {}
        return _cachedConfig;
      }
    }
  } catch {}

  // Try AsyncStorage cache
  try {
    const cached = await AsyncStorage.getItem(KEY_CONFIG_CACHE);
    if (cached) {
      const { config } = JSON.parse(cached);
      _cachedConfig = mergeWithDefaults(config);
    }
  } catch {}

  return _cachedConfig;
}

/** Force next call to re-fetch from API (e.g. after admin changes config). */
export function invalidateGlobalAdConfig() {
  _configFetchedAt = 0;
}

// ─── Persistent switch counter ────────────────────────────────────────────────

async function getSwitchCount(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(KEY_SWITCH_COUNT);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

async function incrementSwitchCount(): Promise<number> {
  const next = (await getSwitchCount()) + 1;
  try { await AsyncStorage.setItem(KEY_SWITCH_COUNT, String(next)); } catch {}
  return next;
}

// ─── Ad action engine ─────────────────────────────────────────────────────────

export type AdAction = 'smartlink' | 'vast' | null;

/**
 * Call once per channel switch.
 *
 * Increments the persistent counter and returns what ad to show.
 * Smartlink and VAST never fire on the same switch.
 */
export async function recordChannelSwitch(config: GlobalAdConfig): Promise<AdAction> {
  if (!config.isEnabled) return null;

  const slFreq  = Math.max(1, config.smartlink.frequency);
  const vaFreq  = Math.max(1, config.vast.frequency);
  const cycleLen = slFreq + vaFreq;

  const count = await incrementSwitchCount();
  const pos   = count % cycleLen; // pos 0 = end of cycle

  // Smartlink fires when pos === slFreq (1-indexed position in cycle)
  if (pos === slFreq && config.smartlink.enabled && config.smartlink.url) {
    // Cooldown check
    if (config.smartlink.cooldownMinutes > 0) {
      try {
        const lastTs = await AsyncStorage.getItem(KEY_LAST_SMARTLINK);
        if (lastTs) {
          const elapsedMin = (Date.now() - parseInt(lastTs, 10)) / 60_000;
          if (elapsedMin < config.smartlink.cooldownMinutes) return null;
        }
      } catch {}
      try { await AsyncStorage.setItem(KEY_LAST_SMARTLINK, String(Date.now())); } catch {}
    }
    return 'smartlink';
  }

  // VAST fires when cycle completes (pos === 0), never on count===0
  if (pos === 0 && count > 0 && config.vast.enabled && config.vast.url) {
    return 'vast';
  }

  return null;
}

// ─── Analytics tracking ───────────────────────────────────────────────────────

export type AdEventType = 'impression' | 'click' | 'error' | 'session';

export async function trackAdEvent(
  type: AdEventType,
  placement: string,
  extra?: Record<string, unknown>,
) {
  try {
    await fetch(`${Config.API_BASE}/ads/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement, ...extra }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {}
}
