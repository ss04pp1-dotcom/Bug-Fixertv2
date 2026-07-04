import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, Switch, StyleSheet, Animated, ActivityIndicator as RNActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMatchAlerts, useToggleMatchAlert } from '@/lib/api-hooks';
import { normalizeName } from '@/lib/normalize';

interface Alert {
  id: string;
  match: string;
  sport: string;
  isLive: boolean;
  time: string;
  enabled: boolean;
}

const sportIcons: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  cricket: 'cricket',
  football: 'soccer',
  basketball: 'basketball',
  tennis: 'tennis',
};

const sportColors: Record<string, string> = {
  cricket: '#10B981',
  football: '#2563EB',
  basketball: '#F59E0B',
  tennis: '#EC4899',
};

function PulsingDot() {
  const opacity = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    // M-028: capture the loop handle and stop it on unmount to avoid leaks.
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

export default function MatchAlertsScreen() {
  const { data: alertsData, isLoading, isError, refetch } = useMatchAlerts();
  const toggleAlertMutation = useToggleMatchAlert();
  const [localEnabled, setLocalEnabled] = useState<Record<string, boolean>>({});

  const alerts: Alert[] = useMemo(() => {
    const items = alertsData ?? [];
    return items.map((a: any) => {
      const teamAName = a.match?.teamA?.name || a.teamA?.name || '';
      const teamBName = a.match?.teamB?.name || a.teamB?.name || '';
      const tournamentName = normalizeName(a.match?.tournament) || normalizeName(a.tournament);
      const matchLabel = teamAName && teamBName ? `${teamAName} vs ${teamBName}` : a.matchTitle || a.title || 'Match';
      const displayLabel = tournamentName ? `${matchLabel} - ${tournamentName}` : matchLabel;
      const isLive = a.match?.status === 'live' || a.status === 'live';
      const scheduledTime = a.match?.scheduledAt || a.scheduledAt;
      let timeStr = isLive ? 'Live' : '';
      if (!isLive && scheduledTime) {
        try {
          const d = new Date(scheduledTime);
          timeStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' • ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } catch { timeStr = ''; }
      }
      const isEnabled = a.id in localEnabled ? localEnabled[a.id] : (a.isEnabled ?? a.enabled ?? true);
      // FIX: API may return sport as a relation object {id, name, slug}
      // instead of a plain string. normalizeName() unwraps both shapes so
      // item.sport.charAt() below never throws.
      const sportName = normalizeName(a.sport, '') || normalizeName(a.match?.sport, 'cricket');
      return {
        id: a.matchId || a.id,
        match: displayLabel,
        sport: sportName.toLowerCase(),
        isLive,
        time: timeStr,
        enabled: isEnabled,
      };
    });
  }, [alertsData, localEnabled]);

  const toggleAlert = (alertId: string) => {
    // M-028: optimistic toggle with rollback on failure. Uses the action param
    // introduced in M-007 so removal actually hits DELETE on the server.
    const current = alerts.find((a) => a.id === alertId)?.enabled ?? false;
    const next = !current;
    setLocalEnabled((prevMap) => ({ ...prevMap, [alertId]: next }));
    toggleAlertMutation.mutate(
      { matchId: alertId, action: next ? 'add' : 'remove' },
      {
        onError: () => {
          setLocalEnabled((prevMap) => ({ ...prevMap, [alertId]: !next }));
        },
      },
    );
  };

  const renderItem = ({ item }: { item: Alert }) => (
    <View style={styles.alertRow}>
      <View style={[styles.sportIcon, { backgroundColor: `${sportColors[item.sport] ?? '#6B7280'}20` }]}>
        <MaterialCommunityIcons name={sportIcons[item.sport] ?? 'trophy-outline'} size={18} color={sportColors[item.sport] ?? '#6B7280'} />
      </View>
      <View style={styles.alertInfo}>
        <Text style={styles.alertMatch}>{item.match}</Text>
        <Text style={styles.alertSport}>{item.sport.charAt(0).toUpperCase() + item.sport.slice(1)}</Text>
        {item.isLive ? (
          <View style={styles.liveBadge}>
            <PulsingDot />
            <Text style={styles.liveText}>Live</Text>
          </View>
        ) : (
          <Text style={styles.alertTime}>{item.time}</Text>
        )}
      </View>
      <Switch
        value={item.enabled}
        onValueChange={() => toggleAlert(item.id)}
        trackColor={{ false: '#2D2D3F', true: '#7C3AED' }}
        thumbColor="#fff"
        ios_backgroundColor="#2D2D3F"
      />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <RNActivityIndicator size="large" color="#7C3AED" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#F2F2F7" />
          </Pressable>
          <Text style={styles.headerTitle}>Match Alerts</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color="#6B6B80" />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#F2F2F7" />
        </Pressable>
        <Text style={styles.headerTitle}>Match Alerts</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.description}>Get notified about your favorite matches and never miss a moment.</Text>

      <FlatList data={alerts} renderItem={renderItem} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={48} color="#6B6B80" />
          <Text style={styles.emptyTitle}>No match alerts set</Text>
          <Text style={styles.emptySubtitle}>Tap the button below to add match alerts</Text>
        </View>
      } />

      <View style={styles.fabContainer}>
        <Pressable style={styles.fab} onPress={() => router.push('/matches')}>
          <LinearGradient colors={['#7C3AED', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabGradient}>
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.fabText}>Add Alert</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070F', paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#121A2F', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#F2F2F7', fontSize: 20, fontWeight: '700' },
  description: { color: '#6B6B80', fontSize: 14, lineHeight: 20, marginBottom: 20, marginTop: 8 },
  list: { gap: 4, paddingBottom: 100 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#121A2F', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  sportIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  alertInfo: { flex: 1 },
  alertMatch: { color: '#F2F2F7', fontSize: 14, fontWeight: '600' },
  alertSport: { color: '#6B6B80', fontSize: 12, marginTop: 2 },
  alertTime: { color: '#B3B8C8', fontSize: 12, marginTop: 4 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { color: '#EF4444', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  fabContainer: { position: 'absolute', bottom: 24, left: 24, right: 24 },
  fab: { borderRadius: 18, overflow: 'hidden', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  fabGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 18 },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyTitle: { color: '#F2F2F7', fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { color: '#6B6B80', fontSize: 13, marginTop: 6, textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 14, backgroundColor: '#7C3AED' },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});