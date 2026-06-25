import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Image,
  RefreshControl,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useBanners,
  useContinueWatching,
  useTrending,
  useLiveChannels,
  useLiveMatches,
  useUpcomingMatches,
} from '@/lib/api-hooks';
import { useAuthStore } from '@/lib/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { Config } from '@/constants/config';

const { width: W } = Dimensions.get('window');

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  live: '#FF3B30',
  success: '#22C55E',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  gold: '#F5C518',
};

function SectionHeader({ title, dot, onSeeAll }: { title: string; dot?: boolean; onSeeAll?: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (dot) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [dot, pulseAnim]);

  return (
    <View style={s.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {dot && (
          <Animated.View style={[s.liveDot, { opacity: pulseAnim }]} />
        )}
      </View>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={s.seeAll}>See All</Text>
        </Pressable>
      )}
    </View>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <View style={s.emptySection}>
      <Ionicons name="film-outline" size={32} color={C.textSec} />
      <Text style={s.emptyLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((st) => st.user);
  const [heroIdx, setHeroIdx] = useState(0);
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const heroRef = useRef<FlatList>(null);
  const qc = useQueryClient();

  const { data: bannersData, isLoading: bannersLoading } = useBanners();
  const { data: continueData } = useContinueWatching();
  const { data: trendingData, isLoading: trendingLoading } = useTrending();
  const { data: channelsData, isLoading: channelsLoading } = useLiveChannels({ limit: 10 });
  const { data: liveMatchData, isLoading: matchLoading } = useLiveMatches();
  const { data: upcomingData } = useUpcomingMatches({ limit: 3 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setTimeout(() => setRefreshing(false), 1000);
  }, [qc]);

  const heroes = useMemo(() => {
    if (!bannersData || !Array.isArray(bannersData)) return [];
    return bannersData.slice(0, 5).map((b: any, i: number) => ({
      id: b.id || String(i),
      title: b.title || b.name || '',
      rating: b.rating || b.imdbRating || '',
      year: b.year || '',
      duration: b.duration || '',
      genre: b.genre || b.genres?.[0] || '',
      poster: b.posterUrl || b.poster || b.thumbnail || '',
    }));
  }, [bannersData]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (heroes.length > 0 && heroRef.current) {
        let nextIdx = heroIdx + 1;
        if (nextIdx >= heroes.length) nextIdx = 0;
        heroRef.current.scrollToIndex({ index: nextIdx, animated: true });
        setHeroIdx(nextIdx);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [heroIdx, heroes]);

  const liveMatches = useMemo(() => {
    if (!liveMatchData || !Array.isArray(liveMatchData)) return [];
    return liveMatchData.slice(0, 4).map((m: any, i: number) => ({
      id: m.id || String(i),
      title: m.tournament || m.title || 'Live Match',
      team1: m.homeTeam?.name || m.team1 || 'Team A',
      team2: m.awayTeam?.name || m.team2 || 'Team B',
      score1: m.homeTeam?.score ?? m.score1 ?? '',
      score2: m.awayTeam?.score ?? m.score2 ?? '',
      time: m.elapsed || m.time || 'LIVE',
      logo1: m.homeTeam?.logo || '',
      logo2: m.awayTeam?.logo || '',
    }));
  }, [liveMatchData]);

  const continueItems = useMemo(() => {
    if (!continueData || !Array.isArray(continueData)) return [];
    return continueData.slice(0, 6).map((c: any, i: number) => ({
      id: c.id || String(i),
      title: c.title || c.movie?.title || '',
      sub: c.remainingTime || '',
      prog: c.progress || 0,
      thumb: c.thumbnailUrl || c.poster || '',
      contentId: c.contentId || c.movieId || c.id,
    }));
  }, [continueData]);

  const trendingItems = useMemo(() => {
    if (!trendingData || !Array.isArray(trendingData)) return [];
    return trendingData.slice(0, 8).map((t: any, i: number) => ({
      id: t.id || String(i),
      title: t.title || t.name || '',
      rating: t.rating || t.imdbRating || '',
      poster: t.posterUrl || t.poster || '',
    }));
  }, [trendingData]);

  const channelItems = useMemo(() => {
    if (!channelsData || !Array.isArray(channelsData)) return [];
    const COLORS: [string, string][] = [
      ['#059669','#047857'],['#DC2626','#991B1B'],['#7C3AED','#5B21B6'],
      ['#D97706','#92400E'],['#2563EB','#1D4ED8'],['#0891B2','#0E7490'],
      ['#B45309','#78350F'],['#6D28D9','#4C1D95'],['#047857','#064E3B'],['#BE185D','#9D174D'],
    ];
    return channelsData.slice(0, 10).map((ch: any, i: number) => ({
      id: ch.id || String(i),
      name: ch.name || '',
      letter: (ch.name || 'C')[0].toUpperCase(),
      color: COLORS[i % COLORS.length],
      logo: ch.logoUrl || ch.logo || '',
      streamUrl: ch.primaryStreamUrl || ch.streamUrl || '',
      cat: ch.category?.name || ch.category || 'Live TV',
    }));
  }, [channelsData]);

  const upcomingMatches = useMemo(() => {
    if (!upcomingData || !Array.isArray(upcomingData)) return [];
    return upcomingData.slice(0, 3).map((m: any, i: number) => ({
      id: m.id || String(i),
      title: m.title || m.tournament || 'Upcoming Match',
      date: m.startTime || m.date || '',
      team1: m.homeTeam?.name || m.team1 || 'Team A',
      team2: m.awayTeam?.name || m.team2 || 'Team B',
      sportId: m.sportId || '',
    }));
  }, [upcomingData]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setHeroIdx(viewableItems[0].index ?? 0);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const getInitials = () => {
    if (!user?.name) return 'U';
    return user.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
  };

  const pulseAnimFilter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimFilter, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnimFilter, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnimFilter]);

  const FILTERS = ['All', 'Movies', 'Series', 'Live sports'];
  const isLoading = bannersLoading && trendingLoading && channelsLoading && matchLoading;

  if (isLoading) {
    return (
      <View style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ color: C.textSec, marginTop: 12, fontFamily: 'Inter' }}>Loading...</Text>
      </View>
    );
  }

  const SPORTS_CATS = [
    { emoji: '🏏', label: 'Cricket' },
    { emoji: '⚽', label: 'Football' },
    { emoji: '🤼', label: 'Wrestling' },
    { emoji: '🎾', label: 'Tennis' },
    { emoji: '🥊', label: 'UFC' },
    { emoji: '🏀', label: 'Basketball' },
    { emoji: '🏸', label: 'Badminton' },
    { emoji: '🎮', label: 'Esports' },
  ];

  return (
    <View style={s.screen}>
      {/* Fixed Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerLeft}>
          <Text style={s.headerBrand}>StreamPro</Text>
        </View>
        <View style={s.headerRight}>
          <Pressable onPress={() => router.push('/(main)/search')} style={s.iconBtn}>
            <Ionicons name="search" size={24} color={C.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/notifications')} style={s.iconBtn}>
            <Ionicons name="notifications-outline" size={24} color={C.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/(main)/profile')} style={s.avatar}>
            <LinearGradient colors={[C.primary, C.accent]} style={s.avatarBg}>
              <Text style={s.avatarTxt}>{getInitials()}</Text>
            </LinearGradient>
            <View style={s.avatarDot} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 56, paddingBottom: 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => (
            <Pressable key={f} onPress={() => setActiveFilter(f)}
              style={[s.filterPill, activeFilter === f && s.filterPillActive]}>
              {f === 'Live sports' && (
                 <Animated.View style={[s.liveSportsDot, { opacity: pulseAnimFilter }]} />
              )}
              <Text style={[s.filterPillTxt, activeFilter === f && s.filterPillTxtActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Hero Banner */}
        {heroes.length > 0 && (
          <View style={s.heroSection}>
            <FlatList
              ref={heroRef}
              data={heroes}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              renderItem={({ item }) => (
                <View style={s.heroCardWrap}>
                  <Pressable style={s.heroCard} onPress={() => router.push(`/player/${item.id}?type=movie&title=${encodeURIComponent(item.title)}`)}>
                    <LinearGradient colors={['#3D1A5C', '#1a0535']} style={s.heroBg}>
                      {item.poster ? (
                        <Image source={{ uri: Config.imageUrl(item.poster) }} style={s.heroPosterOverlay} resizeMode="cover" />
                      ) : null}
                      <LinearGradient colors={['transparent', 'rgba(10,10,15,1)']} style={s.heroOverlay}>
                        <LinearGradient colors={[C.primary, C.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.originalBadgeWrap}>
                           <View style={s.originalBadgeInner}>
                             <Text style={s.originalText}>ORIGINAL</Text>
                           </View>
                        </LinearGradient>
                        <Text style={s.heroTitle} numberOfLines={2}>{item.title}</Text>
                        <View style={s.heroMeta}>
                          {item.rating ? <><Ionicons name="star" size={14} color={C.gold} /><Text style={s.heroMetaText}>{item.rating}</Text></> : null}
                          {item.year ? <Text style={s.heroMetaText}>{item.year}</Text> : null}
                          {item.duration ? <Text style={s.heroMetaText}>{item.duration}</Text> : null}
                        </View>
                        <View style={s.heroBtns}>
                          <Pressable style={s.heroPlayBtn}
                            onPress={() => router.push(`/player/${item.id}?type=movie&title=${encodeURIComponent(item.title)}`)}>
                            <LinearGradient colors={[C.primary, C.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.heroPlayGrad}>
                              <Ionicons name="play" size={18} color="#fff" />
                              <Text style={s.heroPlayTxt}>Play</Text>
                            </LinearGradient>
                          </Pressable>
                          <Pressable style={s.heroListBtn}>
                            <Ionicons name="add" size={20} color="#fff" />
                            <Text style={s.heroListTxt}>My List</Text>
                          </Pressable>
                        </View>
                      </LinearGradient>
                    </LinearGradient>
                  </Pressable>
                </View>
              )}
            />
            <View style={s.heroDots}>
              {heroes.map((_, i) => (
                <View key={i} style={[s.heroDot, i === heroIdx && s.heroDotActive]} />
              ))}
            </View>
          </View>
        )}

        {/* Live Matches */}
        <SectionHeader title="Live Now Match" dot onSeeAll={() => router.push('/(main)/search')} />
        {liveMatches.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
            {liveMatches.map((m) => (
              <Pressable key={m.id} style={s.matchCard}
                onPress={() => router.push(`/match/${m.id}`)}>
                <View style={s.matchHeader}>
                  <Text style={s.matchTournament} numberOfLines={1}>{m.title}</Text>
                  <View style={s.liveBadge}><Text style={s.liveBadgeTxt}>LIVE</Text></View>
                </View>
                <View style={s.matchTeams}>
                  <View style={s.matchTeam}>
                    <View style={s.teamAbbr}>
                      {m.logo1 ? <Image source={{ uri: Config.imageUrl(m.logo1) }} style={s.teamLogoImg} /> : <Text style={s.teamAbbrTxt}>{m.team1.slice(0, 3).toUpperCase()}</Text>}
                    </View>
                  </View>
                  <View style={s.scoreCenter}>
                    <Text style={s.teamScore}>{m.score1} - {m.score2}</Text>
                    <Text style={s.vsLabel}>{m.time}</Text>
                  </View>
                  <View style={s.matchTeam}>
                    <View style={s.teamAbbr}>
                      {m.logo2 ? <Image source={{ uri: Config.imageUrl(m.logo2) }} style={s.teamLogoImg} /> : <Text style={s.teamAbbrTxt}>{m.team2.slice(0, 3).toUpperCase()}</Text>}
                    </View>
                  </View>
                </View>
                <Pressable style={s.watchLiveBtn} onPress={() => router.push(`/match/${m.id}`)}>
                   <LinearGradient colors={[C.primary, C.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.watchLiveBtnGrad}>
                      <Text style={s.watchLiveBtnTxt}>Watch Live</Text>
                   </LinearGradient>
                </Pressable>
              </Pressable>
            ))}
          </ScrollView>
        ) : matchLoading ? (
          <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />
        ) : null}

        {/* Live TV */}
        <SectionHeader title="Live TV" onSeeAll={() => router.push('/(main)/live-tv')} />
        {channelItems.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
            {channelItems.map((ch) => (
              <Pressable key={ch.id} style={s.channelItem}
                onPress={() => router.push({
                  pathname: `/live-player/${ch.id}` as any,
                  params: { title: ch.name, streamUrl: ch.streamUrl || '', logo: ch.logo || '', cat: ch.cat || '' },
                })}>
                <View style={s.channelLogoWrap}>
                  <LinearGradient colors={[C.primary, C.accent]} style={s.channelLogoRing}>
                    <View style={s.channelLogoInner}>
                      {ch.logo ? (
                        <Image source={{ uri: Config.imageUrl(ch.logo) }} style={s.channelLogo} />
                      ) : (
                        <LinearGradient colors={ch.color} style={s.channelLogo}>
                          <Text style={s.channelLetter}>{ch.letter}</Text>
                        </LinearGradient>
                      )}
                    </View>
                  </LinearGradient>
                  <View style={s.livePillFloat}><Text style={s.livePillTxt}>LIVE</Text></View>
                </View>
                <Text style={s.channelName} numberOfLines={1}>{ch.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : channelsLoading ? (
          <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />
        ) : null}

        {/* Continue Watching */}
        {continueItems.length > 0 && (
          <>
            <SectionHeader title="Continue Watching" onSeeAll={() => {}} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
              {continueItems.map((item) => (
                <Pressable key={item.id} style={s.continueCard}
                  onPress={() => router.push(`/player/${item.contentId || item.id}?type=movie&title=${encodeURIComponent(item.title)}`)}>
                  {item.thumb ? (
                    <Image source={{ uri: Config.imageUrl(item.thumb) }} style={s.continueBg} resizeMode="cover" />
                  ) : (
                    <LinearGradient colors={['#3D1A5C', '#1a0535']} style={s.continueBg} />
                  )}
                  <View style={s.continuePlayIcon}>
                    <Ionicons name="play-circle" size={32} color="#fff" />
                  </View>
                  <LinearGradient colors={['transparent', 'rgba(10,10,15,0.92)']} style={s.continueOverlay}>
                    <Text style={s.continueTitle} numberOfLines={1}>{item.title}</Text>
                  </LinearGradient>
                  <View style={s.continueProgress}>
                    <View style={[s.continueProgressFill, { width: `${(item.prog * 100).toFixed(0)}%` as any }]} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Trending */}
        <SectionHeader title="Trending Movies" onSeeAll={() => router.push('/(main)/browse')} />
        {trendingItems.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
            {trendingItems.map((item, idx) => (
              <Pressable key={item.id} style={s.trendCard}
                onPress={() => router.push(`/player/${item.id}?type=movie&title=${encodeURIComponent(item.title)}`)}>
                <View style={s.trendImgWrap}>
                  {item.poster ? (
                    <Image source={{ uri: Config.imageUrl(item.poster) }} style={s.trendBg} resizeMode="cover" />
                  ) : (
                    <LinearGradient colors={['#3D1A5C', '#1a0535']} style={s.trendBg}>
                      <Ionicons name="film-outline" size={28} color={C.textSec} />
                    </LinearGradient>
                  )}
                  {item.rating ? (
                    <View style={s.trendRatingChip}>
                      <Ionicons name="star" size={10} color={C.gold} />
                      <Text style={s.trendRating}>{item.rating}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.trendTitle} numberOfLines={2}>{item.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : trendingLoading ? (
          <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />
        ) : null}

        {/* Browse Sports */}
        <SectionHeader title="Browse Sports" onSeeAll={() => router.push('/(main)/search')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
           {SPORTS_CATS.map((spt) => (
             <Pressable key={spt.label} style={s.sportCatItem} onPress={() => router.push('/(main)/search')}>
               <LinearGradient colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']} style={s.sportCatCircle}>
                  <Text style={s.sportCatEmoji}>{spt.emoji}</Text>
               </LinearGradient>
               <Text style={s.sportCatLabel}>{spt.label}</Text>
             </Pressable>
           ))}
        </ScrollView>

        {/* Upcoming */}
        {upcomingMatches.length > 0 && (
          <>
            <SectionHeader title="Upcoming Matches" onSeeAll={() => router.push('/(main)/search')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
              {upcomingMatches.map((m) => (
                <View key={m.id} style={s.upcomingCardFull}>
                  <View style={s.upcomingIconCol}>
                     <Text style={s.upcomingIconTxt}>⚽</Text>
                  </View>
                  <View style={s.upcomingMid}>
                    <Text style={s.upcomingTitleFull} numberOfLines={1}>{m.team1} vs {m.team2}</Text>
                    <Text style={s.upcomingDateFull}>{m.date}</Text>
                  </View>
                  <Pressable style={s.upcomingBell}>
                    <Ionicons name="notifications-outline" size={20} color={C.primary} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10, backgroundColor: 'rgba(10,10,15,0.85)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerBrand: { fontSize: 24, fontWeight: '800', fontFamily: 'Outfit', color: C.primary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBtn: { padding: 4 },
  avatar: { position: 'relative' },
  avatarBg: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: 'Inter' },
  avatarDot: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.bg },

  scroll: { gap: 0 },
  filterRow: { paddingHorizontal: 20, paddingVertical: 12, gap: 12, paddingBottom: 16 },
  filterPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  filterPillActive: { backgroundColor: 'rgba(139,92,246,0.2)', borderWidth: 1, borderColor: C.primary },
  filterPillTxt: { color: C.textSec, fontSize: 14, fontFamily: 'Inter', fontWeight: '500' },
  filterPillTxtActive: { color: C.primary, fontWeight: '700' },
  liveSportsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.live, marginRight: 6 },

  heroSection: { position: 'relative', marginBottom: 16 },
  heroCardWrap: { width: W, paddingHorizontal: 20 },
  heroCard: { width: '100%', height: W * 0.9, borderRadius: 28, overflow: 'hidden' },
  heroBg: { flex: 1 },
  heroPosterOverlay: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroOverlay: { flex: 1, justifyContent: 'flex-end', padding: 24 },
  originalBadgeWrap: { alignSelf: 'flex-start', padding: 1.5, borderRadius: 8, marginBottom: 12 },
  originalBadgeInner: { backgroundColor: 'rgba(10,10,15,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  originalText: { color: C.text, fontSize: 10, fontWeight: '800', fontFamily: 'Inter', letterSpacing: 1.5 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: C.text, fontFamily: 'Outfit', marginBottom: 8, lineHeight: 36 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  heroMetaText: { color: C.textSec, fontSize: 14, fontFamily: 'Inter', fontWeight: '500' },
  heroBtns: { flexDirection: 'row', gap: 12 },
  heroPlayBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  heroPlayGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  heroPlayTxt: { color: '#fff', fontWeight: '700', fontSize: 16, fontFamily: 'Inter' },
  heroListBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  heroListTxt: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: 'Inter' },
  heroDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 16 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroDotActive: { width: 24, backgroundColor: C.primary, borderRadius: 3 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: C.text, fontFamily: 'Outfit' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.live },
  seeAll: { fontSize: 14, color: C.primary, fontWeight: '600', fontFamily: 'Inter' },

  hScroll: { paddingHorizontal: 20, gap: 16 },

  matchCard: { width: 260, backgroundColor: C.card, borderRadius: 20, padding: 16 },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  matchTournament: { color: C.textSec, fontSize: 12, fontFamily: 'Inter', flex: 1, fontWeight: '500' },
  liveBadge: { backgroundColor: C.live, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  liveBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800', fontFamily: 'Inter', letterSpacing: 0.5 },
  matchTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  matchTeam: { alignItems: 'center', gap: 4 },
  teamAbbr: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  teamAbbrTxt: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Inter' },
  teamLogoImg: { width: '100%', height: '100%' },
  scoreCenter: { alignItems: 'center' },
  teamScore: { color: C.text, fontSize: 24, fontWeight: '800', fontFamily: 'SpaceMono' },
  vsLabel: { color: C.live, fontSize: 12, fontFamily: 'Inter', fontWeight: '600', marginTop: 4 },
  watchLiveBtn: { borderRadius: 12, overflow: 'hidden' },
  watchLiveBtnGrad: { paddingVertical: 12, alignItems: 'center' },
  watchLiveBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Inter' },

  channelItem: { alignItems: 'center', gap: 8, width: 72 },
  channelLogoWrap: { position: 'relative', alignItems: 'center' },
  channelLogoRing: { width: 72, height: 72, borderRadius: 36, padding: 2, justifyContent: 'center', alignItems: 'center' },
  channelLogoInner: { width: '100%', height: '100%', borderRadius: 34, backgroundColor: C.card, overflow: 'hidden' },
  channelLogo: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  channelLetter: { color: '#fff', fontSize: 24, fontWeight: '900', fontFamily: 'Outfit' },
  livePillFloat: { position: 'absolute', bottom: -6, backgroundColor: C.live, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 2, borderColor: C.bg },
  livePillTxt: { color: '#fff', fontSize: 9, fontWeight: '800', fontFamily: 'Inter' },
  channelName: { color: C.text, fontSize: 12, fontFamily: 'Inter', textAlign: 'center', fontWeight: '500', marginTop: 4 },

  continueCard: { width: 160, height: 100, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  continueBg: { ...StyleSheet.absoluteFillObject },
  continuePlayIcon: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  continueOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, paddingTop: 20 },
  continueTitle: { color: '#fff', fontSize: 12, fontFamily: 'Inter', fontWeight: '600' },
  continueProgress: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  continueProgressFill: { height: '100%', backgroundColor: C.primary },

  trendCard: { width: 120, gap: 8 },
  trendImgWrap: { width: 120, height: 180, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  trendBg: { ...StyleSheet.absoluteFillObject },
  trendRatingChip: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(10,10,15,0.8)', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 },
  trendRating: { color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: 'Inter' },
  trendTitle: { color: C.text, fontSize: 13, fontFamily: 'Inter', fontWeight: '500' },

  sportCatItem: { alignItems: 'center', gap: 8 },
  sportCatCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  sportCatEmoji: { fontSize: 28 },
  sportCatLabel: { color: C.textSec, fontSize: 12, fontFamily: 'Inter', fontWeight: '500' },

  upcomingCardFull: { width: 280, backgroundColor: C.card, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  upcomingIconCol: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  upcomingIconTxt: { fontSize: 20 },
  upcomingMid: { flex: 1 },
  upcomingTitleFull: { color: C.text, fontSize: 14, fontFamily: 'Inter', fontWeight: '600', marginBottom: 4 },
  upcomingDateFull: { color: C.textSec, fontSize: 12, fontFamily: 'Inter' },
  upcomingBell: { padding: 8 },

  emptySection: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyLabel: { color: C.textSec, fontSize: 14, fontFamily: 'Inter' },
});
