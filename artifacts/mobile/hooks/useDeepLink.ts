import { useEffect } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { parseDeepLink, PendingLink, isPublicPath } from '@/lib/deeplink';

/**
 * Navigate to a parsed deep-link path.
 *
 * If the target requires auth and the user is not yet logged in, the path is
 * saved in PendingLink and the login screen handles flushing it after auth.
 */
function routeTo(path: string, isAuthenticated: boolean) {
  if (!isAuthenticated && !isPublicPath(path)) {
    PendingLink.set(path);
    return; // auth flow will consume it after login
  }
  try {
    router.push(path as any);
  } catch {
    // router may not be ready on cold start; expo-router's own initialURL
    // handling picks it up automatically in that case.
  }
}

/**
 * Handles all incoming deep links for the app.
 *
 * Three cases are covered:
 *  1. Cold-start URL  — app was launched by tapping a link while closed
 *  2. Foreground URL  — app already open; system delivers the link
 *  3. Post-auth flush — user logged in; navigate to the link they originally tapped
 *
 * Place this hook once inside AppGuards (root layout), inside QueryClientProvider.
 */
export function useDeepLink() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // ── 1. Cold-start: resolve the URL that launched the app ─────────────────
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      const path = parseDeepLink(url);
      if (path) routeTo(path, isAuthenticated);
    });
    // Run once on mount only — isAuthenticated is intentionally excluded so
    // we don't re-process the initial URL on every auth state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Foreground: subscribe to links while the app is open ──────────────
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const path = parseDeepLink(url);
      if (path) routeTo(path, isAuthenticated);
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  // ── 3. Post-auth flush: navigate to the saved pending link after login ───
  useEffect(() => {
    if (!isAuthenticated) return;
    const pending = PendingLink.get();
    if (!pending) return;
    PendingLink.clear();
    try {
      router.push(pending as any);
    } catch {}
  }, [isAuthenticated]);
}
