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
    /** Optional second ad unit rendered below the first (e.g. HilTop, another network script). */
    secondHtmlCode: string;
    /** Optional inline VAST/video URL rendered as a WebView video player below HTML banners. */
    vastUrl: string;
    /** Height of the inline VAST video unit in pixels. Default 250. */
    vastHeight: number;
    /** Seconds before the inline VAST unit can be skipped. Default 5. */
    vastSkipSec: number;
    /** Default height for all banner slots (px). Per-slot overrides live in `heights`. */
    height: number;
    /**
     * Per-placement height overrides (px). Keys match the position keys in `positions`
     * (e.g. "home", "player", "movies"). When present, this value takes priority over
     * `height` for that specific slot. Omitted keys fall back to the global `height`.
     */
    heights: Partial<Record<string, number>>;
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
    secondHtmlCode: '',
    vastUrl: '',
    vastHeight: 250,
    vastSkipSec: 5,
    height: 90,
    heights: {},
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
      heights: {
        ...DEFAULT_GLOBAL_AD_CONFIG.banner.heights,
        ...(raw.banner?.heights ?? {}),
      },
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
  const url = `${Config.API_BASE}/ads/config`;
  if (__DEV__) console.log('[AdEngine] Fetching config from:', url);
  try {
    // Render.com's free tier can take 20-50s to wake a cold instance. A plain
    // 10s AbortSignal.timeout() was killing the very first request on a cold
    // start every time, so we manually build an AbortController with a much
    // longer 30s budget. We also guard against AbortSignal.timeout not being
    // available at all on some Hermes/RN engine builds (it silently throws a
    // TypeError there, which — unlike a timeout — is NOT caught by fetch and
    // was skipping the request entirely on every single retry).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (__DEV__) console.log('[AdEngine] HTTP status:', res.status);
    if (res.ok) {
      const json = await res.json();
      const raw: Partial<GlobalAdConfig> | null =
        json?.data?.globalConfig ??
        json?.globalConfig ??
        null;

      // `adsEnabled` is the top-level master toggle stored separately in AdSetting.isEnabled.
      // It controls the whole ad system independently of the globalConfig JSON blob.
      // Read it and fold it into the merged config so the mobile always respects the
      // admin's master on/off switch even when globalConfig has never been explicitly saved.
      const adsEnabled: boolean | null =
        json?.data?.adsEnabled ??
        json?.adsEnabled ??
        null;

      if (__DEV__) console.log('[AdEngine] adsEnabled:', adsEnabled,
        '| banner.enabled:', raw?.banner?.enabled,
        '| smartlink.enabled:', raw?.smartlink?.enabled,
        '| vast.enabled:', raw?.vast?.enabled,
        '| testMode:', raw?.testMode);

      const base: Partial<GlobalAdConfig> = raw && typeof raw === 'object' ? { ...raw } : {};

      // Override isEnabled with the server-side master toggle when present
      if (typeof adsEnabled === 'boolean') {
        base.isEnabled = adsEnabled;
        // If ads are enabled server-side but banner.enabled was never explicitly saved
        // in globalConfig (undefined or null, not false), default banner.enabled to true
        // so house ads and HTML banners can be displayed.
        // We must NOT override an explicit false — admin may want ads on but banner off.
        if (adsEnabled && raw?.banner?.enabled == null) {
          base.banner = {
            ...DEFAULT_GLOBAL_AD_CONFIG.banner,
            ...(raw?.banner ?? {}),
            enabled: true,
          };
        }
      }

      _cachedConfig = mergeWithDefaults(base);
      _configFetchedAt = now;
      if (__DEV__) console.log('[AdEngine] Config loaded ✓ isEnabled:', _cachedConfig.isEnabled,
        '| banner:', _cachedConfig.banner.enabled,
        '| smartlink:', _cachedConfig.smartlink.enabled,
        '| vast:', _cachedConfig.vast.enabled);
      // Persist for offline use
      try {
        await AsyncStorage.setItem(KEY_CONFIG_CACHE, JSON.stringify({ config: _cachedConfig, ts: now }));
      } catch {}
      return _cachedConfig;
    } else {
      if (__DEV__) console.warn('[AdEngine] Bad HTTP status, falling back to cache');
    }
  } catch (err: any) {
    if (__DEV__) console.warn('[AdEngine] Fetch failed:', err?.message ?? err, '— falling back to cache');
  }

  // Try AsyncStorage cache
  try {
    const cached = await AsyncStorage.getItem(KEY_CONFIG_CACHE);
    if (cached) {
      const { config } = JSON.parse(cached);
      _cachedConfig = mergeWithDefaults(config);
      if (__DEV__) console.log('[AdEngine] Loaded from AsyncStorage cache');
    } else {
      if (__DEV__) console.warn('[AdEngine] No cache — using DEFAULT (all ads OFF)');
    }
  } catch {}

  return _cachedConfig;
}

/** Force next call to re-fetch from API (e.g. after admin changes config). */
export function invalidateGlobalAdConfig() {
  _configFetchedAt = 0;
}

/**
 * Returns true once a successful network fetch has populated the config.
 * Used by useGlobalAdConfig to know whether to keep retrying.
 */
export function isConfigLoaded(): boolean {
  return _configFetchedAt > 0;
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

/**
 * Resets the persistent channel-switch counter (e.g. "reset ad counter"
 * option in a debug/settings screen, or after login/logout). Exposed because
 * the counter previously had no way to be cleared short of reinstalling the
 * app, which made testing new smartlink/VAST frequency values from the admin
 * panel confusing — the cycle position carried over from whatever frequency
 * was in effect before.
 */
export async function resetSwitchCounter(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY_SWITCH_COUNT, KEY_LAST_SMARTLINK]);
  } catch {}
}

// ─── Debug introspection ───────────────────────────────────────────────────────

export interface AdEngineDebugState {
  switchCount: number;
  lastSmartlinkTs: number | null;
  configLoaded: boolean;
  configFetchedAt: number | null;
  config: GlobalAdConfig;
  slFreq: number;
  vaFreq: number;
  cycleLen: number;
  posInCycle: number;
  nextSmartlinkIn: number;
  nextVastIn: number;
}

/**
 * Returns a snapshot of the ad engine's internal state for a debug/QA screen —
 * lets testers see exactly where the persistent switch counter is in the
 * smartlink/VAST cycle without having to read AsyncStorage manually.
 */
export async function getAdEngineDebugState(): Promise<AdEngineDebugState> {
  const [switchCount, lastTs] = await Promise.all([
    getSwitchCount(),
    AsyncStorage.getItem(KEY_LAST_SMARTLINK).catch(() => null),
  ]);

  const config = _cachedConfig;
  const slFreq = Math.max(1, config.smartlink.frequency);
  const vaFreq = Math.max(1, config.vast.frequency);
  const cycleLen = slFreq + vaFreq;
  const posInCycle = switchCount % cycleLen;

  const nextSmartlinkIn = posInCycle < slFreq
    ? slFreq - posInCycle
    : cycleLen - posInCycle + slFreq;
  const nextVastIn = cycleLen - posInCycle === cycleLen ? cycleLen : cycleLen - posInCycle;

  return {
    switchCount,
    lastSmartlinkTs: lastTs ? parseInt(lastTs, 10) : null,
    configLoaded: isConfigLoaded(),
    configFetchedAt: _configFetchedAt > 0 ? _configFetchedAt : null,
    config,
    slFreq,
    vaFreq,
    cycleLen,
    posInCycle,
    nextSmartlinkIn,
    nextVastIn,
  };
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
