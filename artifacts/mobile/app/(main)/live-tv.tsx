import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveChannelsInfinite, useCategories } from '@/lib/api-hooks';
import { Config } from '@/constants/config';

const { width: W } = Dimensions.get('window');

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  live: '#FF3B30',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
};

const GRADIENTS: [string, string][] = [
  ['#8B5CF6', '#EC4899'],
  ['#059669', '#047857'],
  ['#DC2626', '#991B1B'],
  ['#D97706', '#92400E'],
  ['#2563EB', '#1D4ED8'],
  ['#0891B2', '#0E7490'],
  ['#B45309', '#78350F'],
  ['#6D28D9', '#5B21B6'],
  ['#BE185D', '#9D174D'],
  ['#047857', '#064E3B'],
];

function mapChannel(ch: any, i: number) {
  return {
    id: ch.id || String(i),
    name: ch.name || '',
    cat: ch.category?.name || ch.language || ch.country || 'Live TV',
    color: GRADIENTS[i % GRADIENTS.length] as [string, string],
    letter: (ch.name || 'C')[0].toUpperCase(),
    logo: ch.logoUrl || ch.logo || '',
    isLive: ch.isLive !== false,
    tagline: ch.description || ch.currentProgram || 'Live Streaming',
    streamUrl: ch.primaryStreamUrl || ch.streamUrl || '',
  };
}

export default function LiveTVScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search input → triggers server-side search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch all categories from the API (limit=1000 set in the hook)
  const { data: categoryList = [] } = useCategories();

  // Build tab list dynamically: 'All' first, then every category from the DB
  const tabs = useMemo<string[]>(
    () => ['All', ...categoryList.map((c: any) => c.name as string).filter(Boolean)],
    [categoryList],
  );

  // Infinite query — normal browsing (no search): pages of 50 from server
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingBrowse,
    refetch: refetchBrowse,
  } = useLiveChannelsInfinite(debouncedSearch ? { search: debouncedSearch } : undefined);

  const isLoading = isLoadingBrowse;

  // Flatten all fetched pages into a single array
  const allChannels = useMemo(() => {
    if (!infiniteData?.pages) return [];
    return infiniteData.pages.flatMap((page: any, pi: number) =>
      page.items.map((ch: any, i: number) => mapChannel(ch, pi * 50 + i))
    );
  }, [infiniteData]);

  // Client-side tab filter.
  // Priority 1: channel has a category assigned in the DB → exact name match.
  // Priority 2: channel has no assigned category (M3U-imported) → match by
  //             checking if the channel name contains the tab keyword.
  const filtered = useMemo(() => {
    if (activeTab === 'All') return allChannels;
    const tab = activeTab.toLowerCase();
    return allChannels.filter(ch => {
      if (ch.cat.toLowerCase() === tab) return true;
      return ch.name.toLowerCase().includes(tab);
    });
  }, [allChannels, activeTab]);

  // Reset tab to 'All' if the selected tab is no longer in the list (categories reloaded)
  useEffect(() => {
    if (activeTab !== 'All' && tabs.length > 1 && !tabs.includes(activeTab)) {
      setActiveTab('All');
    }
  }, [tabs, activeTab]);

  // Reset infinite query position when tab changes (not search — search goes to server)
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  // Auto-load more pages when a category tab returns an empty filtered list
  // but there are still unloaded server pages that might contain matching channels.
  useEffect(() => {
    if (activeTab === 'All') return;
    if (filtered.length > 0) return;
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [activeTab, filtered.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchBrowse();
    setRefreshing(false);
  }, [refetchBrowse]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderSkeleton = useCallback(({ item }: any) => (
    <View style={s.listCard}>
      <View style={[s.listLogo, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 16, width: '60%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4 }} />
        <View style={{ height: 12, width: '40%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
      </View>
    </View>
  ), []);

  const renderItem = useCallback(({ item }: { item: ReturnType<typeof mapChannel> }) => (
    <Pressable
      style={s.listCard}
      onPress={() => router.push({
        pathname: `/live-player/${item.id}` as any,
        params: { title: item.name, logo: item.logo, cat: item.cat, streamUrl: item.streamUrl },
      })}
    >
      <View style={s.logoWrapper}>
        <LinearGradient colors={[C.primary, C.accent]} style={s.logoBorderGrad}>
          <View style={s.logoInner}>
            {item.logo ? (
              <Image source={{ uri: Config.imageUrl(item.logo) }} style={s.logoImg} resizeMode="contain" />
            ) : (
              <LinearGradient colors={item.color} style={s.logoImg}>
                <Text style={s.listLetter}>{item.letter}</Text>
              </LinearGradient>
            )}
          </View>
        </LinearGradient>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={s.listName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.listCat} numberOfLines={1}>{item.cat}</Text>
        <Text style={s.listTagline} numberOfLines={1}>{item.tagline}</Text>
      </View>

      <View style={s.rightActions}>
        <View style={s.liveBadge}><Text style={s.liveBadgeTxt}>LIVE</Text></View>
        <LinearGradient colors={[C.primary, C.accent]} style={s.playBtn}>
          <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
        </LinearGradient>
      </View>
    </Pressable>
  ), []);

  const ListFooter = useMemo(() => {
    if (isFetchingNextPage) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <ActivityIndicator size="small" color={C.primary} />
          <Text style={{ color: C.textSec, fontSize: 12, marginTop: 6 }}>Loading more…</Text>
        </View>
      );
    }
    if (!hasNextPage && filtered.length > 0) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ color: C.textSec, fontSize: 12 }}>All channels loaded</Text>
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage, hasNextPage, filtered.length]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
          <Text style={s.headerTitle}>Live TV</Text>
        </Pressable>
        <View style={s.headerRight}>
          <Pressable onPress={() => { setSearchVisible(v => !v); if (searchVisible) { setSearch(''); } }} style={s.iconBtn}>
            <Ionicons name={searchVisible ? 'close' : 'search'} size={22} color={C.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/notifications' as any)} style={s.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={C.text} />
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      {searchVisible && (
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color={C.textSec} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search all channels..."
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

      {/* Category tabs — hidden when searching */}
      {!debouncedSearch && (
        <View style={{ paddingBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
            {tabs.map(tab => {
              const isActive = activeTab === tab;
              return (
                <Pressable key={tab} onPress={() => handleTabChange(tab)} style={{ marginRight: 8 }}>
                  {isActive ? (
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

      {/* Channel count */}
      {!isLoading && filtered.length > 0 && (
        <Text style={s.countTxt}>
          {debouncedSearch
            ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${debouncedSearch}"`
            : `${filtered.length}+ channel${filtered.length !== 1 ? 's' : ''}${activeTab !== 'All' ? ` in ${activeTab}` : ''}`}
        </Text>
      )}

      {/* Content */}
      {isLoading ? (
        <FlatList
          data={[1, 2, 3, 4, 5, 6, 7, 8]}
          keyExtractor={i => String(i)}
          renderItem={renderSkeleton}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : filtered.length === 0 ? (
        <View style={s.centerBox}>
          <Ionicons name="tv-outline" size={48} color={C.textSec} />
          <Text style={s.emptyTitle}>
            {allChannels.length === 0 ? 'Loading channels...' : 'No channels found'}
          </Text>
          <Text style={s.emptyTxt}>
            {allChannels.length === 0
              ? 'Please wait or pull down to refresh'
              : debouncedSearch
              ? `No results for "${debouncedSearch}"`
              : `No channels in "${activeTab}" yet`}
          </Text>
          {allChannels.length === 0 && (
            <Pressable onPress={onRefresh} style={s.retryBtn}>
              <LinearGradient colors={[C.primary, C.accent]} style={s.retryGrad}>
                <Text style={s.retryTxt}>Refresh</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={30}
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
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text, fontFamily: 'Outfit' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },

  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  searchInput: { flex: 1, color: C.text, fontSize: 16, fontFamily: 'Inter', outlineWidth: 0 } as any,

  tabRow: { paddingHorizontal: 16, paddingVertical: 4 },
  tabChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  tabChipInactive: { backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  tabChipTxt: { color: C.textSec, fontSize: 13, fontFamily: 'Inter' },

  countTxt: { color: C.textSec, fontSize: 12, fontFamily: 'Inter', paddingHorizontal: 16, marginBottom: 6 },

  listContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, padding: 12, gap: 12 },
  listLogo: { width: 56, height: 56, borderRadius: 10 },

  logoWrapper: { width: 60, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  logoBorderGrad: { width: 64, height: 64, borderRadius: 14, justifyContent: 'center', alignItems: 'center', padding: 2 },
  logoInner: { backgroundColor: C.card, width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  listLetter: { color: '#fff', fontSize: 22, fontWeight: '900', fontFamily: 'Outfit' },
  listName: { color: C.text, fontSize: 15, fontWeight: '700', fontFamily: 'Inter', marginBottom: 2 },
  listCat: { color: C.textSec, fontSize: 12, fontFamily: 'Inter', marginBottom: 3 },
  listTagline: { color: C.textSec, fontSize: 11, fontFamily: 'Inter', opacity: 0.7 },

  rightActions: { alignItems: 'flex-end', justifyContent: 'space-between', height: 56 },
  liveBadge: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(255,59,48,0.2)', borderRadius: 4 },
  liveBadgeTxt: { color: C.live, fontSize: 9, fontWeight: '800', fontFamily: 'Inter' },
  playBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: '700', fontFamily: 'Outfit' },
  emptyTxt: { color: C.textSec, fontSize: 14, fontFamily: 'Inter', textAlign: 'center' },
  retryBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  retryGrad: { paddingHorizontal: 28, paddingVertical: 12 },
  retryTxt: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter' },
});
