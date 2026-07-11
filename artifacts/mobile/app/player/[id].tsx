/**
 * Movie / Series Player Screen
 *
 * This screen NO LONGER mounts a video player.
 * The player is the SINGLETON GlobalVideoPlayer mounted at _layout.tsx.
 * This screen just:
 *   1. Fetches the stream URL from the API
 *   2. Calls useGlobalPlayer.open({...}) to load it into the singleton
 *   3. Shows metadata below (poster, overview, episodes, related)
 *
 * When the user presses back, the player auto-transitions to MINI mode
 * (no reload, no rebuffer) via the back-handler in GlobalVideoPlayer.
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, StatusBar, Platform, Image, BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '@/lib/api';
import { useMovie, useSeries, useRelatedMovies, useRecommendations } from '@/lib/api-hooks';
import { YouTubeVideoBox, isYouTubeUrl, extractYouTubeStream } from '@/components/YouTubePlayer';
import { useGlobalPlayer, type PlayerSource } from '@/lib/player-store';
import { AdBanner } from '@/components/AdBanner';
import { AdRewarded } from '@/components/AdRewarded';
import { VastPlayer } from '@/components/VastPlayer';
import { useGlobalAdConfig } from '@/hooks/useGlobalAdConfig';
import { SocketService } from '@/services/socket.service';

const C = {
  bg: '#050510', card: '#111827', primary: '#8B5CF6',
  accent: '#EC4899', text: '#fff', dim: '#9CA3AF',
};

function getUnsupportedUrlReason(url: string): string | null {
  if (!url) return 'No stream URL configured for this content.';
  const lower = url.toLowerCase();
  if (lower.includes('vimeo.com'))
    return 'Vimeo URLs cannot be played directly. Use a direct stream URL instead.';
  if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('tiktok.com') || lower.includes('instagram.com'))
    return 'Social media URLs cannot be played directly. Use an HLS/DASH/MP4 stream URL.';
  return null;
}

const { width: SW } = Dimensions.get('window');

function buildStreamSource(
  rawUrl: string,
  label: string,
  quality: string,
  data?: { cookie?: string; userAgent?: string; referer?: string; origin?: string },
): PlayerSource {
  let url = rawUrl;
  let pipeHeaders: Record<string, string> = {};

  if (url.includes('|')) {
    const pipeIdx = url.indexOf('|');
    const rawPipe = url.substring(pipeIdx + 1);
    url = url.substring(0, pipeIdx).trim();
    for (const pair of rawPipe.split('&')) {
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const k = decodeURIComponent(pair.substring(0, eq).trim()).toLowerCase();
      const v = decodeURIComponent(pair.substring(eq + 1).trim());
      if (k && v) pipeHeaders[k] = v;
    }
  }

  const cookie    = data?.cookie    || pipeHeaders['cookie'];
  const userAgent = data?.userAgent || pipeHeaders['user-agent'];
  const referer   = data?.referer   || pipeHeaders['referer'] || pipeHeaders['referrer'];
  const origin    = data?.origin    || pipeHeaders['origin'];

  // User-Agent keeps headers non-empty so DataSourceUtil.kt rebuilds its singleton
  // OkHttpDataSource.Factory (prevents old headers leaking between streams).
  // Default UA = 'Lavf/58.29.100' (FFmpeg) — universally whitelisted by IPTV panels.
  //
  // Do NOT add 'Icy-MetaData: 1': it causes Streamer-type IPTV servers to spend
  // 20-30 s preparing audio metadata → ExoPlayer times out → channel never plays.
  const headers: Record<string, string> = {
    'User-Agent': userAgent || 'Lavf/58.29.100',
  };
  if (cookie)    headers['Cookie']     = cookie;
  if (referer)   headers['Referer']    = referer;
  if (origin)    headers['Origin']     = origin;

  return { label, url, quality, headers };
}

export default function PlayerScreen() {
  const { id, type, title: titleParam, season } = useLocalSearchParams<{
    id: string; type?: string; title?: string; season?: string;
  }>();
  const insets = useSafeAreaInsets();

  // Channels → redirect to live-player
  useEffect(() => {
    if (type === 'channel' && id) {
      router.replace({
        pathname: `/live-player/${id}` as any,
        params: { title: titleParam || '', streamUrl: '', logo: '', cat: 'Live TV' },
      });
    }
  }, [type, id, titleParam]);

  const cType = (type || 'movie') as 'movie' | 'series';

  // ── Global ad config (for VAST pre-roll) ───────────────────────────────────
  const globalAdConfig = useGlobalAdConfig();
  const vastEnabled    = globalAdConfig.vast.enabled && !!globalAdConfig.vast.url;
  const [vastDone, setVastDone] = useState(false);
  const handleVastComplete = useCallback(() => setVastDone(true), []);

  // ── Stream sources ──────────────────────────────────────────────────────────
  const [sources, setSources]       = useState<PlayerSource[]>([]);
  const [srcLoading, setSrcLoad]    = useState(true);
  const [srcError, setSrcError]     = useState(false);
  const [srcErrorMsg, setSrcErrMsg] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);

  // ── Series episode state ────────────────────────────────────────────────────
  const [epIdx, setEpIdx]       = useState(() => {
    const s = season ? parseInt(season, 10) : NaN;
    return Number.isNaN(s) ? 0 : Math.max(0, s - 1);
  });
  const [activeTab, setActiveTab] = useState<'info' | 'episodes' | 'related'>('info');

  // ── Content data ────────────────────────────────────────────────────────────
  const { data: movieData }  = useMovie(cType === 'movie' ? id : '');
  const { data: seriesData } = useSeries(cType === 'series' ? id : '');
  const { data: relatedMoviesRaw } = useRelatedMovies(cType === 'movie' ? id : '');
  const { data: relatedSeriesRaw } = useRecommendations('series', cType === 'series' ? id : '');

  const contentData  = movieData || seriesData;
  const contentTitle = titleParam || (contentData as any)?.title || (contentData as any)?.name || 'Now Playing';
  const poster       = (contentData as any)?.poster || (contentData as any)?.posterUrl || (contentData as any)?.thumbnailUrl || '';
  const overview     = (contentData as any)?.description || (contentData as any)?.overview || '';
  const rating       = (contentData as any)?.rating || '';
  const year         = (contentData as any)?.releaseYear || (contentData as any)?.year || '';
  const genre        = (contentData as any)?.genre || '';

  const episodes: any[] = useMemo(() => {
    const sd = seriesData as any;
    if (sd?.seasons?.length) {
      const all: any[] = [];
      for (const s of sd.seasons) {
        if (Array.isArray(s.episodes)) all.push(...s.episodes);
      }
      return all;
    }
    if (sd?.episodes) return sd.episodes;
    return [];
  }, [seriesData]);

  const relatedRaw = cType === 'movie' ? relatedMoviesRaw : relatedSeriesRaw;
  const related: any[] = useMemo(() => {
    const d = (relatedRaw as any)?.data || (relatedRaw as any) || [];
    return Array.isArray(d) ? d.slice(0, 12) : [];
  }, [relatedRaw]);

  // ── Load stream ─────────────────────────────────────────────────────────────
  const loadStream = useCallback(async () => {
    setSrcLoad(true); setSrcError(false); setSrcErrMsg(''); setYoutubeUrl(null);
    try {
      if (cType === 'movie') {
        const res = await apiClient.get(`/movies/${id}`);
        const d   = res.data?.data || res.data;
        const url = d?.streamUrl || d?.stream_url || d?.videoUrl || d?.video_url || d?.url || '';
        if (!url) { setSrcErrMsg('No stream URL configured for this content.'); setSrcError(true); return; }
        if (isYouTubeUrl(url)) {
          // Try server-side extraction first (bypasses embed restrictions)
          const extracted = await extractYouTubeStream(url);
          if (extracted?.streamUrl) {
            const srcs: PlayerSource[] = [buildStreamSource(extracted.streamUrl, 'YouTube', 'HD', {})];
            setSources(srcs);
          } else {
            setYoutubeUrl(url); // fallback: WebView embed
          }
          return;
        }
        const reason = getUnsupportedUrlReason(url);
        if (reason) { setSrcErrMsg(reason); setSrcError(true); return; }
        const headerData = { cookie: d?.cookie, userAgent: d?.userAgent || d?.user_agent, referer: d?.referer, origin: d?.origin };
        const srcs: PlayerSource[] = [buildStreamSource(url, 'Server 1', 'HD', headerData)];
        if (d?.backupStreamUrl && d.backupStreamUrl !== url)
          srcs.push(buildStreamSource(d.backupStreamUrl, 'Server 2', 'SD', headerData));
        setSources(srcs);
      } else {
        const res = await apiClient.get(`/series/${id}`);
        const d   = res.data?.data || res.data;
        const allEps: any[] = [];
        if (Array.isArray(d?.seasons)) {
          for (const s of d.seasons) {
            if (Array.isArray(s.episodes)) allEps.push(...s.episodes);
          }
        }
        if (allEps.length === 0 && Array.isArray(d?.episodes)) allEps.push(...d.episodes);
        const ep  = allEps[epIdx] || allEps[0];
        const url = ep?.streamUrl || ep?.stream_url || ep?.videoUrl || ep?.url || '';
        if (!url) { setSrcErrMsg('No episode stream URL found.'); setSrcError(true); return; }
        if (isYouTubeUrl(url)) {
          const extracted = await extractYouTubeStream(url);
          if (extracted?.streamUrl) {
            const srcs: PlayerSource[] = [buildStreamSource(extracted.streamUrl, 'YouTube', 'HD', {})];
            setSources(srcs);
          } else {
            setYoutubeUrl(url);
          }
          return;
        }
        const reason = getUnsupportedUrlReason(url);
        if (reason) { setSrcErrMsg(reason); setSrcError(true); return; }
        const headerData = { cookie: ep?.cookie, userAgent: ep?.userAgent || ep?.user_agent, referer: ep?.referer, origin: ep?.origin };
        const srcs: PlayerSource[] = [buildStreamSource(url, 'Server 1', 'HD', headerData)];
        if (ep?.backupStreamUrl && ep.backupStreamUrl !== url)
          srcs.push(buildStreamSource(ep.backupStreamUrl, 'Server 2', 'SD', headerData));
        setSources(srcs);
      }
    } catch {
      setSrcErrMsg('Failed to load stream. Check your connection.'); setSrcError(true);
    } finally {
      setSrcLoad(false);
    }
  }, [id, cType, epIdx]);

  useEffect(() => { if (id) loadStream(); }, [id, loadStream]);

  // ── Open the singleton player once sources are ready ───────────────────────
  const openPlayer       = useGlobalPlayer((s) => s.open);
  const setNextEpisode   = useGlobalPlayer((s) => s.setNextEpisode);

  useEffect(() => {
    // Wait for VAST pre-roll to complete before opening the player
    if (sources.length === 0 || youtubeUrl) return;
    if (vastEnabled && !vastDone) return;
    openPlayer({
      title: contentTitle,
      logo: poster,
      contentId: id,
      contentType: cType,
      sources,
      isLive: false,
      playerRoute: `/player/${id}?type=${cType}`,
    });

    // Phase 3: register next episode so the overlay can appear when this one ends
    if (cType === 'series' && epIdx + 1 < episodes.length) {
      const nextEp = episodes[epIdx + 1];
      const nextTitle = nextEp?.title || nextEp?.name || `Episode ${epIdx + 2}`;
      setNextEpisode({
        title: nextTitle,
        epNumber: epIdx + 2,
        onPlay: () => {
          setNextEpisode(null);
          setEpIdx(epIdx + 1);
        },
        onDismiss: () => setNextEpisode(null),
      });
    } else {
      setNextEpisode(null);
    }
  }, [sources, youtubeUrl, vastEnabled, vastDone, contentTitle, poster, id, cType, openPlayer, episodes, epIdx, setNextEpisode]);

  // ── Focus management: top mode only on this screen (YouTube-like) ──────────
  // When user navigates away → shrink to mini. When they come back → restore top.
  useFocusEffect(
    useCallback(() => {
      const { mode, enterTop } = useGlobalPlayer.getState();
      if (mode === 'mini') enterTop();

      // Tell admin live-users page what the user is watching
      SocketService.startWatching({ type: cType, id, title: contentTitle, screen: 'player' });

      return () => {
        const { mode: m, enterMini } = useGlobalPlayer.getState();
        if (m === 'top' || m === 'fullscreen') enterMini();
        SocketService.stopWatching('home');
      };
    }, [id, cType, contentTitle])
  );

  // ── When episode changes, reload stream (the open effect will fire again) ──
  // epIdx already in loadStream deps, so it auto-reloads.

  // ── Rewarded ad — fires every 30 minutes during playback ──────────────────
  const PLAYER_REWARDED_MS = 30 * 60 * 1000;
  const [rewardedAdVisible, setRewardedAdVisible] = useState(false);
  const rewardedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRewardedAd = useCallback(() => {
    if (rewardedTimerRef.current) clearTimeout(rewardedTimerRef.current);
    rewardedTimerRef.current = setTimeout(() => setRewardedAdVisible(true), PLAYER_REWARDED_MS);
  }, []);

  useEffect(() => {
    if (sources.length > 0 || youtubeUrl) scheduleRewardedAd();
    return () => { if (rewardedTimerRef.current) clearTimeout(rewardedTimerRef.current); };
  }, [sources, youtubeUrl, scheduleRewardedAd]);

  const handleRewardedAdClose = useCallback(() => {
    setRewardedAdVisible(false);
    scheduleRewardedAd(); // restart 30-minute clock
  }, [scheduleRewardedAd]);

  // ── Back button → triggers PiP via GlobalVideoPlayer's back handler ─────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // GlobalVideoPlayer handles back: fullscreen→top, top→PiP (native).
      return false;
    });
    return () => sub.remove();
  }, []);

  const handleBack = useCallback(() => {
    // GlobalVideoPlayer's back handler triggers PiP automatically.
    // We just navigate away from this screen.
    if (router.canGoBack()) router.back();
    else router.replace('/(main)');
  }, []);

  // ── Below-player content ─────────────────────────────────────────────────────
  const belowPlayer = (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <View style={s.infoRow}>
        {poster ? (
          <Image source={{ uri: poster }} style={s.poster} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[C.primary, C.accent]} style={s.poster}>
            <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        )}
        <View style={s.infoText}>
          <Text style={s.infoTitle} numberOfLines={2}>{contentTitle}</Text>
          <View style={s.metaRow}>
            {year   ? <Text style={s.metaChip}>{year}</Text> : null}
            {rating ? <Text style={[s.metaChip, { borderColor: C.accent, color: C.accent }]}>★ {rating}</Text> : null}
            {genre  ? <Text style={s.metaChip}>{genre}</Text> : null}
          </View>
        </View>
      </View>

      <AdBanner placement="player_banner" style={{ marginTop: 0 }} />

      {(episodes.length > 0 || related.length > 0 || overview) && (
        <View style={s.tabBar}>
          {(['info', ...(episodes.length > 0 ? ['episodes'] : []), ...(related.length > 0 ? ['related'] : [])] as const).map(tab => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab as any)} style={s.tabItem}>
              <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
                {tab === 'info' ? 'INFO' : tab === 'episodes' ? 'EPISODES' : 'MORE LIKE THIS'}
              </Text>
              {activeTab === tab && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeTab === 'info' && overview ? (
        <View style={s.section}>
          <Text style={s.overviewTxt}>{overview}</Text>
        </View>
      ) : null}

      {activeTab === 'episodes' && episodes.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Episodes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {episodes.map((_: any, i: number) => {
              const active = i === epIdx;
              return (
                <TouchableOpacity key={i} onPress={() => setEpIdx(i)} style={[s.epBox, active && s.epBoxActive]}>
                  {active ? (
                    <LinearGradient colors={[C.primary, C.accent]} style={s.epGrad}>
                      <Text style={s.epTxtA}>{i + 1}</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={s.epTxt}>{i + 1}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {activeTab === 'related' && related.length > 0 && (
        <View style={s.section}>
          <View style={s.relGrid}>
            {related.map((item: any, i: number) => (
              <TouchableOpacity
                key={item.id || i}
                onPress={() => router.push(`/player/${item.id}?type=${cType}` as any)}
                style={s.relCard}
              >
                {item.posterUrl || item.thumbnailUrl ? (
                  <Image source={{ uri: item.posterUrl || item.thumbnailUrl }} style={s.relThumb} resizeMode="cover" />
                ) : (
                  <LinearGradient colors={['#7C3AED', '#2563EB']} style={s.relThumb}>
                    <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.5)" />
                  </LinearGradient>
                )}
                <Text style={s.relTitle} numberOfLines={2}>{item.title || item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );

  // ── YouTube embed (separate path — doesn't use singleton) ───────────────────
  if (youtubeUrl) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={[s.ytHeader, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity onPress={handleBack} style={s.ytBack} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.ytTitle} numberOfLines={1}>{contentTitle}</Text>
        </View>
        <YouTubeVideoBox url={youtubeUrl} />
        {belowPlayer}
      </View>
    );
  }

  // ── Normal: player is in the singleton overlay; this screen shows metadata ──
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* VAST pre-roll — shown once before playback starts when global VAST is enabled */}
      {vastEnabled && !vastDone && sources.length > 0 && (
        <VastPlayer
          vastUrl={globalAdConfig.vast.url}
          onComplete={handleVastComplete}
          defaultSkipSec={globalAdConfig.vast.skipAfterSeconds ?? 5}
        />
      )}

      {/* 30-second rewarded ad — fires every 30 min during movie/series playback */}
      <AdRewarded
        placement="player_rewarded"
        visible={rewardedAdVisible}
        onClose={handleRewardedAdClose}
        onRewardEarned={handleRewardedAdClose}
        rewardSeconds={30}
      />

      {/* Spacer for the video area (singleton covers it visually) */}
      <View style={{ height: Math.round(SW * 9 / 16), backgroundColor: '#000' }} />
      {belowPlayer}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  ytHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 10, backgroundColor: C.bg },
  ytBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  ytTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  infoRow:   { flexDirection: 'row', padding: 14, gap: 12 },
  poster:    { width: 72, height: 100, borderRadius: 8, overflow: 'hidden', backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  infoText:  { flex: 1, justifyContent: 'center', gap: 8 },
  infoTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  metaRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip:  { color: C.dim, fontSize: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tabBar:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', marginHorizontal: 14 },
  tabItem:      { paddingVertical: 10, paddingHorizontal: 4, marginRight: 18, position: 'relative' },
  tabTxt:       { color: C.dim, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  tabTxtActive: { color: '#fff' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: C.primary, borderRadius: 1 },
  section:      { paddingHorizontal: 14, paddingTop: 16 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  overviewTxt:  { color: C.dim, fontSize: 14, lineHeight: 22 },
  epBox:      { width: 46, height: 46, borderRadius: 10, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  epBoxActive:{ borderColor: C.primary },
  epGrad:     { width: '100%', height: '100%', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  epTxt:      { color: '#fff', fontSize: 14, fontWeight: '600' },
  epTxtA:     { color: '#fff', fontSize: 14, fontWeight: '700' },
  relGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  relCard:   { width: (SW - 38 - 10) / 2 },
  relThumb:  { width: '100%', height: 100, borderRadius: 8, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: C.card },
  relTitle:  { color: '#d1d5db', fontSize: 12, marginTop: 6, lineHeight: 17 },
});
