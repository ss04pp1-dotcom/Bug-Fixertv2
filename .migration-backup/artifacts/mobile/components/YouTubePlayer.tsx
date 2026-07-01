import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ActivityIndicator, StatusBar, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/lib/api';

const { width: W } = Dimensions.get('window');

const C = {
  bg: '#050510', text: '#fff', dim: '#9CA3AF',
  primary: '#8B5CF6', error: '#EF4444', yt: '#FF0000',
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

// ── API-based stream extraction (bypasses embed restrictions) ─────────────────
export async function extractYouTubeStream(youtubeUrl: string): Promise<{
  streamUrl: string;
  title: string;
  thumbnail: string;
  duration: number;
  isLive: boolean;
} | null> {
  try {
    const res = await apiClient.post('/youtube/extract', { url: youtubeUrl });
    const d = res.data?.data ?? res.data;
    if (d?.streamUrl) return d;
    return null;
  } catch {
    return null;
  }
}

// ── YouTubeVideoBox — embeds player (WebView for native, iframe for web) ──────
interface YouTubeVideoBoxProps {
  url: string;
  height?: number;
  title?: string;
}

export function YouTubeVideoBox({ url, height, title }: YouTubeVideoBoxProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  const webViewRef = useRef<any>(null);
  const iframeRef  = useRef<any>(null);

  const videoId = extractYouTubeId(url);
  const boxH    = height ?? W * (9 / 16);

  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=https://www.youtube.com`
    : null;

  const openInYouTube = useCallback(() => {
    const ytUrl = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : url;
    Linking.openURL(ytUrl).catch(() => {});
  }, [videoId, url]);

  if (!videoId) {
    return (
      <View style={[s.playerBox, { height: boxH }, s.center]}>
        <Ionicons name="alert-circle-outline" size={36} color={C.error} />
        <Text style={s.errTxt}>Invalid YouTube URL</Text>
      </View>
    );
  }

  // ── Web: native iframe ────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={[s.playerBox, { height: boxH }]}>
        {loading && (
          <View style={[StyleSheet.absoluteFill, s.loadingOverlay]}>
            <Ionicons name="logo-youtube" size={48} color={C.yt} />
            <ActivityIndicator color={C.primary} style={{ marginTop: 12 }} />
            <Text style={s.loadingTxt}>Loading YouTube…</Text>
          </View>
        )}
        {/* @ts-ignore */}
        <iframe
          ref={iframeRef}
          src={embedUrl!}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#000' } as any}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
      </View>
    );
  }

  // ── Native: try react-native-youtube-iframe first ────────────────────────
  let YoutubeIframe: any = null;
  try {
    YoutubeIframe = require('react-native-youtube-iframe').default;
  } catch { /* not available */ }

  if (YoutubeIframe) {
    return (
      <NativeYouTubeIframe
        videoId={videoId}
        height={boxH}
        title={title}
        onError={() => setEmbedBlocked(true)}
        embedBlocked={embedBlocked}
        onOpenYouTube={openInYouTube}
      />
    );
  }

  // ── Native fallback: WebView ──────────────────────────────────────────────
  let WebViewComponent: any = null;
  try {
    WebViewComponent = require('react-native-webview').WebView;
  } catch { /* not available */ }

  if (!WebViewComponent) {
    return (
      <View style={[s.playerBox, { height: boxH }, s.center]}>
        <Ionicons name="logo-youtube" size={48} color={C.yt} />
        <Text style={s.errTxt}>YouTube Player</Text>
        <Text style={s.errSub}>Restart the app to load the player.</Text>
      </View>
    );
  }

  return (
    <View style={[s.playerBox, { height: boxH }]}>
      {loading && !error && (
        <View style={[StyleSheet.absoluteFill, s.loadingOverlay]}>
          <Ionicons name="logo-youtube" size={48} color={C.yt} />
          <ActivityIndicator color={C.primary} style={{ marginTop: 12 }} />
          <Text style={s.loadingTxt}>Loading YouTube…</Text>
        </View>
      )}
      {error && (
        <View style={[StyleSheet.absoluteFill, s.center]}>
          <Ionicons name="logo-youtube" size={48} color={C.yt} />
          <Text style={s.errTxt}>
            {embedBlocked ? 'Embedding disabled' : 'Failed to load video'}
          </Text>
          <Text style={s.errSub}>
            {embedBlocked
              ? 'The video owner has disabled embedding outside YouTube.'
              : 'Check your connection and try again.'}
          </Text>
          <TouchableOpacity style={s.ytBtn} onPress={openInYouTube}>
            <Ionicons name="logo-youtube" size={16} color="#fff" />
            <Text style={s.ytBtnTxt}>  Open in YouTube</Text>
          </TouchableOpacity>
          {!embedBlocked && (
            <TouchableOpacity style={s.retryBtn} onPress={() => { setError(false); setEmbedBlocked(false); }}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={s.retryTxt}>  Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {!error && (
        <WebViewComponent
          ref={webViewRef}
          source={{ uri: embedUrl! }}
          style={{ flex: 1, backgroundColor: '#000' }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          allowsPictureInPictureMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          onHttpError={() => { setLoading(false); setEmbedBlocked(true); setError(true); }}
          onShouldStartLoadWithRequest={(req: any) => {
            const u: string = req.url || '';
            return (
              u.includes('youtube.com/embed') ||
              u.includes('google.com/accounts') ||
              u.includes('accounts.google.com') ||
              u.includes('about:blank') ||
              u.startsWith('data:')
            );
          }}
          userAgent={
            Platform.OS === 'android'
              ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
              : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          }
        />
      )}
    </View>
  );
}

// ── NativeYouTubeIframe — react-native-youtube-iframe wrapper ─────────────────
interface NativeYouTubeIframeProps {
  videoId: string;
  height: number;
  title?: string;
  onError: () => void;
  embedBlocked: boolean;
  onOpenYouTube: () => void;
}

function NativeYouTubeIframe({
  videoId, height, title, onError, embedBlocked, onOpenYouTube,
}: NativeYouTubeIframeProps) {
  const [playing, setPlaying] = useState(true);
  const YoutubeIframe = require('react-native-youtube-iframe').default;

  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') setPlaying(false);
  }, []);

  if (embedBlocked) {
    return (
      <View style={[s.playerBox, { height }, s.center]}>
        <Ionicons name="logo-youtube" size={48} color={C.yt} />
        <Text style={s.errTxt}>Embedding disabled</Text>
        <Text style={s.errSub}>The video owner has restricted embedding outside YouTube.</Text>
        <TouchableOpacity style={s.ytBtn} onPress={onOpenYouTube}>
          <Ionicons name="logo-youtube" size={16} color="#fff" />
          <Text style={s.ytBtnTxt}>  Open in YouTube</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.playerBox, { height }]}>
      <YoutubeIframe
        height={height}
        width={W}
        play={playing}
        videoId={videoId}
        onChangeState={onStateChange}
        onError={onError}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
          allowsFullscreenVideo: true,
        }}
      />
    </View>
  );
}

// ── Full-screen YouTubePlayer (used standalone if needed) ────────────────────
interface YouTubePlayerProps {
  url: string;
  title?: string;
  onBack: () => void;
}

export default function YouTubePlayer({ url, title = '', onBack }: YouTubePlayerProps) {
  const insets  = useSafeAreaInsets();
  const videoId = extractYouTubeId(url);

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
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title || 'YouTube'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <YouTubeVideoBox url={url} title={title} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  headerTitle: { flex: 1, color: C.text, fontSize: 16, fontWeight: '600' },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  playerBox: { width: W, backgroundColor: '#000', position: 'relative' },
  loadingOverlay: {
    backgroundColor: '#000', justifyContent: 'center',
    alignItems: 'center', gap: 8,
  },
  loadingTxt: { color: C.dim, fontSize: 14, marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  errTxt: { color: C.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  errSub: { color: C.dim, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.primary, paddingHorizontal: 24,
    paddingVertical: 10, borderRadius: 22, marginTop: 8,
  },
  retryTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ytBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.yt, paddingHorizontal: 24,
    paddingVertical: 10, borderRadius: 22, marginTop: 8,
  },
  ytBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
