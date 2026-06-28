import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);
    if (!token) throw new WsException('No authentication token provided');

    const secret = this.configService.get<string>('jwt.accessSecret');
    if (!secret) throw new WsException('Server misconfiguration: JWT secret not set');

    try {
      const payload = this.jwtService.verify(token, { secret });
      client.data.user = payload;
      return true;
    } catch {
      throw new WsException('Invalid or expired token');
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers?.authorization as string | undefined;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    // Prefer handshake.auth.token (sent via { auth: { token } } option in socket.io client)
    // over query string to avoid tokens leaking in server logs, proxy logs, and browser history.
    const authToken = client.handshake.auth?.token as string | undefined;
    return authToken ?? null;
  }
}
