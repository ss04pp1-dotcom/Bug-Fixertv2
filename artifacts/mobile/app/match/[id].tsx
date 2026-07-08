import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  ActivityIndicator as RNActivityIndicator,
  Image,
} from 'react-native';
import { Config } from '@/constants/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMatch, useToggleMatchAlert } from '@/lib/api-hooks';
import { normalizeName, normalizeCapitalized } from '@/lib/normalize';

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

  const { data: matchData, isLoading, isError, refetch } = useMatch(id);
  const toggleAlert = useToggleMatchAlert();

  const match = matchData;
  const teamALabel = match?.teamA?.name?.toUpperCase() || 'TEAM A';
  const teamBLabel = match?.teamB?.name?.toUpperCase() || 'TEAM B';
  const headerTitle = `${match?.teamA?.abbr || 'TBA'} VS ${match?.teamB?.abbr || 'TBA'}`;
  const description = match?.description || '';
  const isLive = match?.status === 'live';
  const watchUrl = match?.streamUrl || match?.liveUrl || match?.streamUrls?.[0]?.url;

  const handleWatch = () => {
    if (!watchUrl || !id) return;
    // Build stream sources array from all available stream URLs
    const rawUrls: { label: string; url: string }[] = Array.isArray(match?.streamUrls) && match.streamUrls.length > 0
      ? match.streamUrls.filter((u: any) => u?.url)
      : [{ label: 'Server 1', url: watchUrl }];
    const streamSources = JSON.stringify(rawUrls);

    router.push({
      pathname: `/live-player/${id}`,
      params: {
        title: `${match?.teamA?.name || 'Team A'} vs ${match?.teamB?.name || 'Team B'}`,
        streamUrl: watchUrl,
        streamSources,
        cat: normalizeCapitalized(match?.sport, 'Sports'),
        type: 'match',
      },
    } as any);
  };

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
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.7}
            onPress={() => id && toggleAlert.mutate({
              matchId: id as string,
              // M-048: pass the correct action so the hook issues DELETE for
              // removal (instead of always POST). The hook already invalidates
              // ['sports','match',matchId] on success so the icon updates.
              action: match?.isAlertSet ? 'remove' : 'add',
            })}
          >
            <Ionicons name={match?.isAlertSet ? 'notifications' : 'notifications-outline'} size={22} color={match?.isAlertSet ? colors.primary : colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── Hero Card ─────────────────────────────── */}
        <LinearGradient
          colors={[colors.primary, colors.primaryBlue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroCard}
        >
          {/* Live badge */}
          {isLive && (
            <View style={styles.heroLiveBadge}>
              <View style={styles.heroLiveDot} />
              <Text style={styles.heroLiveText}>LIVE</Text>
            </View>
          )}

          {/* Team A */}
          <View style={styles.heroTeamBlock}>
            {match?.teamA?.logo ? (
              <Image
                source={{ uri: Config.imageUrl(match.teamA.logo) }}
                style={styles.teamLogo}
                resizeMode="contain"
              />
            ) : null}
            <Text style={styles.heroTeamLabel}>{teamALabel}</Text>
          </View>

          <Text style={styles.heroVs}>VS</Text>

          {/* Team B */}
          <View style={styles.heroTeamBlock}>
            {match?.teamB?.logo ? (
              <Image
                source={{ uri: Config.imageUrl(match.teamB.logo) }}
                style={styles.teamLogo}
                resizeMode="contain"
              />
            ) : null}
            <Text style={styles.heroTeamLabel}>{teamBLabel}</Text>
          </View>

          {/* Need statement */}
          <View style={styles.heroNeedRow}>
            <Text style={styles.heroNeedText}>
              {description || `${teamALabel} vs ${teamBLabel}`}
            </Text>
          </View>

          {/* Stats row */}
          <View style={styles.heroStatsRow}>
            <StatBox label="Sport" value={normalizeCapitalized(match?.sport, 'N/A')} />
            <View style={styles.heroStatsDivider} />
            {/* M-011: avoid rendering the literal string 'undefined' when status is missing. */}
            <StatBox
              label="Status"
              value={
                match?.status
                  ? match.status.charAt(0).toUpperCase() + match.status.slice(1)
                  : 'N/A'
              }
            />
            <View style={styles.heroStatsDivider} />
            <StatBox label={typeof match?.tournament === 'string' ? 'Tournament' : 'Match'} value={normalizeName(match?.tournament, 'N/A')} />
          </View>

          {/* Watch button */}
          {watchUrl ? (
            <TouchableOpacity style={styles.watchBtn} activeOpacity={0.85} onPress={handleWatch}>
              <Ionicons name="play-circle" size={20} color={colors.primary} />
              <Text style={styles.watchBtnText}>{isLive ? 'Watch Live' : 'Watch Match'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.watchBtnDisabled}>
              <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.6)" />
              <Text style={styles.watchBtnDisabledText}>Stream not available yet</Text>
            </View>
          )}
        </LinearGradient>

        {/* ── Match Info ────────────────────────────── */}
        <View style={styles.infoSection}>
          {match?.venue ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={styles.infoLabel}>Venue</Text>
              <Text style={styles.infoValue}>{match.venue}</Text>
            </View>
          ) : null}
          {match?.scheduledAt ? (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.infoLabel}>Scheduled</Text>
              <Text style={styles.infoValue}>
                {new Date(match.scheduledAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>
            </View>
          ) : null}
        </View>
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
  teamLogo: {
    width: 52,
    height: 52,
    marginBottom: 8,
  },
  heroTeamLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.5,
    textAlign: 'center',
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

  // Watch button
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  watchBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  watchBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  watchBtnDisabledText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },

  // Match Info
  infoSection: {
    marginTop: 20,
    marginHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted,
    width: 80,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
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