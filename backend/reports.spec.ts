import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports';
import { PrismaService } from './prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const mockPrismaService = {
      user: { findUnique: jest.fn() },
      patient: { findUnique: jest.fn() },
      glucoseReading: { findMany: jest.fn() },
      activity: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate weekly report correctly', async () => {
    // Mock user
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user1',
      role: 'patient',
      patient_profile: { id: 'patient1' },
    });

    // Mock patient
    (prisma.patient.findUnique as jest.Mock).mockResolvedValue({ id: 'patient1' });

    // Mock glucose readings
    (prisma.glucoseReading.findMany as jest.Mock).mockResolvedValue([
      { value_mg_dl: 100, reading_type: 'fasting' }, // in range, fasting
      { value_mg_dl: 150, reading_type: 'post_meal' }, // out of range, post_meal spike
      { value_mg_dl: 80, reading_type: 'random' }, // in range
    ]);

    // Mock activities
    (prisma.activity.findMany as jest.Mock).mockResolvedValue([
      { steps: 5000 },
      { steps: 2000 },
    ]);

    const result = await service.getWeeklyReport('user1');

    expect(result).toEqual({
      patient_id: 'patient1',
      time_in_range_percentage: 66.67, // 2 out of 3
      average_fasting_glucose: 100, // only 1 fasting reading
      post_meal_spike_frequency: 1, // 1 reading > 140
      average_daily_steps: 1000, // 7000 / 7
    });
  });

  it('should throw NotFoundException if user not found', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.getWeeklyReport('invalid')).rejects.toThrow(NotFoundException);
  });
});
