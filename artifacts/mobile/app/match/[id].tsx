import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  ActivityIndicator as RNActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMatch, useMatchCommentary, useToggleMatchAlert } from '@/lib/api-hooks';

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
  live: '#EF4444',
  star: '#F5C518',
};

// ─── Types ───────────────────────────────────────────────────
type DetailTab = 'scorecard' | 'live' | 'commentary' | 'stats';

interface BatterRow {
  name: string;
  runs: string;
  balls: string;
  fours: string;
  sixes: string;
  sr: string;
  isOut: boolean;
}

interface BowlerRow {
  name: string;
  overs: string;
  maidens: string;
  runs: string;
  wickets: string;
}

// ─── Data ───────────────────────────────────────────────────
const detailTabs: { key: DetailTab; label: string }[] = [
  { key: 'scorecard', label: 'Scorecard' },
  { key: 'live', label: 'Live' },
  { key: 'commentary', label: 'Commentary' },
  { key: 'stats', label: 'Stats' },
];

// ─── Table Components ────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statBoxValue}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<DetailTab>('scorecard');

  const { data: matchData, isLoading, isError, refetch } = useMatch(id);
  const toggleAlert = useToggleMatchAlert();

  const match = matchData;
  const teamALabel = match?.teamA?.name?.toUpperCase() || 'TEAM A';
  const teamBLabel = match?.teamB?.name?.toUpperCase() || 'TEAM B';
  const teamAScore = match?.teamAScore || '0/0';
  const teamBScore = match?.teamBScore || '0/0';
  const headerTitle = `${match?.teamA?.abbr || 'TBA'} VS ${match?.teamB?.abbr || 'TBA'}`;
  const description = match?.description || '';

  const scorecard = match?.scorecard;
  const battingRows: BatterRow[] = useMemo(() => {
    if (scorecard?.batting) return scorecard.batting;
    if (scorecard?.innings?.[0]?.batting) return scorecard.innings[0].batting;
    return [];
  }, [scorecard]);

  const bowlingRows: BowlerRow[] = useMemo(() => {
    if (scorecard?.bowling) return scorecard.bowling;
    if (scorecard?.innings?.[1]?.bowling) return scorecard.innings[1].bowling;
    return [];
  }, [scorecard]);

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Header ─────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={() => id && toggleAlert.mutate(id)}>
            <Ionicons name={match?.isAlertSet ? 'notifications' : 'notifications-outline'} size={22} color={match?.isAlertSet ? colors.primary : colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── Hero Score Card ────────────────────────── */}
        <LinearGradient
          colors={[colors.primary, colors.primaryBlue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroCard}
        >
          {/* Live badge */}
          <View style={styles.heroLiveBadge}>
            <View style={styles.heroLiveDot} />
            <Text style={styles.heroLiveText}>LIVE</Text>
          </View>

          {/* Team A */}
          <View style={styles.heroTeamBlock}>
            <Text style={styles.heroTeamLabel}>{teamALabel}</Text>
            <Text style={styles.heroScore}>{teamAScore}</Text>
            <Text style={styles.heroOvers}>{match?.status || ''}</Text>
          </View>

          <Text style={styles.heroVs}>VS</Text>

          {/* Team B */}
          <View style={styles.heroTeamBlock}>
            <Text style={styles.heroTeamLabel}>{teamBLabel}</Text>
            <Text style={styles.heroScore}>{teamBScore}</Text>
            <Text style={styles.heroOvers}>{match?.teamBStatus || ''}</Text>
          </View>

          {/* Need statement */}
          <View style={styles.heroNeedRow}>
            <Text style={styles.heroNeedText}>
              {description || `${teamALabel} vs ${teamBLabel}`}
            </Text>
          </View>

          {/* Stats row */}
          <View style={styles.heroStatsRow}>
            <StatBox label="Sport" value={match?.sport ? match.sport.charAt(0).toUpperCase() + match.sport.slice(1) : 'N/A'} />
            <View style={styles.heroStatsDivider} />
            <StatBox label="Status" value={match?.status?.charAt(0).toUpperCase() + (match?.status || '').slice(1) || 'N/A'} />
            <View style={styles.heroStatsDivider} />
            <StatBox label={typeof match?.tournament === 'string' ? 'Tournament' : 'Match'} value={typeof match?.tournament === 'string' ? match.tournament : match?.tournament?.name || 'N/A'} />
          </View>
        </LinearGradient>

        {/* ── Detail Tabs ───────────────────────────── */}
        <View style={styles.detailTabRow}>
          {detailTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.detailTab, activeTab === tab.key && styles.detailTabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.detailTabText, activeTab === tab.key && styles.detailTabTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Scorecard Content ─────────────────────── */}
        {activeTab === 'scorecard' && (
          <View style={styles.scorecardSection}>
            {/* Batting */}
            <View style={styles.tableHeader}>
              <Text style={styles.tableTitle}>{match?.teamA?.name || 'Team A'} Batting</Text>
              {match?.status === 'live' && (
                <View style={styles.liveSmallBadge}>
                  <View style={styles.liveDotSmall} />
                  <Text style={styles.liveSmallText}>Batting</Text>
                </View>
              )}
            </View>

            {battingRows.length > 0 ? (
              <View style={styles.tableContainer}>
                <View style={styles.tableColHeader}>
                  <Text style={[styles.tableColText, { flex: 2.2 }]}>Player</Text>
                  <Text style={[styles.tableColText, styles.tableColCenter, { width: 32 }]}>R</Text>
                  <Text style={[styles.tableColText, styles.tableColCenter, { width: 32 }]}>B</Text>
                  <Text style={[styles.tableColText, styles.tableColCenter, { width: 32 }]}>4s</Text>
                  <Text style={[styles.tableColText, styles.tableColCenter, { width: 32 }]}>6s</Text>
                  <Text style={[styles.tableColText, styles.tableColCenter, { width: 44 }]}>SR</Text>
                </View>
                {battingRows.map((b, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}>
                    <View style={{ flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.tableCellPlayer, b.isOut && styles.tableCellPlayerOut, !b.isOut && styles.tableCellPlayerBatting]}>{b.name}</Text>
                      {!b.isOut && <Text style={styles.battingIndicator}>*</Text>}
                    </View>
                    <Text style={[styles.tableCellNum, styles.tableColCenter, { width: 32 }]}>{b.runs}</Text>
                    <Text style={[styles.tableCellNum, styles.tableColCenter, { width: 32 }]}>{b.balls}</Text>
                    <Text style={[styles.tableCellNum, styles.tableColCenter, { width: 32 }]}>{b.fours}</Text>
                    <Text style={[styles.tableCellNum, styles.tableColCenter, { width: 32 }]}>{b.sixes}</Text>
                    <Text style={[styles.tableCellNum, styles.tableColCenter, { width: 44 }]}>{b.sr}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyScorecard}>
                <Text style={styles.emptyScorecardText}>Scorecard not available yet</Text>
              </View>
            )}

            {/* Bowling */}
            {bowlingRows.length > 0 && (
              <View style={[styles.tableHeader, { marginTop: 24 }]}>
                <Text style={styles.tableTitle}>{match?.teamB?.name || 'Team B'} Bowling</Text>
              </View>
            )}
            {bowlingRows.length > 0 && (
              <View style={styles.tableContainer}>
                <View style={styles.tableColHeader}>
                  <Text style={[styles.tableColText, { flex: 2.5 }]}>Player</Text>
                  <Text style={[styles.tableColText, styles.tableColCenter, { width: 40 }]}>O</Text>
                  <Text style={[styles.tableColText, styles.tableColCenter, { width: 32 }]}>M</Text>
                  <Text style={[styles.tableColText, styles.tableColCenter, { width: 32 }]}>R</Text>
                  <Text style={[styles.tableColText, styles.tableColCenter, { width: 32 }]}>W</Text>
                </View>
                {bowlingRows.map((b, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}>
                    <Text style={[styles.tableCellPlayer, { flex: 2.5 }]}>{b.name}</Text>
                    <Text style={[styles.tableCellNum, styles.tableColCenter, { width: 40 }]}>{b.overs}</Text>
                    <Text style={[styles.tableCellNum, styles.tableColCenter, { width: 32 }]}>{b.maidens}</Text>
                    <Text style={[styles.tableCellNum, styles.tableColCenter, { width: 32 }]}>{b.runs}</Text>
                    <Text style={[styles.tableCellNum, styles.tableColCenter, { width: 32 }]}>{b.wickets}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Full Scorecard link */}
            <TouchableOpacity style={styles.fullScorecardBtn} activeOpacity={0.7}>
              <Text style={styles.fullScorecardText}>Full Scorecard</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'live' && (
          <View style={styles.placeholderTab}>
            <Ionicons name="radio-outline" size={48} color={colors.textMuted} />
            <Text style={styles.placeholderTitle}>Live Feed</Text>
            <Text style={styles.placeholderSubtitle}>Real-time match updates</Text>
          </View>
        )}

        {activeTab === 'commentary' && (
          <TouchableOpacity
            style={styles.placeholderTab}
            activeOpacity={0.7}
            onPress={() => router.push(`/match/${id}/commentary`)}
          >
            <Ionicons name="chatbubble-outline" size={48} color={colors.textMuted} />
            <Text style={styles.placeholderTitle}>Ball-by-Ball Commentary</Text>
            <Text style={styles.placeholderSubtitle}>Tap to view full commentary →</Text>
          </TouchableOpacity>
        )}

        {activeTab === 'stats' && (
          <View style={styles.placeholderTab}>
            <Ionicons name="stats-chart-outline" size={48} color={colors.textMuted} />
            <Text style={styles.placeholderTitle}>Match Statistics</Text>
            <Text style={styles.placeholderSubtitle}>Wagon wheel, Manhattan, Run rate chart</Text>
          </View>
        )}
      </ScrollView>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },

  // Hero Card
  heroCard: {
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  heroLiveBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 5,
  },
  heroLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.live,
  },
  heroLiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  heroTeamBlock: {
    alignItems: 'center',
    flex: 1,
  },
  heroTeamLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    letterSpacing: 1,
  },
  heroScore: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  heroOvers: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  heroVs: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    alignSelf: 'center',
  },
  heroNeedRow: {
    marginTop: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  heroNeedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  heroStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 14,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  heroStatsDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statBox: {
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  statBoxLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    fontWeight: '500',
  },

  // Detail Tabs
  detailTabRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 6,
    marginTop: 20,
    marginBottom: 16,
  },
  detailTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  detailTabActive: {
    backgroundColor: colors.primary,
  },
  detailTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  detailTabTextActive: {
    color: '#fff',
  },

  // Scorecard
  scorecardSection: {
    paddingHorizontal: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  liveSmallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
  liveSmallText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.live,
  },
  tableContainer: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  tableColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceLight,
  },
  tableColText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableColCenter: {
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableRowEven: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  tableCellPlayer: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  tableCellPlayerOut: {
    color: colors.textSecondary,
  },
  tableCellPlayerBatting: {
    color: colors.text,
    fontWeight: '700',
  },
  tableCellNum: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  battingIndicator: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 16,
  },

  // Full Scorecard button
  fullScorecardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 14,
  },
  fullScorecardText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Empty Scorecard
  emptyScorecard: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyScorecardText: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Placeholder tabs
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