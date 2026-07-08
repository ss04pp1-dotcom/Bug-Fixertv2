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
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailer: MailerService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Deterministic hash of a refresh token so we can store & look it up in DB
   * without keeping the raw JWT at rest. HMAC-SHA256 keyed with the refresh
   * secret — a DB dump alone can't be replayed against /auth/refresh unless
   * the attacker also has the server's JWT_REFRESH_SECRET.
   */
  static hashRefreshToken(token: string): string {
    return crypto.createHmac('sha256', jwtConfig.refreshSecret).update(token).digest('hex');
  }

  async register(dto: RegisterDto) {
    dto.email = dto.email?.trim() || undefined;
    dto.phone = dto.phone?.trim() || undefined;
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
    // refreshToken is intentionally included so the controller can set it as an httpOnly cookie.
    // The controller is responsible for stripping it from the JSON response body before returning.
    return { user: this.sanitizeUser(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
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
        refreshToken: AuthService.hashRefreshToken(tokens.refreshToken),
        deviceName: dto.deviceName,
        deviceType: dto.deviceType,
        platform: dto.platform,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    // Refresh token is delivered via httpOnly cookie by the controller — never return it in the JSON body.
    return { user: this.sanitizeUser(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async refresh(userId: string, sessionId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt !== null) throw new UnauthorizedException();

    const tokens = await this.generateTokens(user.id, user.email || user.phone || '', user.role, {});
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.session.update({
      where: { id: sessionId, userId },
      data: { refreshToken: AuthService.hashRefreshToken(tokens.refreshToken), expiresAt },
    });

    // Controller sets the refresh token as an httpOnly cookie; only return accessToken + user to the client.
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: this.sanitizeUser(user) };
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

    // A-030: invalidate all previously-issued, still-unused OTPs for this identifier
    // BEFORE creating the new one. Without this, an attacker who requested 5 OTPs has
    // 5 valid codes they can try — defeating the `recentFailures >= 5` brute-force guard
    // in verifyOtp() which only counts unused OTPs whose code != the submitted code.
    await this.prisma.otp.updateMany({
      where: { identifier: dto.identifier, usedAt: null },
      data: { usedAt: new Date() },
    });

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
        subject: 'SOL TV — Password Reset Code',
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
    const MAX_ATTEMPTS = 5;

    // Get the latest active OTP for this identifier+type (forgotPassword invalidates
    // older ones, so there is at most one). Brute-force is tracked on this row via
    // `failedAttempts` — the old "count of unused OTPs with different code" heuristic
    // could never actually trip because every request invalidates previous OTPs.
    const active = await this.prisma.otp.findFirst({
      where: {
        identifier: dto.identifier,
        type: dto.type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!active) throw new BadRequestException('Invalid or expired OTP');
    if (active.failedAttempts >= MAX_ATTEMPTS) {
      // Burn this OTP so the user must request a fresh one.
      await this.prisma.otp.update({ where: { id: active.id }, data: { usedAt: new Date() } });
      throw new BadRequestException('Too many failed attempts. Please request a new OTP.');
    }

    if (active.code !== hashedInput) {
      await this.prisma.otp.update({
        where: { id: active.id },
        data: { failedAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.otp.update({ where: { id: active.id }, data: { usedAt: new Date() } });
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
    // Wrap password update + OTP mark-used + session deactivation in a single transaction so
    // a crash between any of these steps can't leave the system in an inconsistent state
    // (e.g. password changed but sessions still active, or OTP never marked as used and
    // therefore reusable for a second reset).
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.otp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
      await tx.session.updateMany({ where: { userId: user.id }, data: { isActive: false } });
    });

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
    // Wrap the password update + session deactivation in a transaction so a crash between
    // them can't leave sessions active after the password changed (or vice versa).
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.session.updateMany({ where: { userId }, data: { isActive: false } });
    });
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

    // Check phone uniqueness — same reasoning as the email check above.
    if (data.phone && data.phone !== user.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: data.phone, deletedAt: null, id: { not: userId } },
      });
      if (existingPhone) throw new ConflictException('Phone number already in use');
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
  async socialLogin(dto: {
    provider: string;
    accessToken?: string;
    code?: string;
    redirectUri?: string;
    codeVerifier?: string;
    email?: string;
    name?: string;
    providerId?: string;
  }) {
    let accessToken = dto.accessToken;
    let name = dto.name;

    // Facebook is exchanged server-side using the private client token — the
    // client never sees it (mirrors admin's isPublic:false for facebook_client_token).
    if (dto.provider === 'facebook' && !accessToken && dto.code) {
      const exchanged = await this.exchangeFacebookCode(dto.code, dto.redirectUri, dto.codeVerifier);
      accessToken = exchanged.accessToken;
      name = name ?? exchanged.name;
    }

    if (!accessToken) {
      throw new BadRequestException('An access token (or authorization code) is required for social login');
    }
    if (!dto.email && !dto.providerId) {
      throw new BadRequestException('Email or provider ID is required for social login');
    }

    // Server-side OAuth token verification
    const verifiedEmail = await this.verifyOAuthToken(dto.provider, accessToken, dto.email);
    if (!verifiedEmail) {
      throw new UnauthorizedException('OAuth token verification failed — invalid or expired token');
    }
    const resolvedEmail = verifiedEmail;
    dto = { ...dto, name };

    // 1. Try to find an existing user by verified email
    let user = resolvedEmail
      ? await this.prisma.user.findFirst({ where: { email: resolvedEmail, deletedAt: null } })
      : null;

    // 2. Create user if not found — race-condition-safe: two concurrent socialLogin
    // calls with the same OAuth token could both pass the findFirst check and both try to
    // create the user. We catch P2002 (unique constraint on email) and re-fetch instead.
    // We also set a random passwordHash so the OAuth user can NEVER log in via password
    // (they must always go through the OAuth flow).
    if (!user) {
      const name = dto.name ?? resolvedEmail?.split('@')[0] ?? 'User';
      const randomPasswordHash = crypto.randomBytes(32).toString('hex');
      try {
        user = await this.prisma.user.create({
          data: { name, email: resolvedEmail ?? null, language: 'en', passwordHash: randomPasswordHash },
        });
      } catch (e) {
        // PrismaClientKnownRequestError with code 'P2002' means a unique constraint fired —
        // another concurrent request already created the user. Re-fetch and continue.
        if (
          typeof e === 'object' && e !== null &&
          'code' in e && (e as { code: string }).code === 'P2002'
        ) {
          if (!resolvedEmail) {
            // Should not happen — P2002 on what then? Re-throw.
            throw e;
          }
          user = await this.prisma.user.findFirst({ where: { email: resolvedEmail, deletedAt: null } });
          if (!user) {
            // User was created then immediately soft-deleted by a concurrent request — abort.
            throw new ConflictException('Account is in an inconsistent state, please try again');
          }
        } else {
          throw e;
        }
      }
    }

    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const tokens = await this.generateTokens(user.id, user.email || user.phone || '', user.role, {});

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: AuthService.hashRefreshToken(tokens.refreshToken),
        deviceName: `${dto.provider} OAuth`,
        expiresAt,
      },
    });

    // Refresh token is delivered via httpOnly cookie by the controller — never return it in the JSON body.
    return { user: this.sanitizeUser(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
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
        const data = await res.json() as { email?: string; error?: string; aud?: string; azp?: string; email_verified?: string | boolean };
        if (data.error || !data.email) return null;
        // Reject unverified Google accounts.
        const verified = data.email_verified === true || data.email_verified === 'true';
        if (!verified) return null;
        // Audience check: only accept tokens minted for our OAuth client(s).
        // Configured via settings key `google_client_ids` (comma-separated) or
        // env GOOGLE_OAUTH_CLIENT_IDS, PLUS whichever of the per-platform client
        // IDs the admin has actually configured in Settings → Authentication
        // (google_client_id_web / _android / _ios). Those are the only fields
        // the admin UI exposes, so they must count as allowed audiences —
        // otherwise every Google sign-in is refused even when fully configured.
        const [configured, webId, androidId, iosId] = await Promise.all([
          this.settingsService.get('google_client_ids').catch(() => null),
          this.settingsService.get('google_client_id_web').catch(() => null),
          this.settingsService.get('google_client_id_android').catch(() => null),
          this.settingsService.get('google_client_id_ios').catch(() => null),
        ]);
        const raw = [
          configured?.value ? String(configured.value) : '',
          webId?.value ? String(webId.value) : '',
          androidId?.value ? String(androidId.value) : '',
          iosId?.value ? String(iosId.value) : '',
          process.env.GOOGLE_OAUTH_CLIENT_IDS || '',
        ].join(',');
        const allowed = raw.split(',').map(s => s.trim()).filter(Boolean);
        if (allowed.length === 0) {
          this.logger.error('Google Sign-In: no google client IDs configured — refusing login (received aud=' + (data.aud ?? '') + ')');
          return null;
        }
        const aud = data.aud || data.azp || '';
        if (!allowed.includes(aud)) return null;
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

  /**
   * Exchange a Facebook OAuth authorization code (obtained on-device via PKCE)
   * for a user access token. Uses the app's private `facebook_client_token`
   * setting as the client secret equivalent — this must stay server-side only
   * (it is stored with isPublic:false), which is why this exchange cannot
   * happen on the mobile client itself.
   */
  private async exchangeFacebookCode(
    code: string,
    redirectUri?: string,
    codeVerifier?: string,
  ): Promise<{ accessToken: string; name?: string }> {
    const [appIdSetting, clientTokenSetting] = await Promise.all([
      this.settingsService.get('facebook_app_id').catch(() => null),
      this.settingsService.get('facebook_client_token').catch(() => null),
    ]);
    const appId = appIdSetting?.value ? String(appIdSetting.value) : '';
    const clientToken = clientTokenSetting?.value ? String(clientTokenSetting.value) : '';
    if (!appId || !clientToken) {
      throw new BadRequestException('Facebook Sign-In is not configured on the server');
    }
    if (!redirectUri) {
      throw new BadRequestException('redirectUri is required to exchange a Facebook authorization code');
    }

    const params = new URLSearchParams({
      client_id: appId,
      client_secret: clientToken,
      redirect_uri: redirectUri,
      code,
    });
    if (codeVerifier) params.set('code_verifier', codeVerifier);

    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`, {
      signal: AbortSignal.timeout(5000),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: { message?: string } };
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new UnauthorizedException(tokenData.error?.message || 'Failed to exchange Facebook authorization code');
    }

    let name: string | undefined;
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v19.0/me?fields=name&access_token=${encodeURIComponent(tokenData.access_token)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (meRes.ok) {
        const me = (await meRes.json()) as { name?: string };
        name = me.name;
      }
    } catch {
      // Non-fatal — name is optional, socialLogin() falls back to the email prefix.
    }

    return { accessToken: tokenData.access_token, name };
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
