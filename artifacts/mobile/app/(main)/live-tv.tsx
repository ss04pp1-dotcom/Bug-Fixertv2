import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveChannels } from '@/lib/api-hooks';
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

// Category keyword mapping for client-side filtering
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Bangladesh': ['bd', 'bangladesh', 'bangla', 'btv', 'channel i', 'ntv', 'atn', 'somoy', 'jamuna', 'ekattor', 'independent', 'boishakhi', 'desh', 'maasranga', 'rtv', 'sa tv', 'deepto', 'nagorik', 'channel 24', 'mytv', 'brtv', 'gazi'],
  'Sports': ['sport', 'espn', 'star sports', 'sky sports', 'bein', 'dazn', 'eurosport', 'bt sport', 'cricket', 'football', 'tennis', 'golf', 'boxing', 'f1', 'formula', 'nba', 'nfl', 'nhl', 'fox sport', 'supersport'],
  'News': ['news', 'cnn', 'bbc', 'al jazeera', 'fox news', 'msnbc', 'cnbc', 'bloomberg', 'reuters', 'sky news', 'france 24', 'dw', 'euronews', 'abc news', 'nbc news', 'times now', 'ndtv'],
  'Entertainment': ['entertainment', 'movie', 'films', 'cinema', 'hbo', 'showtime', 'fx', 'tnt', 'tbs', 'amc', 'star plus', 'zee', 'sony', 'colors', 'mtv', 'vh1', 'comedy', 'drama'],
  'Kids': ['kids', 'cartoon', 'disney', 'nickelodeon', 'nick', 'cartoon network', 'boomerang', 'baby', 'junior', 'junior', 'cbeebies', 'pbs kids', 'discovery kids'],
  'Religious': ['religious', 'islamic', 'christian', 'peace', 'quran', 'bible', 'islamic', 'muslim', 'church', 'gospel', 'hindu', 'dharma', 'prayer', 'god', 'divine'],
  'International': ['international', 'global', 'world', 'uk', 'usa', 'us', 'france', 'germany', 'spain', 'italy', 'arabic', 'indian', 'pakistan', 'turkey', 'russia', 'china', 'japan', 'korean'],
  'IPTV': ['iptv', 'm3u8'],
};

function matchesCategory(name: string, category: string): boolean {
  if (category === 'All') return true;
  const lower = name.toLowerCase();
  const keywords = CATEGORY_KEYWORDS[category] || [category.toLowerCase()];
  return keywords.some(k => lower.includes(k));
}

const TABS = ['All', 'Bangladesh', 'Sports', 'News', 'Entertainment', 'Kids', 'Religious', 'International', 'IPTV'];

export default function LiveTVScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [displayLimit, setDisplayLimit] = useState(150);
  // Fetch channels — 500 covers most IPTV libraries.
  // Search runs client-side across all loaded channels.
  const { data: allChannels, isLoading, refetch } = useLiveChannels({ limit: 500 });

  // Reset display limit when tab or search changes
  useEffect(() => { setDisplayLimit(150); }, [activeTab, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const channels = useMemo(() => {
    const raw = Array.isArray(allChannels) ? allChannels : [];
    return raw.map((ch: any, i: number) => ({
      id: ch.id || String(i),
      name: ch.name || '',
      cat: ch.category?.name || ch.language || ch.country || 'Live TV',
      color: GRADIENTS[i % GRADIENTS.length],
      letter: (ch.name || 'C')[0].toUpperCase(),
      logo: ch.logoUrl || ch.logo || '',
      isLive: ch.isLive !== false,
      tagline: ch.description || ch.currentProgram || 'Live Streaming',
      streamUrl: ch.primaryStreamUrl || ch.streamUrl || '',
    }));
  }, [allChannels]);

  const filtered = useMemo(() => {
    let result = channels;
    if (activeTab !== 'All') {
      result = result.filter(ch =>
        matchesCategory(ch.name, activeTab) ||
        matchesCategory(ch.cat, activeTab)
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(ch =>
        ch.name.toLowerCase().includes(q) ||
        ch.cat.toLowerCase().includes(q)
      );
    }
    return result;
  }, [channels, activeTab, search]);

  const renderSkeleton = useCallback(({ item }: any) => (
    <View style={s.listCard}>
      <View style={[s.listLogo, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 16, width: '60%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4 }} />
        <View style={{ height: 12, width: '40%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
      </View>
    </View>
  ), []);

  const renderItem = useCallback(({ item }: { item: any }) => (
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

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
          <Text style={s.headerTitle}>Live TV</Text>
        </Pressable>
        <View style={s.headerRight}>
          <Pressable onPress={() => setSearchVisible(v => !v)} style={s.iconBtn}>
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
            placeholder="Search channels..."
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

      {/* Category tabs */}
      <View style={{ paddingBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {TABS.map(tab => {
            const isActive = activeTab === tab;
            return (
              <Pressable key={tab} onPress={() => setActiveTab(tab)} style={{ marginRight: 8 }}>
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

      {/* Channel count */}
      {!isLoading && channels.length > 0 && (
        <Text style={s.countTxt}>
          {filtered.length} channel{filtered.length !== 1 ? 's' : ''}
          {activeTab !== 'All' ? ` in ${activeTab}` : ''}
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
            {channels.length === 0 ? 'Loading channels...' : 'No channels found'}
          </Text>
          <Text style={s.emptyTxt}>
            {channels.length === 0
              ? 'Please wait or pull down to refresh'
              : search
              ? `No results for "${search}"`
              : `Try selecting "All" to see all channels`}
          </Text>
          {channels.length === 0 && (
            <Pressable onPress={onRefresh} style={s.retryBtn}>
              <LinearGradient colors={[C.primary, C.accent]} style={s.retryGrad}>
                <Text style={s.retryTxt}>Refresh</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={search.trim() ? filtered : filtered.slice(0, displayLimit)}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={30}
          windowSize={10}
          onEndReached={() => {
            if (!search.trim() && displayLimit < filtered.length) {
              setDisplayLimit(prev => Math.min(prev + 100, filtered.length));
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            !search.trim() && displayLimit < filtered.length ? (
              <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                <Text style={{ color: C.textSec, fontSize: 12, fontFamily: 'Inter' }}>
                  Loading more channels…
                </Text>
              </View>
            ) : null
          }
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
