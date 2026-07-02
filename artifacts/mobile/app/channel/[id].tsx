import React, { useMemo } from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChannel, useToggleFavorite, useFavorites } from '@/lib/api-hooks';
import { Config } from '@/constants/config';
import { useChannelAdGate } from '@/hooks/useChannelAdGate';

const C = {
  bg: '#0A0A0F',
  card: '#13131C',
  primary: '#8B5CF6',
  accent: '#EC4899',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  border: 'rgba(255,255,255,0.06)',
};

const getImageUrl = (path?: string) =>
  path ? Config.imageUrl(path) : 'https://images.unsplash.com/photo-1616530940355-351fabd9524b?w=400&h=400&fit=crop';

// M-003: backend sometimes returns channel.category as an object ({name, ...}) —
// never render that as a Text child.
const getCategoryName = (cat: any): string => {
  if (!cat) return 'Live TV';
  if (typeof cat === 'string') return cat;
  return cat.name || cat.title || 'Live TV';
};

export default function ChannelDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const { data: channel, isLoading } = useChannel(id as string);
  const { data: favorites } = useFavorites();
  const toggleFav = useToggleFavorite();

  // Smartlink gate — opens the configured Smartlink URL in an in-app browser
  // before navigating to the live player (if isSmartlinkEnabled is true).
  // Use the hook directly here because this screen lives outside the (main)
  // route group and therefore outside ChannelAdGateProvider's scope.
  const channelGate = useChannelAdGate();

  // M-027: derive favorite state from server data instead of always sending 'add'.
  const isFav = useMemo(() => (favorites || []).some((f: any) => f.id === id), [favorites, id]);

  const handleWatchLive = () => {
    if (!channel) return;
    const ch = channel as any;
    channelGate.requestChannel(ch.id || (id as string), {
      title:              ch.name || '',
      streamUrl:          ch.primaryStreamUrl || ch.streamUrl || '',
      logo:               ch.logoUrl || ch.logo || '',
      cat:                getCategoryName(ch.category),
      // Pass smartlink fields so the gate hook can open the Smartlink before playback
      isSmartlinkEnabled: ch.isSmartlinkEnabled === true,
      smartlinkUrl:       ch.smartlinkUrl || '',
    });
  };

  const handleToggleFav = () => {
    if (!channel) return;
    toggleFav.mutate({ type: 'channel', id: (channel as any).id, action: isFav ? 'remove' : 'add' });
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

  const ch = channel as any;
  const categoryName = getCategoryName(ch.category);
  const bannerUri = getImageUrl(ch.banner || ch.thumbnail || ch.logo);
  const logoUri   = getImageUrl(ch.logo);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      {/* Banner */}
      <View style={s.bannerWrap}>
        <Image source={{ uri: bannerUri }} style={s.bannerImg} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,15,0.85)', C.bg]}
          style={s.bannerGrad}
        />
        <TouchableOpacity
          onPress={() => router.back()}
          style={[s.backBtn, { top: insets.top + 8 }]}
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={s.content}>
        {/* Logo + Title row */}
        <View style={s.titleRow}>
          <Image source={{ uri: logoUri }} style={s.logo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{ch.name}</Text>
            <Text style={s.subtitle}>{categoryName}</Text>
          </View>
          <TouchableOpacity onPress={handleToggleFav} style={s.iconBtn}>
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={22}
              color={isFav ? '#EF4444' : C.textSec}
            />
          </TouchableOpacity>
        </View>

        {/* LIVE badge */}
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveTxt}>LIVE NOW</Text>
        </View>

        {/* Watch button */}
        <TouchableOpacity style={s.watchBtn} onPress={handleWatchLive} activeOpacity={0.85}>
          <LinearGradient
            colors={[C.primary, C.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.watchBtnGrad}
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={s.watchBtnTxt}>Watch Live</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Description */}
        {!!ch.description && (
          <Text style={s.description}>{ch.description}</Text>
        )}

        {/* Meta */}
        <View style={s.metaGrid}>
          {!!ch.language && (
            <View style={s.metaItem}>
              <Ionicons name="language-outline" size={15} color={C.textSec} />
              <Text style={s.metaTxt}>{ch.language}</Text>
            </View>
          )}
          {!!ch.country && (
            <View style={s.metaItem}>
              <Ionicons name="flag-outline" size={15} color={C.textSec} />
              <Text style={s.metaTxt}>{ch.country}</Text>
            </View>
          )}
          {!!ch.streamType && (
            <View style={s.metaItem}>
              <Ionicons name="radio-outline" size={15} color={C.textSec} />
              <Text style={s.metaTxt}>{ch.streamType}</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  loader:     { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },

  bannerWrap: { width: '100%', height: 260, position: 'relative' },
  bannerImg:  { width: '100%', height: '100%' },
  bannerGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 130 },
  backBtn: {
    position: 'absolute', left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center', alignItems: 'center',
  },

  content:  { paddingHorizontal: 20, paddingTop: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  logo:     { width: 60, height: 60, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  title:    { color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 2 },
  subtitle: { color: C.textSec, fontSize: 13 },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginBottom: 18,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },
  liveTxt: { color: '#EF4444', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  watchBtn:     { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  watchBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  watchBtnTxt:  { color: '#fff', fontSize: 16, fontWeight: '700' },

  description: { color: C.textSec, fontSize: 14, lineHeight: 21, marginBottom: 20 },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
  },
  metaTxt: { color: C.textSec, fontSize: 13 },
});
