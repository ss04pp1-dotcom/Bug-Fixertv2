import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getAdEngineDebugState,
  resetSwitchCounter,
  invalidateGlobalAdConfig,
  fetchGlobalAdConfig,
  type AdEngineDebugState,
} from '@/lib/global-ad-engine';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  success: '#22C55E',
  danger: '#EF4444',
  warn: '#F59E0B',
};

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function fmtTs(ts: number | null): string {
  if (!ts) return 'Never';
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleString();
}

export default function AdDebugScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<AdEngineDebugState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const snap = await getAdEngineDebugState();
      setState(snap);
    } catch (e) {
      if (__DEV__) console.warn('[AdDebug] failed to load state:', e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleReset = () => {
    Alert.alert(
      'Reset switch counter',
      'This clears the persistent channel-switch counter and last-smartlink timestamp on this device, restarting the ad cycle from position 0.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await resetSwitchCounter();
              await load();
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleForceRefreshConfig = async () => {
    setBusy(true);
    try {
      invalidateGlobalAdConfig();
      await fetchGlobalAdConfig();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ad Engine Debug</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading || !state ? (
        <View style={s.loader}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        >
          <View style={s.group}>
            <Text style={s.groupTitle}>Cycle State</Text>
            <View style={s.groupCard}>
              <Row label="Switch counter" value={String(state.switchCount)} />
              <Row label="Position in cycle" value={`${state.posInCycle} / ${state.cycleLen}`} />
              <Row label="Smartlink frequency" value={`every ${state.slFreq}`} />
              <Row label="VAST frequency" value={`every ${state.vaFreq}`} />
              <Row label="Next smartlink in" value={`${state.nextSmartlinkIn} switch(es)`} />
              <Row label="Next VAST in" value={`${state.nextVastIn} switch(es)`} />
              <Row label="Last smartlink" value={fmtTs(state.lastSmartlinkTs)} />
            </View>
          </View>

          <View style={s.group}>
            <Text style={s.groupTitle}>Global Config</Text>
            <View style={s.groupCard}>
              <Row
                label="Config loaded"
                value={state.configLoaded ? 'Yes' : 'No (using defaults)'}
                valueColor={state.configLoaded ? C.success : C.danger}
              />
              <Row label="Last fetched" value={fmtTs(state.configFetchedAt)} />
              <Row
                label="Master enabled"
                value={state.config.isEnabled ? 'On' : 'Off'}
                valueColor={state.config.isEnabled ? C.success : C.danger}
              />
              <Row label="Test mode" value={state.config.testMode ? 'On' : 'Off'} />
              <Row
                label="Smartlink"
                value={state.config.smartlink.enabled ? (state.config.smartlink.url ? 'On' : 'On (no URL!)') : 'Off'}
                valueColor={state.config.smartlink.enabled ? (state.config.smartlink.url ? C.success : C.warn) : C.textSec}
              />
              <Row
                label="VAST"
                value={state.config.vast.enabled ? (state.config.vast.url ? 'On' : 'On (no URL!)') : 'Off'}
                valueColor={state.config.vast.enabled ? (state.config.vast.url ? C.success : C.warn) : C.textSec}
              />
              <Row
                label="Banner"
                value={state.config.banner.enabled ? 'On' : 'Off'}
                valueColor={state.config.banner.enabled ? C.success : C.textSec}
              />
              <Row label="Cooldown" value={`${state.config.smartlink.cooldownMinutes}m`} />
            </View>
          </View>

          <View style={s.group}>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: `${C.primary}18`, borderColor: `${C.primary}40` }]}
              onPress={handleForceRefreshConfig}
              disabled={busy}
              activeOpacity={0.7}
            >
              {busy ? (
                <ActivityIndicator color={C.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color={C.primary} />
                  <Text style={[s.actionBtnText, { color: C.primary }]}>Force refresh config</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: `${C.danger}18`, borderColor: `${C.danger}40`, marginTop: 12 }]}
              onPress={handleReset}
              disabled={busy}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color={C.danger} />
              <Text style={[s.actionBtnText, { color: C.danger }]}>Reset switch counter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text, fontFamily: 'Outfit' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  group: { marginHorizontal: 16, marginBottom: 20 },
  groupTitle: { fontSize: 12, fontWeight: '600', color: C.textSec, fontFamily: 'Inter', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  groupCard: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowLabel: { fontSize: 14, color: C.textSec, fontFamily: 'Inter', flex: 1 },
  rowValue: { fontSize: 14, color: C.text, fontFamily: 'Inter', fontWeight: '600' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  actionBtnText: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter' },
});
