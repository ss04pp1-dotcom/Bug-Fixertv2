import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/lib/api-hooks';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  border: 'rgba(255,255,255,0.1)',
};

// ─── Types ───────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timeAgo: string;
  isRead: boolean;
  icon: string;
  color: string;
}

// ─── Icon helper ─────────────────────────────────────────────

function getIconForType(type: string): { icon: string, color: string } {
  const map: Record<string, { icon: string, color: string }> = {
    new_episode: { icon: 'tv-outline', color: '#8B5CF6' },
    new_movie: { icon: 'film-outline', color: '#EC4899' },
    recommendation: { icon: 'star-outline', color: '#F59E0B' },
    system: { icon: 'settings-outline', color: '#A1A1AA' },
    subscription: { icon: 'crown-outline', color: '#22C55E' },
    promo: { icon: 'gift-outline', color: '#06B6D4' },
    live: { icon: 'radio-outline', color: '#EF4444' },
    default: { icon: 'notifications-outline', color: '#8B5CF6' },
  };
  return map[type] || map.default;
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date().getTime();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Notification Card ───────────────────────────────────────

function NotificationCard({ item, onMarkRead }: { item: NotificationItem; onMarkRead: (id: string) => void }) {
  return (
    <Pressable
      style={[styles.card, !item.isRead && styles.cardUnread]}
      onPress={() => onMarkRead(item.id)}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.iconWrapper, { backgroundColor: `${item.color}15` }]}>
          <Ionicons name={item.icon as any} size={20} color={item.color} />
        </View>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardTime}>{item.timeAgo}</Text>
        </View>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

const FILTER_TABS = ['All', 'New Releases', 'Live Sports', 'Offers', 'System'];

export default function NotificationsScreen() {
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [activeTab, setActiveTab] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  };

  const notifications: NotificationItem[] = React.useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    return data.map((n: any, i: number) => {
      const typeInfo = getIconForType(n.type || n.category || '');
      return {
        id: n.id || String(i + 1),
        title: n.title || n.subject || 'Notification',
        description: n.description || n.body || n.message || '',
        timeAgo: formatTimeAgo(n.createdAt || n.sentAt || n.date),
        isRead: !!n.isRead || !!n.read,
        icon: typeInfo.icon,
        color: typeInfo.color,
      };
    });
  }, [data]);

  const filteredNotifications = React.useMemo(() => {
    if (activeTab === 'All') return notifications;
    // Basic mock filtering based on text/type for the UI design requirement
    return notifications.filter(n => {
      if (activeTab === 'New Releases') return n.icon === 'tv-outline' || n.icon === 'film-outline';
      if (activeTab === 'Live Sports') return n.icon === 'radio-outline';
      if (activeTab === 'Offers') return n.icon === 'gift-outline' || n.icon === 'crown-outline';
      if (activeTab === 'System') return n.icon === 'settings-outline';
      return true;
    });
  }, [notifications, activeTab]);

  const handleMarkRead = (id: string) => {
    markRead.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable hitSlop={8} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={22} color={C.text} />
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
          {FILTER_TABS.map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              {activeTab === tab ? (
                <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.tabActiveGrad}>
                  <Text style={styles.tabTextActive}>{tab}</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.tabText}>{tab}</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Mark All Read */}
      {notifications.some(n => !n.isRead) && (
        <View style={styles.markAllRow}>
          <Text style={styles.markAllCount}>{notifications.filter(n => !n.isRead).length} unread</Text>
          <Pressable onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.textSec} />
          <Text style={styles.emptyTitle}>Failed to load</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="notifications-off-outline" size={64} color={C.textSec} />
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptySubtitle}>You're all caught up!</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationCard item={item} onMarkRead={handleMarkRead} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    fontFamily: 'Outfit',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabActive: {
    padding: 0,
    borderWidth: 0,
  },
  tabActiveGrad: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabText: {
    color: C.textSec,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  tabTextActive: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  markAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  markAllCount: {
    color: C.textSec,
    fontSize: 13,
    fontFamily: 'Inter',
  },
  markAllText: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    gap: 14,
  },
  cardUnread: {
    backgroundColor: 'rgba(139,92,246,0.05)',
    borderColor: 'rgba(139,92,246,0.2)',
  },
  cardLeft: {
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: C.textSec,
    fontFamily: 'Inter',
  },
  cardTitleUnread: {
    color: C.text,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  cardDescription: {
    fontSize: 13,
    color: C.textSec,
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  cardTime: {
    fontSize: 11,
    color: C.textSec,
    fontFamily: 'Inter',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    fontFamily: 'Outfit',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.textSec,
    fontFamily: 'Inter',
    marginTop: 4,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.primary,
    fontFamily: 'Inter',
  },
});
