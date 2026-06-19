import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth';
import { PrismaService } from './prisma/prisma.service';

jest.mock('bcrypt');
const bcryptHash = bcrypt.hash as jest.Mock;
const bcryptCompare = bcrypt.compare as jest.Mock;

const mockPrisma = {
  otpVerification: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('jwt-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // sendOtp
  // ─────────────────────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('creates an OTP record with a hashed code and an expiry 10 minutes from now', async () => {
      bcryptHash.mockResolvedValue('hashed-otp');
      mockPrisma.otpVerification.create.mockResolvedValue({ id: 'otp1' });

      await service.sendOtp({ phone: '+919876543210' });

      expect(bcryptHash).toHaveBeenCalled();
      expect(mockPrisma.otpVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: '+919876543210',
            otp_hash: 'hashed-otp',
          }),
        }),
      );
    });

    it('returns a success message', async () => {
      bcryptHash.mockResolvedValue('hashed-otp');
      mockPrisma.otpVerification.create.mockResolvedValue({ id: 'otp1' });

      const result = await service.sendOtp({ phone: '+919876543210' });

      expect(result.message).toBe('OTP sent successfully');
    });

    it('stores an expiry timestamp roughly 10 minutes in the future', async () => {
      bcryptHash.mockResolvedValue('hashed-otp');

      const before = new Date();
      mockPrisma.otpVerification.create.mockImplementation(async ({ data }) => {
        const diff = (data.expires_at.getTime() - before.getTime()) / 60000;
        expect(diff).toBeGreaterThanOrEqual(9);
        expect(diff).toBeLessThanOrEqual(11);
        return { id: 'otp1' };
      });

      await service.sendOtp({ phone: '+919876543210' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // verifyOtp
  // ─────────────────────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    const dto = { phone: '+919876543210', otp: '123456' };
    const otpRecord = { id: 'otp1', otp_hash: 'hashed-otp' };
    const existingUser = { id: 'u1', phone: '+919876543210', role: 'patient' };

    it('throws BadRequestException when no valid OTP record exists for the phone', async () => {
      mockPrisma.otpVerification.findFirst.mockResolvedValue(null);

      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the OTP code does not match the stored hash', async () => {
      mockPrisma.otpVerification.findFirst.mockResolvedValue(otpRecord);
      bcryptCompare.mockResolvedValue(false);

      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
    });

    it('marks the OTP record as used after a successful verification', async () => {
      mockPrisma.otpVerification.findFirst.mockResolvedValue(otpRecord);
      bcryptCompare.mockResolvedValue(true);
      mockPrisma.otpVerification.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await service.verifyOtp(dto);

      expect(mockPrisma.otpVerification.update).toHaveBeenCalledWith({
        where: { id: 'otp1' },
        data: { is_used: true },
      });
    });

    it('returns access_token and user for an existing phone-verified user', async () => {
      mockPrisma.otpVerification.findFirst.mockResolvedValue(otpRecord);
      bcryptCompare.mockResolvedValue(true);
      mockPrisma.otpVerification.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.verifyOtp(dto);

      expect(result.access_token).toBe('jwt-token');
      expect(result.user).toEqual(existingUser);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('creates a new patient account when no user exists for the phone number', async () => {
      const newUser = { id: 'u2', phone: '+919876543210', role: 'patient', is_phone_verified: true };
      mockPrisma.otpVerification.findFirst.mockResolvedValue(otpRecord);
      bcryptCompare.mockResolvedValue(true);
      mockPrisma.otpVerification.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(newUser);

      const result = await service.verifyOtp(dto);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: dto.phone,
            is_phone_verified: true,
          }),
        }),
      );
      expect(result.access_token).toBe('jwt-token');
    });

    it('looks up the most recent un-used, non-expired OTP for the phone number', async () => {
      mockPrisma.otpVerification.findFirst.mockResolvedValue(otpRecord);
      bcryptCompare.mockResolvedValue(true);
      mockPrisma.otpVerification.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await service.verifyOtp(dto);

      expect(mockPrisma.otpVerification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            phone: dto.phone,
            is_used: false,
          }),
          orderBy: { created_at: 'desc' },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // login
  // ─────────────────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'doctor@example.com', password: 'secret123' };
    const user = { id: 'u1', email: dto.email, password_hash: 'hashed-pw', role: 'doctor' };

    it('throws UnauthorizedException when no user exists with the given email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user has no password hash (phone-only account)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...user, password_hash: null });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(user);
      bcryptCompare.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('returns access_token and user on successful login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(user);
      bcryptCompare.mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result.access_token).toBe('jwt-token');
      expect(result.user).toEqual(user);
    });

    it('compares the submitted password against the stored hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(user);
      bcryptCompare.mockResolvedValue(true);

      await service.login(dto);

      expect(bcryptCompare).toHaveBeenCalledWith(dto.password, user.password_hash);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // registerDoctor
  // ─────────────────────────────────────────────────────────────────────────────

  describe('registerDoctor', () => {
    const dto = { email: 'newdoc@example.com', password: 'pass123' };
    const created = { id: 'u1', email: dto.email, role: 'doctor' };

    it('throws ConflictException when the email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.registerDoctor(dto)).rejects.toThrow(ConflictException);
    });

    it('hashes the password with bcrypt before saving', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      bcryptHash.mockResolvedValue('hashed-pw');
      mockPrisma.user.create.mockResolvedValue(created);

      await service.registerDoctor(dto);

      expect(bcryptHash).toHaveBeenCalledWith(dto.password, 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ password_hash: 'hashed-pw' }),
        }),
      );
    });

    it('creates the user with the doctor role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      bcryptHash.mockResolvedValue('hashed-pw');
      mockPrisma.user.create.mockResolvedValue(created);

      await service.registerDoctor(dto);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'doctor' }),
        }),
      );
    });

    it('returns access_token and user after successful registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      bcryptHash.mockResolvedValue('hashed-pw');
      mockPrisma.user.create.mockResolvedValue(created);

      const result = await service.registerDoctor(dto);

      expect(result.access_token).toBe('jwt-token');
      expect(result.user).toEqual(created);
    });
  });
});
