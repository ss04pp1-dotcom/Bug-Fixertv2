import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from '../../common/services/mailer.service';
import * as bcrypt from 'bcryptjs';

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  session: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  otp: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockMailer = { sendMail: jest.fn().mockResolvedValue(undefined) };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailerService, useValue: mockMailer },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'mocked.jwt.token'),
            signAsync: jest.fn(() => Promise.resolve('mocked.jwt.token')),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should throw ConflictException if user already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing-id' });
      await expect(
        service.register({ name: 'Test', email: 'test@test.com', password: 'pass123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user and return tokens when user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-id', name: 'Test', email: 'test@test.com',
        passwordHash: 'hash', role: 'user', isActive: true, isPremium: false,
        emailVerified: false, phoneVerified: false, avatar: null,
        country: null, language: 'en',
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-id' });

      const result = await service.register({ name: 'Test', email: 'test@test.com', password: 'pass123' });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'notfound@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'id', passwordHash: await bcrypt.hash('correct', 10), isActive: true,
      });
      await expect(
        service.login({ identifier: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens on successful login', async () => {
      const hash = await bcrypt.hash('correct123', 10);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-id', email: 'test@test.com', passwordHash: hash,
        isActive: true, role: 'user', name: 'Test', phone: null,
        isPremium: false, avatar: null, country: null, language: 'en',
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-id' });

      const result = await service.login({ identifier: 'test@test.com', password: 'correct123' });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('forgotPassword', () => {
    it('should return safe message when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const result = await service.forgotPassword({ identifier: 'nobody@test.com' });
      expect(result.message).toBe('If the account exists, a verification code has been sent.');
      expect(result).not.toHaveProperty('code');
    });

    it('should send OTP and not expose the code in response', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-id', email: 'test@test.com' });
      mockPrisma.otp.create.mockResolvedValue({ id: 'otp-id' });

      const result = await service.forgotPassword({ identifier: 'test@test.com' });
      expect(result).toEqual({ message: 'OTP sent successfully' });
      expect(result).not.toHaveProperty('code');
    });
  });

  describe('verifyOtp', () => {
    it('should throw BadRequestException for invalid OTP', async () => {
      mockPrisma.otp.count.mockResolvedValue(0);
      mockPrisma.otp.findFirst.mockResolvedValue(null);
      const { BadRequestException } = await import('@nestjs/common');
      await expect(
        service.verifyOtp({ identifier: 'test@test.com', code: '000000', type: 'forgot_password' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
