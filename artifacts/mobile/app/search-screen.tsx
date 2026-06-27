import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable,
  StyleSheet, Image, ActivityIndicator, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { Config } from '@/constants/config';

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

async function searchAll(query: string): Promise<ResultItem[]> {
  if (!query.trim()) return [];
  try {
    const [movies, series, channels] = await Promise.allSettled([
      apiClient.get('/movies', { params: { search: query, limit: 10 } }),
      apiClient.get('/series', { params: { search: query, limit: 10 } }),
      apiClient.get('/channels', { params: { search: query, limit: 10 } }),
    ]);

    const results: ResultItem[] = [];

    if (movies.status === 'fulfilled') {
      const data = movies.value.data?.data || movies.value.data || [];
      (Array.isArray(data) ? data : []).forEach((m: any) => {
        results.push({
          id: m.id,
          title: m.title || m.name || '',
          type: 'movie',
          poster: m.posterUrl || m.poster || m.thumbnailUrl || '',
          year: m.year ? String(m.year) : '',
          category: 'Movie',
        });
      });
    }

    if (series.status === 'fulfilled') {
      const data = series.value.data?.data || series.value.data || [];
      (Array.isArray(data) ? data : []).forEach((s: any) => {
        results.push({
          id: s.id,
          title: s.title || s.name || '',
          type: 'series',
          poster: s.posterUrl || s.poster || s.thumbnailUrl || '',
          year: s.year ? String(s.year) : '',
          category: 'Series',
        });
      });
    }

    if (channels.status === 'fulfilled') {
      const data = channels.value.data?.data || channels.value.data || [];
      (Array.isArray(data) ? data : []).forEach((ch: any) => {
        results.push({
          id: ch.id,
          title: ch.name || '',
          type: 'channel',
          poster: ch.logoUrl || ch.logo || '',
          category: ch.category?.name || 'Live TV',
        });
      });
    }

    return results;
  } catch {
    return [];
  }
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(text), 400);
  }, []);

  const { data = [], isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchAll(debouncedQuery),
    enabled: debouncedQuery.trim().length > 1,
  });

  const handleSelect = useCallback((item: ResultItem) => {
    if (item.type === 'movie') router.push(`/movie/${item.id}`);
    else if (item.type === 'series') router.push(`/series/${item.id}`);
    else if (item.type === 'channel') {
      router.push({ pathname: `/live-player/${item.id}` as any, params: { title: item.title } });
    }
  }, []);

  const typeIcon: Record<string, any> = {
    movie: 'film-outline',
    series: 'tv-outline',
    channel: 'radio-outline',
  };
  const typeColor: Record<string, string> = {
    movie: C.primary,
    series: C.accent,
    channel: '#EF4444',
  };

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

      {/* Results */}
      {isFetching ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : debouncedQuery.length < 2 ? (
        <View style={s.placeholder}>
          <Ionicons name="search" size={48} color="rgba(139,92,246,0.3)" />
          <Text style={s.placeholderTxt}>Search for anything</Text>
          <Text style={s.placeholderSub}>Movies, series, live TV channels</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={s.placeholder}>
          <Ionicons name="sad-outline" size={48} color={C.dim} />
          <Text style={s.placeholderTxt}>No results found</Text>
          <Text style={s.placeholderSub}>Try different keywords</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => `${item.type}-${item.id}-${i}`}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => handleSelect(item)}>
              {item.poster ? (
                <Image source={{ uri: Config.imageUrl(item.poster) }} style={s.thumb} resizeMode="cover" />
              ) : (
                <View style={[s.thumb, s.thumbFallback]}>
                  <Ionicons name={typeIcon[item.type] || 'film-outline'} size={22} color={typeColor[item.type] || C.dim} />
                </View>
              )}
              <View style={s.info}>
                <Text style={s.title} numberOfLines={1}>{item.title}</Text>
                <View style={s.meta}>
                  <View style={[s.typeBadge, { backgroundColor: typeColor[item.type] + '22' }]}>
                    <Text style={[s.typeTxt, { color: typeColor[item.type] }]}>{item.category}</Text>
                  </View>
                  {item.year ? <Text style={s.year}>{item.year}</Text> : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.dim} />
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />
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
  placeholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
    paddingBottom: 80,
  },
  placeholderTxt: { color: C.text, fontSize: 18, fontWeight: '600' },
  placeholderSub: { color: C.dim, fontSize: 13 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 10,
  },
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
