import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { useProfile, useMySubscription } from '@/lib/api-hooks';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  success: '#22C55E',
  danger: '#FF3B30',
};

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  badge?: string;
  route?: string;
  danger?: boolean;
}

const MENU_GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Account',
    items: [
      { id: 'mylist', label: 'My List', icon: 'heart-outline', iconColor: '#EC4899', route: '/my-list' },
      { id: 'history', label: 'Watch History', icon: 'time-outline', iconColor: '#8B5CF6', route: '/watch-history' },
      { id: 'downloads', label: 'Downloads', icon: 'download-outline', iconColor: '#2563EB', route: '/downloads' },
      { id: 'purchases', label: 'Purchases', icon: 'card-outline', iconColor: '#22C55E', route: '/subscription' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { id: 'parental', label: 'Parental Control', icon: 'shield-checkmark-outline', iconColor: '#F59E0B', route: '/parental-control' },
      { id: 'settings', label: 'Settings', icon: 'settings-outline', iconColor: C.textSec, route: '/settings' },
      { id: 'notifications', label: 'Notifications', icon: 'notifications-outline', iconColor: '#06B6D4', route: '/notifications' },
      { id: 'language', label: 'Language', icon: 'globe-outline', iconColor: '#8B5CF6', route: '/language' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'help', label: 'Help & Support', icon: 'help-circle-outline', iconColor: C.textSec, route: '/support' },
      { id: 'about', label: 'About StreamPro', icon: 'information-circle-outline', iconColor: C.textSec },
      { id: 'logout', label: 'Logout', icon: 'log-out-outline', iconColor: C.danger, danger: true },
    ],
  },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { data: profileData, isLoading } = useProfile();
  const { data: subData } = useMySubscription();

  const displayName = profileData?.name || user?.name || 'Guest User';
  const displayEmail = profileData?.email || user?.email || '';
  const planName = subData?.plan?.name || user?.plan || 'Free';
  const isPremium = planName?.toLowerCase() !== 'free';

  // M-047: filter empty segments so a double-space in the name doesn't produce
  // undefined characters; fall back to 'U' when displayName is empty.
  const initials = displayName
    ? displayName.split(' ').filter((p: string) => p.length > 0).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2) || 'U'
    : 'U';

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: () => { logout(); router.replace('/(auth)/login'); },
      },
    ]);
  }, [logout]);

  const handleMenuPress = (item: MenuItem) => {
    if (item.id === 'logout') { handleLogout(); return; }
    if (item.route) router.push(item.route as any);
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
        <Pressable hitSlop={8} onPress={() => router.push('/settings')}><Ionicons name="settings-outline" size={22} color={C.text} /></Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Profile Card */}
        <View style={s.profileCard}>
          {isLoading ? (
            <ActivityIndicator color={C.primary} />
          ) : (
            <>
              {/* Avatar */}
              <View style={s.avatarWrapper}>
                <LinearGradient colors={[C.primary, C.accent]} style={s.avatar}>
                  <Text style={s.avatarTxt}>{initials}</Text>
                </LinearGradient>
                <Pressable style={s.editAvatarBtn}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </Pressable>
              </View>
              <Text style={s.userName}>{displayName}</Text>
              <Text style={s.userEmail}>{displayEmail}</Text>
              {/* Plan Badge */}
              {isPremium ? (
                <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.planBadge}>
                  <Ionicons name="diamond" size={13} color="#fff" />
                  <Text style={s.planBadgeTxt}>{planName} Plan</Text>
                </LinearGradient>
              ) : (
                <View style={s.freeBadge}>
                  <Text style={s.freeBadgeTxt}>Free Plan</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          {[
            { label: 'Watched', value: profileData?.watchedCount ?? 0, icon: 'eye-outline' as const },
            { label: 'Days Active', value: profileData?.daysActive ?? 0, icon: 'calendar-outline' as const },
            { label: isPremium ? 'Plan' : 'Free', value: isPremium ? 'Active' : 'Upgrade', icon: 'trophy-outline' as const, highlight: isPremium },
          ].map((stat) => (
            <View key={stat.label} style={[s.statCard, stat.highlight && s.statCardHighlight]}>
              <Ionicons name={stat.icon} size={20} color={stat.highlight ? '#fff' : C.primary} />
              <Text style={[s.statValue, stat.highlight && s.statValueHighlight]}>{stat.value}</Text>
              <Text style={[s.statLabel, stat.highlight && s.statLabelHighlight]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Upgrade Banner (if free) */}
        {!isPremium && (
          <Pressable onPress={() => router.push('/subscription')} style={s.upgradeBanner}>
            <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.upgradeBannerGrad}>
              <View>
                <Text style={s.upgradeTxt}>Upgrade to Premium</Text>
                <Text style={s.upgradeSubTxt}>Unlimited access · No ads · HD quality</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        )}

        {/* Menu Groups */}
        {MENU_GROUPS.map((group) => (
          <View key={group.title} style={s.menuGroup}>
            <Text style={s.menuGroupTitle}>{group.title}</Text>
            <View style={s.menuCard}>
              {group.items.map((item, idx) => (
                <Pressable
                  key={item.id}
                  style={[s.menuItem, idx < group.items.length - 1 && s.menuItemBorder]}
                  onPress={() => handleMenuPress(item)}
                >
                  <View style={[s.menuIconBox, { backgroundColor: item.danger ? 'rgba(255,59,48,0.1)' : `${item.iconColor}18` }]}>
                    <Ionicons name={item.icon} size={18} color={item.iconColor} />
                  </View>
                  <Text style={[s.menuLabel, item.danger && s.menuLabelDanger]}>{item.label}</Text>
                  {item.badge && (
                    <View style={s.menuBadge}><Text style={s.menuBadgeTxt}>{item.badge}</Text></View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={item.danger ? C.danger : 'rgba(255,255,255,0.3)'} style={{ marginLeft: 'auto' }} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Version */}
        <Text style={s.version}>StreamPro v{require('@/constants/config').Config.APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.text, fontFamily: 'Outfit' },

  profileCard: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 30, fontWeight: '800', color: '#fff', fontFamily: 'Outfit' },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  userName: { fontSize: 20, fontWeight: '800', color: C.text, fontFamily: 'Outfit', marginBottom: 4 },
  userEmail: { fontSize: 13, color: C.textSec, fontFamily: 'Inter', marginBottom: 12 },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  planBadgeTxt: { fontSize: 12, fontWeight: '700', color: '#fff', fontFamily: 'Inter' },
  freeBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  freeBadgeTxt: { fontSize: 12, fontWeight: '600', color: C.textSec, fontFamily: 'Inter' },

  statsRow: { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statCardHighlight: { backgroundColor: C.primary },
  statValue: { fontSize: 18, fontWeight: '800', color: C.text, fontFamily: 'Outfit' },
  statValueHighlight: { color: '#fff' },
  statLabel: { fontSize: 11, color: C.textSec, fontFamily: 'Inter' },
  statLabelHighlight: { color: 'rgba(255,255,255,0.8)' },

  upgradeBanner: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  upgradeBannerGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  upgradeTxt: { fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'Inter', marginBottom: 3 },
  upgradeSubTxt: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter' },

  menuGroup: { marginHorizontal: 16, marginBottom: 16 },
  menuGroupTitle: { fontSize: 12, fontWeight: '600', color: C.textSec, fontFamily: 'Inter', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  menuCard: { backgroundColor: C.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '500', color: C.text, fontFamily: 'Inter', flex: 1 },
  menuLabelDanger: { color: C.danger },
  menuBadge: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  menuBadgeTxt: { fontSize: 11, fontWeight: '700', color: '#fff', fontFamily: 'Inter' },
  version: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter', paddingVertical: 12 },
});
