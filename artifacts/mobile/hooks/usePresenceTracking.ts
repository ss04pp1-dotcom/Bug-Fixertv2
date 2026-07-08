import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { SocketService } from '@/services/socket.service';

const HEARTBEAT_INTERVAL_MS = 30_000; // 30s — well within server's 90s timeout

/**
 * Manages WebSocket presence tracking for the authenticated user.
 *
 * Server auto-registers the user as online the moment the socket connects
 * (JWT is verified at handshake time). This hook only needs to:
 *  1. Connect the socket when user is authenticated
 *  2. Send a heartbeat every 30s so the server doesn't time the user out
 *  3. Disconnect when the user logs out
 *
 * Race safety: a generation counter ensures that if auth flips to logged-out
 * while connect() is still in flight, the stale completion immediately
 * disconnects the newly created socket instead of leaving it alive.
 *
 * Heartbeat lifecycle: interval is tied to socket connect/disconnect events
 * so timers are never orphaned across reconnects or transient disconnects.
 */
export function usePresenceTracking() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);

  // Incremented each time the effect re-runs so stale async completions can
  // detect they are no longer the "current" session and self-abort.
  const generationRef = useRef(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable refs for socket event listeners so they can be removed on cleanup.
  const startHeartbeatRef = useRef<() => void>(() => {});
  const stopHeartbeatRef  = useRef<() => void>(() => {});

  useEffect(() => {
    const generation = ++generationRef.current;

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const startHeartbeat = () => {
      if (heartbeatRef.current) return; // already running
      heartbeatRef.current = setInterval(() => {
        if (SocketService.getSocket()?.connected) {
          SocketService.getSocket()?.emit('presence:heartbeat', { currentScreen: 'app' });
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    // Keep stable refs so the cleanup closure can remove the same function
    // instances that were added as listeners.
    startHeartbeatRef.current = startHeartbeat;
    stopHeartbeatRef.current  = stopHeartbeat;

    if (!isAuthenticated || !userId) {
      stopHeartbeat();
      SocketService.disconnect();
      return;
    }

    (async () => {
      try {
        const socket = await SocketService.connect();

        // Auth may have changed while we were awaiting — immediately tear down
        // the socket we just created and bail out.
        if (generation !== generationRef.current) {
          socket.disconnect();
          return;
        }

        // Tie heartbeat lifecycle to actual socket connect/disconnect events.
        socket.on('connect',    startHeartbeat);
        socket.on('disconnect', stopHeartbeat);

        if (socket.connected) startHeartbeat();
      } catch (err) {
        if (__DEV__) console.warn('[Presence] Socket connect failed:', err);
      }
    })();

    return () => {
      // Bump generation so any in-flight connect() self-aborts.
      generationRef.current++;
      stopHeartbeatRef.current();

      const sock = SocketService.getSocket();
      if (sock) {
        sock.off('connect',    startHeartbeatRef.current);
        sock.off('disconnect', stopHeartbeatRef.current);
      }
      SocketService.disconnect();
    };
  }, [isAuthenticated, userId]); // eslint-disable-line react-hooks/exhaustive-deps
}
