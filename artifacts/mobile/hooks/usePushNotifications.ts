/**
 * usePushNotifications
 *
 * Responsibilities:
 *  1. Request OS permission for push notifications (once per install).
 *  2. Obtain the native device push token (FCM on Android, APNs on iOS)
 *     and register it with the backend via PUT /auth/profile.
 *  3. Configure the foreground handler so notifications appear as banners
 *     even while the app is open / video is playing.
 *  4. Listen for notification taps and navigate to the deepLink if present.
 *
 * Mount this hook once inside AppGuards (_layout.tsx).
 * It self-silences when the user is not logged in.
 */
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

const TOKEN_STORE_KEY = 'sol_tv_fcm_token';

// ── Foreground display config ─────────────────────────────────────────────────
// Show as banner + play sound + update badge even while the app is in the
// foreground (e.g. while a live stream is playing).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Android channel ───────────────────────────────────────────────────────────
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'SOL TV',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor:       '#8B5CF6',
    sound:            'default',
    showBadge:        true,
  });
}

// ── Permission + token registration ──────────────────────────────────────────
async function registerForPushNotifications(): Promise<string | null> {
  await ensureAndroidChannel();

  // PermissionResponse.granted comes from expo's base type — cast needed
  // because TypeScript can't always resolve the transitive expo export.
  const existingPerms = (await Notifications.getPermissionsAsync()) as unknown as { granted: boolean };
  let granted = existingPerms.granted;

  if (!granted) {
    const newPerms = (await Notifications.requestPermissionsAsync()) as unknown as { granted: boolean };
    granted = newPerms.granted;
  }

  if (!granted) {
    return null; // user denied — don't crash
  }

  try {
    // getDevicePushTokenAsync() returns the native token:
    //   Android → FCM registration token (what the backend sends via firebase-admin)
    //   iOS     → APNs device token
    const { data } = await Notifications.getDevicePushTokenAsync();
    return data ?? null;
  } catch (err) {
    if (__DEV__) console.warn('[push] getDevicePushTokenAsync failed:', err);
    return null;
  }
}

async function sendTokenToServer(token: string): Promise<void> {
  try {
    const stored = await SecureStore.getItemAsync(TOKEN_STORE_KEY);
    if (stored === token) return; // already registered, skip unnecessary PUT

    await apiClient.put('/auth/profile', { fcmToken: token });
    await SecureStore.setItemAsync(TOKEN_STORE_KEY, token);
    if (__DEV__) console.log('[push] FCM token registered with server');
  } catch (err) {
    if (__DEV__) console.warn('[push] Failed to register token with server:', err);
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePushNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);

  // Register token whenever authentication state flips to true
  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotifications().then((token) => {
      if (token) sendTokenToServer(token);
    });
  }, [isAuthenticated]);

  // Listen for token refresh (FCM rotates tokens occasionally)
  useEffect(() => {
    const sub = Notifications.addPushTokenListener(({ data: token }) => {
      if (token && isAuthenticated) sendTokenToServer(token as string);
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  // Handle taps on notifications — navigate to deepLink if present
  useEffect(() => {
    // Tapped while app is open (foreground)
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const link =
          response.notification.request.content.data?.deepLink as string | undefined;
        if (link) {
          try { router.push(link as any); } catch {}
        }
      },
    );

    // Tapped from background/killed state (cold-start via notification)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const link =
        response.notification.request.content.data?.deepLink as string | undefined;
      if (link) {
        try { router.push(link as any); } catch {}
      }
    });

    return () => {
      responseListenerRef.current?.remove();
    };
  }, []);
}
