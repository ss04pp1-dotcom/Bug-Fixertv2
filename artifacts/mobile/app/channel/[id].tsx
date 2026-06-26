import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveChannels, useToggleFavorite } from '@/lib/api-hooks';
import { Config } from '@/constants/config';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  border: 'rgba(255,255,255,0.06)',
};

const getImageUrl = (path?: string) => path ? Config.imageUrl(path) : 'https://images.unsplash.com/photo-1616530940355-351fabd9524b?w=400&h=400&fit=crop';

export default function ChannelDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const { data: channelsData, isLoading } = useLiveChannels();
  const toggleFav = useToggleFavorite();
  
  const channel = (channelsData || []).find((c: any) => c.id === id);

  const handleWatchLive = () => {
    if (!channel) return;
    router.push({
      pathname: `/live-player/${id}` as any,
      params: {
        title:     (channel as any).name || '',
        streamUrl: (channel as any).primaryStreamUrl || (channel as any).streamUrl || '',
        logo:      (channel as any).logoUrl || (channel as any).logo || '',
        cat:       (channel as any).category?.name || (channel as any).category || 'Live TV',
      },
    });
  };

  const handleToggleFav = () => {
    if (!channel) return;
    toggleFav.mutate({ type: 'channel', id: channel.id, action: 'add' });
  };

  if (isLoading) {
    return <View style={s.loader}><ActivityIndicator color={C.primary} size="large" /></View>;
  }

  if (!channel) {
    return (
      <View style={s.loader}>
        <TouchableOpacity onPress={() => router.back()} style={[s.iconBtn, { position: 'absolute', top: 60, left: 16 }]}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Ionicons name="tv-outline" size={48} color={C.textSec} />
        <Text style={{ color: C.textSec, fontSize: 16, fontFamily: 'Inter', marginTop: 16 }}>Channel not found</Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Banner Area */}
        <View style={s.bannerArea}>
          <LinearGradient colors={['rgba(0,0,0,0.8)', 'transparent', C.bg]} style={s.bannerGradient} />
          
          {/* Header over banner */}
          <View style={[s.header, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
              <Ionicons name="chevron-back" size={24} color={C.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleToggleFav} style={s.iconBtn}>
              <Ionicons name="heart-outline" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          
          <View style={s.logoContainer}>
            {channel.logoUrl ? (
              <Image source={{ uri: getImageUrl(channel.logoUrl) }} style={s.logo} />
            ) : (
              <LinearGradient colors={[C.primary, C.accent]} style={s.logoFallback}>
                <Text style={s.logoFallbackTxt}>{channel.name.slice(0, 2).toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={s.liveBadge}>
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>LIVE</Text>
            </View>
          </View>
        </View>

        <View style={s.contentArea}>
          <Text style={s.channelName}>{channel.name}</Text>
          <Text style={s.channelCategory}>{channel.category} • Bangladesh</Text>
          <Text style={s.description}>{channel.description || 'Watch live broadcasting 24/7.'}</Text>
          
          {/* Program Guide */}
          <Text style={s.sectionTitle}>Schedule</Text>
          
          <View style={s.programCard}>
            <View style={s.programTime}>
              <Text style={s.timeTxt}>Now</Text>
              <View style={s.activeLine} />
            </View>
            <View style={s.programInfo}>
              <Text style={s.programTitle}>{channel.currentProgram || 'Current Program'}</Text>
              <Text style={s.programDesc}>Live Broadcast</Text>
            </View>
          </View>
          
          <View style={[s.programCard, { opacity: 0.6 }]}>
            <View style={s.programTime}>
              <Text style={s.timeTxt}>Next</Text>
              <View style={[s.activeLine, { backgroundColor: 'transparent' }]} />
            </View>
            <View style={s.programInfo}>
              <Text style={s.programTitle}>{channel.nextProgram || 'Upcoming Program'}</Text>
              <Text style={s.programDesc}>Scheduled</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Button */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom || 24 }]}>
        <TouchableOpacity onPress={handleWatchLive} style={s.watchBtn}>
          <LinearGradient colors={[C.primary, C.accent]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.watchBtnGrad}>
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={s.watchBtnTxt}>Watch Live</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  loader: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  
  bannerArea: { height: 320, backgroundColor: '#1E1E2E', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  bannerGradient: { ...StyleSheet.absoluteFillObject },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  
  logoContainer: { alignItems: 'center', marginTop: 40 },
  logo: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: 'rgba(255,255,255,0.1)' },
  logoFallback: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.1)' },
  logoFallbackTxt: { fontSize: 40, fontWeight: '800', color: '#fff', fontFamily: 'Outfit' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: -14, borderWidth: 2, borderColor: C.bg },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 6 },
  liveTxt: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  
  contentArea: { padding: 24, paddingBottom: 100 },
  channelName: { fontSize: 28, fontWeight: '800', color: C.text, fontFamily: 'Outfit', textAlign: 'center', marginBottom: 6 },
  channelCategory: { fontSize: 14, color: C.textSec, fontFamily: 'Inter', textAlign: 'center', marginBottom: 20 },
  description: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter', lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  
  sectionTitle: { fontSize: 18, fontWeight: '700', color: C.text, fontFamily: 'Outfit', marginBottom: 16 },
  
  programCard: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  programTime: { width: 60, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: C.border, marginRight: 16 },
  timeTxt: { fontSize: 14, fontWeight: '700', color: C.primary, fontFamily: 'Inter', marginBottom: 8 },
  activeLine: { width: 2, height: 20, backgroundColor: C.primary, borderRadius: 1 },
  programInfo: { flex: 1, justifyContent: 'center' },
  programTitle: { fontSize: 16, fontWeight: '600', color: C.text, fontFamily: 'Inter', marginBottom: 4 },
  programDesc: { fontSize: 13, color: C.textSec, fontFamily: 'Inter' },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,10,15,0.9)', paddingHorizontal: 24, paddingTop: 16 },
  watchBtn: { borderRadius: 16, overflow: 'hidden' },
  watchBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  watchBtnTxt: { fontSize: 18, fontWeight: '700', color: '#fff', fontFamily: 'Inter' },
});
