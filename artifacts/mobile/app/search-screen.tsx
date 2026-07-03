import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable,
  StyleSheet, Image, ActivityIndicator, StatusBar, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { Config } from '@/constants/config';
import { AdBanner } from '@/components/AdBanner';
import { useGlobalAdConfig } from '@/hooks/useGlobalAdConfig';
import { useChannelAdGate } from '@/hooks/useChannelAdGate';

const C = {
  bg: '#0A0A0F', card: '#13131C', primary: '#8B5CF6',
  accent: '#EC4899', text: '#FFFFFF', dim: '#A1A1AA',
  border: 'rgba(255,255,255,0.07)',
};

type ResultItem = {
  id: string;
  title: string;
  type: 'movie' | 'series' | 'channel';
  poster?: string;
  year?: string;
  category?: string;
};

// Use the dedicated /search endpoint — one request instead of three parallel
// calls per keystroke, reduces server load and avoids race conditions.
// Endpoint: GET /v1/search?q=<query>
// Response: { channels: [...], movies: [...], series: [...], query: string }
async function searchAll(query: string): Promise<ResultItem[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];
  try {
    const res = await apiClient.get('/search', { params: { q } });
    const envelope = res?.data?.data ?? res?.data ?? {};
    const channels: any[] = Array.isArray(envelope.channels) ? envelope.channels : [];
    const movies:   any[] = Array.isArray(envelope.movies)   ? envelope.movies   : [];
    const series:   any[] = Array.isArray(envelope.series)   ? envelope.series   : [];

    const results: ResultItem[] = [];

    channels.forEach((ch: any) => {
      results.push({
        id:       ch.id,
        title:    ch.name || '',
        type:     'channel',
        poster:   ch.logo || ch.logoUrl || '',
        category: 'Live TV',
      });
    });

    movies.forEach((m: any) => {
      results.push({
        id:       m.id,
        title:    m.title || '',
        type:     'movie',
        poster:   m.poster || m.posterUrl || '',
        year:     m.year ? String(m.year) : '',
        category: 'Movie',
      });
    });

    series.forEach((s: any) => {
      results.push({
        id:       s.id,
        title:    s.title || '',
        type:     'series',
        poster:   s.poster || s.posterUrl || '',
        year:     s.year ? String(s.year) : '',
        category: 'Series',
      });
    });

    return results;
  } catch {
    return [];
  }
}

const TYPE_ICON: Record<string, any> = {
  movie: 'film-outline', series: 'tv-outline', channel: 'radio-outline',
};
const TYPE_COLOR: Record<string, string> = {
  movie: C.primary, series: C.accent, channel: '#EF4444',
};

function AnimatedRow({ item, index, onPress }: {
  item: ResultItem; index: number; onPress: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 240,
        delay: Math.min(index * 35, 280),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 240,
        delay: Math.min(index * 35, 280),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const color = TYPE_COLOR[item.type] || C.dim;
  const icon  = TYPE_ICON[item.type] || 'film-outline';

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Pressable style={s.row} onPress={onPress} android_ripple={{ color: 'rgba(139,92,246,0.15)' }}>
        {item.poster ? (
          <Image source={{ uri: Config.imageUrl(item.poster) }} style={s.thumb} resizeMode="cover" />
        ) : (
          <View style={[s.thumb, s.thumbFallback, { backgroundColor: color + '18' }]}>
            <Ionicons name={icon} size={22} color={color} />
          </View>
        )}
        <View style={s.info}>
          <Text style={s.title} numberOfLines={1}>{item.title}</Text>
          <View style={s.meta}>
            <View style={[s.typeBadge, { backgroundColor: color + '22' }]}>
              <Text style={[s.typeTxt, { color }]}>{item.category}</Text>
            </View>
            {item.year ? <Text style={s.year}>{item.year}</Text> : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.dim} />
      </Pressable>
    </Animated.View>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(text), 300);
  }, []);

  const { data = [], isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchAll(debouncedQuery),
    enabled: debouncedQuery.trim().length > 1,  // API requires at least 2 chars
  });

  // search-screen is outside (main)/ so ChannelAdGateProvider is not available.
  // Use the hooks directly — same pattern as channel/[id].tsx and live-player/[id].tsx.
  const globalAdConfig = useGlobalAdConfig();
  const { requestChannel } = useChannelAdGate(globalAdConfig);

  const handleSelect = useCallback((item: ResultItem) => {
    if (item.type === 'movie') router.push(`/movie/${item.id}`);
    else if (item.type === 'series') router.push(`/series/${item.id}`);
    // Channels are gated behind the global ad engine — Smartlink/VAST
    // may play before navigation depending on the frequency config.
    else requestChannel(item.id, { title: item.title }).catch((e: any) => console.warn('[Search] requestChannel failed:', e?.message ?? e));
  }, [requestChannel]);

  const showPlaceholder = !isFetching && debouncedQuery.length === 0;
  const showEmpty = !isFetching && debouncedQuery.length > 0 && data.length === 0;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View style={s.inputWrap}>
          <Ionicons name="search-outline" size={18} color={C.dim} />
          <TextInput
            style={s.input}
            placeholder="Search movies, series, channels..."
            placeholderTextColor={C.dim}
            value={query}
            onChangeText={handleChange}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setDebouncedQuery(''); }}>
              <Ionicons name="close-circle" size={18} color={C.dim} />
            </Pressable>
          )}
        </View>
      </View>

      <AdBanner placement="search_banner" style={{ marginTop: 4 }} />

      {/* Results area */}
      {isFetching ? (
        <View style={s.centered}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={s.searchingTxt}>Searching…</Text>
        </View>
      ) : showPlaceholder ? (
        <View style={s.placeholder}>
          <Ionicons name="search" size={52} color="rgba(139,92,246,0.3)" />
          <Text style={s.placeholderTxt}>Search for anything</Text>
          <Text style={s.placeholderSub}>Movies, series, live TV channels</Text>
        </View>
      ) : showEmpty ? (
        <View style={s.placeholder}>
          <Ionicons name="sad-outline" size={52} color={C.dim} />
          <Text style={s.placeholderTxt}>No results found</Text>
          <Text style={s.placeholderSub}>Try different keywords</Text>
        </View>
      ) : (
        <>
          <Text style={s.countTxt}>{data.length} result{data.length !== 1 ? 's' : ''}</Text>
          <FlatList
            data={data}
            keyExtractor={(item, i) => `${item.type}-${item.id}-${i}`}
            contentContainerStyle={s.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <AnimatedRow item={item} index={index} onPress={() => handleSelect(item)} />
            )}
            ItemSeparatorComponent={() => <View style={s.sep} />}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 14,
    paddingHorizontal: 14, gap: 10, height: 46,
    borderWidth: 1, borderColor: C.border,
  },
  input: { flex: 1, color: C.text, fontSize: 15 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingBottom: 80 },
  searchingTxt: { color: C.dim, fontSize: 14 },
  placeholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingBottom: 80,
  },
  placeholderTxt: { color: C.text, fontSize: 18, fontWeight: '600' },
  placeholderSub: { color: C.dim, fontSize: 13 },
  countTxt: {
    color: C.dim, fontSize: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2,
  },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: C.card, overflow: 'hidden' },
  thumbFallback: { justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  title: { color: C.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeTxt: { fontSize: 11, fontWeight: '700' },
  year: { color: C.dim, fontSize: 12 },
  sep: { height: 1, backgroundColor: C.border, marginLeft: 70 },
});
