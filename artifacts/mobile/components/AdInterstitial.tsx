import React, { useEffect, useRef, useState } from 'react';
import { openExternalUrl } from '@/lib/safeLink';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Config } from '@/constants/config';
import { useAuthStore } from '@/lib/auth-store';

const { width: W, height: H } = Dimensions.get('window');

interface AdItem {
  id: string;
  name: string;
  imageUrl?: string;
  clickUrl?: string;
}

async function fetchInterstitialAd(placement: string): Promise<AdItem | null> {
  try {
    const res = await fetch(
      `${Config.API_BASE}/advertisements/placements/public?slug=${encodeURIComponent(placement)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : data?.data ?? [];
    const pl = items.find((p: any) => p.slug === placement || p.name === placement) ?? items[0];
    if (!pl) return null;
    const ads: any[] = (pl.advertisements ?? []).filter(
      (a: any) => a.isActive !== false && ['interstitial', 'popup', 'app_open', 'splash'].includes(a.type),
    );
    if (ads.length === 0) return null;
    const pick = ads[Math.floor(Math.random() * ads.length)];
    return {
      id: pick.id,
      name: pick.title || pick.name || '',
      imageUrl: pick.imageUrl || pick.bannerUrl || '',
      clickUrl: pick.targetUrl || pick.clickUrl || pick.destinationUrl || '',
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

interface AdInterstitialProps {
  placement: string;
  visible: boolean;
  onClose: () => void;
  /** Seconds before the skip/close button appears. Default: 5 */
  skipAfterSeconds?: number;
}

// Track whether ad fetch has resolved (null = no ad available)
type FetchState = 'idle' | 'loading' | 'ready' | 'empty';

export function AdInterstitial({ placement, visible, onClose, skipAfterSeconds = 5 }: AdInterstitialProps) {
  const [ad, setAd] = useState<AdItem | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [countdown, setCountdown] = useState(skipAfterSeconds);
  const impressionTracked = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuthStore();
  const isPremium = !!user?.plan && user.plan.toLowerCase() !== 'free';

  // Premium users are never shown interstitials — close immediately so
  // navigation is never blocked.
  useEffect(() => {
    if (isPremium && visible) onClose();
  }, [isPremium, visible, onClose]);

  useEffect(() => {
    if (isPremium) return;
    if (visible) {
      setFetchState('loading');
      impressionTracked.current = false;
      fetchInterstitialAd(placement).then(result => {
        setAd(result);
        setFetchState(result ? 'ready' : 'empty');
      });
    } else {
      setAd(null);
      setFetchState('idle');
    }
  }, [visible, placement, isPremium]);

  // Auto-close if no house ad is available so navigation proceeds.
  useEffect(() => {
    if (visible && fetchState === 'empty') onClose();
  }, [visible, fetchState, onClose]);

  useEffect(() => {
    if (visible && ad && !impressionTracked.current) {
      impressionTracked.current = true;
      trackEvent(ad.id, 'impression', placement);
    }
  }, [ad, visible, placement]);

  useEffect(() => {
    if (fetchState !== 'ready') return;
    setCountdown(skipAfterSeconds);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchState, skipAfterSeconds]);

  if (isPremium) return null;
  if (!visible || fetchState !== 'ready' || !ad) return null;

  const handlePress = () => {
    trackEvent(ad.id, 'click', placement);
    if (ad.clickUrl) openExternalUrl(ad.clickUrl);
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Text style={styles.adLabel}>AD</Text>
            <TouchableOpacity
              onPress={onClose}
              disabled={countdown > 0}
              style={[styles.closeBtn, countdown > 0 && styles.closeBtnDisabled]}
              hitSlop={8}
            >
              {countdown > 0 ? (
                <Text style={styles.countdownText}>{countdown}</Text>
              ) : (
                <Ionicons name="close" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={styles.imageWrapper}>
            {ad.imageUrl ? (
              <Image source={{ uri: Config.imageUrl(ad.imageUrl) }} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={styles.fallback}>
                <Ionicons name="megaphone-outline" size={40} color="#6B7280" />
                <Text style={styles.fallbackText}>{ad.name}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.ctaBtn} onPress={handlePress} activeOpacity={0.85}>
            <Text style={styles.ctaBtnText}>Learn More</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#121A2F',
    borderRadius: 20,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  adLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  countdownText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  imageWrapper: {
    width: '100%',
  },
  image: {
    width: '100%',
    height: H * 0.4,
  },
  fallback: {
    width: '100%',
    height: H * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1C1C2A',
  },
  fallbackText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  ctaBtn: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
