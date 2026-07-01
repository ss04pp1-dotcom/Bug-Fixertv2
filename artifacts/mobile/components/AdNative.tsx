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
import { Config } from '@/constants/config';
import { useAuthStore } from '@/lib/auth-store';

interface AdItem {
  id: string;
  name: string;
  imageUrl?: string;
  clickUrl?: string;
  description?: string;
}

async function fetchNativeAd(placement: string): Promise<AdItem | null> {
  try {
    const res = await fetch(
      `${Config.API_BASE}/advertisements/placements/public?slug=${encodeURIComponent(placement)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : data?.data ?? [];
    const pl = items.find((p: any) => p.slug === placement || p.name);
    if (!pl) return null;
    const ads: any[] = (pl.advertisements ?? []).filter(
      (a: any) => a.isActive !== false && ['native', 'banner', 'house_ad'].includes(a.type),
    );
    if (ads.length === 0) return null;
    const pick = ads[Math.floor(Math.random() * ads.length)];
    return {
      id: pick.id,
      name: pick.title || pick.name || '',
      imageUrl: pick.imageUrl || pick.bannerUrl || pick.thumbnailUrl || '',
      clickUrl: pick.targetUrl || pick.clickUrl || pick.destinationUrl || '',
      description: pick.description || pick.subtitle || '',
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

interface AdNativeProps {
  placement: string;
  style?: object;
}

export function AdNative({ placement, style }: AdNativeProps) {
  const [ad, setAd] = useState<AdItem | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const impressionTracked = useRef(false);
  const { user } = useAuthStore();
  const isPremium = !!user && user.plan?.toLowerCase() !== 'free';

  useEffect(() => {
    if (isPremium) return;
    fetchNativeAd(placement).then(setAd);
  }, [placement, isPremium]);

  useEffect(() => {
    if (ad && !impressionTracked.current) {
      impressionTracked.current = true;
      trackEvent(ad.id, 'impression', placement);
    }
  }, [ad, placement]);

  // Premium users see no ads — placed after all hooks to respect Rules of Hooks
  if (isPremium) return null;

  if (!ad || dismissed) return null;

  const handlePress = () => {
    trackEvent(ad.id, 'click', placement);
    if (ad.clickUrl) Linking.openURL(ad.clickUrl).catch(() => {});
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      activeOpacity={0.85}
      onPress={handlePress}
    >
      {ad.imageUrl ? (
        <Image
          source={{ uri: Config.imageUrl(ad.imageUrl) }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.thumbnailFallback}>
          <Ionicons name="megaphone-outline" size={20} color="#6B7280" />
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>Sponsored</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{ad.name}</Text>
        {!!ad.description && (
          <Text style={styles.description} numberOfLines={1}>{ad.description}</Text>
        )}
      </View>

      <TouchableOpacity
        onPress={() => setDismissed(true)}
        style={styles.dismissBtn}
        hitSlop={8}
      >
        <Ionicons name="close" size={12} color="#6B7280" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121A2F',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 24,
    marginVertical: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    flexShrink: 0,
  },
  thumbnailFallback: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#1C1C2A',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  adBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124,58,237,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F2F2F7',
    lineHeight: 18,
  },
  description: {
    fontSize: 11,
    color: '#6B7280',
  },
  dismissBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
});
