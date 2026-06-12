import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DoctorsService, PatientsService, UsersService } from './profiles';
import { PrismaService } from './prisma/prisma.service';

jest.mock('bcrypt');
const bcryptHash = bcrypt.hash as jest.Mock;

const mockPrisma = {
  doctor: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  patient: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  glucoseReading: {
    findFirst: jest.fn(),
  },
  alert: {
    count: jest.fn(),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DoctorsService
// ─────────────────────────────────────────────────────────────────────────────

describe('DoctorsService', () => {
  let service: DoctorsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DoctorsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<DoctorsService>(DoctorsService);
  });

  describe('createProfile', () => {
    const dto = { full_name: 'Dr. Rahul', license_number: 'MED123' };

    it('creates a doctor profile with a generated invite code', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(null);
      mockPrisma.doctor.create.mockResolvedValue({ id: 'd1', ...dto, invite_code: 'ABC123' });

      const result = await service.createProfile('u1', dto as any);

      expect(mockPrisma.doctor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ user_id: 'u1', full_name: dto.full_name }),
        }),
      );
      expect(result.invite_code).toBeDefined();
    });

    it('throws ConflictException when doctor profile already exists', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.createProfile('u1', dto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('getProfile', () => {
    it('returns the doctor profile', async () => {
      const profile = { id: 'd1', full_name: 'Dr. Smith' };
      mockPrisma.doctor.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile('u1');

      expect(result).toEqual(profile);
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates the doctor profile', async () => {
      const existing = { id: 'd1' };
      const updated = { id: 'd1', full_name: 'Dr. Updated' };
      mockPrisma.doctor.findUnique.mockResolvedValue(existing);
      mockPrisma.doctor.update.mockResolvedValue(updated);

      const result = await service.updateProfile('u1', {
        full_name: 'Dr. Updated',
        license_number: 'MED456',
      } as any);

      expect(result.full_name).toBe('Dr. Updated');
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('u1', { full_name: 'X', license_number: 'Y' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyPatients', () => {
    it('returns patients enriched with latest glucose and alert count', async () => {
      const doctor = { id: 'd1' };
      const patients = [{ id: 'p1', user: { id: 'u2' } }];
      mockPrisma.doctor.findUnique.mockResolvedValue(doctor);
      mockPrisma.patient.findMany.mockResolvedValue(patients);
      mockPrisma.glucoseReading.findFirst.mockResolvedValue({ value_mg_dl: 120 });
      mockPrisma.alert.count.mockResolvedValue(2);

      const result = await service.getMyPatients('u1');

      expect(result).toHaveLength(1);
      expect(result[0].latest_glucose).toEqual({ value_mg_dl: 120 });
      expect(result[0].unresolved_alerts).toBe(2);
    });

    it('throws NotFoundException when doctor profile does not exist', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(null);

      await expect(service.getMyPatients('u1')).rejects.toThrow(NotFoundException);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PatientsService
// ─────────────────────────────────────────────────────────────────────────────

describe('PatientsService', () => {
  let service: PatientsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PatientsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
  });

  describe('createProfile', () => {
    const dto = { full_name: 'Jane Doe', date_of_birth: '1990-01-01' };

    it('creates a patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);
      mockPrisma.patient.create.mockResolvedValue({ id: 'p1', ...dto });

      const result = await service.createProfile('u1', dto as any);

      expect(mockPrisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ user_id: 'u1', full_name: 'Jane Doe' }),
        }),
      );
      expect(result.id).toBe('p1');
    });

    it('throws ConflictException when patient profile already exists', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.createProfile('u1', dto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('getProfile', () => {
    it('returns the patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1' });

      const result = await service.getProfile('u1');

      expect(result.id).toBe('p1');
    });

    it('throws NotFoundException when patient profile does not exist', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('linkDoctor', () => {
    it('links the patient to a doctor via invite code', async () => {
      const doctor = { id: 'd1' };
      const patient = { id: 'p1', doctor_id: null };
      const updated = { id: 'p1', doctor_id: 'd1' };

      mockPrisma.doctor.findUnique.mockResolvedValue(doctor);
      mockPrisma.patient.findUnique.mockResolvedValue(patient);
      mockPrisma.patient.update.mockResolvedValue(updated);

      const result = await service.linkDoctor('u1', { invite_code: 'ABC123' });

      expect(mockPrisma.patient.update).toHaveBeenCalledWith({
        where: { user_id: 'u1' },
        data: { doctor_id: 'd1' },
      });
      expect(result.doctor_id).toBe('d1');
    });

    it('throws NotFoundException when invite code is invalid', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(null);

      await expect(service.linkDoctor('u1', { invite_code: 'INVALID' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when patient profile does not exist', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue({ id: 'd1' });
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.linkDoctor('u1', { invite_code: 'ABC123' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UsersService
// ─────────────────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('getMe', () => {
    it('returns the current user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        role: 'patient',
      });

      const result = await service.getMe('u1');

      expect(result.id).toBe('u1');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMe', () => {
    it('hashes the password before saving when password is provided', async () => {
      bcryptHash.mockResolvedValue('hashed-new-pw');
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', email: 'new@example.com' });

      await service.updateMe('u1', { password: 'newpass123' });

      expect(bcryptHash).toHaveBeenCalledWith('newpass123', 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ password_hash: 'hashed-new-pw' }),
        }),
      );
    });

    it('updates without hashing when no password is provided', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', email: 'new@example.com' });

      await service.updateMe('u1', { email: 'new@example.com' });

      expect(bcryptHash).not.toHaveBeenCalled();
    });
  });
});
