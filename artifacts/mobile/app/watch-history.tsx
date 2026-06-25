import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useContinueWatching } from '@/lib/api-hooks';
import apiClient from '@/lib/api';
import { Config } from '@/constants/config';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  border: 'rgba(255,255,255,0.06)',
};

const getImageUrl = (path?: string) => path ? Config.imageUrl(path) : '';

export default function WatchHistoryScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, isLoading } = useContinueWatching();

  const history = (data && Array.isArray(data)) ? data : [];

  const handleClearAll = () => {
    if (history.length === 0) return;
    Alert.alert(
      'Clear Watch History',
      'Are you sure you want to clear your entire watch history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete('/watch-history');
              queryClient.invalidateQueries({ queryKey: ['watch-history'] });
            } catch {
              Alert.alert('Error', 'Failed to clear watch history. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Watch History</Text>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={handleClearAll} disabled={history.length === 0}>
          <Text style={[s.clearTxt, history.length === 0 && { opacity: 0.4 }]}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item, index) => item.id || String(index)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const content = item.movie || item.series;
            if (!content) return null;
            
            const isMovie = !!item.movie;
            const progressPercent = item.progress ? Math.min(100, Math.round(item.progress * 100)) : 0;
            const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Recently';

            return (
              <TouchableOpacity 
                style={s.historyCard}
                onPress={() => router.push(isMovie ? `/movie/${content.id}` : `/series/${content.id}`)}
              >
                <Image source={{ uri: getImageUrl(content.posterUrl || content.thumbnailUrl) }} style={s.poster} />
                <View style={s.infoArea}>
                  <Text style={s.title} numberOfLines={1}>{content.title}</Text>
                  <Text style={s.meta}>{isMovie ? 'Movie' : 'Series'} • Watched {progressPercent}% • {dateStr}</Text>
                  
                  <View style={s.progressTrack}>
                    <View style={[s.progressBar, { width: `${progressPercent}%` }]} />
                  </View>
                  
                  <TouchableOpacity style={s.playBtn} onPress={() => router.push(`/player/${content.id}?type=${isMovie ? 'movie' : 'series'}`)}>
                    <Ionicons name="play" size={12} color="#fff" />
                    <Text style={s.playBtnTxt}>Continue Watching</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListEmptyComponent={() => (
             <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Ionicons name="time-outline" size={48} color={C.textSec} />
                <Text style={{ color: C.textSec, marginTop: 12, fontFamily: 'Inter' }}>No watch history found</Text>
             </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text, fontFamily: 'Outfit' },
  clearTxt: { fontSize: 14, fontWeight: '600', color: C.primary, fontFamily: 'Inter' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  historyCard: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.border, gap: 12 },
  poster: { width: 70, height: 100, borderRadius: 8, backgroundColor: '#1E1E2E' },
  infoArea: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: C.text, fontFamily: 'Inter', marginBottom: 4 },
  meta: { fontSize: 12, color: C.textSec, fontFamily: 'Inter', marginBottom: 10 },
  
  progressTrack: { height: 4, backgroundColor: '#2A2A3A', borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  progressBar: { height: 4, backgroundColor: C.primary, borderRadius: 2 },
  
  playBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(139,92,246,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  playBtnTxt: { fontSize: 12, fontWeight: '600', color: C.primary, fontFamily: 'Inter' },
});
