import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ListRenderItem,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTrending } from '@/lib/api-hooks';

interface TrendingItem {
  id: string;
  rank: number;
  title: string;
  genre: string;
  year: string;
  rating: string;
  imdbRating: string;
  badge: string;
  gradientColors: [string, string];
  type: 'movie' | 'series' | 'live' | 'sports';
}

const TABS = ['All', 'Movies', 'Series', 'Live', 'Sports'];

const GRADIENTS: [string, string][] = [
  ['#7C3AED', '#2563EB'],
  ['#10B981', '#059669'],
  ['#EF4444', '#DC2626'],
  ['#EC4899', '#7C3AED'],
  ['#F59E0B', '#D97706'],
];

// M-005: Map API movie shape → TrendingItem. Hide 'live' items that don't
// resolve to a movie/series ID (they have no detail screen to navigate to).
const mapTrendingItem = (movie: any, index: number): TrendingItem | null => {
  if (!movie || !movie.id) return null;
  const year = movie.releaseYear || movie.year ||
    (movie.releaseDate ? String(new Date(movie.releaseDate).getFullYear()) : '--');
  const genres = Array.isArray(movie.genres)
    ? movie.genres.map((g: any) => typeof g === 'string' ? g : (g?.name ?? '')).filter(Boolean)
    : [];
  return {
    id: String(movie.id),
    rank: index + 1,
    title: movie.title || movie.name || 'Untitled',
    genre: genres.join(', ') || 'Movie',
    year,
    rating: movie.rating ? String(movie.rating) : '-',
    imdbRating: movie.imdbRating ? String(movie.imdbRating) : '-',
    badge: movie.isTrending ? '🔥 Hot' : '⬆️ Rising',
    gradientColors: GRADIENTS[index % GRADIENTS.length],
    type: 'movie',
  };
};

export default function TrendingScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());

  // M-005: pull real trending movies from the API.
  const { data: trendingData, isLoading } = useTrending();
  const allItems = useMemo(
    () => (trendingData || []).map(mapTrendingItem).filter(Boolean) as TrendingItem[],
    [trendingData],
  );

  const toggleLike = (id: string) => {
    setLikedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredItems = useMemo(() => {
    if (activeTab === 0) return allItems;
    const tabMap: Record<number, string> = {
      1: 'movie',
      2: 'series',
      3: 'live',
      4: 'sports',
    };
    return allItems.filter((item) => item.type === tabMap[activeTab]);
  }, [allItems, activeTab]);

  const renderTrendingItem: ListRenderItem<TrendingItem> = ({ item }) => (
    <View style={styles.trendingItem}>
      {/* Large Faded Rank */}
      <Text style={styles.rankNumber}>#{item.rank}</Text>

      {/* Poster Thumbnail */}
      <TouchableOpacity
        style={styles.posterWrapper}
        activeOpacity={0.8}
        onPress={() => {
          if (item.type === 'movie') {
            router.push(`/movie/${item.id}`);
          } else if (item.type === 'series') {
            router.push(`/series/${item.id}`);
          }
          // 'live' / 'sports' items have no movie id from /movies/trending — skip.
        }}
      >
        <LinearGradient
          colors={item.gradientColors}
          style={styles.poster}
        >
          <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.5)" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.trendingInfo}>
        <View style={styles.trendingInfoTop}>
          <Text style={styles.trendingTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.trendingGenre}>{item.genre}</Text>
        </View>

        <View style={styles.trendingMetaRow}>
          {/* Badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>

          {/* Star Rating */}
          {item.rating !== '-' && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#F5C518" />
              <Text style={styles.ratingValue}>{item.rating}</Text>
            </View>
          )}

          {/* IMDb Rating */}
          {item.imdbRating !== '-' && (
            <View style={styles.imdbBadge}>
              <Text style={styles.imdbText}>{item.imdbRating}</Text>
            </View>
          )}

          {/* Year */}
          <Text style={styles.yearText}>{item.year}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.trendingActions}>
        <TouchableOpacity
          style={styles.playButton}
          activeOpacity={0.7}
          onPress={() => {
            if (item.type === 'movie' || item.type === 'series') {
              router.push(`/player/${item.id}?type=${item.type}&title=${encodeURIComponent((item as any).title || '')}`);
            }
          }}
        >
          <Ionicons name="play" size={16} color="#F2F2F7" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.heartButton,
            likedItems.has(item.id) && styles.heartButtonActive,
          ]}
          activeOpacity={0.7}
          onPress={() => toggleLike(item.id)}
        >
          <Ionicons
            name={likedItems.has(item.id) ? 'heart' : 'heart-outline'}
            size={16}
            color={likedItems.has(item.id) ? '#EC4899' : '#B3B8C8'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      {isLoading ? (
        <ActivityIndicator color="#7C3AED" size="large" />
      ) : (
        <>
          <Ionicons name="trending-up-outline" size={48} color="#6B6B80" />
          <Text style={styles.emptyText}>No trending content available right now.</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#F2F2F7" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Trending Now</Text>
        <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
          <Ionicons name="filter" size={22} color="#F2F2F7" />
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabPill,
                activeTab === index && styles.tabPillActive,
              ]}
              activeOpacity={0.7}
              onPress={() => setActiveTab(index)}
            >
              <Text
                style={[
                  styles.tabPillText,
                  activeTab === index && styles.tabPillTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Trending List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderTrendingItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070F',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#B3B8C8',
    textAlign: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#121A2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#F2F2F7',
    textAlign: 'center',
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#121A2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    paddingLeft: 24,
    paddingBottom: 8,
  },
  tabScrollContent: {
    gap: 8,
    paddingRight: 24,
  },
  tabPill: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#121A2F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  tabPillText: {
    fontSize: 14,
    color: '#B3B8C8',
    fontWeight: '600',
  },
  tabPillTextActive: {
    color: '#F2F2F7',
  },
  topicsSection: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  topicsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F2F2F7',
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  topicsScrollContent: {
    gap: 10,
    paddingHorizontal: 24,
    paddingRight: 24,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121A2F',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  topicName: {
    fontSize: 13,
    color: '#F2F2F7',
    fontWeight: '500',
  },
  topicCountBadge: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  topicCountText: {
    fontSize: 11,
    color: '#B388FF',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  trendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rankNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.08)',
    width: 52,
    textAlign: 'center',
  },
  posterWrapper: {
    flexShrink: 0,
  },
  poster: {
    width: 70,
    height: 100,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingInfo: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  trendingInfoTop: {
    gap: 3,
  },
  trendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F2F2F7',
  },
  trendingGenre: {
    fontSize: 13,
    color: '#6B6B80',
    fontWeight: '500',
  },
  trendingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,197,24,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  ratingValue: {
    fontSize: 12,
    color: '#F5C518',
    fontWeight: '700',
  },
  imdbBadge: {
    backgroundColor: '#121A2F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  imdbText: {
    fontSize: 11,
    color: '#F5C518',
    fontWeight: '600',
  },
  yearText: {
    fontSize: 12,
    color: '#6B6B80',
    fontWeight: '500',
  },
  trendingActions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#121A2F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heartButtonActive: {
    backgroundColor: 'rgba(236,72,153,0.15)',
    borderColor: 'rgba(236,72,153,0.3)',
  },
});