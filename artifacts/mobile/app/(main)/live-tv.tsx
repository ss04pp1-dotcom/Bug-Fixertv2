import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  Dimensions, ScrollView, Image, TextInput,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveChannelsInfinite, useCategories } from '@/lib/api-hooks';
import { Config } from '@/constants/config';
import { AdBanner } from '@/components/AdBanner';
import { useChannelAdGateContext } from '@/lib/channel-ad-gate-context';

const { width: W } = Dimensions.get('window');

const C = {
  bg:      '#0A0A0F',
  card:    '#141418',
  border:  '#222228',
  primary: '#8B5CF6',
  accent:  '#EC4899',
  live:    '#FF3B30',
  text:    '#FFFFFF',
  textSec: '#A1A1AA',
  logoBg:  '#FFFFFF',
};

// 3-column grid dimensions
const H_PAD   = 10;
const COL_GAP = 8;
const COLS    = 3;
const CARD_W  = Math.floor((W - H_PAD * 2 - COL_GAP * (COLS - 1)) / COLS);
const LOGO_D  = Math.round(CARD_W * 0.56); // logo circle diameter
const CARD_H  = LOGO_D + 56; // logo + name + badge

const GRADIENTS: [string, string][] = [
  ['#8B5CF6', '#EC4899'], ['#059669', '#047857'], ['#DC2626', '#991B1B'],
  ['#D97706', '#92400E'], ['#2563EB', '#1D4ED8'], ['#0891B2', '#0E7490'],
  ['#B45309', '#78350F'], ['#6D28D9', '#5B21B6'], ['#BE185D', '#9D174D'],
  ['#047857', '#064E3B'],
];

function mapChannel(ch: any, i: number) {
  return {
    id:                 ch.id || String(i),
    name:               ch.name || '',
    cat:                ch.category?.name || ch.language || ch.country || 'Live TV',
    color:              GRADIENTS[i % GRADIENTS.length] as [string, string],
    letter:             (ch.name || 'C')[0].toUpperCase(),
    logo:               ch.logoUrl || ch.logo || '',
    isLive:             ch.isLive !== false,
    streamUrl:          ch.primaryStreamUrl || ch.streamUrl || '',
    isSmartlinkEnabled: ch.isSmartlinkEnabled === true,
    smartlinkUrl:       ch.smartlinkUrl || '',
  };
}

// ── Grid channel card ─────────────────────────────────────────────────────────
function ChannelCard({ item, onSelect }: { item: ReturnType<typeof mapChannel>; onSelect: (item: ReturnType<typeof mapChannel>) => void }) {
  const [imgErr, setImgErr] = useState(false);
  const showLogo = item.logo && !imgErr;
  const logoUri  = item.logo ? Config.imageUrl(item.logo) : '';

  return (
    <Pressable
      style={s.card}
      onPress={() => onSelect(item)}
      android_ripple={{ color: 'rgba(139,92,246,0.15)', borderless: false }}
    >
      {/* Logo circle */}
      <View style={s.logoCircle}>
        {showLogo ? (
          <Image
            source={{ uri: logoUri }}
            style={s.logoImg}
            resizeMode="contain"
            onError={() => setImgErr(true)}
          />
        ) : (
          <LinearGradient colors={item.color} style={s.logoFallback}>
            <Text style={s.logoLetter}>{item.letter}</Text>
          </LinearGradient>
        )}
      </View>

      {/* Channel name */}
      <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>

      {/* LIVE badge */}
      <View style={s.liveBadge}>
        <View style={s.liveDot} />
        <Text style={s.liveTxt}>LIVE</Text>
      </View>
    </Pressable>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={[s.card, { gap: 8 }]}>
      <View style={[s.logoCircle, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
      <View style={{ height: 11, width: '70%', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4 }} />
      <View style={{ height: 16, width: 44, backgroundColor: 'rgba(255,59,48,0.12)', borderRadius: 4 }} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LiveTVScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab]       = useState('All');
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [searchVisible, setSearchVis]   = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: categoryList = [] } = useCategories();

  // Build tab list (names) and a name→id map for server-side filtering
  const tabs = useMemo<string[]>(
    () => ['All', ...categoryList.map((c: any) => c.name as string).filter(Boolean)],
    [categoryList],
  );
  const tabIdMap = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    categoryList.forEach((c: any) => { if (c.name && c.id) m[c.name] = c.id; });
    return m;
  }, [categoryList]);

  // When search is active, ignore category; when a category tab is selected, pass its ID to the API
  const activeCategoryId = !debouncedSearch && activeTab !== 'All'
    ? tabIdMap[activeTab]
    : undefined;

  const hookParams = useMemo(
    () => (debouncedSearch || activeCategoryId
      ? { search: debouncedSearch || undefined, categoryId: activeCategoryId }
      : undefined),
    [debouncedSearch, activeCategoryId],
  );

  const {
    data: infiniteData, fetchNextPage, hasNextPage,
    isFetchingNextPage, isLoading, refetch: refetchBrowse,
  } = useLiveChannelsInfinite(hookParams);

  // ── Ad gate context (must be declared before any usage of globalConfig) ──────
  const { requestChannel, globalConfig } = useChannelAdGateContext();

  const allChannels = useMemo(() => {
    if (!infiniteData?.pages) return [];
    return infiniteData.pages.flatMap((page: any, pi: number) =>
      page.items.map((ch: any, i: number) => mapChannel(ch, pi * 50 + i))
    );
  }, [infiniteData]);

  // Server handles both search and category filtering — no client-side filter needed
  const filtered = allChannels;

  // ── Chunked grid rows (enables banner injection between channel rows) ────────
  type RowItem =
    | { kind: 'ch-row'; chs: ReturnType<typeof mapChannel>[]; key: string }
    | { kind: 'banner'; key: string };

  const bannerEnabled    = globalConfig.banner.enabled && globalConfig.banner.positions.channelGrid;
  const bannerEveryNRows = Math.max(1, Math.ceil((globalConfig.banner.positions.channelGridFrequency || 6) / COLS));

  const chunkedFiltered = useMemo<RowItem[]>(() => {
    const rows: RowItem[] = [];
    let chRowCount = 0;
    for (let i = 0; i < filtered.length; i += COLS) {
      rows.push({ kind: 'ch-row', chs: filtered.slice(i, i + COLS), key: `row-${i}` });
      chRowCount++;
      if (bannerEnabled && chRowCount % bannerEveryNRows === 0) {
        rows.push({ kind: 'banner', key: `banner-${i}` });
      }
    }
    return rows;
  }, [filtered, bannerEnabled, bannerEveryNRows]);

  // Reset active tab to 'All' if its category disappears from the list
  useEffect(() => {
    if (activeTab !== 'All' && tabs.length > 1 && !tabs.includes(activeTab)) setActiveTab('All');
  }, [tabs, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchBrowse();
    setRefreshing(false);
  }, [refetchBrowse]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const handleSelectChannel = useCallback((item: ReturnType<typeof mapChannel>) => {
    requestChannel(item.id, {
      title:     item.name,
      logo:      item.logo,
      cat:       item.cat,
      streamUrl: item.streamUrl,
    });
  }, [requestChannel]);

  const renderRow = useCallback(({ item }: { item: RowItem }) => {
    if (item.kind === 'banner') {
      return (
        <AdBanner
          placement="channel-grid-banner"
          htmlCode={globalConfig.banner.enabled && globalConfig.banner.htmlCode ? globalConfig.banner.htmlCode : undefined}
          style={{ marginBottom: COL_GAP }}
        />
      );
    }
    return (
      <View style={{ flexDirection: 'row', gap: COL_GAP, marginBottom: COL_GAP }}>
        {item.chs.map(ch => (
          <ChannelCard key={ch.id} item={ch} onSelect={handleSelectChannel} />
        ))}
        {item.chs.length < COLS && Array.from({ length: COLS - item.chs.length }, (_, j) => (
          <View key={`empty-${j}`} style={{ width: CARD_W }} />
        ))}
      </View>
    );
  }, [handleSelectChannel, globalConfig.banner.enabled, globalConfig.banner.htmlCode]);

  const renderSkelRow = useCallback(() => (
    <View style={{ flexDirection: 'row', gap: COL_GAP, marginBottom: COL_GAP }}>
      <SkeletonCard /><SkeletonCard /><SkeletonCard />
    </View>
  ), []);

  const ListFooter = useMemo(() => {
    if (isFetchingNextPage) return (
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={{ color: C.textSec, fontSize: 12, marginTop: 6 }}>Loading more…</Text>
      </View>
    );
    if (!hasNextPage && filtered.length > 0) return (
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <Text style={{ color: C.textSec, fontSize: 12 }}>All channels loaded</Text>
      </View>
    );
    return null;
  }, [isFetchingNextPage, hasNextPage, filtered.length]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
          <Text style={s.headerTitle}>Live TV</Text>
        </Pressable>
        <View style={s.headerRight}>
          <Pressable
            onPress={() => { setSearchVis(v => !v); if (searchVisible) setSearch(''); }}
            style={s.iconBtn}
          >
            <Ionicons name={searchVisible ? 'close' : 'search'} size={22} color={C.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/notifications' as any)} style={s.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={C.text} />
          </Pressable>
        </View>
      </View>

      {/* ── Search bar ─────────────────────────────────────────── */}
      {searchVisible && (
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color={C.textSec} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search channels…"
            placeholderTextColor={C.textSec}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={C.textSec} />
            </Pressable>
          )}
        </View>
      )}

      {/* ── Category tabs ──────────────────────────────────────── */}
      {!debouncedSearch && (
        <View style={{ paddingBottom: 6 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
            {tabs.map(tab => {
              const active = activeTab === tab;
              return (
                <Pressable key={tab} onPress={() => setActiveTab(tab)} style={{ marginRight: 8 }}>
                  {active ? (
                    <LinearGradient colors={[C.primary, C.accent]} style={s.tabChip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Text style={[s.tabChipTxt, { color: '#FFF', fontWeight: '600' }]}>{tab}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[s.tabChip, s.tabChipInactive]}>
                      <Text style={s.tabChipTxt}>{tab}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <AdBanner placement="home-banner" style={{ marginTop: 4, marginBottom: 0 }} />

      {/* ── Count hint ─────────────────────────────────────────── */}
      {!isLoading && filtered.length > 0 && (
        <Text style={s.countTxt}>
          {debouncedSearch
            ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${debouncedSearch}"`
            : `${filtered.length}+ channel${filtered.length !== 1 ? 's' : ''}${activeTab !== 'All' ? ` · ${activeTab}` : ''}`}
        </Text>
      )}

      {/* ── Grid content ───────────────────────────────────────── */}
      {isLoading ? (
        <FlatList
          data={[0, 1, 2]}
          keyExtractor={i => `skel-${i}`}
          renderItem={renderSkelRow}
          contentContainerStyle={s.gridContent}
          showsVerticalScrollIndicator={false}
        />
      ) : filtered.length === 0 ? (
        <View style={s.centerBox}>
          <Ionicons name="tv-outline" size={48} color={C.textSec} />
          <Text style={s.emptyTitle}>
            {debouncedSearch
              ? `No results for "${debouncedSearch}"`
              : activeTab !== 'All'
                ? `No channels in "${activeTab}"`
                : 'No channels found'}
          </Text>
          <Text style={s.emptyTxt}>
            {debouncedSearch
              ? 'Try a different search term'
              : activeTab !== 'All'
                ? 'Try a different category or pull to refresh'
                : 'Pull down to refresh'}
          </Text>
          <Pressable onPress={onRefresh} style={s.retryBtn}>
            <LinearGradient colors={[C.primary, C.accent]} style={s.retryGrad}>
              <Text style={s.retryTxt}>Refresh</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={chunkedFiltered}
          keyExtractor={item => item.key}
          renderItem={renderRow}
          contentContainerStyle={s.gridContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={10}
          windowSize={10}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={ListFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: C.bg },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Search
  searchBar:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10, marginBottom: 8, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, color: C.text, fontSize: 15, outlineWidth: 0 } as any,

  // Tabs
  tabRow:         { paddingHorizontal: H_PAD, paddingVertical: 4 },
  tabChip:        { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  tabChipInactive:{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tabChipTxt:     { color: C.textSec, fontSize: 13 },

  // Count
  countTxt: { color: C.textSec, fontSize: 12, paddingHorizontal: H_PAD, marginBottom: 6 },

  // Grid
  gridContent:   { paddingHorizontal: H_PAD, paddingBottom: 100, paddingTop: 4 },
  columnWrapper: { gap: COL_GAP, marginBottom: COL_GAP },

  // Channel card
  card: {
    width: CARD_W,
    minHeight: CARD_H,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 6,
    overflow: 'hidden',
  },

  // Logo circle — white background like the screenshot
  logoCircle: {
    width: LOGO_D,
    height: LOGO_D,
    borderRadius: LOGO_D / 2,
    backgroundColor: C.logoBg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  logoImg: {
    width: LOGO_D - 6,
    height: LOGO_D - 6,
    borderRadius: (LOGO_D - 6) / 2,
  },
  logoFallback: {
    width: LOGO_D,
    height: LOGO_D,
    borderRadius: LOGO_D / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: { color: '#fff', fontSize: 22, fontWeight: '900' },

  // Channel name
  cardName: {
    color: C.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },

  // LIVE badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,59,48,0.18)',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.live },
  liveTxt: { color: C.live, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // Empty / error
  centerBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  emptyTxt:   { color: C.textSec, fontSize: 14, textAlign: 'center' },
  retryBtn:   { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  retryGrad:  { paddingHorizontal: 28, paddingVertical: 12 },
  retryTxt:   { color: '#fff', fontSize: 15, fontWeight: '700' },
});
