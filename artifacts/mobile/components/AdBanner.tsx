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
  /** Optional raw HTML/JS code from Adsterra or Monetag — rendered in a WebView. */
  htmlCode?: string;
  /** Height for the WebView banner. Default: 90. */
  bannerHeight?: number;
  style?: object;
}

/**
 * Wraps raw ad HTML/JS into a full-page document optimised for WebView:
 * - Resets margin/padding, hides scrollbars, transparent background.
 * - Disables user-select so taps don't accidentally highlight text.
 */
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

async function fetchAd(placement: string): Promise<AdItem | null> {
  try {
    const res = await fetch(
      `${Config.API_BASE}/advertisements/placements/public?slug=${encodeURIComponent(placement)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : data?.data ?? [];
    const placement_item = items.find((p: any) => p.slug === placement || p.name === placement) ?? items[0];
    if (!placement_item) return null;

    const ads: any[] = Array.isArray(placement_item.advertisements)
      ? placement_item.advertisements
      : [];
    const active = ads.filter((a: any) => a.isActive !== false);
    if (active.length === 0) return null;

    const pick = active[Math.floor(Math.random() * active.length)];
    return {
      id: pick.id,
      name: pick.title || pick.name || '',
      imageUrl: pick.imageUrl || pick.bannerUrl || '',
      clickUrl: pick.targetUrl || pick.clickUrl || pick.destinationUrl || '',
      type: pick.type || 'house_ad',
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
  } catch {
  }
}

/**
 * Renders a banner ad.
 *
 * Priority order:
 *  1. If `htmlCode` prop is passed directly (per-channel Adsterra/Monetag script) → WebView.
 *  2. If house-ad from API has an `htmlCode` field → WebView.
 *  3. If house-ad has an `imageUrl` → Image tap target.
 *  4. Nothing visible if none of the above resolves.
 */
export function AdBanner({ placement, htmlCode: propHtmlCode, bannerHeight = 90, style }: AdBannerProps) {
  const [ad, setAd] = useState<AdItem | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [imgError, setImgError] = useState(false);
  const impressionTracked = useRef(false);
  const { user } = useAuthStore();
  const isPremium = !!user?.plan && user.plan.toLowerCase() !== 'free';

  useEffect(() => {
    if (isPremium || propHtmlCode) return;
    fetchAd(placement).then(setAd);
  }, [placement, isPremium, propHtmlCode]);

  useEffect(() => {
    if (ad && !impressionTracked.current) {
      impressionTracked.current = true;
      trackEvent(ad.id, 'impression', placement);
    }
  }, [ad, placement]);

  if (isPremium || dismissed) return null;

  const activeHtml = propHtmlCode || ad?.htmlCode;

  if (activeHtml) {
    return (
      <View style={[styles.container, { height: bannerHeight }, style]}>
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

  if (!ad || (ad.imageUrl && imgError)) return null;

  const handlePress = () => {
    trackEvent(ad.id, 'click', placement);
    if (ad.clickUrl) Linking.openURL(ad.clickUrl).catch(() => {});
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>AD</Text>
      </View>
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} style={styles.bannerTouch}>
        {ad.imageUrl ? (
          <Image
            source={{ uri: Config.imageUrl(ad.imageUrl) }}
            style={[styles.bannerImage, { height: bannerHeight }]}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.fallbackBanner, { height: bannerHeight }]}>
            <Ionicons name="megaphone-outline" size={24} color="#6B7280" />
            <Text style={styles.fallbackText}>{ad.name}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.dismissBtn} onPress={() => setDismissed(true)} hitSlop={8}>
        <Ionicons name="close" size={14} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}

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
