import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDownloads, useDownloadStats, useDeleteDownload, useClearCompletedDownloads } from '@/lib/api-hooks';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#FF3B30',
};

const GRADIENTS: [string, string][] = [
  ['#3D1A5C','#1a0535'],['#1a2a4a','#0a1525'],['#4a1515','#200505'],
  ['#1a3a2a','#0a1a10'],['#2a1a0a','#100800'],
];

const TABS = ['All', 'Movies', 'Series', 'Completed'];

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const { data: downloadsData, isLoading, refetch } = useDownloads();
  const { data: statsData } = useDownloadStats();
  const deleteDownload = useDeleteDownload();
  const clearCompleted = useClearCompletedDownloads();

  const [activeTab, setActiveTab] = useState('All');

  const downloads = (downloadsData && Array.isArray(downloadsData))
    ? downloadsData.map((d: any, i: number) => ({
        id: d.id || String(i),
        title: d.title || d.movie?.title || `Download ${i + 1}`,
        info: d.fileSize || d.size || '',
        quality: d.quality || '1080p',
        status: d.status || 'completed',
        progress: d.progress ?? 0,
        type: d.contentType || d.type || 'movie',
        g: GRADIENTS[i % GRADIENTS.length],
      }))
    : [];

  const filteredDownloads = downloads.filter(d => {
    if (activeTab === 'Movies') return d.type === 'movie';
    if (activeTab === 'Series') return d.type === 'series';
    if (activeTab === 'Completed') return d.status === 'completed';
    return true;
  });

  const storageUsed = statsData?.used || '0 GB';
  const storageTotal = statsData?.total || '0 GB';
  const storagePercent = statsData?.percent || 0;

  const handleDelete = (id: string) => {
    Alert.alert('Delete Download', 'Are you sure you want to delete this download?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDownload.mutate(id) },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear Completed', 'Remove all completed downloads?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearCompleted.mutate() },
    ]);
  };

  const statusColor = (status: string) => {
    if (status === 'completed') return C.success;
    if (status === 'downloading') return C.primary;
    if (status === 'paused') return C.warning;
    return C.textSec;
  };

  const statusLabel = (status: string) => {
    if (status === 'completed') return 'Completed';
    if (status === 'downloading') return 'Downloading';
    if (status === 'paused') return 'Paused';
    return status;
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Downloads</Text>
        <TouchableOpacity onPress={handleClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.editTxt}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Storage Bar */}
      <View style={s.storageCard}>
        <View style={s.storageRow}>
          <Text style={s.storageLabel}>Storage</Text>
          <Text style={s.storageValue}>{storageUsed} / {storageTotal}</Text>
        </View>
        <View style={s.storageTrack}>
          <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:0}}
            style={[s.storageBar, { width: `${storagePercent * 100}%` as any }]} />
        </View>
      </View>

      {/* Tabs */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsContainer}>
          {TABS.map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[s.tab, activeTab === tab && s.tabActive]}
            >
              {activeTab === tab ? (
                <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.tabActiveGrad}>
                  <Text style={s.tabTextActive}>{tab}</Text>
                </LinearGradient>
              ) : (
                <Text style={s.tabText}>{tab}</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={s.loader}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filteredDownloads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={s.downloadRow}>
              {/* Thumbnail */}
              <LinearGradient colors={item.g} style={s.thumb}>
                <Ionicons name="film-outline" size={24} color="rgba(255,255,255,0.5)" />
              </LinearGradient>

              {/* Info */}
              <View style={s.infoArea}>
                <Text style={s.downloadTitle} numberOfLines={1}>{item.title}</Text>
                <View style={s.metaRow}>
                  <View style={s.qualityChip}><Text style={s.qualityTxt}>{item.quality}</Text></View>
                  <Text style={s.downloadInfo}>{item.info}</Text>
                </View>
                
                {item.status !== 'completed' && (
                  <View style={s.progressTrack}>
                    <LinearGradient 
                      colors={statusColor(item.status) === C.primary ? [C.primary, C.accent] : [statusColor(item.status), statusColor(item.status)]} 
                      start={{x:0,y:0}} end={{x:1,y:0}}
                      style={[s.progressBar, { width: `${item.progress * 100}%` as any }]} 
                    />
                  </View>
                )}
                <Text style={[s.statusTxt, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
              </View>

              {/* Actions */}
              <View style={s.actions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={20} color={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={() => (
             <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Ionicons name="download-outline" size={48} color={C.textSec} />
                <Text style={{ color: C.textSec, marginTop: 12, fontFamily: 'Inter' }}>No downloads found</Text>
             </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text, fontFamily: 'Outfit' },
  editTxt: { fontSize: 15, fontWeight: '600', color: C.primary, fontFamily: 'Inter' },

  storageCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  storageLabel: { fontSize: 14, fontWeight: '600', color: C.text, fontFamily: 'Inter' },
  storageValue: { fontSize: 13, color: C.textSec, fontFamily: 'Inter' },
  storageTrack: { height: 6, backgroundColor: '#1E1E2E', borderRadius: 3, overflow: 'hidden' },
  storageBar: { height: 6, borderRadius: 3 },

  tabsContainer: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tabActive: { padding: 0, borderWidth: 0 },
  tabActiveGrad: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  tabText: { color: C.textSec, fontSize: 13, fontWeight: '600', fontFamily: 'Inter' },
  tabTextActive: { color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: 'Inter' },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  downloadRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, padding: 12, gap: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  thumb: { width: 60, height: 80, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoArea: { flex: 1, gap: 4 },
  downloadTitle: { fontSize: 15, fontWeight: '700', color: C.text, fontFamily: 'Inter' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  qualityChip: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  qualityTxt: { fontSize: 10, fontWeight: '700', color: C.text, fontFamily: 'Inter' },
  downloadInfo: { fontSize: 12, color: C.textSec, fontFamily: 'Inter' },
  progressTrack: { height: 4, backgroundColor: '#2A2A3A', borderRadius: 2, marginVertical: 4, overflow: 'hidden' },
  progressBar: { height: 4, borderRadius: 2 },
  statusTxt: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,59,48,0.1)', alignItems: 'center', justifyContent: 'center' },
});
