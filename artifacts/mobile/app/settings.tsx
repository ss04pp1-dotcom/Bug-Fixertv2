import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings, useUpdateSetting } from '@/lib/api-hooks';
import { useAuthStore } from '@/lib/auth-store';
import { Config } from '@/constants/config';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  success: '#22C55E',
};

interface SettingItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  type: 'toggle' | 'nav' | 'value';
  value?: string;
  key?: string;
  route?: string;
}

const SETTING_GROUPS: { title: string; items: SettingItem[] }[] = [
  {
    title: 'Account',
    items: [
      { id: 'account', label: 'Account', icon: 'person-outline', iconColor: '#8B5CF6', type: 'nav', route: '/(main)/profile' },
      { id: 'playback', label: 'Playback', icon: 'play-circle-outline', iconColor: '#2563EB', type: 'nav' },
    ],
  },
  {
    title: 'Quality',
    items: [
      { id: 'videoquality', label: 'Video Quality', icon: 'tv-outline', iconColor: '#22C55E', type: 'value', value: 'Auto (Best)', key: 'videoQuality' },
      { id: 'downloadquality', label: 'Download Quality', icon: 'download-outline', iconColor: '#2563EB', type: 'value', value: 'High', key: 'downloadQuality' },
      { id: 'autodownload', label: 'Auto Download', icon: 'cloud-download-outline', iconColor: '#8B5CF6', type: 'toggle', key: 'autoDownload' },
      { id: 'datasaver', label: 'Data Saver', icon: 'cellular-outline', iconColor: '#F59E0B', type: 'toggle', key: 'dataSaver' },
    ],
  },
  {
    title: 'App',
    items: [
      { id: 'notifications', label: 'Notifications', icon: 'notifications-outline', iconColor: '#EC4899', type: 'nav', route: '/notifications' },
      { id: 'parentalcontrol', label: 'Parental Control', icon: 'shield-checkmark-outline', iconColor: '#22C55E', type: 'nav', route: '/parental-control' },
      { id: 'language', label: 'Language', icon: 'globe-outline', iconColor: '#06B6D4', type: 'nav', route: '/language' },
      { id: 'about', label: 'About StreamPro', icon: 'information-circle-outline', iconColor: C.textSec, type: 'value', value: `v${Config.APP_VERSION}` },
    ],
  },
  ...(__DEV__ ? [{
    title: 'Diagnostics',
    items: [
      { id: 'iptv-report', label: 'IPTV Compatibility Report', icon: 'pulse-outline' as const, iconColor: '#8B5CF6', type: 'nav' as const, route: '/iptv-report' },
    ] as SettingItem[],
  }] : []),
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { data: settingsData, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  const logout = useAuthStore((state) => state.logout);

  const [toggles, setToggles] = useState<Record<string, boolean>>({
    autoDownload: false,
    dataSaver: false,
  });

  const handleToggle = (key: string, value: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: value }));
    // M-024: don't hit the admin /settings endpoint from the user app. The
    // useUpdateSetting hook now points at /auth/profile/preferences — but if
    // the backend hasn't shipped that route yet we still keep the toggle in
    // local state so the UI works. A toast acknowledges the save.
    updateSetting.mutate(
      { key, value },
      {
        onError: () =>
          Alert.alert('Saved locally', 'Couldn\u2019t sync preference to the server — saved on this device for now.'),
      },
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {SETTING_GROUPS.map((group) => (
            <View key={group.title} style={s.group}>
              <Text style={s.groupTitle}>{group.title}</Text>
              <View style={s.groupCard}>
                {group.items.map((item, idx) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.settingRow, idx < group.items.length - 1 && s.settingRowBorder]}
                    onPress={() => {
                      if (item.route) {
                        router.push(item.route as any);
                      }
                    }}
                    activeOpacity={item.type === 'toggle' ? 1 : 0.7}
                  >
                    <View style={[s.iconBox, { backgroundColor: `${item.iconColor}18` }]}>
                      <Ionicons name={item.icon} size={18} color={item.iconColor} />
                    </View>
                    <Text style={s.settingLabel}>{item.label}</Text>
                    {item.type === 'toggle' && item.key ? (
                      <Switch
                        value={
                          // M-024: local `toggles` is the source of truth so the UI
                          // stays responsive even if the user-preferences endpoint is missing.
                          toggles[item.key] ??
                          (settingsData?.[item.key] !== undefined ? Boolean(settingsData[item.key]) : false)
                        }
                        onValueChange={(val) => handleToggle(item.key!, val)}
                        trackColor={{ false: '#2A2A3A', true: C.primary }}
                        thumbColor="#fff"
                      />
                    ) : item.type === 'value' ? (
                      <View style={s.valueRow}>
                        <Text style={s.valueTxt}>{item.value}</Text>
                        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Logout */}
          <View style={s.group}>
            <View style={s.groupCard}>
              <TouchableOpacity style={s.settingRow} onPress={handleLogout} activeOpacity={0.7}>
                <View style={[s.iconBox, { backgroundColor: '#EF444418' }]}>
                  <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                </View>
                <Text style={[s.settingLabel, { color: '#EF4444' }]}>Logout</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(239,68,68,0.4)" />
              </TouchableOpacity>
            </View>
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
  groupCard: { backgroundColor: C.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontSize: 15, fontWeight: '500', color: C.text, fontFamily: 'Inter', flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valueTxt: { fontSize: 13, color: C.textSec, fontFamily: 'Inter' },
});
