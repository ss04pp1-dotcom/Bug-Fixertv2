import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ActivityIndicator, StatusBar, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const { width: W } = Dimensions.get('window');

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

// ── PiP JS injected into native WebView ──────────────────────────────────────
const PIP_JS = `(function(){
  var video = document.querySelector('video');
  if (video) {
    if (video.webkitSupportsPresentationMode && typeof video.webkitSetPresentationMode === 'function') {
      video.webkitSetPresentationMode('picture-in-picture');
    } else if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
      video.requestPictureInPicture().catch(function(){});
    }
  }
  true;
})();`;

// ── YouTubeVideoBox — embeddable player (no header/back) ─────────────────────
interface YouTubeVideoBoxProps {
  url: string;
  height?: number;
}

export function YouTubeVideoBox({ url, height }: YouTubeVideoBoxProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);

  const videoId = extractYouTubeId(url);
  const boxH = height ?? W * (9 / 16);

  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1`
    : null;

  if (!videoId) {
    return (
      <View style={[s.playerBox, { height: boxH }, s.center]}>
        <Ionicons name="alert-circle-outline" size={36} color={C.error} />
        <Text style={s.errTxt}>Invalid YouTube URL</Text>
      </View>
    );
  }

  // ── Web platform: use native iframe ────────────────────────────────────────
  if (Platform.OS === 'web') {
    const handleWebPip = () => {
      try {
        const iframe = iframeRef.current as HTMLIFrameElement | null;
        if (!iframe) return;
        if ((document as any).pictureInPictureEnabled) {
          (iframe as any).requestPictureInPicture?.().catch(() => {
            Alert.alert('PiP', 'Use the browser\'s built-in PiP (right-click the video → Picture in Picture).');
          });
        } else {
          Alert.alert('PiP', 'Right-click the video and select "Picture in Picture" from the context menu.');
        }
      } catch {
        Alert.alert('PiP', 'Use the browser\'s built-in PiP controls on the video.');
      }
    };

    return (
      <View style={[s.playerBox, { height: boxH }]}>
        {loading && (
          <View style={[StyleSheet.absoluteFill, s.loadingOverlay]}>
            <Ionicons name="logo-youtube" size={48} color="#FF0000" />
            <ActivityIndicator color={C.primary} style={{ marginTop: 12 }} />
            <Text style={s.loadingTxt}>Loading YouTube video…</Text>
          </View>
        )}
        {/* @ts-ignore — iframe is valid in react-native-web */}
        <iframe
          ref={iframeRef}
          src={embedUrl!}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#000',
          } as any}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
        {/* PiP button overlay */}
        {!loading && (
          <TouchableOpacity style={s.pipBtn} onPress={handleWebPip}>
            <MaterialIcons name="picture-in-picture-alt" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Native platform: use WebView ────────────────────────────────────────────
  let WebViewComponent: any = null;
  try {
    WebViewComponent = require('react-native-webview').WebView;
  } catch {
    WebViewComponent = null;
  }

  if (!WebViewComponent) {
    return (
      <View style={[s.playerBox, { height: boxH }, s.center]}>
        <Ionicons name="logo-youtube" size={48} color="#FF0000" />
        <Text style={s.errTxt}>YouTube Player</Text>
        <Text style={s.errSub}>Restart the app to load the player.</Text>
      </View>
    );
  }

  const handleNativePip = () => {
    webViewRef.current?.injectJavaScript(PIP_JS);
  };

  return (
    <View style={[s.playerBox, { height: boxH }]}>
      {loading && !error && (
        <View style={[StyleSheet.absoluteFill, s.loadingOverlay]}>
          <Ionicons name="logo-youtube" size={48} color="#FF0000" />
          <ActivityIndicator color={C.primary} style={{ marginTop: 12 }} />
          <Text style={s.loadingTxt}>Loading YouTube video…</Text>
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
      {/* PiP button overlay (native only) */}
      {!loading && !error && (
        <TouchableOpacity style={s.pipBtn} onPress={handleNativePip}>
          <MaterialIcons name="picture-in-picture-alt" size={18} color="#fff" />
        </TouchableOpacity>
      )}
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
  const insets = useSafeAreaInsets();
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
      <YouTubeVideoBox url={url} />
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
  pipBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8, padding: 6,
  },
});
