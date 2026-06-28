import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  ScrollView,
  Image,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMovies, useSeriesList, useCategories } from '@/lib/api-hooks';
import { Config } from '@/constants/config';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  gold: '#F5C518',
};

const DEFAULT_CATS = [
  'All', 'Action', 'Drama', 'Comedy', 'Horror', 'Sci-Fi', 
  'Romance', 'Thriller', 'Animation', 'Bangla', 'Hollywood', 
  'Bollywood', 'Korean', 'Anime', 'Documentary'
];

const CONTENT_TABS = ['Movies', 'Series'];

export default function BrowseScreen() {
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeCat, setActiveCat] = useState('All');
  const [activeTab, setActiveTab] = useState('Movies');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  // M-015: accumulate items across pages so pagination doesn't replace the list.
  // Reset whenever the filter/search context changes.
  const [allItems, setAllItems] = useState<any[]>([]);
  const lastPageRef = useRef(0);

  // We can merge cats from API with defaults, or just use defaults to ensure we have the requested ones
  const { data: catsData } = useCategories();
  const categories = useMemo(() => {
    if (!catsData || !Array.isArray(catsData) || catsData.length === 0) return DEFAULT_CATS;
    // Combine defaults and API cats, unique
    const apiCats = catsData.map((c: any) => c.name || c.title || c);
    return Array.from(new Set(['All', ...DEFAULT_CATS, ...apiCats]));
  }, [catsData]);

  const params = useMemo(() => ({
    genre: activeCat !== 'All' ? activeCat : undefined,
    page,
    limit: 30,
  }), [activeCat, page]);

  const { data: moviesData, isLoading: moviesLoading, refetch: refetchMovies } = useMovies(params);
  const { data: seriesData, isLoading: seriesLoading, refetch: refetchSeries } = useSeriesList(params);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await Promise.all([refetchMovies(), refetchSeries()]);
    setRefreshing(false);
  }, [refetchMovies, refetchSeries]);

  const items = useMemo(() => {
    const raw = activeTab === 'Movies' ? moviesData : seriesData;
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map((m: any, i: number) => ({
      id: m.id || String(i),
      title: m.title || m.name || '',
      rating: m.rating || m.imdbRating || 0,
      year: m.year?.toString() || '',
      poster: m.posterUrl || m.poster || '',
      type: activeTab === 'Movies' ? 'movie' : 'series',
    }));
  }, [moviesData, seriesData, activeTab]);

  // M-015: when the page/filter context changes, reset accumulation; otherwise append.
  useEffect(() => {
    const isContextReset = activeCat !== undefined && page === 1;
    if (isContextReset) {
      // fresh query (page 1, or filter changed) → replace accumulated list
      setAllItems(items);
      lastPageRef.current = page;
      return;
    }
    if (page !== lastPageRef.current && items.length > 0) {
      // append-only: avoid duplicating IDs that already exist.
      setAllItems((prev) => {
        const seen = new Set(prev.map((it) => it.id));
        const merged = [...prev, ...items.filter((it) => !seen.has(it.id))];
        return merged;
      });
      lastPageRef.current = page;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, page, activeTab, activeCat]);

  const isLoading = activeTab === 'Movies' ? moviesLoading : seriesLoading;

  // 3-column for movies, 2-column for series
  const cols = activeTab === 'Movies' ? 3 : 2;
  const cardW = (W - 32 - (cols - 1) * 12) / cols;

  const renderSkeleton = () => (
    <View style={[s.grid, { gap: 12, paddingHorizontal: 16 }]}>
      {Array.from({ length: 12 }).map((_, i) => (
        <View key={i} style={{ width: cardW, marginBottom: 16 }}>
          <View style={[s.posterSkeleton, { height: cardW * 1.5 }]} />
          <View style={s.textSkeleton} />
          <View style={[s.textSkeleton, { width: '60%', marginTop: 4 }]} />
        </View>
      ))}
    </View>
  );

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={[s.movieCard, { width: cardW }]}
      // @ts-ignore
      onPress={() => router.push(`/${item.type}/${item.id}`)}
    >
      <View style={[s.posterContainer, { height: cardW * 1.5 }]}>
        {item.poster ? (
          <Image source={{ uri: Config.imageUrl(item.poster) }} style={s.moviePoster} />
        ) : (
          <LinearGradient colors={['#3D1A5C', '#1a0535']} style={s.moviePoster}>
            <Ionicons name="film-outline" size={28} color={C.textSec} />
          </LinearGradient>
        )}
        {item.rating ? (
          <View style={s.ratingBadge}>
            <Ionicons name="star" size={10} color={C.gold} />
            <Text style={s.ratingTxt}>{typeof item.rating === 'number' ? item.rating.toFixed(1) : item.rating}</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.movieTitle} numberOfLines={2}>{item.title}</Text>
    </Pressable>
  );

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{activeTab === 'Movies' ? 'Movies' : 'Series'}</Text>
        <View style={s.headerIcons}>
          <Pressable onPress={() => router.push('/(main)/search')} style={s.iconBtn}>
            <Ionicons name="search-outline" size={24} color={C.text} />
          </Pressable>
          <Pressable style={s.iconBtn}>
            <Ionicons name="options-outline" size={24} color={C.text} />
          </Pressable>
        </View>
      </View>

      {/* Top Tabs */}
      <View style={s.tabContainer}>
        <View style={s.tabBg}>
          {CONTENT_TABS.map(tab => {
            const isActive = activeTab === tab;
            return (
              <Pressable 
                key={tab} 
                onPress={() => { setActiveTab(tab); setPage(1); }}
                style={s.tabWrapper}
              >
                {isActive && (
                  <LinearGradient
                    colors={[C.primary, C.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: 12 }]}
                  />
                )}
                <Text style={[s.tabTxt, isActive && s.tabTxtActive]}>{tab}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Genre Chips */}
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={s.catRow}
        >
          {categories.map((cat: string) => {
            const isActive = activeCat === cat;
            return (
              <Pressable 
                key={cat} 
                onPress={() => { setActiveCat(cat); setPage(1); }}
              >
                {isActive ? (
                  <LinearGradient
                    colors={[C.primary, C.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.catChip}
                  >
                    <Text style={s.catChipTxtActive}>{cat}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[s.catChip, s.catChipInactive]}>
                    <Text style={s.catChipTxt}>{cat}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content Grid */}
      {isLoading && allItems.length === 0 ? (
        renderSkeleton()
      ) : allItems.length === 0 ? (
        <View style={s.emptyBox}>
          <Ionicons name={activeTab === 'Movies' ? 'film-outline' : 'tv-outline'} size={48} color={C.textSec} />
          <Text style={s.emptyTitle}>No {activeTab} Found</Text>
          <Text style={s.emptyTxt}>
            Try changing the category or checking back later.
          </Text>
        </View>
      ) : (
        <FlatList
          key={cols}
          data={allItems}
          numColumns={cols}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[s.grid, { paddingHorizontal: 16 }]}
          columnWrapperStyle={{ gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          onEndReached={() => {
            if (!isLoading && allItems.length >= 30) {
              setPage(p => p + 1);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoading && allItems.length > 0 ? (
              <ActivityIndicator size="small" color={C.primary} style={{ marginVertical: 20 }} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12 
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: C.text, fontFamily: 'Outfit' },
  headerIcons: { flexDirection: 'row', gap: 12 },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  tabContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabBg: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 4,
  },
  tabWrapper: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabTxt: { color: C.textSec, fontSize: 15, fontWeight: '600', fontFamily: 'Inter' },
  tabTxtActive: { color: '#fff', fontWeight: '700' },

  catRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
  catChip: { 
    paddingHorizontal: 18, 
    paddingVertical: 8, 
    borderRadius: 20, 
    justifyContent: 'center',
    alignItems: 'center'
  },
  catChipInactive: {
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)'
  },
  catChipTxt: { color: C.textSec, fontSize: 14, fontFamily: 'Inter', fontWeight: '500' },
  catChipTxtActive: { color: '#fff', fontSize: 14, fontFamily: 'Inter', fontWeight: '600' },

  grid: { paddingBottom: 100, gap: 16 },
  movieCard: { marginBottom: 4 },
  posterContainer: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: C.card,
    marginBottom: 8,
    overflow: 'hidden',
  },
  moviePoster: { width: '100%', height: '100%', resizeMode: 'cover' },
  ratingBadge: { 
    position: 'absolute', 
    top: 8, 
    left: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    borderRadius: 8, 
    paddingHorizontal: 6, 
    paddingVertical: 4 
  },
  ratingTxt: { color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: 'Inter' },
  movieTitle: { color: C.text, fontSize: 13, fontFamily: 'Inter', lineHeight: 18, fontWeight: '500' },

  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: '700', fontFamily: 'Outfit' },
  emptyTxt: { color: C.textSec, fontSize: 15, fontFamily: 'Inter', textAlign: 'center' },

  posterSkeleton: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 8,
  },
  textSkeleton: {
    width: '80%',
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
  }
});
