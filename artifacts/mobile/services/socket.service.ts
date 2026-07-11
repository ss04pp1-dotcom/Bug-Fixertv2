import { io, Socket } from 'socket.io-client';
import { Config } from '../constants/config';
import { tokenStorage } from '../lib/api';

let socket: Socket | null = null;

export const SocketService = {
  connect: async (): Promise<Socket> => {
    // Reuse existing connected socket — avoids duplicate connections and listener leaks.
    if (socket?.connected) return socket;

    if (socket) {
      // Instance exists but disconnected — update auth token before reconnecting
      // so an expired JWT doesn't get the connection immediately rejected.
      const fresh = await tokenStorage.getAccessToken();
      socket.auth = { token: fresh };
      socket.connect();
      return socket;
    }

    // Fresh socket — use a callback for `auth` so socket.io calls it before
    // EVERY connection attempt (initial + all reconnects). This guarantees
    // each reconnect uses a fresh, non-expired access token even after the
    // original 15-minute JWT window has passed.
    socket = io(`${Config.WS_URL}/ws`, {
      auth: async (cb: (data: { token: string | null }) => void) => {
        const token = await tokenStorage.getAccessToken();
        cb({ token });
      },
      // Some carriers/corporate networks and proxies in front of Render block a
      // raw WebSocket upgrade from React Native's WS client while still allowing
      // HTTP long-polling. Admin (browser) already falls back to 'polling'; the
      // mobile client only offered 'websocket', so on those networks the socket
      // never connects (silently — connect_error fires but the UI has no visible
      // WS status), which reads as "app never gets live viewer/presence updates".
      transports: ['websocket', 'polling'],
      reconnection: true,
      // No upper limit on attempts — server restarts on Render's free tier
      // are frequent; a 5-attempt cap means mobile users never reconnect.
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 30_000, // cap at 30s so we don't wait forever
      randomizationFactor: 0.4,
    });

    if (__DEV__) {
      socket.on('connect',       () => console.log('[Socket] Connected', socket?.id));
      socket.on('disconnect',    (r) => console.log('[Socket] Disconnected:', r));
      socket.on('connect_error', (e) => console.warn('[Socket] Error:', e.message));
    }

    return socket;
  },

  disconnect: () => {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  },

  getSocket: () => socket,

  onPresence: (handler: (data: { userId: string; online: boolean }) => void) => {
    socket?.on('presence', handler);
    return () => { socket?.off('presence', handler); };
  },

  onLiveViewers: (handler: (data: { channelId: string; count: number }) => void) => {
    socket?.on('viewer_count', handler);
    return () => { socket?.off('viewer_count', handler); };
  },

  onMatchUpdate: (handler: (data: { matchId: string; score: unknown; event: string }) => void) => {
    socket?.on('match_update', handler);
    return () => { socket?.off('match_update', handler); };
  },

  joinChannel: (channelId: string) => {
    socket?.emit('join_channel', { channelId });
  },

  leaveChannel: (channelId: string) => {
    socket?.emit('leave_channel', { channelId });
  },

  /** Call when user starts watching content — updates admin live-users page. */
  startWatching: (opts: {
    type: 'live' | 'movie' | 'series';
    id: string;
    title: string;
    screen: string;
  }) => {
    socket?.emit('presence:heartbeat', {
      currentScreen:  opts.screen,
      watchingType:   opts.type,
      watchingId:     opts.id,
      watchingTitle:  opts.title,
    });
  },

  /** Call when user stops watching (leaves player screen). */
  stopWatching: (screen = 'app') => {
    socket?.emit('presence:heartbeat', {
      currentScreen:  screen,
      watchingType:   undefined,
      watchingId:     undefined,
      watchingTitle:  undefined,
    });
  },
};
