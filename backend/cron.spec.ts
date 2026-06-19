import { Test, TestingModule } from '@nestjs/testing';
import { WeeklySummaryJob } from './cron';
import { PrismaService } from './prisma/prisma.service';

const mockPrisma = {
  patient: { findMany: jest.fn() },
  insight: { findFirst: jest.fn(), create: jest.fn() },
  glucoseReading: { findMany: jest.fn() },
  meal: { findMany: jest.fn() },
  activity: { findMany: jest.fn() },
};

const PATIENT = {
  id: 'p1',
  full_name: 'Ananya Shah',
  target_glucose_min: 70,
  target_glucose_max: 140,
};

describe('WeeklySummaryJob', () => {
  let job: WeeklySummaryJob;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [WeeklySummaryJob, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    job = module.get<WeeklySummaryJob>(WeeklySummaryJob);
  });

  // ─── generateWeeklySummaries ──────────────────────────────────────────────

  describe('generateWeeklySummaries', () => {
    it('fetches all active patients and processes each one', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue({});

      await job.generateWeeklySummaries();

      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user: { is_active: true } } }),
      );
      expect(mockPrisma.insight.create).toHaveBeenCalledTimes(1);
    });

    it('skips a patient when a weekly_summary insight already exists for this week', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
      mockPrisma.insight.findFirst.mockResolvedValue({ id: 'existing' });

      await job.generateWeeklySummaries();

      expect(mockPrisma.glucoseReading.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.insight.create).not.toHaveBeenCalled();
    });

    it('continues processing remaining patients if one fails', async () => {
      const patient2 = { ...PATIENT, id: 'p2', full_name: 'Rohan Mehta' };
      mockPrisma.patient.findMany.mockResolvedValue([PATIENT, patient2]);

      // Patient 1: insight.findFirst throws
      mockPrisma.insight.findFirst
        .mockRejectedValueOnce(new Error('DB timeout'))
        .mockResolvedValueOnce(null);

      // Patient 2 data
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue({});

      await expect(job.generateWeeklySummaries()).resolves.not.toThrow();
      expect(mockPrisma.insight.create).toHaveBeenCalledTimes(1);
    });

    it('processes zero patients without errors', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([]);

      await expect(job.generateWeeklySummaries()).resolves.not.toThrow();
      expect(mockPrisma.insight.create).not.toHaveBeenCalled();
    });
  });

  // ─── insight generation (via generateWeeklySummaries) ────────────────────

  describe('insight flag calculation', () => {
    const runForPatient = async (readings: { value_mg_dl: number }[], activitySteps = 0) => {
      mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue(readings);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue(
        activitySteps ? [{ steps: activitySteps }] : [],
      );
      mockPrisma.insight.create.mockResolvedValue({});
      await job.generateWeeklySummaries();
      return mockPrisma.insight.create.mock.calls[0][0].data;
    };

    it('sets flag to "normal" when TIR is 70% or above', async () => {
      // 7 in range out of 7 → 100% TIR
      const readings = Array(7).fill({ value_mg_dl: 100 });
      const data = await runForPatient(readings);
      expect(data.flag).toBe('normal');
    });

    it('sets flag to "info" when TIR is between 50% and 69%', async () => {
      // 4 in range, 4 out of range → 50% TIR
      const readings = [
        { value_mg_dl: 100 }, { value_mg_dl: 110 },
        { value_mg_dl: 100 }, { value_mg_dl: 110 },
        { value_mg_dl: 180 }, { value_mg_dl: 190 },
        { value_mg_dl: 180 }, { value_mg_dl: 190 },
      ];
      const data = await runForPatient(readings);
      expect(data.flag).toBe('info');
    });

    it('sets flag to "warning" when TIR is below 50%', async () => {
      // 1 in range, 3 out of range → 25% TIR
      const readings = [
        { value_mg_dl: 100 },
        { value_mg_dl: 200 }, { value_mg_dl: 210 }, { value_mg_dl: 220 },
      ];
      const data = await runForPatient(readings);
      expect(data.flag).toBe('warning');
    });

    it('sets flag to "warning" when the patient has no readings', async () => {
      const data = await runForPatient([]);
      expect(data.flag).toBe('warning');
    });
  });

  describe('insight message content', () => {
    it('includes the patient name, reading count, and meal count', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 95 }, { value_mg_dl: 105 },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue({});

      await job.generateWeeklySummaries();

      const { message } = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(message).toContain(PATIENT.full_name);
      expect(message).toContain('2 glucose readings');
      expect(message).toContain('3 meals');
    });

    it('includes average glucose and TIR when readings are present', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 90 }, { value_mg_dl: 110 },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue({});

      await job.generateWeeklySummaries();

      const { message } = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(message).toContain('100 mg/dL');  // avg of 90 and 110
      expect(message).toContain('time in range');
    });

    it('includes average steps when activity data is present', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([{ steps: 35000 }]);
      mockPrisma.insight.create.mockResolvedValue({});

      await job.generateWeeklySummaries();

      const { message } = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(message).toContain('steps');
    });

    it('includes no-readings reminder when patient logged zero readings', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue({});

      await job.generateWeeklySummaries();

      const { message } = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(message).toContain('No readings this week');
    });
  });

  describe('insight metadata', () => {
    it('saves insight with type weekly_summary and generated_by cron_job', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue({});

      await job.generateWeeklySummaries();

      expect(mockPrisma.insight.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patient_id: PATIENT.id,
            type: 'weekly_summary',
            generated_by: 'cron_job',
          }),
        }),
      );
    });

    it('checks for an existing summary since the start of the current week', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue({});

      await job.generateWeeklySummaries();

      expect(mockPrisma.insight.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patient_id: PATIENT.id,
            type: 'weekly_summary',
            created_at: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });
  });
});
