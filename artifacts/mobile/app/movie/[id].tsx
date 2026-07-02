import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Share,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useMovie, useToggleFavorite, useRelatedMovies, useFavorites } from '@/lib/api-hooks';
import { Config } from '@/constants/config';
import { AdBanner } from '@/components/AdBanner';
import { AdRewarded } from '@/components/AdRewarded';
import { useAuthStore } from '@/lib/auth-store';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// M-023: removed FALLBACK_CAST and FALLBACK_SIMILAR — show empty states instead.

const GRADIENTS: [string, string][] = [
  ['#7C3AED', '#2563EB'], ['#EC4899', '#7C3AED'], ['#2563EB', '#10B981'],
  ['#F5C518', '#EF4444'], ['#EF4444', '#7C3AED'], ['#10B981', '#2563EB'],
];

export default function MovieDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [descExpanded, setDescExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('Movie');
  const [rewardAdVisible, setRewardAdVisible] = useState(false);
  const { user } = useAuthStore();
  const isPremium = !!user?.plan && user.plan.toLowerCase() !== 'free';

  const handleWatchAdPlay = useCallback(() => setRewardAdVisible(true), []);
  const handleRewardAdClose = useCallback(() => setRewardAdVisible(false), []);

  const { data: movieData, isLoading, isError, refetch } = useMovie(id || '');
  const { data: relatedData } = useRelatedMovies(id || '');
  // M-022: pull favorites from the server and derive the bookmark state.
  const { data: favorites } = useFavorites();
  const toggleFav = useToggleFavorite();

  const isBookmarked = useMemo(
    () => (favorites || []).some((f: any) => f.id === id),
    [favorites, id],
  );

  const movie = useMemo(() => {
    if (!movieData) return null;
    const m = movieData as any;
    return {
      id: m.id || id,
      title: m.title || m.name || 'Movie',
      rating: m.rating || m.imdbRating || 8.7,
      year: (m.year || '2023').toString(),
      duration: m.duration || m.runtime || '2h 15m',
      // API field: ageRating (schema.prisma). certification/ratingLabel are legacy fallbacks.
      certification: m.ageRating || m.certification || m.ratingLabel || '',
      // API does not have a quality field — omit default claim.
      quality: m.quality || '',
      genres: m.genres || m.genre || [],
      description: m.description || m.synopsis || m.overview || '',
      cast: m.cast || [],
      similar: m.similar || m.similarMovies || [],
      // API field: poster. posterUrl/thumbnail are legacy fallbacks.
      poster: m.poster || m.posterUrl || m.thumbnail || m.backdropUrl || m.cover || '',
    };
  }, [movieData, id]);

  const cast = useMemo(() => {
    // M-023: return real cast only — no fallback fake entries.
    if (!movie?.cast || movie.cast.length === 0) return [];
    return movie.cast.map((c: any) => ({
      id: c.id || String(Math.random()),
      name: c.name || '',
      initials: (c.name || '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    }));
  }, [movie]);

  const similar = useMemo(() => {
    // M-023: prefer API related data, then movie.similar, otherwise empty.
    const relatedList = Array.isArray(relatedData) && relatedData.length > 0 ? relatedData : movie?.similar || [];
    if (!relatedList || relatedList.length === 0) return [];
    return relatedList.map((s: any, i: number) => ({
      id: s.id || String(i + 1),
      title: s.title || s.name || '',
      gradientColors: GRADIENTS[i % GRADIENTS.length],
    }));
  }, [movie, relatedData]);

  // handleRewardEarned is declared here — after `movie` — so movie?.title is safe.
  const handleRewardEarned = useCallback(() => {
    setRewardAdVisible(false);
    router.push(`/player/${id}?type=movie&title=${encodeURIComponent(movie?.title || '')}`);
  }, [id, movie?.title]);

  const handleToggleFavorite = () => {
    // M-022: drive the toggle off the server-derived state.
    toggleFav.mutate({ type: 'movie', id: id || '', action: isBookmarked ? 'remove' : 'add' });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${movie?.title} on StreamPro!`,
      });
    } catch (error) {
      if (__DEV__) console.log('Share error:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient colors={['#7C3AED', '#2563EB']} style={styles.skeletonPulse} />
      </View>
    );
  }

  if (isError || !movie) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Ionicons name="alert-circle-outline" size={48} color="#6B6B80" />
        <Text style={styles.errorText}>Failed to load movie</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const genreList = Array.isArray(movie.genres) ? movie.genres : [movie.genres].filter(Boolean);

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
            colors={['#7C3AED', '#EC4899']}
            style={styles.backdropGradient}
          />
          {movie.poster ? (
            <Image
              source={{ uri: Config.imageUrl(movie.poster) }}
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

          {/* Top Action Buttons */}
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

        {/* Content Area */}
        <View style={styles.content}>
          {/* Title Section */}
          <Text style={styles.movieTitle}>{movie.title}</Text>
          
          <View style={styles.metaRow}>
            <Ionicons name="star" size={16} color="#F5C518" style={{ marginTop: -2 }} />
            <Text style={styles.metaTextHighlight}>{movie.rating}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{movie.year}</Text>
            <Text style={styles.metaDot}>•</Text>
            {genreList.slice(0, 2).map((g: any, i: number) => (
              <React.Fragment key={i}>
                <Text style={styles.metaText}>{typeof g === 'string' ? g : g.name || g.title || ''}</Text>
                {i === 0 && genreList.length > 1 && <Text style={styles.metaDot}>•</Text>}
              </React.Fragment>
            ))}
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{movie.duration}</Text>
          </View>

          {/* Rewarded Ad Modal */}
          <AdRewarded
            placement="movie_rewarded"
            visible={rewardAdVisible}
            onClose={handleRewardAdClose}
            onRewardEarned={handleRewardEarned}
          />

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/player/${id}?type=movie&title=${encodeURIComponent(movie?.title || '')}`)}>
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.watchNowButton}
              >
                <Ionicons name="play" size={20} color="#FFFFFF" />
                <Text style={styles.watchNowText}>Play</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Watch Ad & Play — shown to free users only */}
            {!isPremium && (
              <TouchableOpacity style={styles.watchAdButton} activeOpacity={0.8} onPress={handleWatchAdPlay}>
                <Ionicons name="play-circle-outline" size={18} color="#F59E0B" />
                <Text style={styles.watchAdText}>Watch Ad & Play</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.myListButton} activeOpacity={0.8} onPress={handleToggleFavorite}>
              <Ionicons name={isBookmarked ? 'checkmark' : 'add-outline'} size={20} color="#FFFFFF" />
              <Text style={styles.myListText}>{isBookmarked ? 'Added' : 'My List'}</Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => setDescExpanded(!descExpanded)}>
            <Text 
              style={styles.description} 
              numberOfLines={descExpanded ? undefined : 3}
            >
              {movie.description}
            </Text>
            {!descExpanded && (
              <Text style={styles.readMoreText}>more</Text>
            )}
          </TouchableOpacity>

          {/* Ad Banner — shown to free users between description and cast */}
          <AdBanner placement="movies_banner" style={{ marginTop: 16, marginBottom: 4 }} />

          {/* Cast */}
          <Text style={styles.sectionTitle}>Cast</Text>
          {cast.length === 0 ? (
            // M-023: empty state instead of fake cast cards.
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={32} color="#6B6B80" />
              <Text style={styles.emptyText}>No cast information</Text>
            </View>
          ) : (
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
                </View>
              ))}
            </ScrollView>
          )}

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {['Movie', 'About', 'More Like This'].map((tab) => (
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

          {/* More Like This */}
          {activeTab === 'More Like This' && (
            similar.length === 0 ? (
              // M-023: empty state instead of fake similar cards.
              <View style={styles.emptyState}>
                <Ionicons name="film-outline" size={32} color="#6B6B80" />
                <Text style={styles.emptyText}>No similar movies</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarScrollContent}
              >
                {similar.map((s: any) => (
                  <TouchableOpacity key={s.id} activeOpacity={0.8} onPress={() => router.push(`/movie/${s.id}`)}>
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
            )
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
  movieTitle: {
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
  watchAdButton: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  watchAdText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
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
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Outfit',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 32,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B6B80',
    fontFamily: 'Inter',
  },
});
