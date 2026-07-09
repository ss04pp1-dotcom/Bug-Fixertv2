import React, { useEffect, createContext, useContext } from 'react';
import { View, Text, StyleSheet, Linking, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import OtaUpdateBanner from '@/components/OtaUpdateBanner';
import GlobalVideoPlayer from '@/components/GlobalVideoPlayer';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import apiClient, { setUnauthenticatedHandler } from '@/lib/api';
import { Config } from '@/constants/config';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';
import { useDeepLink } from '@/hooks/useDeepLink';
import { usePushNotifications } from '@/hooks/usePushNotifications';
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

// ─── Feature Flags Context ────────────────────────────────────────────────────
interface FeatureFlags {
  [key: string]: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlags>({});
export const useFeatureFlagsContext = () => useContext(FeatureFlagsContext);

// ─── App Guards (inside QueryClientProvider) ──────────────────────────────────
function AppGuards({ children }: { children: React.ReactNode }) {
  const unwrap = (r: any) => r?.data?.data;

  // Track user presence for live-user count in admin dashboard
  usePresenceTracking();
  // Handle incoming deep links (cold-start, foreground, post-login flush)
  useDeepLink();
  // Register device for push notifications + foreground banner handler
  usePushNotifications();

  useEffect(() => {
    // Register safe navigation handler now that router is mounted.
    // checkAuth() is intentionally NOT called here — the splash screen
    // owns the initial auth check and navigation to avoid race conditions.
    setUnauthenticatedHandler(() => {
      try { router.replace('/(auth)/login'); } catch {}
    });
  }, []);

  const { data: forceUpdate } = useQuery({
    queryKey: ['force-update', 'app-guard'],
    queryFn: () => apiClient.get('/force-update/check', { params: { version: Config.APP_VERSION, platform: Platform.OS === 'ios' ? 'ios' : 'android' } }).then(unwrap),
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  const { data: geoCheck } = useQuery({
    queryKey: ['geo-check', 'app-guard'],
    queryFn: async () => {
      try {
        const Localization = await import('expo-localization');
        const locales = Localization.getLocales ? Localization.getLocales() : [];
        const country = (locales[0]?.regionCode || 'US').toUpperCase();
        return apiClient.get(`/geo-block/check/${country}`).then(unwrap);
      } catch {
        return apiClient.get('/geo-block/check/US').then(unwrap);
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  const { data: flagsData } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => apiClient.get('/feature-flags/enabled').then(unwrap),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (forceUpdate?.needsUpdate) {
      import('react-native').then(({ Alert }) => {
        Alert.alert(
          'Update Required',
          forceUpdate.message || 'A new version is available. Please update to continue.',
          [{ text: 'Update Now', onPress: () => Linking.openURL(forceUpdate.storeUrl || 'https://soltv.app') }],
          { cancelable: false }
        );
      });
    }
  }, [forceUpdate?.needsUpdate]);

  const flags: FeatureFlags = React.useMemo(() => {
    if (!Array.isArray(flagsData)) return {};
    return flagsData.reduce((acc: FeatureFlags, flag: { key?: string; name?: string; isEnabled: boolean }) => {
      const k = flag.key || flag.name || '';
      if (k) acc[k] = flag.isEnabled;
      return acc;
    }, {});
  }, [flagsData]);

  if (geoCheck?.blocked) {
    return (
      <View style={styles.blockedContainer}>
        <Text style={styles.blockedIcon}>🌐</Text>
        <Text style={styles.blockedTitle}>Not Available in Your Region</Text>
        <Text style={styles.blockedSub}>
          SOL TV is not currently available in your country.{'\n'}
          Contact support for more information.
        </Text>
      </View>
    );
  }

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <View style={styles.container}>
            <AppGuards>
              <Stack screenOptions={{ headerShown: false }} />
            </AppGuards>
            <OtaUpdateBanner />
            <GlobalVideoPlayer />
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070F',
  },
  blockedContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  blockedIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  blockedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  blockedSub: {
    fontSize: 15,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 22,
  },
});
