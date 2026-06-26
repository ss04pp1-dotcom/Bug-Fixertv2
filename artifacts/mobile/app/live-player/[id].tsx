import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, StatusBar, Image, FlatList, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '@/lib/api';
import { useLiveChannels } from '@/lib/api-hooks';
import PremiumVideoPlayer, { type StreamSource } from '@/components/PremiumVideoPlayer';

const C = {
  bg: '#050510', card: '#111827', primary: '#8B5CF6',
  accent: '#EC4899', live: '#EF4444', text: '#fff', dim: '#9CA3AF',
};

const PLAYBACK_SUCCESS_DELAY_MS = 15_000;

export default function LivePlayerScreen() {
  const {
    id,
    title: titleParam,
    streamUrl: passedUrl,
    logo: passedLogo,
    cat: passedCat,
  } = useLocalSearchParams<{
    id: string; title?: string; streamUrl?: string; logo?: string; cat?: string;
  }>();

  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const isLandscape = W > H;

  const contentTitle = titleParam || 'Live TV';
  const logoUrl      = passedLogo || '';
  const category     = passedCat  || 'Live TV';

  // ── Stream sources ─────────────────────────────────────────────────────────
  const [sources, setSources]         = useState<StreamSource[]>([]);
  const [fetchLoading, setFetchLoad]  = useState(true);
  const [fetchError, setFetchError]   = useState(false);
  const [activeTab, setActiveTab]     = useState<'channels' | 'info'>('channels');

  // ── Playback reporting ─────────────────────────────────────────────────────
  const playbackTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef        = useRef(false);
  const playbackStartRef   = useRef<number>(0);

  const clearPlaybackTimer = () => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  const reportPlayback = useCallback(async (success: boolean, durationSecs?: number) => {
    if (!id) return;
    try {
      await apiClient.post('/playback-events/report', {
        channelId: id,
        success,
        duration: durationSecs,
      });
    } catch { /* non-fatal */ }
  }, [id]);

  const onPlaybackStart = useCallback(() => {
    clearPlaybackTimer();
    reportedRef.current = false;
    playbackStartRef.current = Date.now();
    playbackTimerRef.current = setTimeout(() => {
      if (!reportedRef.current) {
        reportedRef.current = true;
        reportPlayback(true, Math.round((Date.now() - playbackStartRef.current) / 1000));
      }
    }, PLAYBACK_SUCCESS_DELAY_MS);
  }, [reportPlayback]);

  const onPlaybackError = useCallback(() => {
    clearPlaybackTimer();
    if (!reportedRef.current) {
      reportedRef.current = true;
      reportPlayback(false);
    }
  }, [reportPlayback]);

  useEffect(() => () => clearPlaybackTimer(), []);

  // ── Related channels ───────────────────────────────────────────────────────
  const { data: relatedRaw } = useLiveChannels({ limit: 20 });
  const related = useMemo(() => {
    if (!relatedRaw || !Array.isArray(relatedRaw)) return [];
    return (relatedRaw as any[])
      .filter((ch: any) => ch.id !== id)
      .slice(0, 16)
      .map((ch: any) => ({
        id:        ch.id || '',
        name:      ch.name || '',
        logo:      ch.logoUrl || ch.logo || '',
        cat:       ch.category?.name || ch.category || ch.language || 'Live TV',
        streamUrl: ch.primaryStreamUrl || ch.streamUrl || '',
      }));
  }, [relatedRaw, id]);

  // ── Load stream URL ────────────────────────────────────────────────────────
  const loadStream = useCallback(async () => {
    setFetchLoad(true);
    setFetchError(false);
    setSources([]);
    clearPlaybackTimer();
    reportedRef.current = false;

    if (passedUrl) {
      const srcs: StreamSource[] = [{ url: passedUrl, label: 'Server 1', quality: 'HD' }];
      try {
        const res = await apiClient.get(`/channels/${id}`);
        const ch  = res.data?.data || res.data;
        if (ch?.backupStreamUrl  && ch.backupStreamUrl  !== passedUrl) srcs.push({ url: ch.backupStreamUrl,  label: 'Server 2', quality: 'SD' });
        if (ch?.thirdBackupUrl   && ch.thirdBackupUrl   !== passedUrl) srcs.push({ url: ch.thirdBackupUrl,   label: 'Server 3', quality: 'SD' });
      } catch { /* non-fatal */ }
      setSources(srcs);
      setFetchLoad(false);
      return;
    }

    try {
      const res = await apiClient.get(`/channels/${id}`);
      const ch  = res.data?.data || res.data;
      const srcs: StreamSource[] = [];
      if (ch?.primaryStreamUrl) srcs.push({ url: ch.primaryStreamUrl, label: 'Server 1', quality: ch.streamType || 'HD' });
      if (ch?.backupStreamUrl)  srcs.push({ url: ch.backupStreamUrl,  label: 'Server 2', quality: 'SD' });
      if (ch?.thirdBackupUrl)   srcs.push({ url: ch.thirdBackupUrl,   label: 'Server 3', quality: 'SD' });
      if (ch?.streamUrl && !srcs.find(s => s.url === ch.streamUrl))
        srcs.push({ url: ch.streamUrl, label: `Server ${srcs.length + 1}`, quality: 'SD' });
      if (srcs.length === 0) setFetchError(true);
      else setSources(srcs);
    } catch {
      setFetchError(true);
    } finally {
      setFetchLoad(false);
    }
  }, [id, passedUrl]);

  useEffect(() => { if (id) loadStream(); }, [id, loadStream]);

  // ── Switch channel ─────────────────────────────────────────────────────────
  const switchChannel = useCallback((ch: typeof related[0]) => {
    router.replace({
      pathname: `/live-player/${ch.id}` as any,
      params: {
        title:     ch.name,
        streamUrl: ch.streamUrl,
        logo:      ch.logo,
        cat:       ch.cat,
      },
    });
  }, []);

  return (
    <View style={[s.root, !isLandscape && { paddingTop: insets.top }]}>
      <StatusBar translucent barStyle="light-content" backgroundColor="transparent" />

      {/* ── Premium Player ──────────────────────────────────────────────── */}
      <PremiumVideoPlayer
        sources={sources}
        title={contentTitle}
        isLive
        isLoading={fetchLoading}
        hasError={fetchError}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(main)/live-tv');
        }}
        onRetry={loadStream}
        onRefreshStream={loadStream}
        contentId={id}
        contentType="channel"
        onPlaybackStart={onPlaybackStart}
        onPlaybackError={onPlaybackError}
      />

      {/* ── Below player (portrait) ─────────────────────────────────────── */}
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Channel header */}
        <View style={s.channelHeader}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={s.channelLogo} resizeMode="contain" />
          ) : (
            <LinearGradient colors={[C.primary, C.accent]} style={s.channelLogo}>
              <Ionicons name="tv" size={20} color="#fff" />
            </LinearGradient>
          )}
          <View style={s.channelInfo}>
            <Text style={s.channelName} numberOfLines={1}>{contentTitle}</Text>
            <View style={s.livePillSmall}>
              <View style={s.liveDotSmall} />
              <Text style={s.liveTxtSmall}>LIVE • {category}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={loadStream} style={s.refreshBtn}>
            <Ionicons name="refresh-outline" size={20} color={C.dim} />
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {(['channels', 'info'] as const).map(tab => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={s.tabItem}>
              <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
                {tab === 'channels' ? 'RELATED CHANNELS' : 'INFO'}
              </Text>
              {activeTab === tab && <View style={s.tabLine} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Related channels */}
        {activeTab === 'channels' && (
          <FlatList
            data={related}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={s.grid}
            columnWrapperStyle={s.columnWrapper}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.chCard} onPress={() => switchChannel(item)} activeOpacity={0.75}>
                <View style={s.chThumb}>
                  {item.logo ? (
                    <Image source={{ uri: item.logo }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                  ) : (
                    <LinearGradient colors={[C.primary, C.accent]} style={StyleSheet.absoluteFill}>
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="tv-outline" size={24} color="rgba(255,255,255,0.5)" />
                      </View>
                    </LinearGradient>
                  )}
                  <View style={s.chLiveBadge}>
                    <View style={s.liveDotSmall} />
                    <Text style={s.chLiveTxt}>LIVE</Text>
                  </View>
                </View>
                <Text style={s.chName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.chCat} numberOfLines={1}>{item.cat}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={s.emptyBox}>
                <Ionicons name="tv-outline" size={40} color={C.dim} />
                <Text style={s.emptyTxt}>No other channels available</Text>
              </View>
            )}
          />
        )}

        {activeTab === 'info' && (
          <ScrollView contentContainerStyle={s.infoPad} showsVerticalScrollIndicator={false}>
            <View style={s.infoItem}>
              <Ionicons name="tv-outline" size={16} color={C.primary} />
              <Text style={s.infoLabel}>Channel</Text>
              <Text style={s.infoVal}>{contentTitle}</Text>
            </View>
            <View style={s.infoItem}>
              <Ionicons name="folder-outline" size={16} color={C.primary} />
              <Text style={s.infoLabel}>Category</Text>
              <Text style={s.infoVal}>{category}</Text>
            </View>
            <View style={s.infoItem}>
              <Ionicons name="radio-outline" size={16} color={C.live} />
              <Text style={s.infoLabel}>Status</Text>
              <View style={s.livePillSmall}>
                <View style={s.liveDotSmall} />
                <Text style={[s.liveTxtSmall, { color: C.live }]}>LIVE</Text>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const { width: SW } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 14 * 2 - 10) / 2);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  channelHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  channelLogo:  {
    width: 52, height: 52, borderRadius: 10, overflow: 'hidden',
    backgroundColor: C.card, justifyContent: 'center', alignItems: 'center',
  },
  channelInfo:  { flex: 1 },
  channelName:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  refreshBtn:   { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  livePillSmall: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  liveDotSmall:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.live },
  liveTxtSmall:  { color: C.dim, fontSize: 12 },

  tabBar:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 14 },
  tabItem:   { paddingVertical: 10, marginRight: 20, position: 'relative' },
  tabTxt:    { color: C.dim, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  tabTxtActive: { color: '#fff' },
  tabLine:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: C.primary, borderRadius: 1 },

  grid:         { paddingHorizontal: 14, paddingVertical: 14, paddingBottom: 100 },
  columnWrapper: { gap: 10, marginBottom: 10 },
  chCard: { width: CARD_W },
  chThumb: {
    width: '100%', height: 90, borderRadius: 10,
    backgroundColor: C.card, overflow: 'hidden',
    marginBottom: 6, position: 'relative',
  },
  chLiveBadge: {
    position: 'absolute', bottom: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239,68,68,0.88)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  chLiveTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  chName:    { color: '#fff', fontSize: 13, fontWeight: '600' },
  chCat:     { color: C.dim, fontSize: 11, marginTop: 2 },

  emptyBox: { flex: 1, alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt: { color: C.dim, fontSize: 14 },

  infoPad:  { padding: 14, gap: 2 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  infoLabel: { color: C.dim, fontSize: 13, width: 80 },
  infoVal:  { color: '#fff', fontSize: 13, flex: 1 },
});
