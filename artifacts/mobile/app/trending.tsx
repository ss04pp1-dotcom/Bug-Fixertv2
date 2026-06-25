import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ListRenderItem,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

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

interface TrendingTopic {
  id: string;
  name: string;
  count: number;
}

const TABS = ['All', 'Movies', 'Series', 'Live', 'Sports'];

const MOCK_TRENDING: TrendingItem[] = [
  {
    id: '1',
    rank: 1,
    title: 'Oppenheimer',
    genre: 'Biography, Drama',
    year: '2023',
    rating: '8.5',
    imdbRating: '8.3',
    badge: '🔥 Hot',
    gradientColors: ['#7C3AED', '#2563EB'],
    type: 'movie',
  },
  {
    id: '2',
    rank: 2,
    title: 'Nightfall S2',
    genre: 'Sci-Fi, Thriller',
    year: '2024',
    rating: '9.1',
    imdbRating: '8.9',
    badge: '⬆️ Rising',
    gradientColors: ['#10B981', '#059669'],
    type: 'series',
  },
  {
    id: '3',
    rank: 3,
    title: 'IND vs AUS 3rd T20',
    genre: 'Cricket, Live',
    year: 'Live',
    rating: '-',
    imdbRating: '-',
    badge: '🔴 Live',
    gradientColors: ['#EF4444', '#DC2626'],
    type: 'live',
  },
  {
    id: '4',
    rank: 4,
    title: 'The Dark Knight Rises',
    genre: 'Action, Thriller',
    year: '2012',
    rating: '8.4',
    imdbRating: '8.1',
    badge: '🔥 Hot',
    gradientColors: ['#EC4899', '#7C3AED'],
    type: 'movie',
  },
  {
    id: '5',
    rank: 5,
    title: 'F1: Monaco Grand Prix',
    genre: 'Racing, Sports',
    year: '2024',
    rating: '-',
    imdbRating: '-',
    badge: '⬆️ Rising',
    gradientColors: ['#F59E0B', '#D97706'],
    type: 'sports',
  },
];

const MOCK_TOPICS: TrendingTopic[] = [
  { id: 't1', name: 'Action', count: 245 },
  { id: 't2', name: 'Drama', count: 189 },
  { id: 't3', name: 'Sci-Fi', count: 156 },
  { id: 't4', name: 'Comedy', count: 132 },
  { id: 't5', name: 'Horror', count: 98 },
  { id: 't6', name: 'Romance', count: 87 },
  { id: 't7', name: 'Documentary', count: 76 },
  { id: 't8', name: 'Anime', count: 64 },
];

export default function TrendingScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());

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

  const filteredItems =
    activeTab === 0
      ? MOCK_TRENDING
      : MOCK_TRENDING.filter((item) => {
          const tabMap: Record<number, string> = {
            1: 'movie',
            2: 'series',
            3: 'live',
            4: 'sports',
          };
          return item.type === tabMap[activeTab];
        });

  const renderTrendingItem: ListRenderItem<TrendingItem> = ({ item, index }) => (
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
          } else if (item.type === 'live') {
            router.push(`/live-player/${item.id}`);
          }
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
              router.push(`/player/${item.id}`);
            } else {
              router.push(`/live-player/${item.id}`);
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

  const renderTopicsHeader = () => (
    <View style={styles.topicsSection}>
      <Text style={styles.topicsTitle}>Trending Topics</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.topicsScrollContent}
      >
        {MOCK_TOPICS.map((topic) => (
          <View key={topic.id} style={styles.topicChip}>
            <Text style={styles.topicName}>{topic.name}</Text>
            <View style={styles.topicCountBadge}>
              <Text style={styles.topicCountText}>{topic.count}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
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
        ListHeaderComponent={renderTopicsHeader}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070F',
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