import React, { useEffect, useRef, useState } from 'react';
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

const { width: W, height: H } = Dimensions.get('window');
const REWARD_SECONDS = 10;

interface AdItem {
  id: string;
  name: string;
  imageUrl?: string;
  clickUrl?: string;
}

async function fetchRewardedAd(placement: string): Promise<AdItem | null> {
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
      (a: any) => a.isActive !== false && ['rewarded', 'video', 'interstitial'].includes(a.type),
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

interface AdRewardedProps {
  placement: string;
  visible: boolean;
  onClose: () => void;
  onRewardEarned: () => void;
}

export function AdRewarded({ placement, visible, onClose, onRewardEarned }: AdRewardedProps) {
  const [ad, setAd] = useState<AdItem | null>(null);
  const [countdown, setCountdown] = useState(REWARD_SECONDS);
  const [rewardEarned, setRewardEarned] = useState(false);
  const impressionTracked = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rewardCalledRef = useRef(false);

  useEffect(() => {
    if (visible) {
      fetchRewardedAd(placement).then(setAd);
      setCountdown(REWARD_SECONDS);
      setRewardEarned(false);
      impressionTracked.current = false;
      rewardCalledRef.current = false;
    } else {
      setAd(null);
    }
  }, [visible, placement]);

  useEffect(() => {
    if (visible && ad && !impressionTracked.current) {
      impressionTracked.current = true;
      trackEvent(ad.id, 'impression', placement);
    }
  }, [ad, visible, placement]);

  useEffect(() => {
    if (!visible) return;
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setRewardEarned(true);
          if (!rewardCalledRef.current) {
            rewardCalledRef.current = true;
            onRewardEarned();
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, onRewardEarned]);

  if (!visible || !ad) return null;

  const handlePress = () => {
    trackEvent(ad.id, 'click', placement);
    if (ad.clickUrl) Linking.openURL(ad.clickUrl).catch(() => {});
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={rewardEarned ? onClose : () => {}}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <View style={styles.rewardBadge}>
              <Ionicons name="gift-outline" size={14} color="#F59E0B" />
              <Text style={styles.rewardBadgeText}>Watch to earn reward</Text>
            </View>
            {rewardEarned ? (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.closeBtn, styles.closeBtnDisabled]}>
                <Text style={styles.countdownText}>{countdown}s</Text>
              </View>
            )}
          </View>

          <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={styles.imageWrapper}>
            {ad.imageUrl ? (
              <Image source={{ uri: Config.imageUrl(ad.imageUrl) }} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={styles.fallback}>
                <Ionicons name="gift-outline" size={48} color="#F59E0B" />
                <Text style={styles.fallbackText}>{ad.name}</Text>
              </View>
            )}
          </TouchableOpacity>

          {rewardEarned ? (
            <View style={styles.rewardEarnedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.rewardEarnedText}>Reward Earned!</Text>
            </View>
          ) : (
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((REWARD_SECONDS - countdown) / REWARD_SECONDS) * 100}%` },
                ]}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
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
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  imageWrapper: {
    width: '100%',
  },
  image: {
    width: '100%',
    height: H * 0.38,
  },
  fallback: {
    width: '100%',
    height: H * 0.38,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#1C1C2A',
  },
  fallbackText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    margin: 16,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
  },
  rewardEarnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: 'rgba(16,185,129,0.12)',
    margin: 16,
    borderRadius: 12,
  },
  rewardEarnedText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
});
