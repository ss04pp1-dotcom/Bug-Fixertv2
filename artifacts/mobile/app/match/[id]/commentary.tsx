import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Animated,
  ActivityIndicator as RNActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMatch, useMatchCommentary } from '@/lib/api-hooks';

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
type CommentaryTab = 'commentary' | 'scorecard' | 'squads';

type BallEvent = 'wicket' | 'six' | 'four' | 'zero' | 'one' | 'two' | 'three';

interface CommentaryEntry {
  id: string;
  overBall: string;
  event: BallEvent;
  bowler: string;
  batter: string;
  runs: string;
  text: string;
  highlightColor?: string;
}

// ─── Data ───────────────────────────────────────────────────
const commentaryTabs: { key: CommentaryTab; label: string }[] = [
  { key: 'commentary', label: 'Commentary' },
  { key: 'scorecard', label: 'Scorecard' },
  { key: 'squads', label: 'Squads' },
];

const eventColors: Record<BallEvent, string> = {
  wicket: colors.error,
  six: colors.primary,
  four: colors.primaryBlue,
  zero: colors.textMuted,
  one: colors.textMuted,
  two: colors.textMuted,
  three: colors.textMuted,
};

const eventLabels: Record<BallEvent, string> = {
  wicket: 'W',
  six: '6',
  four: '4',
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
};

function mapEvent(eventStr: string): BallEvent {
  const s = (eventStr || '').toLowerCase();
  if (s.includes('wicket')) return 'wicket';
  if (s.includes('six') || s === '6') return 'six';
  if (s.includes('four') || s === '4') return 'four';
  if (s === '0' || s === 'dot') return 'zero';
  if (s === '1' || s === 'single') return 'one';
  if (s === '2' || s === 'double') return 'two';
  if (s === '3' || s === 'triple') return 'three';
  return 'one';
}

// ─── Pulse Animation ─────────────────────────────────────────
function PulsingDot() {
  const scale = useState(new Animated.Value(1))[0];

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.5,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scale]);

  return (
    <Animated.View
      style={[
        styles.pulseDot,
        { transform: [{ scale }] },
      ]}
    />
  );
}

// ─── Components ──────────────────────────────────────────────

function CommentaryTabPill({
  tab,
  active,
  onPress,
}: {
  tab: (typeof commentaryTabs)[number];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.cTab, active && styles.cTabActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.cTabText, active && styles.cTabTextActive]}>{tab.label}</Text>
    </TouchableOpacity>
  );
}

function OverSummaryCard({ summary }: { summary?: { overNumber?: number; balls?: string; runs?: number } }) {
  if (!summary) return null;
  const { overNumber, balls, runs } = summary;
  if (!balls) return null;
  return (
    <View style={styles.overSummaryCard}>
      <View style={styles.overSummaryHeader}>
        <Text style={styles.overSummaryTitle}>Over {overNumber || ''}</Text>
        <View style={styles.overSummaryRuns}>
          <Text style={styles.overSummaryRunsText}>{runs || 0} runs</Text>
        </View>
      </View>
      <View style={styles.overSummaryBalls}>
        {balls.split(', ').map((ball, i) => {
          let color = colors.textMuted;
          if (ball === 'W') color = colors.error;
          else if (ball === '6') color = colors.primary;
          else if (ball === '4') color = colors.primaryBlue;

          return (
            <View key={i} style={styles.overBallChip}>
              <View style={[styles.overBallDot, { backgroundColor: color }]} />
              <Text style={[styles.overBallText, { color }]}>{ball}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CommentaryRow({ item }: { item: CommentaryEntry }) {
  const eventColor = eventColors[item.event];
  const eventLabel = eventLabels[item.event];

  return (
    <View style={styles.commentaryRow}>
      {/* Left: ball event */}
      <View style={styles.commentaryLeft}>
        <View style={[styles.ballCircle, { backgroundColor: eventColor }]}>
          <Text style={styles.ballCircleText}>{eventLabel}</Text>
        </View>
        <Text style={styles.overBallLabel}>{item.overBall}</Text>
      </View>

      {/* Right: text */}
      <View style={styles.commentaryRight}>
        <Text style={styles.bowlerText}>
          {item.bowler} to {item.batter}
        </Text>
        <Text style={styles.commentaryText}>
          {item.text}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function CommentaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<CommentaryTab>('commentary');

  const { data: matchData, isError: matchError, refetch: refetchMatch } = useMatch(id);
  const { data: commentaryData, isLoading, isError, refetch } = useMatchCommentary(id);

  const commentary: CommentaryEntry[] = useMemo(() => {
    const items = Array.isArray(commentaryData) ? commentaryData : commentaryData?.data ?? [];
    return items.map((c: any) => ({
      id: c.id,
      overBall: c.overBall || c.overNumber || '',
      event: mapEvent(c.event || c.runs || ''),
      bowler: c.bowler || c.bowlerName || '',
      batter: c.batter || c.batterName || '',
      runs: c.runs || c.event || '0',
      text: c.text || c.commentary || c.description || '',
      highlightColor: c.event?.toLowerCase().includes('wicket') ? colors.error
        : c.event?.toLowerCase().includes('four') ? colors.primaryBlue
        : c.event?.toLowerCase().includes('six') ? colors.primary
        : undefined,
    }));
  }, [commentaryData]);

  const overSummary = commentaryData?.overSummary;

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

  if (isError || matchError) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
        <Text style={styles.errorText}>Something went wrong</Text>
        <TouchableOpacity onPress={() => { refetch(); refetchMatch(); }} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{typeof matchData?.tournament === 'string' ? matchData.tournament : matchData?.tournament?.name || 'Match'}</Text>
          <View style={styles.headerLiveBadge}>
            <PulsingDot />
            <Text style={styles.headerLiveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.headerBtnPlaceholder} />
      </View>

      {/* ── Score Bar ──────────────────────────────── */}
      <View style={styles.scoreBar}>
        <View style={styles.scoreBarTeam}>
          <Text style={styles.scoreBarAbbr}>{matchData?.teamA?.abbr || matchData?.teamA?.name?.slice(0, 3).toUpperCase() || 'TBA'}</Text>
          <Text style={styles.scoreBarScore}>{matchData?.teamAScore || '0/0'}</Text>
          <Text style={styles.scoreBarOvers}>{matchData?.status || ''}</Text>
        </View>
        <View style={styles.scoreBarDivider} />
        <View style={styles.scoreBarCenter}>
          <Text style={styles.scoreBarCRR}>CRR</Text>
          <Text style={styles.scoreBarCRRValue}>{matchData?.crr || 'N/A'}</Text>
        </View>
        <View style={styles.scoreBarDivider} />
        <View style={styles.scoreBarTeam}>
          <Text style={styles.scoreBarAbbr}>{matchData?.teamB?.abbr || matchData?.teamB?.name?.slice(0, 3).toUpperCase() || 'TBA'}</Text>
          <Text style={styles.scoreBarScore}>{matchData?.teamBScore || '0/0'}</Text>
          <Text style={styles.scoreBarOvers}>{matchData?.teamBStatus || ''}</Text>
        </View>
      </View>

      {/* ── Tabs ───────────────────────────────────── */}
      <View style={styles.tabRow}>
        {commentaryTabs.map((tab) => (
          <CommentaryTabPill
            key={tab.key}
            tab={tab}
            active={activeTab === tab.key}
            onPress={() => setActiveTab(tab.key)}
          />
        ))}
      </View>

      {/* ── Commentary Content ─────────────────────── */}
      {activeTab === 'commentary' && (
        <FlatList
          data={commentary}
          keyExtractor={(c) => c.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.commentaryList}
          renderItem={({ item }) => <CommentaryRow item={item} />}
          ListHeaderComponent={<OverSummaryCard summary={overSummary} />}
          ItemSeparatorComponent={() => <View style={styles.commentarySeparator} />}
        />
      )}

      {activeTab === 'scorecard' && (
        <View style={styles.placeholderTab}>
          <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
          <Text style={styles.placeholderTitle}>Scorecard</Text>
          <Text style={styles.placeholderSubtitle}>View full scorecard on match detail page</Text>
        </View>
      )}

      {activeTab === 'squads' && (
        <View style={styles.placeholderTab}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={styles.placeholderTitle}>Playing XI</Text>
          <Text style={styles.placeholderSubtitle}>{matchData?.teamA?.name || 'Team A'} & {matchData?.teamB?.name || 'Team B'} squad details</Text>
        </View>
      )}

      {/* ── FABs ───────────────────────────────────── */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.primary, colors.primaryBlue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="trending-up-outline" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.primary, colors.primaryBlue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="share-social-outline" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnPlaceholder: {
    width: 44,
    height: 44,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 5,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.live,
  },
  headerLiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.live,
    letterSpacing: 0.5,
  },

  // Score Bar
  scoreBar: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreBarTeam: {
    flex: 1,
    alignItems: 'center',
  },
  scoreBarAbbr: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
  scoreBarScore: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  scoreBarOvers: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  scoreBarDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.surfaceLight,
  },
  scoreBarCenter: {
    alignItems: 'center',
    minWidth: 48,
  },
  scoreBarCRR: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  scoreBarCRRValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 16,
  },
  cTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  cTabActive: {
    backgroundColor: colors.primary,
  },
  cTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  cTabTextActive: {
    color: '#fff',
  },

  // Over Summary
  commentaryList: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  overSummaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  overSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overSummaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  overSummaryRuns: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  overSummaryRunsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  overSummaryBalls: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  overBallChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  overBallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  overBallText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Commentary Row
  commentaryRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 4,
  },
  commentarySeparator: {
    height: 12,
  },
  commentaryLeft: {
    alignItems: 'center',
    width: 40,
  },
  ballCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballCircleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  overBallLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  commentaryRight: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
  },
  bowlerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  commentaryText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text,
    lineHeight: 19,
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    gap: 12,
  },
  fab: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Placeholder
  placeholderTab: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  placeholderSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },

  // Error
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