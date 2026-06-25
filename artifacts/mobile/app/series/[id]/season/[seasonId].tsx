import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';

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

const MOCK_EPISODES: Episode[] = [
  {
    id: 'e1',
    number: 1,
    title: 'The Awakening',
    description: 'Dr. Maya Lin discovers an ancient artifact that holds the key to understanding the darkness spreading across the world.',
    duration: '52 min',
    progress: 1.0,
    isNew: false,
    isCurrent: false,
    gradientColors: ['#10B981', '#059669'],
  },
  {
    id: 'e2',
    number: 2,
    title: 'Shadows Gather',
    description: 'As strange events intensify, Agent Cole is drawn into a conspiracy that threatens to unravel everything he believes in.',
    duration: '48 min',
    progress: 1.0,
    isNew: false,
    isCurrent: false,
    gradientColors: ['#2563EB', '#1D4ED8'],
  },
  {
    id: 'e3',
    number: 3,
    title: 'Into the Dark',
    description: 'The team ventures into the shadow realm, where the rules of reality no longer apply and danger lurks at every turn.',
    duration: '55 min',
    progress: 0.45,
    isNew: false,
    isCurrent: true,
    gradientColors: ['#7C3AED', '#6D28D9'],
  },
  {
    id: 'e4',
    number: 4,
    title: 'The Reckoning',
    description: 'Past mistakes come back to haunt the heroes as they face their greatest challenge yet in the heart of the storm.',
    duration: '50 min',
    progress: 0,
    isNew: false,
    isCurrent: false,
    gradientColors: ['#EC4899', '#DB2777'],
  },
  {
    id: 'e5',
    number: 5,
    title: 'Final Stand',
    description: 'With time running out, the group must make a desperate last stand against the forces of darkness consuming the world.',
    duration: '58 min',
    progress: 0,
    isNew: false,
    isCurrent: false,
    gradientColors: ['#EF4444', '#DC2626'],
  },
  {
    id: 'e6',
    number: 6,
    title: 'New Dawn',
    description: 'In the explosive season finale, sacrifices must be made and the true nature of the darkness is finally revealed.',
    duration: '54 min',
    progress: 0,
    isNew: true,
    isCurrent: false,
    gradientColors: ['#F59E0B', '#D97706'],
  },
];

export default function SeasonEpisodesScreen() {
  const { id, seasonId } = useLocalSearchParams<{ id: string; seasonId: string }>();
  const [activeSeason, setActiveSeason] = useState(Number(seasonId) || 2);

  const seasons = [
    { number: 1, label: 'S1', episodeCount: 8 },
    { number: 2, label: 'S2', episodeCount: 6 },
    { number: 3, label: 'S3', episodeCount: 10 },
  ];

  const renderEpisodeItem: ListRenderItem<Episode> = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.episodeRow,
        item.isCurrent && styles.episodeRowCurrent,
      ]}
      activeOpacity={0.7}
      onPress={() => router.push(`/player/${item.id}`)}
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
          <Text style={styles.screenTitle}>Nightfall</Text>
          <Text style={styles.seasonSubtitle}>Season {activeSeason}</Text>
        </View>
        <TouchableOpacity style={styles.dropdownButton} activeOpacity={0.7}>
          <Ionicons name="chevron-down" size={22} color="#B3B8C8" />
        </TouchableOpacity>
      </View>

      {/* Episodes List */}
      <FlatList
        data={MOCK_EPISODES}
        keyExtractor={(item) => item.id}
        renderItem={renderEpisodeItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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