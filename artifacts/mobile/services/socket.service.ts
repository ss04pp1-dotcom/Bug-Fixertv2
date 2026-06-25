import { io, Socket } from 'socket.io-client';
import { Config } from '../constants/config';
import { tokenStorage } from '../lib/api';

let socket: Socket | null = null;

export const SocketService = {
  connect: async (): Promise<Socket> => {
    if (socket?.connected) return socket;
    const token = await tokenStorage.getAccessToken();
    // FIX: namespace '/ws' যোগ করতে হবে — server uses @WebSocketGateway({ namespace: '/ws' })
    socket = io(`${Config.WS_URL}/ws`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    if (__DEV__) {
      socket.on('connect', () => console.log('[Socket] Connected'));
      socket.on('disconnect', () => console.log('[Socket] Disconnected'));
      socket.on('connect_error', (err) => console.warn('[Socket] Error:', err.message));
    }
    return socket;
  },

  disconnect: () => {
    socket?.disconnect();
    socket = null;
  },

  getSocket: () => socket,

  onPresence: (handler: (data: { userId: string; online: boolean }) => void) => {
    socket?.on('presence', handler);
    return () => { socket?.off('presence', handler); };
  },

  // FIX: server emits 'viewer_count' (not 'live_viewers') — event name ঠিক করা হয়েছে
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
};
