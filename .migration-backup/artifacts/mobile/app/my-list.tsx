import React, { useMemo } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFavorites, useToggleFavorite, useContinueWatching } from '@/lib/api-hooks';

const { width } = Dimensions.get('window');

const GRADIENTS = [
  '#1a1a3e', '#1e2a1e', '#2a1a2e', '#1e1e2a', '#1a2a2e', '#2a2a1a',
  '#2a1a1a', '#1a2a2a', '#1a1a2a', '#20201a',
];

export default function MyListScreen() {
  const { data: favoritesData, isLoading: favLoading, isError: favError, refetch: refetchFav } = useFavorites();
  const { data: continueData, isLoading: contLoading } = useContinueWatching();
  const toggleFav = useToggleFavorite();
  const [editing, setEditing] = React.useState(false);

  // Map continue watching from API
  const continueWatching = useMemo(() => {
    if (!continueData || !Array.isArray(continueData) || continueData.length === 0) return [];
    return continueData.slice(0, 6).map((c: any, i: number) => ({
      id: c.contentId || c.movieId || c.seriesId || c.id || String(i + 1),
      title: c.title || c.movie?.title || c.series?.title || '',
      progress: c.progress || 0,
      duration: c.remainingTime || `${Math.round((1 - (c.progress || 0)) * 60)}m left`,
      color: GRADIENTS[i % GRADIENTS.length],
      contentType: c.contentType || (c.movieId ? 'movie' : c.seriesId ? 'series' : 'movie'),
    }));
  }, [continueData]);

  // Map favorites from API
  const watchlist = useMemo(() => {
    if (!favoritesData || !Array.isArray(favoritesData) || favoritesData.length === 0) {
      return [];
    }
    return favoritesData.map((f: any, i: number) => ({
      id: f.id || f.contentId || String(i + 1),
      title: f.title || f.name || f.content?.title || '',
      year: (f.year || '').toString(),
      genre: f.genre || f.genres?.[0] || f.content?.genre || '',
      color: GRADIENTS[i % GRADIENTS.length],
      type: f.type || f.contentType || 'movie',
    }));
  }, [favoritesData, favError]);

  const removeFavorite = (item: any) => {
    toggleFav.mutate({ type: item.type || 'movie', id: item.id, action: 'remove' });
  };

  const renderContinueWatching = ({ item }: { item: typeof continueWatching[0] }) => (
    <Pressable style={styles.continueCard} onPress={() => router.push(`/player/${item.id}?type=${item.contentType}&title=${encodeURIComponent(item.title)}`)}>
      <View style={[styles.continueThumbnail, { backgroundColor: item.color }]}>
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={24} color="#fff" />
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${item.progress * 100}%` }]} />
        </View>
      </View>
      <Text numberOfLines={1} style={styles.continueTitle}>{item.title}</Text>
      <Text style={styles.continueDuration}>{item.duration}</Text>
    </Pressable>
  );

  const renderWatchlistItem = ({ item }: { item: typeof watchlist[0] }) => (
    // @ts-ignore
    <Pressable style={styles.watchlistRow} onPress={() => router.push(item.type === 'series' ? `/series/${item.id}` : `/movie/${item.id}`)}>
      <View style={[styles.watchlistThumb, { backgroundColor: item.color }]}>
        <Ionicons name="film" size={24} color="rgba(255,255,255,0.3)" />
      </View>
      <View style={styles.watchlistInfo}>
        <Text style={styles.watchlistTitle}>{item.title}</Text>
        <Text style={styles.watchlistYear}>{item.year}</Text>
        <View style={styles.genreBadge}>
          <Text style={styles.genreText}>{item.genre}</Text>
        </View>
      </View>
      {editing && (
        <Pressable style={styles.removeBtn} onPress={() => removeFavorite(item)}>
          <Ionicons name="heart" size={20} color="#EC4899" />
        </Pressable>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My List</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => setEditing(!editing)}>
            <Ionicons name={editing ? 'close' : 'create-outline'} size={22} color="#B3B8C8" />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => refetchFav()}>
            <Ionicons name="refresh" size={22} color="#B3B8C8" />
          </Pressable>
        </View>
      </View>

      {favLoading ? (
        <View style={styles.fullLoading}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <>
          {continueWatching.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Continue Watching</Text>
              <FlatList
                data={continueWatching}
                renderItem={renderContinueWatching}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              />
            </View>
          )}

          {watchlist.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Watchlist</Text>
              <FlatList
                data={watchlist}
                renderItem={renderWatchlistItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={64} color="#6B6B80" />
              <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
              <Text style={styles.emptySubtitle}>Add movies and shows to your list to watch later</Text>
              <Pressable onPress={() => router.push('/(main)/browse')} style={styles.exploreBtn}>
                <LinearGradient colors={['#7C3AED', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.exploreGradient}>
                  <Text style={styles.exploreText}>Explore Content</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070F', paddingHorizontal: 24 },
  fullLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingBottom: 20 },
  headerTitle: { color: '#F2F2F7', fontSize: 24, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#121A2F', justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#F2F2F7', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  continueCard: { width: 160 },
  continueThumbnail: { width: 160, height: 90, borderRadius: 14, overflow: 'hidden', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  playOverlay: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  progressBarBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  progressBarFill: { height: '100%', backgroundColor: '#7C3AED', borderRadius: 2 },
  continueTitle: { color: '#F2F2F7', fontSize: 13, fontWeight: '600', marginTop: 8 },
  continueDuration: { color: '#6B6B80', fontSize: 11, marginTop: 2 },
  watchlistRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  watchlistThumb: { width: 84, height: 120, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  watchlistInfo: { flex: 1 },
  watchlistTitle: { color: '#F2F2F7', fontSize: 15, fontWeight: '600' },
  watchlistYear: { color: '#6B6B80', fontSize: 13, marginTop: 2 },
  genreBadge: { marginTop: 6, backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
  genreText: { color: '#7C3AED', fontSize: 11, fontWeight: '600' },
  removeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(236,72,153,0.1)', justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { color: '#F2F2F7', fontSize: 18, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  emptySubtitle: { color: '#6B6B80', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  exploreBtn: { marginTop: 28 },
  exploreGradient: { borderRadius: 18, paddingHorizontal: 32, paddingVertical: 14 },
  exploreText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});