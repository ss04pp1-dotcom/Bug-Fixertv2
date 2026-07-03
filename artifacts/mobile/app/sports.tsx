import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StatusBar,
  ActivityIndicator as RNActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useLiveMatches, useUpcomingMatches, useMyTeams, useSportTypes } from '@/lib/api-hooks';
import { AdBanner } from '@/components/AdBanner';
import { AdInterstitial } from '@/components/AdInterstitial';
import { SocketService } from '@/services/socket.service';
import { normalizeName } from '@/lib/normalize';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Design Tokens ───────────────────────────────────────────
const colors = {
  bg: '#05070F',
  surface: '#121A2F',
  surfaceLight: '#1C1C2A',
  text: '#F2F2F7',
  textSecondary: '#B3B8C8',
  textMuted: '#6B6B80',
  primary: '#7C3AED',
  primaryBlue: '#2563EB',
  accent: '#EC4899',
  error: '#EF4444',
  success: '#10B981',
  star: '#F5C518',
  live: '#EF4444',
};

const CARD_W = SCREEN_WIDTH - 48;

// ─── Types ───────────────────────────────────────────────────
// sport is now a plain string — fetched dynamically from the API so any sport
// the admin creates (Baseball, Kabaddi, …) automatically appears in the UI.
interface LiveMatch {
  id: string;
  sport: string;
  teamA: { name: string; score: string; abbr: string };
  teamB: { name: string; score: string; abbr: string };
  status: string;
  tournament: string;
}

interface Team {
  id: string;
  abbr: string;
  name: string;
  gradient: [string, string];
}

interface UpcomingMatch {
  id: string;
  teamA: string;
  teamB: string;
  sport: string;
  time: string;
  tournament: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const teamGradients: Record<string, [string, string]> = {
  MI: ['#004BA0', '#D4A843'],
  CSK: ['#FCCA06', '#0081C8'],
  RCB: ['#EC1C24', '#000000'],
  ARS: ['#EF0107', '#DB0007'],
};

function formatScheduledTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    return d.toLocaleDateString('en-US', { weekday: 'short' }) + `, ${timeStr}`;
  } catch {
    return dateStr;
  }
}

function capitalizeSport(sport: string): string {
  return sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();
}

const sportIconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  Cricket: 'baseball-outline' as any,
  Football: 'football-outline',
  Tennis: 'tennisball-outline',
  Basketball: 'basketball-outline',
};

// ─── Components ──────────────────────────────────────────────

function CategoryTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.categoryTab, active && styles.categoryTabActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function LiveMatchCard({ match, onPress }: { match: LiveMatch; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.liveMatchCard}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.liveMatchHeader}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <Text style={styles.liveMatchTournament}>{match.tournament}</Text>
      </View>

      <View style={styles.liveMatchScoreRow}>
        <View style={styles.liveMatchTeamBlock}>
          <Text style={styles.liveMatchTeamName}>{match.teamA.name}</Text>
          <Text style={styles.liveMatchScore}>{match.teamA.score}</Text>
        </View>
        <Text style={styles.liveMatchVs}>VS</Text>
        <View style={styles.liveMatchTeamBlock}>
          <Text style={styles.liveMatchTeamName}>{match.teamB.name}</Text>
          <Text style={styles.liveMatchScore}>{match.teamB.score}</Text>
        </View>
      </View>

      <View style={styles.liveMatchFooter}>
        <Text style={styles.liveMatchStatus}>{match.status}</Text>
        <TouchableOpacity style={styles.watchLiveBtn}>
          <LinearGradient
            colors={[colors.primary, colors.primaryBlue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.watchLiveBtnGradient}
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={styles.watchLiveBtnText}>Watch Live</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function TeamCircle({ team }: { team: Team | null }) {
  if (!team) {
    return (
      <TouchableOpacity style={styles.teamCircleAdd} activeOpacity={0.7}>
        <Ionicons name="add" size={24} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={styles.teamCircle} activeOpacity={0.7}>
      <LinearGradient
        colors={team.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.teamCircleGradient}
      >
        <Text style={styles.teamCircleText}>{team.abbr}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function UpcomingRow({ item, onPress }: { item: UpcomingMatch; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.upcomingRow} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.upcomingIcon}>
        <Ionicons
          name={sportIconMap[item.sport] || 'ellipse-outline'}
          size={20}
          color={colors.textMuted}
        />
      </View>
      <View style={styles.upcomingInfo}>
        <View style={styles.upcomingTeamsRow}>
          <Text style={styles.upcomingTeamName}>{item.teamA}</Text>
          <Text style={styles.upcomingVs}> vs </Text>
          <Text style={styles.upcomingTeamName}>{item.teamB}</Text>
        </View>
        <Text style={styles.upcomingTournament}>{item.tournament}</Text>
      </View>
      <Text style={styles.upcomingTime}>{item.time}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function SportsScreen() {
  // selectedSportId: null = "All", otherwise the actual UUID from the API.
  // Passing the UUID (not the name) to useLiveMatches / useUpcomingMatches is
  // what makes the server-side filter work correctly.
  const [selectedSportId, setSelectedSportId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string>('All');
  const queryClient = useQueryClient();

  // ── Match pre-navigation ad (30-second interstitial) ─────────────────────
  const [matchAdVisible, setMatchAdVisible] = useState(false);
  const pendingMatchPath = React.useRef<string | null>(null);

  const handleMatchPress = React.useCallback((matchId: string) => {
    pendingMatchPath.current = `/match/${matchId}`;
    setMatchAdVisible(true);
  }, []);

  const handleMatchAdClose = React.useCallback(() => {
    setMatchAdVisible(false);
    if (pendingMatchPath.current) {
      const path = pendingMatchPath.current;
      pendingMatchPath.current = null;
      router.push(path as any);
    }
  }, []);

  // Fetch sport types dynamically — admin can add any sport and it appears here.
  const { data: sportTypes = [] } = useSportTypes();

  const sportId = selectedSportId ?? undefined;
  const { data: liveData, isLoading: liveLoading, isError: liveError, refetch: refetchLive } = useLiveMatches(sportId);

  // T3.8: Socket → React Query — match_update events patch the live matches
  // cache in-place so the UI reflects score changes without a full refetch.
  useEffect(() => {
    const unsub = SocketService.onMatchUpdate((update) => {
      queryClient.setQueryData(
        ['sports', 'live', sportId],
        (old: any) => {
          if (!old) return old;
          const list: any[] = Array.isArray(old) ? old : old?.data ?? [];
          const patched = list.map((m: any) =>
            m.id === update.matchId
              ? { ...m, ...(update.score as object), status: update.event ?? m.status }
              : m,
          );
          return Array.isArray(old) ? patched : { ...old, data: patched };
        },
      );
    });
    return unsub;
  }, [queryClient, sportId]);

  const { data: upcomingData, isLoading: upcomingLoading, isError: upcomingError, refetch: refetchUpcoming } = useUpcomingMatches({ sportId, limit: 20 });
  const { data: myTeamsData, isLoading: teamsLoading, isError: teamsError, refetch: refetchTeams } = useMyTeams();

  const liveMatches: LiveMatch[] = useMemo(() => {
    const items = Array.isArray(liveData) ? liveData : liveData?.data ?? [];
    return items.map((m: any) => {
      // FIX: API returns sport/tournament as relation objects {id, name, slug}
      // in some responses, plain strings in others. normalizeName() unwraps
      // both shapes — without it, passing the raw object into capitalizeSport
      // causes: TypeError: sport.charAt is not a function → app crash.
      const sportName = normalizeName(m.sport);
      return {
        id: m.id,
        sport: capitalizeSport(sportName || 'Sport'),
        teamA: { name: m.teamA?.name || '', score: m.teamAScore || '', abbr: m.teamA?.abbr || m.teamA?.name?.slice(0, 3).toUpperCase() || 'TBA' },
        teamB: { name: m.teamB?.name || '', score: m.teamBScore || '', abbr: m.teamB?.abbr || m.teamB?.name?.slice(0, 3).toUpperCase() || 'TBA' },
        status: m.status || '',
        tournament: normalizeName(m.tournament),
      };
    });
  }, [liveData]);

  const upcomingMatches: UpcomingMatch[] = useMemo(() => {
    const items = Array.isArray(upcomingData) ? upcomingData : upcomingData?.data ?? [];
    return items.map((m: any) => {
      // FIX: same object-extraction fix as liveMatches above.
      const sportName = normalizeName(m.sport);
      const sportLabel = capitalizeSport(sportName || 'Sport');
      return {
        id: m.id,
        teamA: m.teamA?.name || '',
        teamB: m.teamB?.name || '',
        sport: sportLabel,
        time: m.scheduledAt ? formatScheduledTime(m.scheduledAt) : '',
        tournament: normalizeName(m.tournament),
        icon: (sportIconMap[sportLabel] ?? 'ellipse-outline') as keyof typeof Ionicons.glyphMap,
      };
    });
  }, [upcomingData]);

  const myTeams: (Team | null)[] = useMemo(() => {
    const items = Array.isArray(myTeamsData) ? myTeamsData : myTeamsData?.data ?? [];
    const mapped = items.map((t: any) => ({
      id: t.id,
      abbr: t.abbr || t.name?.slice(0, 3).toUpperCase() || 'TM',
      name: t.name || '',
      gradient: teamGradients[t.abbr] || ['#7C3AED', '#2563EB'],
    }));
    return [...mapped, null];
  }, [myTeamsData]);

  const isLoading = liveLoading && upcomingLoading && teamsLoading;
  const hasError = liveError && upcomingError && teamsError;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <ActivityIndicator />
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
        <Text style={styles.errorText}>Something went wrong</Text>
        <TouchableOpacity onPress={() => { refetchLive(); refetchUpcoming(); refetchTeams(); }} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* ── Match pre-navigation ad (30-second interstitial) ─── */}
      <AdInterstitial
        placement="sports_interstitial"
        visible={matchAdVisible}
        onClose={handleMatchAdClose}
        skipAfterSeconds={30}
      />

      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sports</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="search" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        {/* ── Category Tabs ─────────────────────────── */}
        {/* Dynamic — built from API sport types so any sport admin creates
            automatically appears here without a code change. */}
        <View style={styles.categoryRow}>
          <FlatList
            data={[{ id: null, name: 'All' }, ...sportTypes] as { id: string | null; name: string }[]}
            keyExtractor={(c) => c.id ?? 'all'}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => (
              <CategoryTab
                label={item.name}
                active={activeName === item.name}
                onPress={() => {
                  setSelectedSportId(item.id);
                  setActiveName(item.name);
                }}
              />
            )}
          />
        </View>

        {/* ── Live Matches ──────────────────────────── */}
        <Text style={styles.sectionTitle}>Live Matches</Text>
        <FlatList
          data={liveMatches.filter(
            (m) => activeName === 'All' || m.sport === activeName,
          )}
          keyExtractor={(m) => m.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.liveMatchList}
          renderItem={({ item }) => <LiveMatchCard match={item} onPress={() => handleMatchPress(item.id)} />}
          ListEmptyComponent={
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No live matches right now</Text>
            </View>
          }
        />

        {/* ── Ad Banner (live_banner placement) ────── */}
        <AdBanner placement="live_banner" />

        {/* ── My Teams ─────────────────────────────── */}
        <Text style={styles.sectionTitle}>My Teams</Text>
        <FlatList
          data={myTeams}
          keyExtractor={(_, i) => `team-${i}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.teamList}
          renderItem={({ item }) => <TeamCircle team={item} />}
        />

        {/* ── Upcoming ─────────────────────────────── */}
        <Text style={styles.sectionTitle}>Upcoming</Text>
        <FlatList
          data={upcomingMatches.filter(
            (m) => activeName === 'All' || m.sport === activeName,
          )}
          keyExtractor={(m) => m.id}
          scrollEnabled={false}
          renderItem={({ item }) => <UpcomingRow item={item} onPress={() => handleMatchPress(item.id)} />}
          ItemSeparatorComponent={() => <View style={styles.upcomingSeparator} />}
          ListEmptyComponent={
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No upcoming matches</Text>
            </View>
          }
        />
      </ScrollView>
    </View>
  );
}

// ─── Minimal ActivityIndicator for loading state ─────────────
function ActivityIndicator() {
  return (
    <View style={styles.spinner}>
      <RNActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.primary,
    borderTopColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Scroll
  scrollContent: {
    paddingBottom: 32,
  },

  // Category Tabs
  categoryRow: {
    marginBottom: 20,
  },
  categoryList: {
    paddingHorizontal: 24,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  categoryTabTextActive: {
    color: '#fff',
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
    paddingHorizontal: 24,
    marginTop: 4,
  },

  // Live Match Card
  liveMatchList: {
    paddingLeft: 24,
    paddingRight: 24,
    gap: 16,
  },
  liveMatchCard: {
    width: CARD_W,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
  },
  liveMatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.live,
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.live,
    letterSpacing: 0.5,
  },
  liveMatchTournament: {
    fontSize: 12,
    color: colors.textMuted,
  },
  liveMatchScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  liveMatchTeamBlock: {
    flex: 1,
    alignItems: 'center',
  },
  liveMatchTeamName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  liveMatchScore: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  liveMatchVs: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginHorizontal: 8,
  },
  liveMatchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveMatchStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  watchLiveBtn: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  watchLiveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  watchLiveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // Team Circles
  teamList: {
    paddingLeft: 24,
    paddingRight: 24,
    gap: 16,
    marginBottom: 20,
  },
  teamCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  teamCircleGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamCircleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  teamCircleAdd: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Upcoming
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 24,
    gap: 14,
  },
  upcomingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  upcomingTeamName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  upcomingVs: {
    fontSize: 13,
    color: colors.textMuted,
  },
  upcomingTournament: {
    fontSize: 12,
    color: colors.textMuted,
  },
  upcomingTime: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  upcomingSeparator: {
    height: 10,
  },

  // Empty
  emptySection: {
    paddingVertical: 32,
    alignItems: 'center',
    marginHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});