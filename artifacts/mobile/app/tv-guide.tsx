import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ListRenderItem,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEPG } from '@/lib/api-hooks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLOT_WIDTH = 140;
const CHANNEL_HEADER_WIDTH = 110;
const HALF_HOUR_HEIGHT = 60;

// ─── Types ───────────────────────────────────────────────────────────

interface Program {
  id: string;
  title: string;
  startSlot: number;
  durationSlots: number;
  color: string;
  isLive: boolean;
}

interface Channel {
  id: string;
  name: string;
  logo: string;
  programs: Program[];
}

// ─── Fallback Data ───────────────────────────────────────────────────

const DATES = ['Today', 'Tomorrow', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIME_SLOTS = [
  '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM',
  '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM',
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
];

const PROGRAM_COLORS = [
  'rgba(124,58,237,0.35)',
  'rgba(37,99,235,0.35)',
  'rgba(236,72,153,0.35)',
  'rgba(16,185,129,0.35)',
  'rgba(245,158,11,0.35)',
  'rgba(239,68,68,0.35)',
  'rgba(99,102,241,0.35)',
  'rgba(14,165,233,0.35)',
];

const NOW_SLOT = 8;

export default function TVGuideScreen() {
  const [activeDate, setActiveDate] = useState(0);
  const timeScrollRef = useRef<ScrollView>(null);

  // Build date string for API
  const dateParam = useMemo(() => {
    if (activeDate === 0) return 'today';
    if (activeDate === 1) return 'tomorrow';
    return DATES[activeDate];
  }, [activeDate]);

  const { data: epgData, isLoading, isError, refetch } = useEPG({ date: dateParam });

  // Map API data to Channel format
  const channels: Channel[] = useMemo(() => {
    if (!epgData || !Array.isArray(epgData) || epgData.length === 0) return [];
    return epgData.map((ch: any, chIdx: number) => ({
      id: ch.id || `ch${chIdx + 1}`,
      name: ch.name || ch.channelName || 'Channel',
      logo: (ch.name || ch.channelName || 'CH').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      programs: (ch.programs || ch.schedule || []).map((p: any, pIdx: number) => ({
        id: p.id || `p${chIdx}-${pIdx}`,
        title: p.title || p.name || 'Program',
        startSlot: p.startSlot || p.slotIndex || pIdx * 2 + 4,
        durationSlots: p.durationSlots || Math.max(1, Math.round((p.duration || 60) / 30)),
        color: PROGRAM_COLORS[pIdx % PROGRAM_COLORS.length],
        isLive: p.isLive || p.isCurrentlyAiring || false,
      })),
    }));
  }, [epgData]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      timeScrollRef.current?.scrollTo({
        x: Math.max(0, (NOW_SLOT - 2) * SLOT_WIDTH),
        animated: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const renderChannelRow: ListRenderItem<Channel> = ({ item }) => (
    <View style={styles.channelRow}>
      {/* Channel Name (Sticky Left) */}
      <View style={styles.channelNameCell}>
        <LinearGradient colors={['#7C3AED', '#2563EB']} style={styles.channelLogo}>
          <Text style={styles.channelLogoText}>{item.logo}</Text>
        </LinearGradient>
        <Text style={styles.channelNameText} numberOfLines={1}>
          {item.name}
        </Text>
      </View>

      {/* Programs Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled
        contentContainerStyle={styles.programsScrollContent}
      >
        {/* Time Grid Lines */}
        <View style={styles.programsRow}>
          {TIME_SLOTS.map((_, slotIndex) => (
            <View key={slotIndex} style={[styles.slotColumn, { left: slotIndex * SLOT_WIDTH }]} />
          ))}

          {/* Program Blocks */}
          {item.programs.map((program) => (
            <TouchableOpacity
              key={program.id}
              style={[
                styles.programBlock,
                {
                  left: program.startSlot * SLOT_WIDTH,
                  width: program.durationSlots * SLOT_WIDTH - 4,
                  height: HALF_HOUR_HEIGHT * Math.min(program.durationSlots, 2) - 8,
                  backgroundColor: program.color,
                },
              ]}
              activeOpacity={0.7}
            >
              {program.isLive && (
                <View style={styles.programLiveRow}>
                  <View style={styles.programLiveDot} />
                  <Text style={styles.programLiveText}>LIVE</Text>
                </View>
              )}
              <Text style={styles.programTitle} numberOfLines={2}>
                {program.title}
              </Text>
            </TouchableOpacity>
          ))}

          {/* NOW Indicator */}
          <View style={[styles.nowIndicator, { left: NOW_SLOT * SLOT_WIDTH }]} />
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#F2F2F7" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>TV Guide</Text>
        <TouchableOpacity style={styles.searchButton} activeOpacity={0.7}>
          <Ionicons name="search" size={22} color="#F2F2F7" />
        </TouchableOpacity>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelectorContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateScrollContent}
        >
          {DATES.map((date, index) => (
            <TouchableOpacity
              key={date}
              style={[
                styles.datePill,
                activeDate === index && styles.datePillActive,
              ]}
              activeOpacity={0.7}
              onPress={() => setActiveDate(index)}
            >
              <Text
                style={[
                  styles.datePillText,
                  activeDate === index && styles.datePillTextActive,
                ]}
              >
                {date}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Time Header */}
      <View style={styles.timeHeaderRow}>
        <View style={styles.timeHeaderSpacer} />
        <ScrollView
          ref={timeScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeHeaderScroll}
        >
          {TIME_SLOTS.map((time, index) => (
            <View key={index} style={styles.timeSlotHeader}>
              <Text style={styles.timeSlotHeaderText}>{time}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* EPG Grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : isError ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="cloud-offline-outline" size={40} color="#6B6B80" />
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          renderItem={renderChannelRow}
          contentContainerStyle={styles.epgListContent}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
          ListHeaderComponent={
            <View style={styles.listHeaderSpacer} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070F',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#121A2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#F2F2F7',
    textAlign: 'center',
  },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#121A2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateSelectorContainer: {
    paddingLeft: 24,
    paddingBottom: 12,
  },
  dateScrollContent: {
    gap: 8,
    paddingRight: 24,
  },
  datePill: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#121A2F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  datePillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  datePillText: {
    fontSize: 14,
    color: '#B3B8C8',
    fontWeight: '600',
  },
  datePillTextActive: {
    color: '#F2F2F7',
  },
  timeHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  timeHeaderSpacer: {
    width: CHANNEL_HEADER_WIDTH + 24,
    flexShrink: 0,
  },
  timeHeaderScroll: {
    gap: 0,
  },
  timeSlotHeader: {
    width: SLOT_WIDTH,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  timeSlotHeaderText: {
    fontSize: 11,
    color: '#6B6B80',
    fontWeight: '500',
  },
  listHeaderSpacer: {
    backgroundColor: '#05070F',
  },
  epgListContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.15)',
    marginTop: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    fontFamily: 'Inter',
  },
  channelRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  channelNameCell: {
    width: CHANNEL_HEADER_WIDTH + 24,
    paddingLeft: 24,
    paddingRight: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  channelLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  channelLogoText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F2F2F7',
    letterSpacing: 0.5,
  },
  channelNameText: {
    fontSize: 11,
    color: '#B3B8C8',
    fontWeight: '500',
    textAlign: 'center',
  },
  programsScrollContent: {
    minWidth: TIME_SLOTS.length * SLOT_WIDTH,
  },
  programsRow: {
    height: HALF_HOUR_HEIGHT * 2,
    position: 'relative',
  },
  slotColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SLOT_WIDTH,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.04)',
  },
  programBlock: {
    position: 'absolute',
    top: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  programLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  programLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  programLiveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  programTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F2F2F7',
    lineHeight: 16,
  },
  nowIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#F97316',
    zIndex: 10,
  },
});