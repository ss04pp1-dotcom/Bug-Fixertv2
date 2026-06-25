import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useFeatureFlagsContext } from '@/app/_layout';
import { tokenStorage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function MainTabLayout() {
  const insets = useSafeAreaInsets();
  const flags = useFeatureFlagsContext();
  const sportsEnabled = flags['sports_enabled'] !== false;
  const liveTvEnabled = flags['live_tv_enabled'] !== false;
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        router.replace('/(auth)/login');
        return;
      }
      await checkAuth();
      setAuthChecked(true);
    })();
  }, []);

  useEffect(() => {
    if (authChecked && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [authChecked, isAuthenticated]);

  if (!authChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 60 + Math.max(insets.bottom, 8),
          backgroundColor: '#0D0D16',
          borderTopWidth: 1,
          borderTopColor: 'rgba(139,92,246,0.2)',
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          elevation: 0,
          shadowColor: '#8B5CF6',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        tabBarItemStyle: { flex: 1, paddingVertical: 2 },
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: '#4A4A5A',
        tabBarLabelStyle: { fontSize: 10, fontFamily: 'Inter', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon iconName={focused ? 'home' : 'home-outline'} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="live-tv"
        options={{
          title: 'Live TV',
          href: liveTvEnabled ? undefined : null,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon iconName={focused ? 'tv' : 'tv-outline'} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Movies',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon iconName={focused ? 'film' : 'film-outline'} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Sports',
          href: sportsEnabled ? undefined : null,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon iconName={focused ? 'football' : 'football-outline'} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon iconName={focused ? 'person' : 'person-outline'} focused={focused} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  iconName,
  focused,
  color,
  size,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  size: number;
}) {
  const scale = useSharedValue(focused ? 1 : 0.9);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.9, { damping: 15, stiffness: 200 });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.iconContainer, animatedStyle]}>
      {focused && (
        <View style={styles.activeBar}>
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
      <Ionicons name={iconName} size={size} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 30,
  },
  activeBar: {
    position: 'absolute',
    top: -8,
    width: 28,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
});
