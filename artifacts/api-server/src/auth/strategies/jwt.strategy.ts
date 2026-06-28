import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { jwtConfig } from '../../config/jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.secret,
    });
  }

  async validate(payload: { sub: string; email: string; role: string; sessionId?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      // SECURITY: never load passwordHash from the DB on the JWT validation path.
      // The returned object is attached to `req.user` by Passport and propagated to
      // every controller via @CurrentUser() — if passwordHash were included here it
      // would silently leak to every authenticated response and to any transform
      // interceptor that serializes the request user.
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
        isPremium: true,
        emailVerified: true,
        phoneVerified: true,
        avatar: true,
        country: true,
        language: true,
        subscriptionEndsAt: true,
      },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return { ...user, sessionId: payload.sessionId };
  }
}
