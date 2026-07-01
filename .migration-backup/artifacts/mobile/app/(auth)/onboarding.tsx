import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

interface Step {
  id: string;
  emoji: string;
  bg: string;
  badge: string;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  {
    id: '1',
    emoji: '🎬',
    bg: '#1a0b2e',
    badge: 'ENTERTAINMENT',
    title: 'Unlimited Entertainment',
    desc: 'Watch Movies, Series, Originals and more anytime.',
  },
  {
    id: '2',
    emoji: '⚽🏏',
    bg: '#0a1a3e',
    badge: 'LIVE SPORTS',
    title: 'Live Sports All Day, Every Day',
    desc: 'Cricket, Football, WWE, UFC and more.',
  },
  {
    id: '3',
    emoji: '📲',
    bg: '#1f132e',
    badge: 'DOWNLOAD',
    title: 'Download & Watch Anywhere',
    desc: 'Save and watch offline anytime. Multi-device support.',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentIdx, setCurrentIdx] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const goNext = () => {
    if (currentIdx < STEPS.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      flatRef.current?.scrollToIndex({ index: nextIdx, animated: true });
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    setCurrentIdx(Math.round(x / W));
  };

  return (
    <View style={s.screen}>
      <FlatList
        ref={flatRef}
        data={STEPS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[s.slide, { backgroundColor: item.bg }]}>
            <View style={s.emojiContainer}>
              <Text style={s.emoji}>{item.emoji}</Text>
            </View>
            <View style={s.content}>
              <View style={s.badge}>
                <Text style={s.badgeTxt}>{item.badge}</Text>
              </View>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.desc}>{item.desc}</Text>
            </View>
          </View>
        )}
      />
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={s.dots}>
          {STEPS.map((_, i) => (
            <LinearGradient
              key={i}
              colors={i === currentIdx ? ['#8B5CF6', '#EC4899'] : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.2)']}
              start={{x:0,y:0}} end={{x:1,y:0}}
              style={[s.dot, i === currentIdx && s.dotActive]}
            />
          ))}
        </View>
        <Pressable onPress={goNext} style={s.btn}>
          <LinearGradient colors={['#8B5CF6', '#EC4899']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btnGrad}>
            <Text style={s.btnTxt}>{currentIdx === STEPS.length - 1 ? 'Get Started' : 'Next'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0F' },
  slide: { width: W, flex: 1, alignItems: 'center', justifyContent: 'center' },
  emojiContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  emoji: { fontSize: 150 },
  content: { paddingHorizontal: 32, width: '100%' },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  badgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1, fontFamily: 'Inter' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', fontFamily: 'Outfit', marginBottom: 16, lineHeight: 40 },
  desc: { fontSize: 16, color: '#A1A1AA', fontFamily: 'Inter', lineHeight: 24 },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 32,
    backgroundColor: 'rgba(10,10,15,0.8)',
    paddingTop: 20,
  },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 24, justifyContent: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  btn: { borderRadius: 16, overflow: 'hidden' },
  btnGrad: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 18, fontWeight: '700', fontFamily: 'Inter' },
});
