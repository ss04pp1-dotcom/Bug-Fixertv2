import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect,
  MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PresenceService, PresenceEntry } from './presence.service';

const ADMIN_ROOM = 'admin:presence';

interface IdentifyPayload {
  deviceType?:  'android' | 'ios' | 'web' | 'unknown';
  appVersion?:  string;
  platform?:    string;
  displayName?: string;
  email?:       string;
  avatarUrl?:   string;
}

interface HeartbeatPayload {
  currentScreen?: string;
  watchingType?:  'live' | 'movie' | 'series';
  watchingId?:    string;
  watchingTitle?: string;
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      const allowed = process.env.CORS_ORIGIN || '';
      if (!allowed || !origin || allowed.split(',').includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
  },
  namespace: '/ws',
})
export class SolTvGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private logger = new Logger(SolTvGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly presence: PresenceService,
    private readonly configService: ConfigService,
  ) {
    this.presence.onHeartbeatTimeout((socketId) => {
      this.broadcastPresenceRemove(socketId);
      this.broadcastStats();
    });
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────

  handleConnection(client: Socket): void {
    const payload = this.verifyToken(client);
    if (payload) {
      client.data.userId  = payload.sub as string;
      client.data.email   = payload.email as string;
      client.data.role    = payload.role as string;
      client.data.authed  = true;
    } else {
      // Reject the connection immediately — without a valid JWT the client cannot subscribe
      // to any event and keeping the socket open just wastes resources and creates an
      // opportunity for resource-exhaustion attacks.
      this.logger.warn(`Rejecting WebSocket connection ${client.id}: invalid or missing JWT`);
      client.disconnect(true);
      return;
    }
    client.data.ipAddress = (
      client.handshake.headers['x-forwarded-for'] ?? client.handshake.address ?? 'unknown'
    ) as string;

    client.emit('presence:ack', { socketId: client.id, timestamp: new Date().toISOString() });
    this.logger.log(`Connected: ${client.id} | authed: ${client.data.authed as boolean}`);
  }

  handleDisconnect(client: Socket): void {
    const removed = this.presence.remove(client.id);
    if (removed) {
      this.broadcastPresenceRemove(client.id);
      this.broadcastStats();
    }
    this.logger.log(`Disconnected: ${client.id}`);
  }

  // ── Presence — app users ───────────────────────────────────────────────────

  @SubscribeMessage('presence:identify')
  handleIdentify(@ConnectedSocket() client: Socket, @MessageBody() data: IdentifyPayload) {
    if (!client.data.authed) return { error: 'Unauthorized' };
    const entry: PresenceEntry = {
      socketId:       client.id,
      userId:         client.data.userId as string,
      displayName:    data.displayName ?? (client.data.email as string) ?? 'Unknown',
      email:          (client.data.email as string) ?? '',
      avatarUrl:      data.avatarUrl,
      role:           (client.data.role as string) ?? 'user',
      deviceType:     data.deviceType ?? 'unknown',
      appVersion:     data.appVersion,
      platform:       data.platform,
      ipAddress:      client.data.ipAddress as string,
      connectedAt:    new Date(),
      lastActivityAt: new Date(),
    };
    this.presence.add(entry);
    this.broadcastPresenceAdd(entry);
    this.broadcastStats();
    return { ok: true };
  }

  @SubscribeMessage('presence:heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket, @MessageBody() data: HeartbeatPayload) {
    if (!client.data.authed) return { error: 'Unauthorized' };
    const updated = this.presence.update(client.id, {
      currentScreen: data.currentScreen,
      watchingType:  data.watchingType,
      watchingId:    data.watchingId,
      watchingTitle: data.watchingTitle,
    });
    if (updated) {
      this.broadcastPresenceUpdate(updated);
      this.broadcastStats();
    }
    return { ok: true, ts: new Date().toISOString() };
  }

  @SubscribeMessage('presence:leave')
  handleLeave(@ConnectedSocket() client: Socket) {
    if (!client.data.authed) return { error: 'Unauthorized' };
    const removed = this.presence.remove(client.id);
    if (removed) {
      this.broadcastPresenceRemove(client.id);
      this.broadcastStats();
    }
    return { ok: true };
  }

  // ── Admin subscription ─────────────────────────────────────────────────────

  @SubscribeMessage('admin:subscribe')
  handleAdminSubscribe(@ConnectedSocket() client: Socket) {
    const role = client.data.role as string | undefined;
    if (role !== 'admin' && role !== 'super_admin') {
      return { error: 'Forbidden — admin role required' };
    }
    void client.join(ADMIN_ROOM);
    client.emit('presence:snapshot', this.presence.getAll());
    client.emit('presence:stats',    this.presence.getStats());
    this.logger.log(`Admin ${client.id} subscribed to presence room`);
    return { ok: true };
  }

  @SubscribeMessage('admin:unsubscribe')
  handleAdminUnsubscribe(@ConnectedSocket() client: Socket) {
    void client.leave(ADMIN_ROOM);
    return { ok: true };
  }

  // ── Channel rooms ──────────────────────────────────────────────────────────

  @SubscribeMessage('join_channel')
  handleJoinChannel(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: string }) {
    if (!client.data.authed) return { error: 'Unauthorized' };
    // Validate channelId — must be a non-empty string; reject anything that
    // could be used to join arbitrary room names (e.g. 'admin:presence').
    const channelId = String(data?.channelId ?? '').trim();
    if (!channelId || !/^[a-zA-Z0-9_-]+$/.test(channelId)) {
      return { error: 'Invalid channelId' };
    }
    void client.join(`channel:${channelId}`);
    const room = this.server.sockets.adapter.rooms.get(`channel:${channelId}`);
    this.server.to(`channel:${channelId}`).emit('viewer_count', {
      channelId, count: room?.size ?? 0,
    });
    return { event: 'joined', channelId };
  }

  @SubscribeMessage('leave_channel')
  handleLeaveChannel(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: string }) {
    if (!client.data.authed) return { error: 'Unauthorized' };
    void client.leave(`channel:${data.channelId}`);
    const room = this.server.sockets.adapter.rooms.get(`channel:${data.channelId}`);
    this.server.to(`channel:${data.channelId}`).emit('viewer_count', {
      channelId: data.channelId, count: room?.size ?? 0,
    });
    return { event: 'left', channelId: data.channelId };
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    if (!client.data.authed) return { error: 'Unauthorized' };
    return { event: 'pong', timestamp: new Date().toISOString() };
  }

  // ── Broadcast helpers ──────────────────────────────────────────────────────

  private broadcastPresenceAdd(entry: PresenceEntry): void {
    this.server.to(ADMIN_ROOM).emit('presence:update', { type: 'add', entry });
  }

  private broadcastPresenceUpdate(entry: PresenceEntry): void {
    this.server.to(ADMIN_ROOM).emit('presence:update', { type: 'update', entry });
  }

  private broadcastPresenceRemove(socketId: string): void {
    this.server.to(ADMIN_ROOM).emit('presence:update', { type: 'remove', socketId });
  }

  private broadcastStats(): void {
    this.server.to(ADMIN_ROOM).emit('presence:stats', this.presence.getStats());
    // Only emit online_count to authenticated sockets — broadcasting it to every
    // connected socket (including any unauthed/anonymous sockets if the gateway is
    // ever mounted publicly) leaks presence scale to untrusted clients.
    for (const socket of this.server.sockets.sockets.values()) {
      if (socket.data?.authed) {
        socket.emit('online_count', { count: this.presence.getOnlineCount() });
      }
    }
  }

  // ── Used by other services ─────────────────────────────────────────────────

  broadcastNotification(notification: Record<string, unknown>): void {
    // Only emit to authenticated sockets — unauthenticated connections must not
    // receive server-side notification payloads which may contain user-specific data.
    for (const socket of this.server.sockets.sockets.values()) {
      if (socket.data?.authed) {
        socket.emit('notification', notification);
      }
    }
  }

  broadcastToRoom(room: string, event: string, data: Record<string, unknown>): void {
    this.server.to(room).emit(event, data);
  }

  getOnlineCount(): number { return this.presence.getOnlineCount(); }

  // ── JWT token extractor ────────────────────────────────────────────────────

  private verifyToken(client: Socket): Record<string, unknown> | null {
    const authHeader = client.handshake.headers?.authorization as string | undefined;
    const authObj    = client.handshake.auth?.token as string | undefined;
    const raw = authHeader?.startsWith('Bearer ') ? authHeader.slice(7)
      : authObj?.startsWith('Bearer ') ? authObj.slice(7)
      : (authObj ?? null);
    if (!raw) return null;
    try {
      const secret = this.configService.get<string>('jwt.accessSecret');
      if (!secret) {
        this.logger.error('jwt.accessSecret is not configured — WebSocket token verification will always fail');
        return null;
      }
      return this.jwtService.verify(raw, { secret }) as Record<string, unknown>;
    } catch { return null; }
  }
}
