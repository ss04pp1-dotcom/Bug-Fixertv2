import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, StatusBar, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '@/lib/api';
import { useMovie, useSeries, useRelatedMovies, useRecommendations } from '@/lib/api-hooks';
import PremiumVideoPlayer, { type StreamSource } from '@/components/PremiumVideoPlayer';
import { YouTubeVideoBox, isYouTubeUrl } from '@/components/YouTubePlayer';
import { usePlayerStore } from '@/lib/player-store';

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

export default function PlayerScreen() {
  const { id, type, title: titleParam, season } = useLocalSearchParams<{
    id: string; type?: string; title?: string; season?: string;
  }>();
  const insets = useSafeAreaInsets();

  // Channels always use the live player — redirect immediately
  useEffect(() => {
    if (type === 'channel' && id) {
      router.replace({
        pathname: `/live-player/${id}` as any,
        params: { title: titleParam || '', streamUrl: '', logo: '', cat: 'Live TV' },
      });
    }
  }, [type, id, titleParam]);

  const cType = (type || 'movie') as 'movie' | 'series';

  // ── Stream sources ──────────────────────────────────────────────────────────
  const [sources, setSources]       = useState<StreamSource[]>([]);
  const [srcLoading, setSrcLoad]    = useState(true);
  const [srcError, setSrcError]     = useState(false);
  const [srcErrorMsg, setSrcErrMsg] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);

  // ── Series episode state ────────────────────────────────────────────────────
  const [epIdx, setEpIdx]       = useState(season ? parseInt(season) - 1 : 0);
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

  // ── Build headers from stream source data ────────────────────────────────────
  const buildStreamSource = useCallback((
    rawUrl: string,
    label: string,
    quality: string,
    data?: { cookie?: string; userAgent?: string; referer?: string; origin?: string },
  ): StreamSource => {
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

    const headers: Record<string, string> = {};
    const cookie    = data?.cookie    || pipeHeaders['cookie'];
    const userAgent = data?.userAgent || pipeHeaders['user-agent'];
    const referer   = data?.referer   || pipeHeaders['referer'] || pipeHeaders['referrer'];
    const origin    = data?.origin    || pipeHeaders['origin'];
    if (cookie)    headers['Cookie']     = cookie;
    if (userAgent) headers['User-Agent'] = userAgent;
    if (referer)   headers['Referer']    = referer;
    if (origin)    headers['Origin']     = origin;

    return { label, url, quality, ...(Object.keys(headers).length ? { headers } : {}) };
  }, []);

  // ── Load stream ─────────────────────────────────────────────────────────────
  const loadStream = useCallback(async () => {
    setSrcLoad(true); setSrcError(false); setSrcErrMsg(''); setYoutubeUrl(null);
    try {
      if (cType === 'movie') {
        const res = await apiClient.get(`/movies/${id}`);
        const d   = res.data?.data || res.data;
        const url = d?.streamUrl || d?.stream_url || d?.videoUrl || d?.video_url || d?.url || '';
        if (!url) { setSrcErrMsg('No stream URL configured for this content.'); setSrcError(true); return; }
        if (isYouTubeUrl(url)) { setYoutubeUrl(url); return; }
        const reason = getUnsupportedUrlReason(url);
        if (reason) { setSrcErrMsg(reason); setSrcError(true); return; }
        const headerData = { cookie: d?.cookie, userAgent: d?.userAgent || d?.user_agent, referer: d?.referer, origin: d?.origin };
        const srcs: StreamSource[] = [buildStreamSource(url, 'Server 1', 'HD', headerData)];
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
        if (isYouTubeUrl(url)) { setYoutubeUrl(url); return; }
        const reason = getUnsupportedUrlReason(url);
        if (reason) { setSrcErrMsg(reason); setSrcError(true); return; }
        const headerData = { cookie: ep?.cookie, userAgent: ep?.userAgent || ep?.user_agent, referer: ep?.referer, origin: ep?.origin };
        const srcs: StreamSource[] = [buildStreamSource(url, 'Server 1', 'HD', headerData)];
        if (ep?.backupStreamUrl && ep.backupStreamUrl !== url)
          srcs.push(buildStreamSource(ep.backupStreamUrl, 'Server 2', 'SD', headerData));
        setSources(srcs);
      }
    } catch {
      setSrcErrMsg('Failed to load stream. Check your connection.'); setSrcError(true);
    } finally {
      setSrcLoad(false);
    }
  }, [id, cType, epIdx, buildStreamSource]);

  useEffect(() => { if (id) loadStream(); }, [id, loadStream]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNext = episodes.length > 0 && epIdx < episodes.length - 1
    ? () => setEpIdx(i => i + 1) : undefined;
  const handlePrev = episodes.length > 0 && epIdx > 0
    ? () => setEpIdx(i => i - 1) : undefined;

  const epList = episodes.map((ep: any, i: number) => ({
    id:     ep.id || String(i),
    title:  ep.title || ep.name || `Episode ${i + 1}`,
    number: ep.episodeNumber || i + 1,
  }));

  const openMiniPlayer = usePlayerStore((s) => s.open);
  const closeMiniPlayer = usePlayerStore((s) => s.close);

  // Close mini player when full player opens
  useEffect(() => { closeMiniPlayer(); }, [id]);

  const handleBack = useCallback(() => {
    if (sources.length > 0) {
      openMiniPlayer({
        title: contentTitle,
        logo: poster,
        contentId: id,
        contentType: cType,
        sources: sources.map((s) => ({ url: s.url, headers: s.headers, label: s.label })),
        isLive: false,
      });
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(main)');
  }, [sources, contentTitle, poster, id, cType, openMiniPlayer]);

  // ── Shared below-player content ─────────────────────────────────────────────
  const belowPlayer = (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* Content header */}
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

      {/* Tab bar */}
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

      {/* Info tab */}
      {activeTab === 'info' && overview ? (
        <View style={s.section}>
          <Text style={s.overviewTxt}>{overview}</Text>
        </View>
      ) : null}

      {/* Episodes tab */}
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

      {/* Related tab */}
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

  // ── YouTube URL → embed player + show related below ─────────────────────────
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

  // ── Normal stream player ────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <PremiumVideoPlayer
        sources={sources}
        title={contentTitle}
        isLoading={srcLoading}
        hasError={srcError}
        errorMessage={srcErrorMsg}
        onBack={handleBack}
        onRetry={loadStream}
        onRefreshStream={loadStream}
        contentId={cType === 'series' && episodes[epIdx]?.id ? episodes[epIdx].id : id}
        contentType={cType}
        episodes={epList}
        currentEpIdx={epIdx}
        onEpisodeChange={setEpIdx}
        onNext={handleNext}
        onPrev={handlePrev}
      />

      {belowPlayer}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  ytHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 8, gap: 10,
    backgroundColor: C.bg,
  },
  ytBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
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
