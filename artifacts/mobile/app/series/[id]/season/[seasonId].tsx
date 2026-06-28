import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ListRenderItem,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSeries } from '@/lib/api-hooks';

interface Episode {
  id: string;
  number: number;
  title: string;
  description: string;
  duration: string;
  progress: number;
  isNew: boolean;
  isCurrent: boolean;
  gradientColors: [string, string];
}

const EPISODE_GRADIENTS: [string, string][] = [
  ['#10B981', '#059669'],
  ['#2563EB', '#1D4ED8'],
  ['#7C3AED', '#6D28D9'],
  ['#EC4899', '#DB2777'],
  ['#EF4444', '#DC2626'],
  ['#F59E0B', '#D97706'],
];

// M-004: Normalize episodes coming from the API (which may be nested under
// series.seasons[].episodes or flat on series.episodes) into the UI shape.
const extractEpisodes = (series: any, seasonNumber: number): Episode[] => {
  if (!series) return [];
  const seasons: any[] = Array.isArray(series.seasons) ? series.seasons : [];
  const season = seasons.find((s: any) =>
    Number(s.number ?? s.seasonNumber ?? s.season) === seasonNumber,
  );
  const rawList: any[] = season?.episodes || series.episodes || [];
  return rawList.map((e: any, idx: number) => ({
    id: String(e.id ?? e.episodeId ?? `e-${idx + 1}`),
    number: Number(e.number ?? e.episodeNumber ?? e.episode ?? idx + 1),
    title: e.title ?? e.name ?? `Episode ${idx + 1}`,
    description: e.description ?? e.overview ?? e.summary ?? '',
    duration: e.duration ? String(e.duration) : e.runtime ? `${e.runtime} min` : '-- min',
    progress: Number(e.progress ?? e.watchProgress ?? 0),
    isNew: Boolean(e.isNew),
    isCurrent: Boolean(e.isCurrent),
    gradientColors: EPISODE_GRADIENTS[idx % EPISODE_GRADIENTS.length],
  }));
};

const extractSeasons = (series: any): { number: number; label: string; episodeCount: number }[] => {
  if (!series) return [{ number: 1, label: 'S1', episodeCount: 0 }];
  const seasons: any[] = Array.isArray(series.seasons) ? series.seasons : [];
  if (seasons.length === 0) return [{ number: 1, label: 'S1', episodeCount: 0 }];
  return seasons.map((s: any, i: number) => ({
    number: Number(s.number ?? s.seasonNumber ?? s.season ?? i + 1),
    label: `S${Number(s.number ?? s.seasonNumber ?? s.season ?? i + 1)}`,
    episodeCount: Array.isArray(s.episodes) ? s.episodes.length : 0,
  }));
};

export default function SeasonEpisodesScreen() {
  const { id, seasonId } = useLocalSearchParams<{ id: string; seasonId: string }>();
  const [activeSeason, setActiveSeason] = useState(Number(seasonId) || 1);

  // M-004: fetch the real series from the API instead of using MOCK_EPISODES.
  const { data: series, isLoading } = useSeries(String(id || ''));
  const seasons = useMemo(() => extractSeasons(series), [series]);
  const episodes = useMemo(() => extractEpisodes(series, activeSeason), [series, activeSeason]);

  const renderEpisodeItem: ListRenderItem<Episode> = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.episodeRow,
        item.isCurrent && styles.episodeRowCurrent,
      ]}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: `/player/${id}` as any, params: { type: 'series', season: String(activeSeason), episode: String(item.number) } })}
    >
      {/* Left Border for Current */}
      {item.isCurrent && <View style={styles.currentBorder} />}

      {/* Thumbnail */}
      <View style={styles.episodeThumbnail}>
        <LinearGradient colors={item.gradientColors} style={StyleSheet.absoluteFill} />
        <View style={styles.thumbnailOverlay}>
          <Ionicons
            name={item.progress > 0 && item.progress < 1 ? 'play' : 'play'}
            size={22}
            color="rgba(255,255,255,0.8)"
          />
        </View>
        {item.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>

      {/* Episode Info */}
      <View style={styles.episodeInfo}>
        <View style={styles.episodeHeader}>
          <Text style={styles.episodeNumber}>E{item.number}</Text>
          <Text style={styles.episodeDuration}>{item.duration}</Text>
        </View>
        <Text style={styles.episodeTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.episodeDescription} numberOfLines={2}>
          {item.description}
        </Text>

        {/* Progress Bar */}
        {item.progress > 0 && item.progress < 1 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#7C3AED', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${item.progress * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(item.progress * 100)}%</Text>
          </View>
        )}

        {item.progress === 1 && (
          <View style={styles.watchedRow}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.watchedText}>Watched</Text>
          </View>
        )}
      </View>

      {/* Download Button */}
      <TouchableOpacity style={styles.downloadButton} activeOpacity={0.6}>
        <Ionicons name="download-outline" size={20} color="#6B6B80" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Season Tabs */}
      <View style={styles.seasonTabsContainer}>
        {seasons.map((season) => (
          <TouchableOpacity
            key={season.number}
            style={[
              styles.seasonTab,
              activeSeason === season.number && styles.seasonTabActive,
            ]}
            activeOpacity={0.7}
            onPress={() => setActiveSeason(season.number)}
          >
            <Text
              style={[
                styles.seasonTabText,
                activeSeason === season.number && styles.seasonTabTextActive,
              ]}
            >
              {season.label}
            </Text>
            {activeSeason === season.number && (
              <View style={styles.seasonTabIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </View>
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
        <View style={styles.titleSection}>
          <Text style={styles.screenTitle}>{series?.title || 'Series'}</Text>
          <Text style={styles.seasonSubtitle}>Season {activeSeason}</Text>
        </View>
        <TouchableOpacity style={styles.dropdownButton} activeOpacity={0.7}>
          <Ionicons name="chevron-down" size={22} color="#B3B8C8" />
        </TouchableOpacity>
      </View>

      {/* Episodes List */}
      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color="#7C3AED" size="large" />
        </View>
      ) : episodes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="film-outline" size={48} color="#6B6B80" />
          <Text style={styles.emptyText}>No episodes available for this season.</Text>
        </View>
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(item) => item.id}
          renderItem={renderEpisodeItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  titleSection: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F2F2F7',
  },
  seasonSubtitle: {
    fontSize: 13,
    color: '#B3B8C8',
    marginTop: 2,
  },
  dropdownButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#121A2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    paddingBottom: 8,
  },
  seasonTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 4,
  },
  seasonTab: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    position: 'relative',
    alignItems: 'center',
  },
  seasonTabActive: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 14,
  },
  seasonTabText: {
    fontSize: 15,
    color: '#6B6B80',
    fontWeight: '600',
  },
  seasonTabTextActive: {
    color: '#F2F2F7',
  },
  seasonTabIndicator: {
    position: 'absolute',
    bottom: 2,
    left: '25%',
    right: '25%',
    height: 3,
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 14,
  },
  episodeRowCurrent: {
    backgroundColor: 'rgba(124,58,237,0.05)',
    marginHorizontal: -24,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  currentBorder: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  episodeThumbnail: {
    width: 84,
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  thumbnailOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F2F2F7',
    letterSpacing: 0.5,
  },
  episodeInfo: {
    flex: 1,
    gap: 3,
  },
  episodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  episodeNumber: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  episodeDuration: {
    fontSize: 12,
    color: '#6B6B80',
  },
  episodeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F2F2F7',
  },
  episodeDescription: {
    fontSize: 13,
    color: '#B3B8C8',
    lineHeight: 19,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: '600',
    width: 32,
  },
  watchedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  watchedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#121A2F',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});