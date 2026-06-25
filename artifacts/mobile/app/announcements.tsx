import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAnnouncements } from '@/lib/api-hooks';

// ─── Types ───────────────────────────────────────────────────

interface AnnouncementItem {
  id: string;
  title: string;
  description: string;
  date: string;
  type: 'info' | 'update' | 'maintenance';
}

// ─── Helpers ─────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { color: string; label: string; bgColor: string }> = {
  info: { color: '#2563EB', label: 'INFO', bgColor: 'rgba(37,99,235,0.15)' },
  update: { color: '#10B981', label: 'UPDATE', bgColor: 'rgba(16,185,129,0.15)' },
  maintenance: { color: '#F59E0B', label: 'MAINT.', bgColor: 'rgba(245,158,11,0.15)' },
};

const GRADIENT_COLORS: Record<string, [string, string]> = {
  info: ['#2563EB', '#1D4ED8'],
  update: ['#10B981', '#047857'],
  maintenance: ['#F59E0B', '#D97706'],
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── Announcement Card ───────────────────────────────────────

function AnnouncementCard({ item }: { item: AnnouncementItem }) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;

  return (
    <View style={styles.card}>
      {/* Left gradient border */}
      <View style={styles.cardBorder}>
        <LinearGradient
          colors={GRADIENT_COLORS[item.type] || GRADIENT_COLORS.info}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: config.bgColor }]}>
            <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardDescription} numberOfLines={3}>{item.description}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function AnnouncementsScreen() {
  const { data, isLoading, isError, refetch } = useAnnouncements();

  const announcements: AnnouncementItem[] = React.useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    return data.map((a: any, i: number) => ({
      id: a.id || String(i + 1),
      title: a.title || a.subject || '',
      description: a.description || a.body || a.message || '',
      date: a.date || a.createdAt || a.publishedAt || '',
      type: a.type || a.category || 'info',
    }));
  }, [data]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#F2F2F7" />
        </Pressable>
        <Text style={styles.headerTitle}>Announcements</Text>
        <View style={{ width: 42 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : isError ? (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={48} color="#6B6B80" />
          <Text style={styles.emptyTitle}>Failed to load</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="megaphone-outline" size={64} color="#6B6B80" />
          <Text style={styles.emptyTitle}>No announcements</Text>
          <Text style={styles.emptySubtitle}>Check back later for updates</Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AnnouncementCard item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => refetch()}
          refreshing={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#121A2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F2F2F7',
    fontFamily: 'Inter',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#121A2F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    height: 140,
  },
  cardBorder: {
    width: 4,
    height: '100%',
  },
  cardContent: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'Inter',
  },
  cardDate: {
    fontSize: 12,
    color: '#6B6B80',
    fontFamily: 'Inter',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F2F2F7',
    fontFamily: 'Inter',
    lineHeight: 22,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6B6B80',
    fontFamily: 'Inter',
    lineHeight: 18,
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
    color: '#B3B8C8',
    fontFamily: 'Inter',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B6B80',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    fontFamily: 'Inter',
  },
});