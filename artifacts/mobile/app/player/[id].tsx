import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, StatusBar, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '@/lib/api';
import { useMovie, useSeries, useRelatedMovies } from '@/lib/api-hooks';
import PremiumVideoPlayer, { type StreamSource } from '@/components/PremiumVideoPlayer';

const C = {
  bg: '#050510', card: '#111827', primary: '#8B5CF6',
  accent: '#EC4899', text: '#fff', dim: '#9CA3AF',
};

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

  // ── Stream sources ─────────────────────────────────────────────────────────
  const [sources, setSources]     = useState<StreamSource[]>([]);
  const [srcLoading, setSrcLoad]  = useState(true);
  const [srcError, setSrcError]   = useState(false);

  // ── Series episode state ───────────────────────────────────────────────────
  const [epIdx, setEpIdx]         = useState(season ? parseInt(season) - 1 : 0);
  const [activeTab, setActiveTab] = useState<'info' | 'episodes' | 'related'>('info');

  // ── Content data ───────────────────────────────────────────────────────────
  const { data: movieData }   = useMovie(cType === 'movie' ? id : '');
  const { data: seriesData }  = useSeries(cType === 'series' ? id : '');
  const { data: relatedRaw }  = useRelatedMovies(cType === 'movie' ? id : '');

  const contentData  = movieData || seriesData;
  const contentTitle = titleParam || (contentData as any)?.title || (contentData as any)?.name || 'Now Playing';
  // FIX 17: API returns 'poster' not 'posterUrl'; series uses 'poster' too
  const poster       = (contentData as any)?.poster || (contentData as any)?.posterUrl || (contentData as any)?.thumbnailUrl || '';
  const overview     = (contentData as any)?.description || (contentData as any)?.overview || '';
  const rating       = (contentData as any)?.rating || '';
  const year         = (contentData as any)?.releaseYear || (contentData as any)?.year || '';
  const genre        = (contentData as any)?.genre || '';

  // FIX 13: Series এ episodes সরাসরি নয়, seasons[].episodes[] এ থাকে
  const episodes: any[] = useMemo(() => {
    const sd = seriesData as any;
    if (sd?.seasons?.length) {
      // সব seasons এর episodes flat করো
      const all: any[] = [];
      for (const season of sd.seasons) {
        if (Array.isArray(season.episodes)) all.push(...season.episodes);
      }
      return all;
    }
    if (sd?.episodes) return sd.episodes;
    return [];
  }, [seriesData]);

  const related: any[] = useMemo(() => {
    const d = (relatedRaw as any)?.data || (relatedRaw as any) || [];
    return Array.isArray(d) ? d.slice(0, 12) : [];
  }, [relatedRaw]);

  // ── Load stream ────────────────────────────────────────────────────────────
  const loadStream = useCallback(async () => {
    setSrcLoad(true); setSrcError(false);
    try {
      if (cType === 'movie') {
        const res = await apiClient.get(`/movies/${id}`);
        const d   = res.data?.data || res.data;
        // Check all common stream URL field names
        const url = d?.streamUrl || d?.stream_url || d?.videoUrl || d?.video_url || d?.url || '';
        if (url) {
          const srcs = [{ label: 'Server 1', url, quality: 'HD' }];
          if (d?.backupStreamUrl && d.backupStreamUrl !== url)
            srcs.push({ label: 'Server 2', url: d.backupStreamUrl, quality: 'SD' });
          setSources(srcs);
        } else {
          setSrcError(true);
        }
      } else {
        // Series: seasons → episodes[epIdx] → streamUrl
        const res = await apiClient.get(`/series/${id}`);
        const d   = res.data?.data || res.data;
        // Flat all episodes from all seasons
        const allEps: any[] = [];
        if (Array.isArray(d?.seasons)) {
          for (const season of d.seasons) {
            if (Array.isArray(season.episodes)) {
              allEps.push(...season.episodes);
            }
          }
        }
        if (allEps.length === 0 && Array.isArray(d?.episodes)) {
          allEps.push(...d.episodes);
        }
        const ep  = allEps[epIdx] || allEps[0];
        const url = ep?.streamUrl || ep?.stream_url || ep?.videoUrl || ep?.url || '';
        if (url) {
          const srcs = [{ label: 'Server 1', url, quality: 'HD' }];
          if (ep?.backupStreamUrl && ep.backupStreamUrl !== url)
            srcs.push({ label: 'Server 2', url: ep.backupStreamUrl, quality: 'SD' });
          setSources(srcs);
        } else {
          setSrcError(true);
        }
      }
    } catch {
      setSrcError(true);
    } finally {
      setSrcLoad(false);
    }
  }, [id, cType, epIdx]);

  useEffect(() => { if (id) loadStream(); }, [id, loadStream]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNext = episodes.length > 0 && epIdx < episodes.length - 1
    ? () => setEpIdx(i => i + 1) : undefined;
  const handlePrev = episodes.length > 0 && epIdx > 0
    ? () => setEpIdx(i => i - 1) : undefined;

  const epList = episodes.map((ep: any, i: number) => ({
    id:     ep.id || String(i),
    title:  ep.title || ep.name || `Episode ${i + 1}`,
    number: ep.episodeNumber || i + 1,
  }));

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Premium Player ──────────────────────────────────────────────── */}
      <PremiumVideoPlayer
        sources={sources}
        title={contentTitle}
        isLoading={srcLoading}
        hasError={srcError}
        onBack={() => router.back()}
        onRetry={loadStream}
        onRefreshStream={loadStream}
        // FIX 16: Series হলে active episode id পাঠাও (series id নয়)
        contentId={cType === 'series' && episodes[epIdx]?.id ? episodes[epIdx].id : id}
        contentType={cType}
        episodes={epList}
        currentEpIdx={epIdx}
        onEpisodeChange={setEpIdx}
        onNext={handleNext}
        onPrev={handlePrev}
      />

      {/* ── Below player (portrait content) ────────────────────────────── */}
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
              {year ? <Text style={s.metaChip}>{year}</Text> : null}
              {rating ? <Text style={[s.metaChip, { borderColor: C.accent, color: C.accent }]}>★ {rating}</Text> : null}
              {genre ? <Text style={s.metaChip}>{genre}</Text> : null}
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
                  onPress={() => router.push(`/movie/${item.id}` as any)}
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
    </View>
  );
}

const { width: SW } = Dimensions.get('window');

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },

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
