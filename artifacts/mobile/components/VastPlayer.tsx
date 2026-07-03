/**
 * VastPlayer — VAST pre-roll rendered with react-native-video (ExoPlayer / AVPlayer).
 *
 * Flow:
 *  1. Fetch VAST XML tag URL (React Native fetch, not WebView JS).
 *  2. Parse XML to extract the best MediaFile URL (prefers MP4/video) and skipoffset.
 *  3. Play the ad video using the same react-native-video engine as the main player.
 *  4. Overlay: "AD" badge, skip countdown, skip button.
 *  5. Fail-safe: any fetch / parse / playback error calls onComplete so the main
 *     stream is never permanently blocked by a broken ad URL.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── VAST XML helpers ─────────────────────────────────────────────────────────

function extractCdata(s: string): string {
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1].trim() : s.trim();
}

function parseSkipOffset(s: string | null, def: number): number {
  if (!s) return def;
  const parts = s.split(':');
  if (parts.length === 3) {
    return Math.round(
      parseInt(parts[0] ?? '0', 10) * 3600 +
      parseInt(parts[1] ?? '0', 10) * 60 +
      parseFloat(parts[2] ?? '0'),
    );
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : def;
}

interface VastMedia {
  url: string;
  skipSec: number;
}

async function resolveVastMedia(
  vastUrl: string,
  defaultSkipSec: number,
  maxRedirects = 3,
): Promise<VastMedia | null> {
  let url = vastUrl;

  for (let attempt = 0; attempt < maxRedirects; attempt++) {
    let xml: string;
    try {
      const res = await fetch(url, {
        // 15s (was 10s) — gives slow/mobile-data connections more room to
        // fetch the VAST tag before we give up and skip the ad.
        signal: AbortSignal.timeout ? AbortSignal.timeout(15_000) : undefined,
      });
      if (!res.ok) return null;
      xml = await res.text();
    } catch {
      return null;
    }

    // VAST wrapper redirect
    const wrapperMatch = xml.match(/<VASTAdTagURI[^>]*>([\s\S]*?)<\/VASTAdTagURI>/i);
    if (wrapperMatch?.[1]) {
      url = extractCdata(wrapperMatch[1]);
      continue;
    }

    // Extract skipoffset
    const skipMatch = xml.match(/skipoffset="([^"]+)"/i);
    const skipSec = parseSkipOffset(skipMatch?.[1] ?? null, defaultSkipSec);

    // Extract best MediaFile — prefer MP4
    let bestUrl: string | null = null;
    const re = /<MediaFile[^>]*>([\s\S]*?)<\/MediaFile>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const candidate = extractCdata(m[1]);
      if (!candidate) continue;
      if (!bestUrl) bestUrl = candidate;
      const typeAttr = m[0].match(/type="([^"]+)"/i);
      if (typeAttr && typeAttr[1].toLowerCase().includes('mp4')) {
        bestUrl = candidate;
        break;
      }
    }

    if (!bestUrl) return null;
    return { url: bestUrl, skipSec };
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface VastPlayerProps {
  /** VAST tag URL. If empty/null the component renders nothing. */
  vastUrl: string | null | undefined;
  /** Called when ad finishes, is skipped, or any error occurs. Always fires. */
  onComplete: () => void;
  /** Seconds before skip button appears (overridden by VAST skipoffset). Default: 5 */
  defaultSkipSec?: number;
}

type Phase = 'loading' | 'playing' | 'error';

export function VastPlayer({ vastUrl, onComplete, defaultSkipSec = 5 }: VastPlayerProps) {
  const [phase, setPhase]           = useState<Phase>('loading');
  const [mediaUrl, setMediaUrl]     = useState<string | null>(null);
  const [skipSec, setSkipSec]       = useState(defaultSkipSec);
  const [elapsed, setElapsed]       = useState(0);
  const [videoKey, setVideoKey]     = useState(0);
  const doneRef                     = useRef(false);
  const timerRef                    = useRef<ReturnType<typeof setInterval> | null>(null);
  // Slow/flaky networks can throw a transient playback error mid-buffer.
  // Give the ad one remount-and-retry before giving up and skipping it,
  // instead of treating every network blip as a hard failure.
  const retryRef                    = useRef(0);
  const retryTimerRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Resolve VAST XML → media URL ─────────────────────────────────────────
  useEffect(() => {
    if (!vastUrl) { onComplete(); return; }
    let cancelled = false;
    resolveVastMedia(vastUrl, defaultSkipSec).then(result => {
      if (cancelled) return;
      if (!result) { setPhase('error'); setTimeout(onComplete, 1500); return; }
      setMediaUrl(result.url);
      setSkipSec(result.skipSec);
      setPhase('playing');
    });
    return () => { cancelled = true; };
  }, [vastUrl, defaultSkipSec, onComplete]);

  // ── Elapsed timer — drives skip countdown ────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    onComplete();
  }, [onComplete]);

  // Network hiccups (slow WiFi/mobile data) can throw a playback error mid-
  // buffer even though the stream would recover on its own. Retry once with
  // a short delay (clean remount, same media URL) before treating it as a
  // real failure — mirrors the main player's network-error tolerance.
  const handleVideoError = useCallback(() => {
    if (retryRef.current < 1) {
      retryRef.current += 1;
      retryTimerRef.current = setTimeout(() => {
        setVideoKey(k => k + 1);
      }, 2000);
    } else {
      finish();
    }
  }, [finish]);

  const canSkip = elapsed >= skipSec;

  // ── Dynamically require react-native-video ───────────────────────────────
  // react-native-video requires a native dev/production build.
  // The try-catch allows Expo Go to render a graceful fallback.
  let VideoComponent: React.ComponentType<any> | null = null;
  try {
    VideoComponent = require('react-native-video').default;
  } catch {
    VideoComponent = null;
  }

  if (!vastUrl) return null;

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={canSkip ? finish : undefined}
    >
      <SafeAreaView style={s.root}>
        <StatusBar hidden />

        {/* ── Loading state ─────────────────────────────────────────── */}
        {phase === 'loading' && (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={s.loadingTxt}>Loading ad…</Text>
          </View>
        )}

        {/* ── Error state ───────────────────────────────────────────── */}
        {phase === 'error' && (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
            <Text style={s.loadingTxt}>Ad unavailable</Text>
          </View>
        )}

        {/* ── Video playback ────────────────────────────────────────── */}
        {phase === 'playing' && mediaUrl && (
          <>
            {VideoComponent ? (
              <VideoComponent
                key={videoKey}
                source={{ uri: mediaUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                paused={false}
                muted={false}
                controls={false}
                ignoreSilentSwitch="ignore"
                playInBackground={false}
                useTextureView={true}
                hideShutterView={true}
                // More forgiving buffer + retry budget so a slow/flaky
                // connection buffers instead of throwing an error outright.
                bufferConfig={{
                  minBufferMs: 10_000,
                  maxBufferMs: 30_000,
                  bufferForPlaybackMs: 1_500,
                  bufferForPlaybackAfterRebufferMs: 3_000,
                }}
                preferredForwardBufferDuration={10}
                minLoadRetryCount={5}
                onEnd={finish}
                onError={handleVideoError}
              />
            ) : (
              // Expo Go fallback — no native module
              <View style={[StyleSheet.absoluteFill, s.center]}>
                <Ionicons name="phone-portrait-outline" size={42} color="#8B5CF6" />
                <Text style={[s.loadingTxt, { marginTop: 10, textAlign: 'center' }]}>
                  Ad player requires{'\n'}a dev/production build
                </Text>
              </View>
            )}

            {/* AD label */}
            <View style={s.adBadge}>
              <Text style={s.adBadgeTxt}>AD</Text>
            </View>

            {/* Skip area */}
            <View style={s.skipArea}>
              {canSkip ? (
                <TouchableOpacity style={s.skipBtn} onPress={finish} activeOpacity={0.8}>
                  <Text style={s.skipBtnTxt}>Skip Ad  ›</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.countdownBox}>
                  <Text style={s.countdownTxt}>Skip in {skipSec - elapsed}s</Text>
                </View>
              )}
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingTxt: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  adBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  adBadgeTxt: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  skipArea: {
    position: 'absolute',
    bottom: 22,
    right: 16,
  },
  skipBtn: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
  },
  skipBtnTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  countdownBox: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  countdownTxt: {
    color: '#aaa',
    fontSize: 13,
  },
});
