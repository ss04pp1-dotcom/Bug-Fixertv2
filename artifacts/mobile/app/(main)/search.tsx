import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
  RefreshControl,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveMatches, useUpcomingMatches, useMatches, useToggleMatchAlert } from '@/lib/api-hooks';
import { AdBanner } from '@/components/AdBanner';
import { normalizeName } from '@/lib/normalize';
import { Config } from '@/constants/config';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

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
};

const SPORT_TABS = ['Live Now', 'Upcoming', 'Highlights', 'Results'];

const SPORTS_FILTER = [
  { id: 'cricket', name: 'Cricket', emoji: '🏏' },
  { id: 'football', name: 'Football', emoji: '⚽' },
  { id: 'tennis', name: 'Tennis', emoji: '🎾' },
  { id: 'basketball', name: 'Basketball', emoji: '🏀' },
  { id: 'ufc', name: 'UFC', emoji: '🥊' },
  { id: 'wwe', name: 'WWE', emoji: '🤼' },
];

const BROWSE_SPORTS = [
  { id: 'cricket', name: 'Cricket', emoji: '🏏', colors: ['#059669', '#047857'] as [string, string] },
  { id: 'football', name: 'Football', emoji: '⚽', colors: ['#2563EB', '#1D4ED8'] as [string, string] },
  { id: 'wrestling', name: 'Wrestling', emoji: '🤼', colors: ['#7C3AED', '#5B21B6'] as [string, string] },
  { id: 'tennis', name: 'Tennis', emoji: '🎾', colors: ['#D97706', '#92400E'] as [string, string] },
  { id: 'ufc', name: 'UFC/MMA', emoji: '🥊', colors: ['#0891B2', '#0E7490'] as [string, string] },
  { id: 'basketball', name: 'Basketball', emoji: '🏀', colors: ['#DC2626', '#991B1B'] as [string, string] },
  { id: 'badminton', name: 'Badminton', emoji: '🏸', colors: ['#B45309', '#78350F'] as [string, string] },
  { id: 'esports', name: 'Esports', emoji: '🎮', colors: ['#6D28D9', '#4C1D95'] as [string, string] },
];

function PulsingDot() {
  const opacity = useSharedValue(0.4);
  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[s.pulseDot, style]} />;
}

export default function SportsScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('Live Now');
  const [activeSport, setActiveSport] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');

  const { data: liveData, isLoading: liveLoading, refetch: refetchLive } = useLiveMatches(activeSport || undefined);
  const { data: upcomingData, isLoading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingMatches({ sportId: activeSport || undefined, limit: 50 });
  const { data: allData, isLoading: allLoading, refetch: refetchAll } = useMatches({ sportId: activeSport || undefined });
  
  const toggleAlert = useToggleMatchAlert();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchLive(), refetchUpcoming(), refetchAll()]);
    setRefreshing(false);
  }, [refetchLive, refetchUpcoming, refetchAll]);

  const liveMatches = useMemo(() => {
    if (!liveData || !Array.isArray(liveData)) return [];
    return liveData.map((m: any, i: number) => ({
      id: m.id || String(i),
      tournament: normalizeName(m.tournament) || normalizeName(m.title) || 'Live Match',
      team1: m.homeTeam?.name || m.team1 || 'Team A',
      team2: m.awayTeam?.name || m.team2 || 'Team B',
      score1: m.homeTeam?.score ?? m.score1 ?? '',
      score2: m.awayTeam?.score ?? m.score2 ?? '',
      time: m.elapsed || m.time || 'LIVE',
      logo1: m.homeTeam?.logo || '',
      logo2: m.awayTeam?.logo || '',
      status: m.status || 'LIVE',
      sport: normalizeName(m.sport) || m.sportName || '',
    }));
  }, [liveData]);

  const upcomingGroups = useMemo(() => {
    if (!upcomingData || !Array.isArray(upcomingData)) return [];
    const groups: { [key: string]: any[] } = {};
    upcomingData.forEach((m: any, i: number) => {
      const d = m.startTime || m.scheduledAt || m.date;
      const dateStr = d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Upcoming';
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push({
        id: m.id || String(i),
        title: normalizeName(m.title) || `${m.homeTeam?.name || 'Team A'} vs ${m.awayTeam?.name || 'Team B'}`,
        team1: m.homeTeam?.name || m.team1 || 'Team A',
        team2: m.awayTeam?.name || m.team2 || 'Team B',
        timeStr: d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
        sport: normalizeName(m.sport) || m.sportName || '',
        icon: SPORTS_FILTER.find(s => (normalizeName(m.sport) || '').toLowerCase().includes(s.id))?.emoji || '🏅',
      });
    });
    return Object.entries(groups).map(([date, matches]) => ({ date, matches }));
  }, [upcomingData]);

  const isLoading = activeTab === 'Live Now' ? liveLoading : activeTab === 'Upcoming' ? upcomingLoading : allLoading;

  const handleToggleAlert = (matchId: string, isAlerted?: boolean) => {
    toggleAlert.mutate({ matchId, action: isAlerted ? 'remove' : 'add' });
  };

  const renderLiveMatch = ({ item }: { item: any }) => (
    <Pressable style={s.matchCard} onPress={() => router.push(`/match/${item.id}`)}>
      <View style={s.matchHeader}>
        <Text style={s.matchTournament} numberOfLines={1}>{item.tournament}</Text>
        <View style={s.liveBadge}>
          <PulsingDot />
          <Text style={s.liveBadgeTxt}>LIVE</Text>
        </View>
      </View>
      <View style={s.matchTeams}>
        <View style={s.team}>
          {item.logo1 ? (
            <Image source={{ uri: Config.imageUrl(item.logo1) }} style={s.teamLogo} />
          ) : (
            <View style={s.teamLogoFallback}>
              <Text style={s.teamLogoTxt}>{item.team1.slice(0, 3).toUpperCase()}</Text>
            </View>
          )}
        </View>
        
        <View style={s.scoreBox}>
          {item.score1 !== '' && item.score2 !== '' ? (
            <>
              <Text style={s.scoreVal}>{item.score1}</Text>
              <Text style={s.scoreDiv}>-</Text>
              <Text style={s.scoreVal}>{item.score2}</Text>
            </>
          ) : (
            <Text style={s.vsLabel}>vs</Text>
          )}
        </View>

        <View style={s.team}>
          {item.logo2 ? (
            <Image source={{ uri: Config.imageUrl(item.logo2) }} style={s.teamLogo} />
          ) : (
            <View style={[s.teamLogoFallback, { backgroundColor: '#1a2a4a' }]}>
              <Text style={s.teamLogoTxt}>{item.team2.slice(0, 3).toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={s.teamNamesRow}>
        <Text style={s.teamName} numberOfLines={1}>{item.team1}</Text>
        <Text style={s.teamName} numberOfLines={1}>{item.team2}</Text>
      </View>

      <View style={s.matchFooter}>
        <Text style={s.matchTime}>{item.time}</Text>
        <Pressable style={s.watchBtn} onPress={() => router.push(`/match/${item.id}`)}>
          <LinearGradient colors={[C.primary, C.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.watchGrad}>
            <Ionicons name="play" size={12} color="#fff" />
            <Text style={s.watchTxt}>Watch Live</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Pressable>
  );

  const renderUpcomingMatch = (item: any) => (
    <Pressable key={item.id} style={s.upcomingRow} onPress={() => router.push(`/match/${item.id}`)}>
      <Text style={s.upcomingEmoji}>{item.icon}</Text>
      <View style={s.upcomingInfo}>
        <Text style={s.upcomingTeams} numberOfLines={1}>{item.team1} vs {item.team2}</Text>
        <Text style={s.upcomingMeta}>{item.sport} • {item.timeStr}</Text>
      </View>
      <Pressable style={s.alertBtn} onPress={() => handleToggleAlert(item.id)}>
        <Ionicons name="notifications-outline" size={20} color={C.primary} />
      </Pressable>
    </Pressable>
  );

  const renderUpcomingGroup = ({ item }: { item: any }) => (
    <View style={s.upcomingGroup}>
      <Text style={s.dateHeader}>{item.date}</Text>
      {item.matches.map(renderUpcomingMatch)}
    </View>
  );

  const renderBrowseSports = () => (
    <View style={s.browseSection}>
      <Text style={s.browseTitle}>Browse Sports</Text>
      <View style={s.browseGrid}>
        {BROWSE_SPORTS.map((sport) => (
          <Pressable key={sport.id} style={s.browseCard} onPress={() => { setActiveTab('Live Now'); setActiveSport(sport.id); }}>
            <LinearGradient colors={sport.colors} style={s.browseGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={s.browseEmoji}>{sport.emoji}</Text>
              <Text style={s.browseName}>{sport.name}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Live Sports</Text>
        <View style={s.headerRight}>
          <Pressable style={s.iconBtn} onPress={() => { setShowSearch(!showSearch); setSearchText(''); }}>
            <Ionicons name={showSearch ? 'close-outline' : 'search-outline'} size={22} color={C.text} />
          </Pressable>
          <Pressable style={s.iconBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={22} color={C.text} />
          </Pressable>
        </View>
      </View>
      {showSearch && (
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color={C.textSec} />
          <TextInput
            style={s.searchInput}
            placeholder="Search teams, tournaments..."
            placeholderTextColor={C.textSec}
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
            returnKeyType="search"
          />
        </View>
      )}

      <AdBanner placement="sports-banner" style={{ marginBottom: 4 }} />

      {/* Top Tabs */}
      <View style={s.tabScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabScrollRow}>
          {SPORT_TABS.map(tab => {
            const isActive = activeTab === tab;
            return (
              <Pressable key={tab} onPress={() => setActiveTab(tab)} style={s.mainTabBtn}>
                <Text style={[s.mainTabTxt, isActive && s.mainTabTxtActive]}>{tab}</Text>
                {isActive && (
                  <LinearGradient colors={[C.primary, C.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.activeTabLine} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'Live Now' && (
          <>
            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
              <Pressable onPress={() => setActiveSport('')} style={[s.filterChip, activeSport === '' && s.filterChipActive]}>
                <Text style={[s.filterChipTxt, activeSport === '' && s.filterChipTxtActive]}>All</Text>
              </Pressable>
              {SPORTS_FILTER.map(sport => (
                <Pressable key={sport.id} onPress={() => setActiveSport(sport.id)} style={[s.filterChip, activeSport === sport.id && s.filterChipActive]}>
                  <Text style={s.filterChipEmoji}>{sport.emoji}</Text>
                  <Text style={[s.filterChipTxt, activeSport === sport.id && s.filterChipTxtActive]}>{sport.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Live Matches List */}
            {isLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 40 }} />
            ) : liveMatches.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyEmoji}>🏟️</Text>
                <Text style={s.emptyTitle}>No live matches</Text>
                <Text style={s.emptyTxt}>Check back later or try another sport</Text>
              </View>
            ) : (
              <View style={s.listWrap}>
                {liveMatches.map(m => <React.Fragment key={m.id}>{renderLiveMatch({ item: m })}</React.Fragment>)}
              </View>
            )}
            
            {renderBrowseSports()}
          </>
        )}

        {activeTab === 'Upcoming' && (
          <>
            {isLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 40 }} />
            ) : upcomingGroups.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyEmoji}>📅</Text>
                <Text style={s.emptyTitle}>No upcoming matches</Text>
              </View>
            ) : (
              <View style={s.upcomingWrap}>
                {upcomingGroups.map(g => <React.Fragment key={g.date}>{renderUpcomingGroup({ item: g })}</React.Fragment>)}
              </View>
            )}
            {renderBrowseSports()}
          </>
        )}
        
        {activeTab === 'Highlights' && (
          <>
            {isLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 40 }} />
            ) : (() => {
              const highlights = (allData && Array.isArray(allData) ? allData : [])
                .filter((m: any) => {
                  const st = (m.status || '').toLowerCase();
                  return st === 'finished' || st === 'completed' || st === 'ended' || st === 'ft' || st === 'aet';
                })
                .map((m: any, i: number) => ({
                  id: m.id || String(i),
                  title: normalizeName(m.title) || `${m.homeTeam?.name || 'Team A'} vs ${m.awayTeam?.name || 'Team B'}`,
                  team1: m.homeTeam?.name || m.team1 || 'Team A',
                  team2: m.awayTeam?.name || m.team2 || 'Team B',
                  score1: m.homeTeam?.score ?? m.score1 ?? '—',
                  score2: m.awayTeam?.score ?? m.score2 ?? '—',
                  sport: normalizeName(m.sport) || m.sportName || '',
                  icon: SPORTS_FILTER.find(s => (normalizeName(m.sport) || '').toLowerCase().includes(s.id))?.emoji || '🏅',
                  date: m.startTime || m.scheduledAt || m.date,
                }));
              return highlights.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyEmoji}>🎬</Text>
                  <Text style={s.emptyTitle}>No Highlights Yet</Text>
                  <Text style={s.emptyTxt}>Highlights from completed matches will appear here</Text>
                </View>
              ) : (
                <View style={[s.upcomingWrap, { paddingTop: 16 }]}>
                  {highlights.map((item: any) => (
                    <Pressable key={item.id} style={s.upcomingRow} onPress={() => router.push(`/match/${item.id}`)}>
                      <Text style={s.upcomingEmoji}>{item.icon}</Text>
                      <View style={s.upcomingInfo}>
                        <Text style={s.upcomingTeams} numberOfLines={1}>{item.team1} vs {item.team2}</Text>
                        <Text style={s.upcomingMeta}>{item.sport} • Final: {item.score1} - {item.score2}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={C.textSec} />
                    </Pressable>
                  ))}
                </View>
              );
            })()}
          </>
        )}

        {activeTab === 'Results' && (
          <>
            {isLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 40 }} />
            ) : (() => {
              const results = (allData && Array.isArray(allData) ? allData : [])
                .filter((m: any) => {
                  const st = (m.status || '').toLowerCase();
                  return st === 'finished' || st === 'completed' || st === 'ended' || st === 'ft' || st === 'aet';
                })
                .map((m: any, i: number) => ({
                  id: m.id || String(i),
                  team1: m.homeTeam?.name || m.team1 || 'Team A',
                  team2: m.awayTeam?.name || m.team2 || 'Team B',
                  score1: m.homeTeam?.score ?? m.score1 ?? '—',
                  score2: m.awayTeam?.score ?? m.score2 ?? '—',
                  sport: normalizeName(m.sport) || m.sportName || '',
                  icon: SPORTS_FILTER.find(s => (normalizeName(m.sport) || '').toLowerCase().includes(s.id))?.emoji || '🏅',
                  date: m.startTime || m.scheduledAt || m.date,
                }));
              return results.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyEmoji}>📊</Text>
                  <Text style={s.emptyTitle}>No Results Yet</Text>
                  <Text style={s.emptyTxt}>Final scores from completed matches will appear here</Text>
                </View>
              ) : (
                <View style={[s.upcomingWrap, { paddingTop: 16 }]}>
                  {results.map((item: any) => (
                    <View key={item.id} style={s.resultRow}>
                      <Text style={s.upcomingEmoji}>{item.icon}</Text>
                      <View style={s.upcomingInfo}>
                        <Text style={s.upcomingTeams} numberOfLines={1}>{item.team1} vs {item.team2}</Text>
                        <Text style={s.upcomingMeta}>{item.sport}{item.date ? ` • ${new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</Text>
                      </View>
                      <View style={s.resultScore}>
                        <Text style={s.resultScoreTxt}>{item.score1} - {item.score2}</Text>
                        <Text style={s.resultFT}>FT</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: C.text, fontFamily: 'Outfit' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20 },

  tabScrollContainer: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  tabScrollRow: { paddingHorizontal: 16, gap: 24 },
  mainTabBtn: { paddingVertical: 12, position: 'relative', alignItems: 'center' },
  mainTabTxt: { color: C.textSec, fontSize: 15, fontFamily: 'Inter', fontWeight: '500' },
  mainTabTxtActive: { color: C.text, fontWeight: '700' },
  activeTabLine: { position: 'absolute', bottom: -1, left: -4, right: -4, height: 3, borderRadius: 2 },

  filterRow: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'transparent' },
  filterChipActive: { backgroundColor: 'rgba(139,92,246,0.1)', borderColor: C.primary },
  filterChipEmoji: { fontSize: 14 },
  filterChipTxt: { color: C.textSec, fontSize: 13, fontFamily: 'Inter', fontWeight: '500' },
  filterChipTxtActive: { color: C.primary, fontWeight: '600' },

  listWrap: { paddingHorizontal: 16, gap: 16, paddingBottom: 24 },
  matchCard: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  matchTournament: { color: C.textSec, fontSize: 12, fontFamily: 'Inter', flex: 1, marginRight: 12 },
  liveBadge: { backgroundColor: 'rgba(255,59,48,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.live },
  liveBadgeTxt: { color: C.live, fontSize: 10, fontWeight: '800', fontFamily: 'Inter', letterSpacing: 0.5 },

  matchTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  team: { alignItems: 'center', width: 60 },
  teamLogo: { width: 56, height: 56, borderRadius: 28 },
  teamLogoFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  teamLogoTxt: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Inter' },
  
  scoreBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 },
  scoreVal: { color: C.text, fontSize: 32, fontWeight: '800', fontFamily: 'SpaceMono' },
  scoreDiv: { color: C.textSec, fontSize: 24, fontWeight: '400' },
  vsLabel: { color: C.textSec, fontSize: 18, fontFamily: 'SpaceMono', opacity: 0.5 },

  teamNamesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 20, paddingHorizontal: 4 },
  teamName: { color: C.text, fontSize: 13, fontFamily: 'Inter', fontWeight: '600', flex: 1, textAlign: 'center' },

  matchFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16 },
  matchTime: { color: C.primary, fontSize: 13, fontFamily: 'Inter', fontWeight: '600' },
  watchBtn: { borderRadius: 16, overflow: 'hidden' },
  watchGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10 },
  watchTxt: { color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: 'Inter' },

  upcomingWrap: { paddingHorizontal: 16, gap: 24, paddingVertical: 16 },
  upcomingGroup: { gap: 12 },
  dateHeader: { color: C.textSec, fontSize: 13, fontWeight: '600', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 },
  upcomingRow: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  upcomingEmoji: { fontSize: 28 },
  upcomingInfo: { flex: 1 },
  upcomingTeams: { color: C.text, fontSize: 15, fontWeight: '600', fontFamily: 'Inter', marginBottom: 4 },
  upcomingMeta: { color: C.textSec, fontSize: 12, fontFamily: 'Inter' },
  alertBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(139,92,246,0.1)', borderRadius: 20 },

  browseSection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  browseTitle: { color: C.text, fontSize: 18, fontWeight: '700', fontFamily: 'Outfit', marginBottom: 16 },
  browseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  browseCard: { width: (W - 44) / 2, height: 90, borderRadius: 16, overflow: 'hidden' },
  browseGrad: { flex: 1, padding: 16, justifyContent: 'space-between' },
  browseEmoji: { fontSize: 24 },
  browseName: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Inter' },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, color: C.text, fontSize: 15, fontFamily: 'Inter', outlineWidth: 0 } as any,

  emptyBox: { padding: 40, alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '700', fontFamily: 'Outfit', textAlign: 'center' },
  emptyTxt: { color: C.textSec, fontSize: 14, fontFamily: 'Inter', textAlign: 'center' },

  resultRow: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  resultScore: { alignItems: 'flex-end', gap: 2 },
  resultScoreTxt: { color: C.text, fontSize: 15, fontWeight: '700', fontFamily: 'SpaceMono' },
  resultFT: { color: C.success, fontSize: 10, fontWeight: '700', fontFamily: 'Inter', letterSpacing: 0.5 },
});
