import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { jwtConfig } from '../../config/jwt.config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private prisma: PrismaService) {
    super({
      // Read refresh token from the httpOnly cookie first; fall back to body field for
      // backward compatibility with older mobile clients that send it in the JSON body.
      jwtFromRequest: (req: Request) =>
        req?.cookies?.['soltv_refresh_token'] ?? ExtractJwt.fromBodyField('refreshToken')(req),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.refreshSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string }) {
    const refreshToken =
      (req.cookies?.['soltv_refresh_token'] as string | undefined) ??
      (req.body?.refreshToken as string | undefined);
    if (!refreshToken) throw new UnauthorizedException();

    // We store an HMAC of the refresh token, not the raw JWT — look it up by hash.
    const hashed = AuthService.hashRefreshToken(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { userId: payload.sub, refreshToken: hashed, isActive: true, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!session || !session.user.isActive || session.user.deletedAt !== null) {
      throw new UnauthorizedException();
    }
    return { ...session.user, sessionId: session.id, refreshToken };
  }
}
