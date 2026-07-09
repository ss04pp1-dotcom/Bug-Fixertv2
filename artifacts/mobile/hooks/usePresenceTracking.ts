import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';
import { SocketService } from '@/services/socket.service';

const HEARTBEAT_INTERVAL_MS = 30_000; // 30s — well within server's 90s timeout

/**
 * Manages WebSocket presence tracking for the authenticated user.
 *
 * Server auto-registers the user as online the moment the socket connects
 * (JWT is verified at handshake time). This hook:
 *  1. Connects the socket when user is authenticated
 *  2. Sends a heartbeat every 30s so the server doesn't time the user out
 *  3. Reconnects when the app returns to foreground (covers Render restarts
 *     that happened while the app was backgrounded)
 *  4. Disconnects cleanly on logout
 *
 * The socket.io client is configured with reconnectionAttempts: Infinity and
 * a dynamic auth callback that fetches a fresh token on every reconnect, so
 * expired JWTs never permanently block reconnection.
 */
export function usePresenceTracking() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);

  const generationRef    = useRef(0);
  const heartbeatRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const startHbRef       = useRef<() => void>(() => {});
  const stopHbRef        = useRef<() => void>(() => {});

  useEffect(() => {
    const generation = ++generationRef.current;

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const startHeartbeat = () => {
      if (heartbeatRef.current) return;
      heartbeatRef.current = setInterval(() => {
        if (SocketService.getSocket()?.connected) {
          SocketService.getSocket()?.emit('presence:heartbeat', { currentScreen: 'app' });
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    startHbRef.current = startHeartbeat;
    stopHbRef.current  = stopHeartbeat;

    if (!isAuthenticated || !userId) {
      stopHeartbeat();
      SocketService.disconnect();
      return;
    }

    const doConnect = async () => {
      try {
        const socket = await SocketService.connect();

        // Auth changed while we were awaiting — tear down immediately.
        if (generation !== generationRef.current) {
          socket.disconnect();
          return;
        }

        socket.on('connect',    startHbRef.current);
        socket.on('disconnect', stopHbRef.current);

        if (socket.connected) startHeartbeat();
      } catch (err) {
        if (__DEV__) console.warn('[Presence] Socket connect failed:', err);
      }
    };

    doConnect();

    // ── AppState: reconnect when app returns to foreground ────────────────────
    // Covers the case where Render restarted while the app was backgrounded.
    // socket.io's own reconnect logic handles short interruptions; this catches
    // the case where the socket gave up (max backoff reached) while backgrounded.
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active' && isAuthenticated && userId) {
        const sock = SocketService.getSocket();
        if (!sock?.connected) {
          doConnect();
        }
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      generationRef.current++;
      stopHbRef.current();

      const sock = SocketService.getSocket();
      if (sock) {
        sock.off('connect',    startHbRef.current);
        sock.off('disconnect', stopHbRef.current);
      }

      appStateSub.remove();
      SocketService.disconnect();
    };
  }, [isAuthenticated, userId]); // eslint-disable-line react-hooks/exhaustive-deps
}
