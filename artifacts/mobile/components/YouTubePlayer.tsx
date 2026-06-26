import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');

const C = {
  bg: '#050510', text: '#fff', dim: '#9CA3AF',
  primary: '#8B5CF6', error: '#EF4444',
};

// ── YouTube video ID extraction ──────────────────────────────────────────────
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/watch\?v=([^&#]+)/,
    /youtube\.com\/shorts\/([^?&#]+)/,
    /youtube\.com\/embed\/([^?&#]+)/,
    /youtube\.com\/v\/([^?&#]+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface YouTubePlayerProps {
  url: string;
  title?: string;
  onBack: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function YouTubePlayer({ url, title = '', onBack }: YouTubePlayerProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const videoId = extractYouTubeId(url);

  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1`
    : null;

  // ── WebView approach (requires react-native-webview) ────────────────────
  let WebViewComponent: any = null;
  try {
    // Dynamic require — only works when react-native-webview is installed
    WebViewComponent = require('react-native-webview').WebView;
  } catch {
    WebViewComponent = null;
  }

  if (!videoId) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={52} color={C.error} />
          <Text style={s.errTxt}>Invalid YouTube URL</Text>
          <Text style={s.errSub}>{url}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={onBack}>
            <Text style={s.retryTxt}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!WebViewComponent) {
    // Fallback: show instructions when WebView package not yet installed
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.center}>
          <Ionicons name="logo-youtube" size={64} color="#FF0000" />
          <Text style={s.errTxt}>YouTube Player</Text>
          <Text style={s.errSub}>
            WebView package is being installed.{'\n'}
            Please restart the app and try again.{'\n\n'}
            Video ID: {videoId}
          </Text>
          <TouchableOpacity style={s.retryBtn} onPress={onBack}>
            <Text style={s.retryTxt}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title || 'YouTube'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Player */}
      <View style={s.playerBox}>
        {loading && !error && (
          <View style={StyleSheet.absoluteFill}>
            <View style={s.loadingOverlay}>
              <Ionicons name="logo-youtube" size={48} color="#FF0000" />
              <ActivityIndicator color={C.primary} style={{ marginTop: 16 }} />
              <Text style={s.loadingTxt}>Loading YouTube video…</Text>
            </View>
          </View>
        )}

        {error && (
          <View style={[StyleSheet.absoluteFill, s.center]}>
            <Ionicons name="alert-circle-outline" size={48} color={C.error} />
            <Text style={s.errTxt}>Failed to load video</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => setError(false)}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={s.retryTxt}>  Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!error && embedUrl && (
          <WebViewComponent
            source={{ uri: embedUrl }}
            style={s.webview}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState={false}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            userAgent={
              Platform.OS === 'android'
                ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
                : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            }
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerBox: {
    width: W,
    height: W * (9 / 16),
    backgroundColor: '#000',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingTxt: {
    color: C.dim,
    fontSize: 14,
    marginTop: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  errTxt: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errSub: {
    color: C.dim,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 22,
    marginTop: 8,
  },
  retryTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
