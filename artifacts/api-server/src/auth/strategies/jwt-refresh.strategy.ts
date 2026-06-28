import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { jwtConfig } from '../../config/jwt.config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private prisma: PrismaService) {
    super({
      // Read refresh token from the httpOnly cookie first; fall back to body field for
      // backward compatibility with older mobile clients that send it in the JSON body.
      jwtFromRequest: (req: Request) =>
        req?.cookies?.['streampro_refresh_token'] ?? ExtractJwt.fromBodyField('refreshToken')(req),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.refreshSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string }) {
    const refreshToken =
      (req.cookies?.['streampro_refresh_token'] as string | undefined) ??
      (req.body?.refreshToken as string | undefined);
    const session = await this.prisma.session.findFirst({
      where: { userId: payload.sub, refreshToken, isActive: true },
      include: { user: true },
    });
    if (!session || !session.user.isActive) throw new UnauthorizedException();
    return { ...session.user, sessionId: session.id, refreshToken };
  }
}
