import React, { useEffect, createContext, useContext } from 'react';
import { View, Text, StyleSheet, Linking, ActivityIndicator, Platform } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import apiClient from '@/lib/api';
// FIX 8: checkAuth import করো — app startup এ auth state initialize হবে
import { useAuthStore } from '@/lib/auth-store';

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
  // FIX 8: App start এ auth state check করো
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const { data: forceUpdate } = useQuery({
    queryKey: ['force-update'],
    queryFn: () => apiClient.get('/force-update/check', { params: { version: '2.4.1', platform: 'ios' } }).then(unwrap),
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  const { data: geoCheck } = useQuery({
    queryKey: ['geo-check'],
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
    if (forceUpdate?.required && Platform.OS !== 'web') {
      import('react-native').then(({ Alert }) => {
        Alert.alert(
          'Update Required',
          'A new version of StreamPro is available. Please update to continue.',
          [{ text: 'Update Now', onPress: () => Linking.openURL(forceUpdate.storeUrl || 'https://streampro.app') }],
          { cancelable: false }
        );
      });
    }
  }, [forceUpdate?.required]);

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
          StreamPro is not currently available in your country.{'\n'}
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
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <View style={styles.container}>
          <AppGuards>
            <Slot />
          </AppGuards>
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
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
