import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator as RNActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMatches, useLiveMatches } from '@/lib/api-hooks';
import { normalizeName } from '@/lib/normalize';

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
  live: '#EF4444',
};

// ─── Types ───────────────────────────────────────────────────
type TabType = 'live' | 'upcoming' | 'completed';

interface MatchItem {
  id: string;
  type: TabType;
  sport: string;
  teamA: { name: string; score?: string; abbr: string };
  teamB: { name: string; score?: string; abbr: string };
  status: string;
  description: string;
  tournament: string;
}

// ─── Data ───────────────────────────────────────────────────
type TabItem = { key: TabType; label: string; count?: number };

const tabs: TabItem[] = [
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

// ─── Components ──────────────────────────────────────────────

function TabPill({
  tab,
  active,
  onPress,
}: {
  tab: TabItem;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tabPill, active && styles.tabPillActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
        {tab.label}
      </Text>
      {tab.count !== undefined && (
        <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
          <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
            {tab.count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MatchCard({ item }: { item: MatchItem }) {
  const isLive = item.type === 'live';
  const isCompleted = item.type === 'completed';

  return (
    <TouchableOpacity
      style={[styles.matchCard, isCompleted && styles.matchCardCompleted]}
      activeOpacity={0.85}
      onPress={() => router.push(`/match/${item.id}`)}
    >
      {/* Top row: tournament + status badge */}
      <View style={styles.matchCardTop}>
        <Text style={styles.matchTournament}>{item.tournament}</Text>
        {isLive && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
        {isCompleted && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.completedBadgeText}>Completed</Text>
          </View>
        )}
      </View>

      {/* Score row */}
      <View style={styles.matchScoreRow}>
        <View style={styles.matchTeamBlock}>
          <Text style={styles.matchTeamName}>{item.teamA.name}</Text>
          {item.teamA.score && (
            <Text style={styles.matchScore}>{item.teamA.score}</Text>
          )}
        </View>

        <Text style={styles.matchVs}>VS</Text>

        <View style={styles.matchTeamBlock}>
          <Text style={styles.matchTeamName}>{item.teamB.name}</Text>
          {item.teamB.score && (
            <Text style={styles.matchScore}>{item.teamB.score}</Text>
          )}
        </View>
      </View>

      {/* Description */}
      <Text style={styles.matchDescription} numberOfLines={1}>
        {item.description}
      </Text>

      {/* Action row */}
      <View style={styles.matchActionRow}>
        <Text style={styles.matchStatus}>{item.status}</Text>
        {isLive && (
          <TouchableOpacity style={styles.watchLiveBtn} activeOpacity={0.8}>
            <LinearGradient
              colors={[colors.primary, colors.primaryBlue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.watchLiveBtnGradient}
            >
              <Ionicons name="play" size={14} color="#fff" />
              <Text style={styles.watchLiveBtnText}>Watch Live</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {item.type === 'upcoming' && (
          <TouchableOpacity
            style={styles.reminderBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={16} color={colors.primary} />
            <Text style={styles.reminderBtnText}>Set Reminder</Text>
          </TouchableOpacity>
        )}
        {isCompleted && (
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function MatchesScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('live');

  // M-035: status kept lowercase; if the backend is case-sensitive this would need
  // toUpperCase() — confirm with backend before changing.
  const { data: matchesData, isLoading, isError, refetch } = useMatches({ status: activeTab, page: 1 });
  const { data: liveOnlyData } = useLiveMatches();

  const allMatches: MatchItem[] = useMemo(() => {
    const items = Array.isArray(matchesData) ? matchesData : matchesData?.data ?? [];
    return items.map((m: any) => ({
      id: m.id,
      type: (m.status === 'live' ? 'live' : m.status === 'completed' || m.status === 'finished' ? 'completed' : 'upcoming') as TabType,
      sport: normalizeName(m.sport),
      teamA: { name: m.teamA?.name || '', score: m.teamAScore || undefined, abbr: m.teamA?.abbr || m.teamA?.name?.slice(0, 3).toUpperCase() || 'TBA' },
      teamB: { name: m.teamB?.name || '', score: m.teamBScore || undefined, abbr: m.teamB?.abbr || m.teamB?.name?.slice(0, 3).toUpperCase() || 'TBA' },
      status: m.status || '',
      description: m.description || '',
      tournament: normalizeName(m.tournament),
    }));
  }, [matchesData]);

  const filtered = allMatches.filter((m) => m.type === activeTab);

  const liveCount = useMemo(() => {
    const liveItems = Array.isArray(liveOnlyData) ? liveOnlyData : liveOnlyData?.data ?? [];
    if (liveItems.length > 0) return liveItems.length;
    return allMatches.filter(m => m.type === 'live' || m.status === 'live').length;
  }, [allMatches, liveOnlyData]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <View style={styles.spinner}>
          <RNActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
        <Text style={styles.errorText}>Something went wrong</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBack}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Matches</Text>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="search" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* ── Tabs ──────────────────────────────────────── */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TabPill
            key={tab.key}
            tab={{ ...tab, count: tab.key === 'live' ? (liveCount ?? 0) : undefined }}
            active={activeTab === tab.key}
            onPress={() => setActiveTab(tab.key)}
          />
        ))}
      </View>

      {/* ── Match List ────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.matchList}
        renderItem={({ item }) => <MatchCard item={item} />}
        ItemSeparatorComponent={() => <View style={styles.matchSeparator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptySection}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'live'
                ? 'No live matches at the moment'
                : activeTab === 'upcoming'
                  ? 'No upcoming matches scheduled'
                  : 'No completed matches yet'}
            </Text>
          </View>
        }
      />
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.primary,
    borderTopColor: 'transparent',
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
  headerBack: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 20,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    gap: 6,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabPillTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tabBadgeTextActive: {
    color: '#fff',
  },

  // Match List
  matchList: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  matchSeparator: {
    height: 12,
  },

  // Match Card
  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
  },
  matchCardCompleted: {
    opacity: 0.85,
  },
  matchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  matchTournament: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.live,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.live,
    letterSpacing: 0.5,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },

  // Score
  matchScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchTeamBlock: {
    flex: 1,
    alignItems: 'center',
  },
  matchTeamName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  matchScore: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  matchVs: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginHorizontal: 8,
  },
  matchDescription: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  matchActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Buttons
  watchLiveBtn: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  watchLiveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  watchLiveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  reminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reminderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Empty
  emptySection: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
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