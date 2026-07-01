import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { jwtConfig } from '../config/jwt.config';
import { MailerService } from '../common/services/mailer.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtConfig.secret,
      signOptions: { expiresIn: jwtConfig.expiresIn },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, MailerService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
