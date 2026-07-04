/**
 * AdBanner — Global Config-Aware Banner Component
 *
 * Priority for banner HTML:
 *   1. `htmlCode` prop (passed directly by caller, e.g. channel-grid)
 *   2. Global ad config's `banner.htmlCode` (Adsterra / Monetag global script)
 *   3. House ad fetched from API (image or HTML)
 *
 * Visibility rules (all must pass):
 *   a. User is NOT premium
 *   b. globalConfig.isEnabled === true
 *   c. globalConfig.banner.enabled === true
 *   d. If placement maps to a position key → that position is enabled in global config
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Config } from '@/constants/config';
import { useAuthStore } from '@/lib/auth-store';
import { useGlobalAdConfig } from '@/hooks/useGlobalAdConfig';

// ─── Placement → banner position key mapping ──────────────────────────────────

const PLACEMENT_TO_POSITION: Record<string, string> = {
  'home-banner':            'home',
  'home_banner':            'home',
  'browse-banner':          'categories',
  'browse_banner':          'categories',
  'channel-grid-banner':    'channelGrid',
  'channel_grid_banner':    'channelGrid',
  'player_banner':          'player',
  'channel_banner':         'player',
  'movies_banner':          'movies',
  'movies-banner':          'movies',
  'live_banner':            'sports',
  'sports-banner':          'sports',
  'sports_banner':          'sports',
  'search_banner':          'search',
  'search-banner':          'search',
  'series_episodes_banner': 'movies',
  'series-banner':          'movies',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdItem {
  id: string;
  name: string;
  imageUrl?: string;
  clickUrl?: string;
  htmlCode?: string;
  type: string;
}

interface AdBannerProps {
  placement: string;
  /** Override HTML — if provided, skips global config check for HTML (but still applies enabled/position checks). */
  htmlCode?: string;
  /** Override banner height. Falls back to global config's `banner.height` or 90px. */
  bannerHeight?: number;
  style?: object;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wrapHtml(script: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;background:transparent;-webkit-user-select:none;user-select:none;}
</style>
</head>
<body>${script}</body>
</html>`;
}

async function fetchHouseAd(placement: string): Promise<AdItem | null> {
  try {
    const res = await fetch(
      `${Config.API_BASE}/advertisements/placements/public?slug=${encodeURIComponent(placement)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : data?.data ?? [];
    const placementItem = items.find((p: any) => p.slug === placement || p.name === placement) ?? items[0];
    if (!placementItem) return null;
    const ads: any[] = Array.isArray(placementItem.advertisements) ? placementItem.advertisements : [];
    const active = ads.filter((a: any) => a.isActive !== false);
    if (active.length === 0) return null;
    const pick = active[Math.floor(Math.random() * active.length)];
    return {
      id:       pick.id,
      name:     pick.title || pick.name || '',
      imageUrl: pick.imageUrl || pick.bannerUrl || '',
      clickUrl: pick.targetUrl || pick.clickUrl || pick.destinationUrl || '',
      htmlCode: pick.htmlCode || '',
      type:     pick.type || 'house_ad',
    };
  } catch {
    return null;
  }
}

async function trackEvent(adId: string, event: 'impression' | 'click', placement: string) {
  try {
    await fetch(`${Config.API_BASE}/advertisements/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId, eventType: event, placement }),
    });
  } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdBanner({ placement, htmlCode: propHtmlCode, bannerHeight, style }: AdBannerProps) {
  const [houseAd, setHouseAd]   = useState<AdItem | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [imgError, setImgError]   = useState(false);
  const impressionTracked         = useRef(false);

  const { user }    = useAuthStore();
  const rawIsPremium = !!user?.plan && user.plan.toLowerCase() !== 'free';
  const globalConfig = useGlobalAdConfig();

  // Test Mode: bypass premium check so admins can verify ads work in real devices.
  const isPremium = rawIsPremium && !globalConfig.testMode;

  // ── Visibility checks ──────────────────────────────────────────────────────
  const isGlobalEnabled = globalConfig.isEnabled && globalConfig.banner.enabled;
  const posKey = PLACEMENT_TO_POSITION[placement];
  const isPositionEnabled = posKey
    ? !!(globalConfig.banner.positions as any)[posKey]
    : true; // Unknown placement → allow by default

  // Effective height
  const effectiveHeight = bannerHeight ?? globalConfig.banner.height ?? 90;

  // Resolved HTML source (prop → global config → house ad)
  const globalHtml = globalConfig.banner.htmlCode?.trim() || '';
  const houseHtml  = houseAd?.htmlCode?.trim() || '';
  const activeHtml = propHtmlCode?.trim() || globalHtml || houseHtml || '';

  // ── Fetch house ad only when needed ───────────────────────────────────────
  useEffect(() => {
    // Don't fetch if: premium, disabled, hidden position, or we already have HTML
    if (isPremium || !isGlobalEnabled || !isPositionEnabled || dismissed) return;
    if (propHtmlCode || globalHtml) return; // Global/prop HTML takes priority — skip fetch

    let cancelled = false;
    fetchHouseAd(placement)
      .then((ad) => { if (!cancelled) setHouseAd(ad); })
      .catch((e: any) => { console.warn('[AdBanner] fetchHouseAd failed:', e?.message ?? e); });
    return () => { cancelled = true; };
  }, [placement, isPremium, isGlobalEnabled, isPositionEnabled, dismissed, propHtmlCode, globalHtml]);

  // ── Impression tracking ───────────────────────────────────────────────────
  // Reset tracked flag when the ad itself changes so a new ad always fires an impression.
  useEffect(() => {
    impressionTracked.current = false;
  }, [houseAd?.id]);

  useEffect(() => {
    if (houseAd && !impressionTracked.current) {
      impressionTracked.current = true;
      trackEvent(houseAd.id, 'impression', placement);
    }
  }, [houseAd, placement]);

  // ── Gate checks ───────────────────────────────────────────────────────────
  // DEBUG — only in dev builds (Metro / Expo Go)
  if (__DEV__) console.log(
    `[AdBanner][${placement}]`,
    'isPremium:', isPremium,
    '| rawIsPremium:', rawIsPremium,
    '| testMode:', globalConfig.testMode,
    '| isGlobalEnabled:', isGlobalEnabled,
    '(isEnabled:', globalConfig.isEnabled, 'banner.enabled:', globalConfig.banner.enabled, ')',
    '| posKey:', posKey,
    '| isPositionEnabled:', isPositionEnabled,
    '| dismissed:', dismissed,
    '| activeHtml len:', activeHtml.length,
    '| houseAd:', houseAd?.id ?? 'null',
  );

  if (isPremium || dismissed) return null;
  if (!isGlobalEnabled || !isPositionEnabled) return null;

  // ── Render WebView banner ─────────────────────────────────────────────────
  if (activeHtml) {
    return (
      <View style={[styles.container, { height: effectiveHeight }, style]}>
        <View style={styles.adLabel}>
          <Text style={styles.adLabelText}>AD</Text>
        </View>
        <WebView
          source={{ html: wrapHtml(activeHtml) }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          scrollEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          cacheEnabled={false}
          originWhitelist={['*']}
        />
        <TouchableOpacity style={styles.dismissBtn} onPress={() => setDismissed(true)} hitSlop={8}>
          <Ionicons name="close" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render image banner (house ad) ────────────────────────────────────────
  if (!houseAd || (houseAd.imageUrl && imgError)) return null;

  const handlePress = () => {
    trackEvent(houseAd.id, 'click', placement);
    if (houseAd.clickUrl) Linking.openURL(houseAd.clickUrl).catch(() => {});
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>AD</Text>
      </View>
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} style={styles.bannerTouch}>
        {houseAd.imageUrl ? (
          <Image
            source={{ uri: Config.imageUrl(houseAd.imageUrl) }}
            style={[styles.bannerImage, { height: effectiveHeight }]}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.fallbackBanner, { height: effectiveHeight }]}>
            <Ionicons name="megaphone-outline" size={24} color="#6B7280" />
            <Text style={styles.fallbackText}>{houseAd.name}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.dismissBtn} onPress={() => setDismissed(true)} hitSlop={8}>
        <Ionicons name="close" size={14} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 24,
    marginVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#13131C',
    position: 'relative',
  },
  adLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  bannerTouch: {
    width: '100%',
  },
  bannerImage: {
    width: '100%',
    height: 90,
  },
  fallbackBanner: {
    width: '100%',
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1C1C2A',
  },
  fallbackText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
