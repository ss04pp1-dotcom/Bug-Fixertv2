import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Config } from '@/constants/config';
import { admobAvailable, BannerAd, BannerAdSize, TestIds } from '@/lib/admob';
import { appLovinAvailable, MaxAdView, AdFormat, AdViewPosition, initAppLovin } from '@/lib/applovin';
import { useAdConfig, isAdMobActive, isAppLovinActive } from '@/hooks/useAdConfig';
import Constants from 'expo-constants';

const { width: W } = Dimensions.get('window');

interface AdItem {
  id: string;
  name: string;
  imageUrl?: string;
  clickUrl?: string;
  type: string;
}

interface AdBannerProps {
  placement: string;
  style?: object;
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
    const placement_item = items.find((p: any) => p.slug === placement || p.name);
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

/** Real Google AdMob banner — only rendered in a custom dev/production build. */
function AdMobBanner({ unitId, testMode, style }: { unitId: string; testMode: boolean; style?: object }) {
  const [failed, setFailed] = useState(false);
  if (!admobAvailable || !BannerAd || !BannerAdSize || failed) return null;

  const resolvedUnitId = testMode ? TestIds.BANNER : unitId;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>AD</Text>
      </View>
      <BannerAd
        unitId={resolvedUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

/** Real AppLovin MAX banner — only rendered in a custom dev/production build. */
function AppLovinBanner({ unitId, style }: { unitId: string; style?: object }) {
  const [failed, setFailed] = useState(false);
  const sdkKey = (Constants.expoConfig?.extra as any)?.applovinSdkKey;
  useEffect(() => {
    initAppLovin(sdkKey);
  }, [sdkKey]);
  if (!appLovinAvailable || !MaxAdView || failed) return null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>AD</Text>
      </View>
      <MaxAdView
        adUnitId={unitId}
        adFormat={AdFormat?.BANNER}
        adViewPosition={AdViewPosition?.CENTERED}
        style={{ width: '100%', height: 90 }}
        onAdLoadFailed={() => setFailed(true)}
      />
    </View>
  );
}

export function AdBanner({ placement, style }: AdBannerProps) {
  const [ad, setAd] = useState<AdItem | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [imgError, setImgError] = useState(false);
  const impressionTracked = useRef(false);
  const { data: adConfig } = useAdConfig();

  const admobActive = isAdMobActive(adConfig);
  const applovinActive = isAppLovinActive(adConfig);
  const bannerUnitId = adConfig?.activeProvider?.adUnits?.banner;
  const useRealAdMob = admobActive && admobAvailable && !!bannerUnitId;
  const useRealAppLovin = applovinActive && appLovinAvailable && !!bannerUnitId;

  useEffect(() => {
    // House-ad fallback only needs to fetch when we're not using a real network banner.
    if (useRealAdMob || useRealAppLovin) return;
    fetchAd(placement).then(setAd);
  }, [placement, useRealAdMob, useRealAppLovin]);

  useEffect(() => {
    if (ad && !impressionTracked.current) {
      impressionTracked.current = true;
      trackEvent(ad.id, 'impression', placement);
    }
  }, [ad, placement]);

  if (useRealAdMob) {
    return (
      <AdMobBanner
        unitId={bannerUnitId as string}
        testMode={!!adConfig?.activeProvider?.isTestMode}
        style={style}
      />
    );
  }

  if (useRealAppLovin) {
    return <AppLovinBanner unitId={bannerUnitId as string} style={style} />;
  }

  if (!ad || dismissed || (ad.imageUrl && imgError)) return null;

  const handlePress = () => {
    trackEvent(ad.id, 'click', placement);
    if (ad.clickUrl) {
      Linking.openURL(ad.clickUrl).catch(() => {});
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>AD</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={styles.bannerTouch}
      >
        {ad.imageUrl ? (
          <Image
            source={{ uri: Config.imageUrl(ad.imageUrl) }}
            style={styles.bannerImage}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.fallbackBanner}>
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
