import { Controller, Post, Get, Put, Delete, Body, Param, Req, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/interfaces';
import { Request, Response } from 'express';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setRefreshCookieAndStrip(res, result, req);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login with email or phone' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.authService.login(dto, ip, ua);
    this.setRefreshCookieAndStrip(res, result, req);
    return result;
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.refresh(user.id, user.sessionId!);
    this.setRefreshCookieAndStrip(res, result, req);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.sessionId!);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout all devices' })
  logoutAll(@CurrentUser('id') userId: string) {
    return this.authService.logoutAll(userId);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('social')
  @ApiOperation({ summary: 'Social login — find or create user from OAuth provider token' })
  async socialLogin(@Body() dto: SocialLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.socialLogin(dto);
    this.setRefreshCookieAndStrip(res, result, req);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset OTP' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP code' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with OTP' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active sessions' })
  getSessions(@CurrentUser('id') userId: string) {
    return this.authService.getSessions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  revokeSession(@CurrentUser('id') userId: string, @Param('id') sessionId: string) {
    return this.authService.revokeSession(userId, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password while authenticated' })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }

  /**
   * Move the refresh token from the service's return envelope into an httpOnly cookie.
   * For mobile clients (X-Client: mobile header), also keep it in the response body
   * because React Native's HTTP client does not persist cookies between requests.
   * For web/admin clients the token is stripped from the body after setting the cookie.
   */
  private setRefreshCookieAndStrip(res: Response, result: { accessToken: string; refreshToken?: string }, req?: Request): void {
    const isProd = process.env.NODE_ENV === 'production';
    if (result.refreshToken) {
      res.cookie('streampro_refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      // Mobile clients cannot use cookies — keep refreshToken in the body.
      // Web/admin clients get it stripped (cookie-only) for XSS safety.
      const isMobile = req?.headers?.['x-client'] === 'mobile';
      if (!isMobile) {
        delete result.refreshToken;
      }
    }
  }
}
