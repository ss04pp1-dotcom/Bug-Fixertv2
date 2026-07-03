/**
 * Live Channel Player Screen
 *
 * This screen NO LONGER mounts a video player.
 * The player is the SINGLETON GlobalVideoPlayer mounted at _layout.tsx.
 * This screen just:
 *   1. Fetches the channel's stream URL + ad config from the API
 *   2. If the channel has a vastUrl, shows the VastPlayer pre-roll first
 *   3. Calls useGlobalPlayer.open({...}) to load it into the singleton
 *   4. Shows related channels + info below
 *   5. Shows banner HTML ad driven by the global ad config (not per-channel)
 *
 * Back button → player enters native PiP (no reload, no rebuffer).
 * Mini mode has been fully removed — native OS PiP is used everywhere.
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, StatusBar, Image, FlatList, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '@/lib/api';
import { useLiveChannels } from '@/lib/api-hooks';
import { useGlobalPlayer, type PlayerSource } from '@/lib/player-store';
import { AdBanner } from '@/components/AdBanner';
import { VastPlayer } from '@/components/VastPlayer';
import { useGlobalAdConfig } from '@/hooks/useGlobalAdConfig';
import { useChannelAdGate } from '@/hooks/useChannelAdGate';

// ── Related channel card (3-col grid, white logo circle + onError fallback) ──
function RelatedCard({ item, onPress }: { item: any; onPress: () => void }) {
  const [imgErr, setImgErr] = React.useState(false);
  const showLogo = !!(item.logo && !imgErr);

  return (
    <TouchableOpacity style={s.chCard} onPress={onPress} activeOpacity={0.75}>
      {/* Same-category purple dot */}
      {item._sameCat && <View style={s.chSameCatBadge} />}

      {/* White logo circle */}
      <View style={s.chLogoCircle}>
        {showLogo ? (
          <Image
            source={{ uri: item.logo }}
            style={s.chLogoImg}
            resizeMode="contain"
            onError={() => setImgErr(true)}
          />
        ) : (
          <LinearGradient colors={[C.primary, C.accent]} style={s.chLogoFallback}>
            <Ionicons name="tv-outline" size={20} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        )}
      </View>

      {/* Channel name */}
      <Text style={s.chName} numberOfLines={1}>{item.name}</Text>

      {/* LIVE badge */}
      <View style={s.chLiveBadge}>
        <View style={s.chLiveDot} />
        <Text style={s.chLiveTxt}>LIVE</Text>
      </View>
    </TouchableOpacity>
  );
}

const C = {
  bg: '#050510', card: '#111827', primary: '#8B5CF6',
  accent: '#EC4899', live: '#EF4444', text: '#fff', dim: '#9CA3AF',
};

export default function LivePlayerScreen() {
  const {
    id,
    title: titleParam,
    streamUrl: passedUrl,
    logo: passedLogo,
    cat: passedCat,
    globalVastUrl,
    globalVastSkip,
  } = useLocalSearchParams<{
    id: string; title?: string; streamUrl?: string; logo?: string; cat?: string;
    globalVastUrl?: string; globalVastSkip?: string;
  }>();
  const vastSkipSec = globalVastSkip ? parseInt(globalVastSkip, 10) : 5;

  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const isLandscape = W > H;

  const contentTitle = titleParam || 'Live TV';
  const logoUrl      = passedLogo || '';
  const category     = passedCat  || 'Live TV';

  const [headerImgErr, setHeaderImgErr] = useState(false);

  // ── Stream sources ─────────────────────────────────────────────────────────
  const [sources, setSources]         = useState<PlayerSource[]>([]);
  const [fetchLoading, setFetchLoad]  = useState(true);
  const [fetchError, setFetchError]   = useState(false);
  const [activeTab, setActiveTab]     = useState<'channels' | 'info'>('channels');
  const openPlayer = useGlobalPlayer((s) => s.open);

  // ── VAST pre-roll state ────────────────────────────────────────────────────
  // globalVastUrl comes from route params (set by the global ad engine before
  // navigation). vastDone prevents re-showing after the user skips/completes.
  const [vastDone, setVastDone] = useState(false);

  // ── Current channel metadata (for related-channel ranking) ────────────────
  const [currentCatId, setCurrentCatId]     = useState<string | null>(null);
  const [currentCatName, setCurrentCatName] = useState<string | null>(null);
  const [currentLang, setCurrentLang]       = useState<string | null>(null);

  // ── Related channels ────────────────────────────────────────────────────────
  const { data: relatedRaw } = useLiveChannels({ limit: 200, isActive: true });

  const related = useMemo(() => {
    if (!relatedRaw || !Array.isArray(relatedRaw)) return [];

    interface ApiChannel {
      id?: string;
      name?: string;
      logoUrl?: string;
      logo?: string;
      language?: string;
      categoryId?: string;
      category?: string | { id: string; name: string };
      primaryStreamUrl?: string;
      streamUrl?: string;
    }

    const pool = (relatedRaw as ApiChannel[]).filter((ch) => ch.id !== id);
    const scored = pool.map((ch) => {
      let chCatId: string | null = null;
      let chCatName = '';
      if (typeof ch.category === 'object' && ch.category) {
        chCatId = ch.category.id;
        chCatName = ch.category.name;
      } else if (typeof ch.category === 'string') {
        chCatName = ch.category;
      }
      if (ch.categoryId) chCatId = ch.categoryId;

      const chLang    = (ch.language || '').trim().toLowerCase();
      let score = 0;
      if (currentCatId && chCatId && chCatId === currentCatId) score += 3;
      else if (currentCatName && chCatName && chCatName.toLowerCase() === currentCatName.toLowerCase()) score += 3;
      if (currentLang && chLang && chLang === currentLang.toLowerCase()) score += 2;
      if (ch.logoUrl || ch.logo) score += 1;
      return {
        _score: score, _sameCat: score >= 3,
        id: ch.id || '', name: ch.name || '',
        logo: ch.logoUrl || ch.logo || '',
        cat: chCatName || ch.language || 'Live TV',
        language: ch.language || '',
        streamUrl: ch.primaryStreamUrl || ch.streamUrl || '',
      };
    });
    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return a.name.localeCompare(b.name);
    });
    return scored.slice(0, 30);
  }, [relatedRaw, id, currentCatId, currentCatName, currentLang]);

  // ── Build sources from channel response ───────────────────────────────────
  const buildSources = useCallback((ch: any, overrideFirstUrl?: string): PlayerSource[] => {
    const srcs: PlayerSource[] = [];
    if (Array.isArray(ch?.servers) && ch.servers.length > 0) {
      const sorted = [...ch.servers].sort((a: any, b: any) => a.priority - b.priority);
      sorted.forEach((srv: any, i: number) => {
        const cookieExpired = srv.cookieExpired === true;
        const headers: Record<string, string> = {
          'User-Agent': srv.userAgent || 'Mini Player/1.1.2 (Linux;Android 16) AndroidXMedia3/1.8.0',
        };
        if (srv.cookie)    headers['Cookie']     = srv.cookie;
        if (srv.referer)   headers['Referer']    = srv.referer;
        if (srv.origin)    headers['Origin']     = srv.origin;
        srcs.push({
          url: srv.link,
          label: `Server ${i + 1}`,
          quality: i === 0 ? 'HD' : 'SD',
          cookieExpired,
          cookieExpiresAt: srv.cookieExpiresAt ?? null,
          headers,
        });
      });
    } else {
      if (ch?.primaryStreamUrl) srcs.push({ url: ch.primaryStreamUrl, label: 'Server 1', quality: ch.streamType || 'HD' });
      if (ch?.backupStreamUrl && ch.backupStreamUrl !== ch.primaryStreamUrl)
        srcs.push({ url: ch.backupStreamUrl, label: 'Server 2', quality: 'SD' });
      if (ch?.thirdBackupUrl && ch.thirdBackupUrl !== ch.primaryStreamUrl)
        srcs.push({ url: ch.thirdBackupUrl, label: 'Server 3', quality: 'SD' });
    }
    const hasServerSources = Array.isArray(ch?.servers) && ch.servers.length > 0;
    if (overrideFirstUrl && !hasServerSources && !srcs.find(s => s.url === overrideFirstUrl)) {
      srcs.unshift({ url: overrideFirstUrl, label: 'Server 1', quality: 'HD' });
    }
    return srcs;
  }, []);

  // ── Load stream URL ────────────────────────────────────────────────────────
  const loadStream = useCallback(async () => {
    setFetchLoad(true); setFetchError(false); setSources([]);

    try {
      let ch: any = null;
      let authFailed = false;
      try {
        const res = await apiClient.get(`/channels/${id}/sources`);
        ch = res.data?.data || res.data;
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          authFailed = true;
        } else {
          try {
            const res = await apiClient.get(`/channels/${id}`);
            ch = res.data?.data || res.data;
          } catch {
            // Both endpoints failed — fall through to passedUrl below
          }
        }
      }

      if (authFailed) {
        if (passedUrl) {
          setSources([{ url: passedUrl, label: 'Server 1', quality: 'HD' }]);
        } else {
          setFetchError(true);
        }
        return;
      }

      setCurrentCatId(ch?.categoryId || ch?.category?.id || null);
      setCurrentCatName(ch?.category?.name || ch?.category || passedCat || null);
      setCurrentLang((ch?.language || '').trim().toLowerCase() || null);

      const srcs = buildSources(ch, passedUrl || undefined);
      if (srcs.length === 0) setFetchError(true);
      else setSources(srcs);
    } catch {
      if (passedUrl) {
        setSources([{ url: passedUrl, label: 'Server 1', quality: 'HD' }]);
      } else {
        setFetchError(true);
      }
    } finally {
      setFetchLoad(false);
    }
  }, [id, passedUrl, buildSources, passedCat]);

  useEffect(() => { if (id) loadStream(); }, [id, loadStream]);

  // ── Open the singleton player once sources are ready ───────────────────────
  // If there is a VAST pre-roll, we wait until the ad is done before opening
  // the player so the ad plays in silence and the channel doesn't start yet.
  useEffect(() => {
    if (sources.length === 0) return;
    // If VAST was triggered by the global ad engine (globalVastUrl in route params),
    // hold off until the pre-roll finishes before opening the stream player.
    if (globalVastUrl && !vastDone) return;

    openPlayer({
      title: contentTitle,
      logo: logoUrl,
      contentId: id,
      contentType: 'channel',
      sources,
      isLive: true,
      startInTop: true,
      playerRoute: `/live-player/${id}`,
    });
  }, [sources, globalVastUrl, vastDone, contentTitle, logoUrl, id, openPlayer]);

  // ── VAST pre-roll complete handler ─────────────────────────────────────────
  const handleVastComplete = useCallback(() => {
    setVastDone(true);
  }, []);

  // ── Focus management: top mode only on this screen ─────────────────────────
  useFocusEffect(
    useCallback(() => {
      const { mode, enterTop } = useGlobalPlayer.getState();
      if (mode === 'mini') enterTop();

      return () => {
        const { mode: m, enterMini } = useGlobalPlayer.getState();
        if (m === 'top' || m === 'fullscreen') enterMini();
      };
    }, [])
  );

  // ── Global ad engine — drives VAST pre-roll + Smartlink on channel switches ─
  const globalAdConfig  = useGlobalAdConfig();
  const channelAdGate   = useChannelAdGate(globalAdConfig);

  // Switch to another channel — always goes through the global ad engine so
  // Smartlink / VAST fire according to the persistent switch counter.
  const switchChannel = useCallback((ch: typeof related[0]) => {
    channelAdGate.requestChannel(
      ch.id,
      { title: ch.name, streamUrl: ch.streamUrl ?? '', logo: ch.logo ?? '', cat: ch.cat ?? '' },
      { replace: true }, // replace so back button doesn't loop between channels
    );
  }, [channelAdGate]);

  // ── Loading / error state for the metadata area ────────────────────────────
  if (fetchLoading && sources.length === 0) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar translucent barStyle="light-content" backgroundColor="transparent" />
        <Ionicons name="tv-outline" size={48} color={C.primary} />
        <Text style={{ color: C.dim, marginTop: 12 }}>Loading channel…</Text>
      </View>
    );
  }

  if (fetchError && sources.length === 0) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <StatusBar translucent barStyle="light-content" backgroundColor="transparent" />
        <Ionicons name="alert-circle-outline" size={48} color={C.live} />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 12 }}>Channel Unavailable</Text>
        <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
          Could not load this channel. Try again later.
        </Text>
        <TouchableOpacity onPress={loadStream} style={{ marginTop: 16, backgroundColor: C.primary, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 22 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Cookie-expired banner ──────────────────────────────────────────────────
  const hasCookieExpired = sources.some((s) => s.cookieExpired === true);

  // ── VAST pre-roll overlay ──────────────────────────────────────────────────
  // Show VastPlayer as a fullscreen modal when:
  //  • Sources are ready (we know what to play next)
  //  • This channel has a vastUrl configured
  //  • We haven't already shown it this visit
  // VAST is triggered by the global ad engine — the URL arrives via route params.
  const showVast = sources.length > 0 && !!globalVastUrl && !vastDone;

  return (
    <View style={s.root}>
      <StatusBar translucent barStyle="light-content" backgroundColor="transparent" />

      {/* VAST pre-roll — fullscreen modal driven by global ad engine */}
      {showVast && (
        <VastPlayer
          vastUrl={globalVastUrl as string}
          onComplete={handleVastComplete}
          defaultSkipSec={vastSkipSec}
        />
      )}

      {/* Spacer for the video area */}
      <View style={{ height: isLandscape ? 0 : insets.top + Math.round(W * 9 / 16), backgroundColor: '#000' }} />

      <View style={{ flex: 1, backgroundColor: C.bg }}>

        {/* Cookie-expired warning banner */}
        {hasCookieExpired && (
          <View style={{
            backgroundColor: '#78350f', borderLeftWidth: 3, borderLeftColor: '#f59e0b',
            marginHorizontal: 12, marginTop: 8, padding: 10, borderRadius: 8,
            flexDirection: 'row', alignItems: 'center', gap: 8,
          }}>
            <Ionicons name="warning-outline" size={18} color="#f59e0b" />
            <Text style={{ color: '#fde68a', fontSize: 12, flex: 1, lineHeight: 17 }}>
              Stream credential (cookie) has expired. Please contact admin to refresh the channel credentials.
            </Text>
          </View>
        )}

        {/* Channel header */}
        <View style={s.channelHeader}>
          {logoUrl && !headerImgErr ? (
            <Image
              source={{ uri: logoUrl }}
              style={s.channelLogo}
              resizeMode="contain"
              onError={() => setHeaderImgErr(true)}
            />
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

        {/* HTML Banner Ad — position & HTML driven by global ad config */}
        <AdBanner placement="channel_banner" />

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
            numColumns={REL_COLS}
            contentContainerStyle={s.grid}
            columnWrapperStyle={s.columnWrapper}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={related.length > 0 ? () => (
              <View style={s.relatedHeader}>
                <Ionicons name="tv-outline" size={13} color={C.primary} />
                <Text style={s.relatedHeaderTxt}>
                  {related.filter((r: any) => r._sameCat).length > 0
                    ? `${related.filter((r: any) => r._sameCat).length} same category · `
                    : ''}{related.length} channels
                </Text>
              </View>
            ) : null}
            renderItem={({ item }: { item: any }) => (
              <RelatedCard item={item} onPress={() => switchChannel(item)} />
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

const REL_H_PAD  = 10;
const REL_GAP    = 8;
const REL_COLS   = 3;
const REL_CARD_W = Math.floor((SW - REL_H_PAD * 2 - REL_GAP * (REL_COLS - 1)) / REL_COLS);
const REL_LOGO_D = Math.round(REL_CARD_W * 0.56);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  channelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  channelLogo:  { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
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

  grid:          { paddingHorizontal: REL_H_PAD, paddingVertical: 12, paddingBottom: 100 },
  columnWrapper: { gap: REL_GAP, marginBottom: REL_GAP },

  chCard: {
    width: REL_CARD_W,
    backgroundColor: '#141418',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222228',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 6,
    overflow: 'hidden',
  },

  chLogoCircle: {
    width: REL_LOGO_D,
    height: REL_LOGO_D,
    borderRadius: REL_LOGO_D / 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  chLogoImg: {
    width: REL_LOGO_D - 6,
    height: REL_LOGO_D - 6,
    borderRadius: (REL_LOGO_D - 6) / 2,
  },
  chLogoFallback: {
    width: REL_LOGO_D,
    height: REL_LOGO_D,
    borderRadius: REL_LOGO_D / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  chName: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center', width: '100%' },

  chLiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,59,48,0.18)', borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)',
  },
  chLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.live },
  chLiveTxt: { color: C.live, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  chSameCatBadge: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },

  relatedHeader:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10 },
  relatedHeaderTxt: { color: C.dim, fontSize: 12 },

  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt: { color: C.dim, fontSize: 14 },
  infoPad:  { padding: 14, gap: 2 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  infoLabel: { color: C.dim, fontSize: 13, width: 80 },
  infoVal:  { color: '#fff', fontSize: 13, flex: 1 },
});
