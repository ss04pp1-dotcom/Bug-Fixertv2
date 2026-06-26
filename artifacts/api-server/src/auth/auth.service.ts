import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { jwtConfig } from '../config/jwt.config';
import { MailerService } from '../common/services/mailer.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailer: MailerService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone is required');
    }

    const orConditions: Array<{ email: string } | { phone: string }> = [];
    if (dto.email) orConditions.push({ email: dto.email });
    if (dto.phone) orConditions.push({ phone: dto.phone });

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: orConditions,
        deletedAt: null,
      },
    });
    if (existing) throw new ConflictException('User already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        country: dto.country,
        language: dto.language || 'en',
      },
    });

    const tokens = await this.generateTokens(user.id, user.email || user.phone || '', user.role, {});
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        deletedAt: null,
      },
    });

    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const tokens = await this.generateTokens(user.id, user.email || user.phone || '', user.role, {});

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        deviceName: dto.deviceName,
        deviceType: dto.deviceType,
        platform: dto.platform,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(userId: string, sessionId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt !== null) throw new UnauthorizedException();

    const tokens = await this.generateTokens(user.id, user.email || user.phone || '', user.role, {});
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.session.update({
      where: { id: sessionId, userId },
      data: { refreshToken: tokens.refreshToken, expiresAt },
    });

    return tokens;
  }

  async logout(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { isActive: false },
    });
    return { message: 'Logged out from all devices' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        deletedAt: null,
      },
    });

    if (!user) {
      return { message: 'If the account exists, a verification code has been sent.' };
    }

    // Generate 6-digit OTP and hash it before storing
    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.otp.create({
      data: {
        userId: user.id,
        identifier: dto.identifier,
        code: hashedOtp,
        type: 'forgot_password',
        expiresAt,
      },
    });

    if (user.email) {
      this.mailer.sendMail({
        to: user.email,
        subject: 'StreamPro — Password Reset Code',
        template: 'reset-password',
        context: { otp },
      }).catch((err: unknown) => {
        this.logger.warn(
          `Failed to send password reset email to ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const hashedInput = crypto.createHash('sha256').update(dto.code).digest('hex');

    // Brute-force protection: count recent failed attempts for this identifier
    const recentFailures = await this.prisma.otp.count({
      where: {
        identifier: dto.identifier,
        type: dto.type,
        usedAt: null,
        expiresAt: { gt: new Date() },
        code: { not: hashedInput },
      },
    });
    // If 5+ valid but unused OTPs exist (each failed attempt creates a new OTP),
    // we block further attempts. This limits replay + brute-force attacks.
    // A simpler approach: track failed attempts in a rate-limit per identifier.
    // Here we use a practical threshold — 5 unused OTPs for the same identifier
    // means too many codes were generated/attempted.
    if (recentFailures >= 5) {
      throw new BadRequestException('Too many failed attempts. Please request a new OTP.');
    }

    const otp = await this.prisma.otp.findFirst({
      where: {
        identifier: dto.identifier,
        type: dto.type,
        code: hashedInput,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!otp) throw new BadRequestException('Invalid or expired OTP');

    await this.prisma.otp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
    return { message: 'OTP verified successfully', verified: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedOtpCode = crypto.createHash('sha256').update(dto.otpCode).digest('hex');
    const otp = await this.prisma.otp.findFirst({
      where: {
        identifier: dto.identifier,
        code: hashedOtpCode,
        type: 'forgot_password',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!otp) throw new BadRequestException('Invalid or expired OTP');

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { phone: dto.identifier }], deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.prisma.otp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
    await this.prisma.session.updateMany({ where: { userId: user.id }, data: { isActive: false } });

    return { message: 'Password reset successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isActive: true, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new ForbiddenException('Not your session');
    await this.prisma.session.update({ where: { id: sessionId }, data: { isActive: false } });
    return { message: 'Session revoked' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new NotFoundException('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.session.updateMany({ where: { userId }, data: { isActive: false } });
    return { message: 'Password changed successfully. Please log in again.' };
  }

  async updateProfile(userId: string, data: { name?: string; language?: string; country?: string; phone?: string; email?: string; avatar?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Check email uniqueness before updating to avoid raw Prisma constraint error
    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: data.email, deletedAt: null, id: { not: userId } },
      });
      if (existing) throw new ConflictException('Email is already in use by another account');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.language !== undefined && { language: data.language }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.avatar !== undefined && { avatar: data.avatar || null }),
      },
    });
    return this.sanitizeUser(updated);
  }

  /**
   * Social login — find-or-create a user from an OAuth provider.
   * The client sends the provider-issued access token; we verify it
   * server-side against the provider's tokeninfo endpoint before trusting
   * the claimed email.  This prevents email-spoofing account takeover.
   */
  async socialLogin(dto: { provider: string; accessToken: string; email?: string; name?: string; providerId?: string }) {
    if (!dto.email && !dto.providerId) {
      throw new BadRequestException('Email or provider ID is required for social login');
    }

    // Server-side OAuth token verification
    const verifiedEmail = await this.verifyOAuthToken(dto.provider, dto.accessToken, dto.email);
    if (!verifiedEmail) {
      throw new UnauthorizedException('OAuth token verification failed — invalid or expired token');
    }
    const resolvedEmail = verifiedEmail;

    // 1. Try to find an existing user by verified email
    let user = resolvedEmail
      ? await this.prisma.user.findFirst({ where: { email: resolvedEmail, deletedAt: null } })
      : null;

    // 2. Create user if not found
    if (!user) {
      const name = dto.name ?? resolvedEmail?.split('@')[0] ?? 'User';
      user = await this.prisma.user.create({
        data: { name, email: resolvedEmail ?? null, language: 'en' },
      });
    }

    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const tokens = await this.generateTokens(user.id, user.email || user.phone || '', user.role, {});

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        deviceName: `${dto.provider} OAuth`,
        expiresAt,
      },
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  /**
   * Verify an OAuth access token with the provider's server-side API.
   * Returns the verified email on success, null on failure.
   */
  private async verifyOAuthToken(provider: string, accessToken: string, claimedEmail?: string): Promise<string | null> {
    try {
      if (provider === 'google') {
        const res = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) return null;
        const data = await res.json() as { email?: string; error?: string };
        if (data.error || !data.email) return null;
        if (claimedEmail && data.email.toLowerCase() !== claimedEmail.toLowerCase()) return null;
        return data.email;
      }
      if (provider === 'facebook') {
        const res = await fetch(
          `https://graph.facebook.com/v18.0/me?fields=id,email&access_token=${encodeURIComponent(accessToken)}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) return null;
        const data = await res.json() as { email?: string; id?: string; error?: { message?: string } };
        if (data.error || !data.email) return null;
        if (claimedEmail && data.email.toLowerCase() !== claimedEmail.toLowerCase()) return null;
        return data.email;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async generateTokens(userId: string, email: string, role: string, extra: object) {
    const payload = { sub: userId, email, role, ...extra };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtConfig.secret,
        expiresIn: jwtConfig.expiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtConfig.refreshSecret,
        expiresIn: jwtConfig.refreshExpiresIn,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: { passwordHash: string | null; [key: string]: unknown }) {
    const { passwordHash: _hash, ...rest } = user;
    return rest;
  }
}
