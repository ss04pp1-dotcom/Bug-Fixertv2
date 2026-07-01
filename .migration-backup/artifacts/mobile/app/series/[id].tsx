import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSeries, useToggleFavorite, useRecommendations } from '@/lib/api-hooks';
import { Config } from '@/constants/config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Fallback Data ───────────────────────────────────────────────────

const FALLBACK_EPISODES = [
  { id: 'e1', number: 1, title: 'The Awakening', duration: '52m', progress: 1.0, gradientColors: ['#10B981', '#059669'] },
  { id: 'e2', number: 2, title: 'Shadows Gather', duration: '48m', progress: 0.65, gradientColors: ['#2563EB', '#1D4ED8'] },
  { id: 'e3', number: 3, title: 'Into the Dark', duration: '55m', progress: 0.3, gradientColors: ['#7C3AED', '#6D28D9'] },
  { id: 'e4', number: 4, title: 'The Reckoning', duration: '50m', progress: 0, gradientColors: ['#EC4899', '#DB2777'] },
  { id: 'e5', number: 5, title: 'Final Stand', duration: '58m', progress: 0, gradientColors: ['#EF4444', '#DC2626'] },
  { id: 'e6', number: 6, title: 'New Dawn', duration: '54m', progress: 0, gradientColors: ['#F59E0B', '#D97706'] },
];

const FALLBACK_CAST = [
  { id: '1', name: 'Sarah Chen', role: 'Dr. Maya Lin', initials: 'SC' },
  { id: '2', name: 'James Walker', role: 'Agent Cole', initials: 'JW' },
  { id: '3', name: 'Priya Sharma', role: 'Anya Patel', initials: 'PS' },
  { id: '4', name: 'Michael Torres', role: 'Director Hayes', initials: 'MT' },
];

const GRADIENTS: [string, string][] = [
  ['#7C3AED', '#2563EB'], ['#EC4899', '#7C3AED'], ['#2563EB', '#10B981'],
  ['#F5C518', '#EF4444'], ['#EF4444', '#7C3AED'], ['#10B981', '#2563EB'],
];

export default function SeriesDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeSeason, setActiveSeason] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('Episodes');

  const { data: seriesData, isLoading, isError, refetch } = useSeries(id || '');
  const { data: relatedData } = useRecommendations('series', id || '');
  const toggleFav = useToggleFavorite();

  const series = useMemo(() => {
    if (!seriesData) return null;
    const s = seriesData as any;
    return {
      id: s.id || id,
      title: s.title || s.name || 'Series Title',
      rating: s.rating || 0,
      ratingCount: s.ratingCount || s.totalRatings || 0,
      year: (s.year || '').toString(),
      // API returns _count.seasons (Prisma aggregation), not a flat seasonCount field
      seasons: s._count?.seasons ?? (Array.isArray(s.seasons) ? s.seasons.length : (s.seasonCount ?? 0)),
      // API field: ageRating. certification is a legacy fallback.
      certification: s.ageRating || s.certification || '',
      description: s.description || s.synopsis || s.overview || '',
      genres: s.genres || s.genre || [],
      cast: s.cast || [],
      episodes: s.episodes || [],
      // API field: poster. posterUrl/thumbnail are legacy fallbacks.
      poster: s.poster || s.posterUrl || s.thumbnail || s.backdropUrl || s.cover || '',
    };
  }, [seriesData, id]);

  const episodes = useMemo(() => {
    if (series?.episodes && series.episodes.length > 0) {
      return series.episodes.map((ep: any, i: number) => ({
        id: ep.id || `ep-${i}`,
        number: ep.number || ep.episodeNumber || (i + 1),
        title: ep.title || ep.name || `Episode ${i + 1}`,
        duration: ep.duration || `${ep.runtime || 45}m`,
        progress: ep.progress || 0,
        gradientColors: GRADIENTS[i % GRADIENTS.length],
      }));
    }
    return FALLBACK_EPISODES;
  }, [series]);

  const cast = useMemo(() => {
    if (series?.cast && series.cast.length > 0) {
      return series.cast.map((c: any) => ({
        id: c.id || String(Math.random()),
        name: c.name || '',
        role: c.role || c.character || '',
        initials: (c.name || '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      }));
    }
    return FALLBACK_CAST;
  }, [series]);

  const similar = useMemo(() => {
    const relatedList = Array.isArray(relatedData) && relatedData.length > 0 ? relatedData : [];
    if (relatedList.length > 0) {
      return relatedList.map((s: any, i: number) => ({
        id: s.id || String(i + 1),
        title: s.title || s.name || '',
        gradientColors: GRADIENTS[i % GRADIENTS.length],
      }));
    }
    return [];
  }, [relatedData]);

  const seasonList = useMemo(() => {
    const count = series?.seasons || 1;
    return Array.from({ length: count }, (_, i) => `S${i + 1}`);
  }, [series]);

  const handleToggleFavorite = () => {
    const nextState = !isBookmarked;
    setIsBookmarked(nextState);
    toggleFav.mutate({ type: 'series', id: id || '', action: nextState ? 'add' : 'remove' });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Watch ${series?.title} on StreamPro!`,
      });
    } catch (error) {
      if (__DEV__) console.log('Share error:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient colors={['#7C3AED', '#EC4899']} style={styles.skeletonPulse} />
      </View>
    );
  }

  if (isError || !series) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Ionicons name="alert-circle-outline" size={48} color="#A1A1AA" />
        <Text style={styles.errorText}>Failed to load series</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const genreList = Array.isArray(series.genres) ? series.genres : [series.genres].filter(Boolean);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {/* Full Screen Poster Hero Area */}
        <View style={styles.backdropContainer}>
          <LinearGradient
            colors={['#2563EB', '#7C3AED']}
            style={styles.backdropGradient}
          />
          {series.poster ? (
            <Image
              source={{ uri: Config.imageUrl(series.poster) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.backdropOverlay}>
            <LinearGradient
              colors={['rgba(10,10,15,0)', 'rgba(10,10,15,0.7)', '#0A0A0F']}
              locations={[0.2, 0.7, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Top Actions */}
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.actionCircle}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCircle} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title Section */}
          <Text style={styles.seriesTitle}>{series.title}</Text>
          
          <View style={styles.metaRow}>
            <Ionicons name="star" size={16} color="#F5C518" style={{ marginTop: -2 }} />
            <Text style={styles.metaTextHighlight}>{series.rating}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{series.year}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{seasonList.length} Seasons</Text>
            <Text style={styles.metaDot}>•</Text>
            {genreList.slice(0, 1).map((g: any, i: number) => (
              <React.Fragment key={i}>
                <Text style={styles.metaText}>{typeof g === 'string' ? g : g.name || g.title || ''}</Text>
              </React.Fragment>
            ))}
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{series.certification}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => {
              const firstEp = episodes[0];
              if (firstEp) router.push({
                pathname: `/player/${id}` as any,
                // M-010: pass the active season (1-indexed) and E1 explicitly.
                params: { type: 'series', title: series?.title || '', season: String(activeSeason + 1), episode: '1' },
              });
            }}>
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.watchNowButton}
              >
                <Ionicons name="play" size={20} color="#FFFFFF" />
                <Text style={styles.watchNowText}>Play S1 E1</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.myListButton} activeOpacity={0.8} onPress={handleToggleFavorite}>
              <Ionicons name={isBookmarked ? 'checkmark' : 'add-outline'} size={20} color="#FFFFFF" />
              <Text style={styles.myListText}>{isBookmarked ? 'My List' : 'My List'}</Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => setDescExpanded(!descExpanded)}>
            <Text 
              style={styles.description} 
              numberOfLines={descExpanded ? undefined : 3}
            >
              {series.description}
            </Text>
            {!descExpanded && (
              <Text style={styles.readMoreText}>more</Text>
            )}
          </TouchableOpacity>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {['Episodes', 'About', 'More Like This'].map((tab) => (
              <TouchableOpacity 
                key={tab} 
                style={styles.tabItem} 
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab}
                </Text>
                {activeTab === tab && (
                  <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.tabIndicator} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'Episodes' && (
            <>
              {/* Season Selector Dropdown placeholder / Scroll */}
              <View style={styles.seasonTabsContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seasonTabsScroll}
                >
                  {seasonList.map((season, index) => (
                    <TouchableOpacity
                      key={season}
                      style={[styles.seasonTab, activeSeason === index && styles.seasonTabActive]}
                      activeOpacity={0.7}
                      onPress={() => setActiveSeason(index)}
                    >
                      <Text
                        style={[
                          styles.seasonTabText,
                          activeSeason === index && styles.seasonTabTextActive,
                        ]}
                      >
                        {season}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Episode List */}
              <View style={styles.episodesList}>
                {episodes.map((episode: any) => (
                  <TouchableOpacity
                    key={episode.id}
                    style={styles.episodeRow}
                    activeOpacity={0.8}
                    onPress={() => router.push({
                      pathname: `/player/${id}` as any,
                      // M-010: pass the season (not the episode number) as `season`, and the episode number as `episode`.
                      params: { type: 'series', title: series?.title || '', season: String(activeSeason + 1), episode: String(episode.number) },
                    })}
                  >
                    <View style={styles.episodeThumbnailLarge}>
                      <LinearGradient
                        colors={episode.gradientColors}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.episodeThumbnailOverlay}>
                        <Ionicons name="play" size={24} color="#FFFFFF" />
                      </View>
                      {episode.progress > 0 && (
                        <View style={styles.episodeProgressBar}>
                          <View style={[styles.episodeProgressFill, { width: `${episode.progress * 100}%` }]} />
                        </View>
                      )}
                    </View>
                    <View style={styles.episodeRowInfo}>
                      <Text style={styles.episodeRowTitle} numberOfLines={1}>
                        {episode.number}. {episode.title}
                      </Text>
                      <Text style={styles.episodeRowDuration}>{episode.duration}</Text>
                    </View>
                    <TouchableOpacity style={styles.downloadBtn}>
                      <Ionicons name="download-outline" size={20} color="#A1A1AA" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {activeTab === 'About' && (
            <View>
              {/* Cast */}
              <Text style={styles.sectionTitle}>Cast</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.castScrollContent}
              >
                {cast.map((member: any) => (
                  <View key={member.id} style={styles.castItem}>
                    <LinearGradient
                      colors={['#13131C', '#1A1A24']}
                      style={styles.castAvatar}
                    >
                      <Text style={styles.castInitials}>{member.initials}</Text>
                    </LinearGradient>
                    <Text style={styles.castName} numberOfLines={1}>
                      {member.name}
                    </Text>
                    <Text style={styles.castRole} numberOfLines={1}>
                      {member.role}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {activeTab === 'More Like This' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarScrollContent}
            >
              {similar.map((s: any) => (
                <TouchableOpacity key={s.id} activeOpacity={0.8} onPress={() => router.push(`/series/${s.id}`)}>
                  <LinearGradient
                    colors={s.gradientColors}
                    style={styles.similarCard}
                  >
                    <View style={styles.similarCardOverlay}>
                      <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.6)" />
                    </View>
                  </LinearGradient>
                  <Text style={styles.similarTitle} numberOfLines={2}>
                    {s.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  skeletonPulse: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
    opacity: 0.3,
  },
  errorText: {
    fontSize: 16,
    color: '#A1A1AA',
    fontFamily: 'Inter',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
    fontFamily: 'Inter',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  backdropContainer: {
    height: SCREEN_HEIGHT * 0.55,
    width: '100%',
    position: 'relative',
  },
  backdropGradient: {
    width: '100%',
    height: '100%',
  },
  backdropOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  topActions: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    marginTop: -40,
  },
  seriesTitle: {
    fontSize: 32,
    fontFamily: 'Outfit',
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  metaTextHighlight: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '600',
    marginLeft: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#A1A1AA',
    fontFamily: 'Inter',
  },
  metaDot: {
    fontSize: 14,
    color: '#A1A1AA',
    marginHorizontal: 8,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 24,
  },
  watchNowButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  watchNowText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  myListButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  myListText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  description: {
    fontSize: 15,
    color: '#A1A1AA',
    lineHeight: 24,
    fontFamily: 'Inter',
  },
  readMoreText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '600',
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 32,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabItem: {
    marginRight: 24,
    paddingBottom: 12,
    position: 'relative',
  },
  tabText: {
    fontSize: 16,
    color: '#A1A1AA',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  seasonTabsContainer: {
    marginBottom: 20,
  },
  seasonTabsScroll: {
    gap: 8,
  },
  seasonTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#13131C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  seasonTabActive: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderColor: 'rgba(139,92,246,0.3)',
  },
  seasonTabText: {
    fontSize: 14,
    color: '#A1A1AA',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  seasonTabTextActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  episodesList: {
    gap: 16,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  episodeThumbnailLarge: {
    width: 140,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  episodeThumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeProgressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  episodeProgressFill: {
    height: '100%',
    backgroundColor: '#EC4899',
  },
  episodeRowInfo: {
    flex: 1,
  },
  episodeRowTitle: {
    fontSize: 15,
    fontFamily: 'Inter',
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  episodeRowDuration: {
    fontSize: 13,
    color: '#A1A1AA',
    fontFamily: 'Inter',
  },
  downloadBtn: {
    padding: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Outfit',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  castScrollContent: {
    gap: 16,
    paddingRight: 20,
  },
  castItem: {
    alignItems: 'center',
    width: 72,
  },
  castAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  castInitials: {
    fontSize: 18,
    fontFamily: 'Outfit',
    fontWeight: '600',
    color: '#A1A1AA',
  },
  castName: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  castRole: {
    fontSize: 11,
    color: '#A1A1AA',
    marginTop: 2,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  similarScrollContent: {
    gap: 12,
    paddingRight: 20,
    paddingBottom: 20,
  },
  similarCard: {
    width: 140,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  similarCardOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  similarTitle: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 8,
    width: 140,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
});
