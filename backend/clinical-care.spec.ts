import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { InsightsService, AlertsService } from './clinical-care';
import { PrismaService } from './prisma/prisma.service';

// PrismaService side-effect-imports 'dotenv/config', which pulls a developer's
// real .env (and any live GROQ_API_KEY) into process.env for this whole test
// process. Tests must not depend on that, or they'll silently hit the real
// Groq API instead of exercising the rule-engine fallback they assert on.
delete process.env.GROQ_API_KEY;

const mockPrisma = {
  patient: { findUnique: jest.fn(), findMany: jest.fn() },
  doctor: { findUnique: jest.fn() },
  insight: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  glucoseReading: { findMany: jest.fn() },
  meal: { findMany: jest.fn() },
  activity: { findMany: jest.fn() },
  alert: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const PATIENT = { id: 'p1', user_id: 'u1', target_glucose_min: 70, target_glucose_max: 140 };
const DOCTOR = { id: 'd1', user_id: 'u2' };

const buildInsight = (overrides = {}) => ({
  id: 'i1',
  patient_id: 'p1',
  type: 'daily_nudge',
  flag: 'info',
  message: 'cached message',
  created_at: new Date(),
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// InsightsService
// ─────────────────────────────────────────────────────────────────────────────

describe('InsightsService', () => {
  let service: InsightsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [InsightsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
  });

  // ─── getDaily ─────────────────────────────────────────────────────────────

  describe('getDaily', () => {
    it('throws NotFoundException when patient is not found', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.getDaily('u1')).rejects.toThrow(NotFoundException);
    });

    it('returns cached insight without generating a new one', async () => {
      const cached = buildInsight();
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(cached);

      const result = await service.getDaily('u1');

      expect(result).toEqual(cached);
      expect(mockPrisma.insight.create).not.toHaveBeenCalled();
      expect(mockPrisma.glucoseReading.findMany).not.toHaveBeenCalled();
    });

    it('fires no_readings rule when there are meals but no glucose readings', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue(buildInsight({ flag: 'info' }));

      await service.getDaily('u1');

      expect(mockPrisma.insight.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ flag: 'info' }),
        }),
      );
    });

    it('fires missed_logging rule when there are no meals (regardless of readings)', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue(buildInsight({ flag: 'info' }));

      await service.getDaily('u1');

      const createCall = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(createCall.message).toContain("haven't logged any meals");
    });

    it('fires hypo_risk rule when a reading is below 70', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 65, reading_type: 'random' },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue(buildInsight({ flag: 'danger' }));

      await service.getDaily('u1');

      const createCall = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(createCall.flag).toBe('danger');
      expect(createCall.message).toContain('hypoglycemia');
    });

    it('fires fasting_high rule when a fasting reading exceeds 126', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 135, reading_type: 'fasting' },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue(buildInsight({ flag: 'warning' }));

      await service.getDaily('u1');

      const createCall = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(createCall.flag).toBe('warning');
      expect(createCall.message).toContain('fasting glucose');
    });

    it('fires post_meal_spike rule when a post-meal reading exceeds 180', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 195, reading_type: 'post_meal' },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue(buildInsight({ flag: 'warning' }));

      await service.getDaily('u1');

      const createCall = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(createCall.flag).toBe('warning');
      expect(createCall.message).toContain('post-meal glucose');
    });

    it('fires very_high rule when a reading exceeds 300', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 320, reading_type: 'random' },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue(buildInsight({ flag: 'danger' }));

      await service.getDaily('u1');

      const createCall = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(createCall.flag).toBe('danger');
      expect(createCall.message).toContain('300 mg/dL');
    });

    it('fires good_control rule when 2+ readings are all in range', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 90, reading_type: 'fasting' },
        { value_mg_dl: 120, reading_type: 'post_meal' },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue(buildInsight({ flag: 'normal' }));

      await service.getDaily('u1');

      const createCall = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(createCall.flag).toBe('normal');
      expect(createCall.message).toContain('healthy range');
    });

    it('fires low_activity rule when total steps are below 3000', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 110, reading_type: 'random' },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.activity.findMany.mockResolvedValue([{ steps: 2000 }]);
      mockPrisma.insight.create.mockResolvedValue(buildInsight({ flag: 'info' }));

      await service.getDaily('u1');

      const createCall = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(createCall.message).toContain('3,000 steps');
    });

    it('saves the insight with generated_by rule_engine', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 65, reading_type: 'random' },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue(buildInsight());

      await service.getDaily('u1');

      expect(mockPrisma.insight.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patient_id: 'p1',
            type: 'daily_nudge',
            generated_by: 'rule_engine',
          }),
        }),
      );
    });
  });

  // ─── Groq rewrite ─────────────────────────────────────────────────────────

  describe('Groq patient-friendly rewrite', () => {
    const originalFetch = global.fetch;
    const originalEnv = { ...process.env };

    afterEach(() => {
      global.fetch = originalFetch;
      process.env = { ...originalEnv };
    });

    function setupDailyInsight() {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findFirst.mockResolvedValue(null);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 65, reading_type: 'random' },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1' }]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.insight.create.mockResolvedValue(buildInsight());
    }

    it('leaves the rule-engine message untouched when GROQ_API_KEY is unset', async () => {
      delete process.env.GROQ_API_KEY;
      global.fetch = jest.fn();
      setupDailyInsight();

      await service.getDaily('u1');

      expect(global.fetch).not.toHaveBeenCalled();
      const createCall = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(createCall.generated_by).toBe('rule_engine');
      expect(createCall.message).toContain('hypoglycemia');
    });

    it('uses the Groq rewrite and marks generated_by as groq on success', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Friendlier low-sugar message.' } }],
        }),
      });
      setupDailyInsight();

      await service.getDaily('u1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.groq.com'),
        expect.objectContaining({ method: 'POST' }),
      );
      const createCall = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(createCall.generated_by).toBe('groq');
      expect(createCall.message).toBe('Friendlier low-sugar message.');
    });

    it('falls back to the rule-engine message when the Groq call fails', async () => {
      process.env.GROQ_API_KEY = 'test-key';
      global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'bad request' }) });
      setupDailyInsight();

      await service.getDaily('u1');

      const createCall = mockPrisma.insight.create.mock.calls[0][0].data;
      expect(createCall.generated_by).toBe('rule_engine');
      expect(createCall.message).toContain('hypoglycemia');
    });
  });

  // ─── dismiss ──────────────────────────────────────────────────────────────

  describe('dismiss', () => {
    it('sets dismissed_at on the insight', async () => {
      const insight = buildInsight({ dismissed_at: null });
      mockPrisma.insight.findUnique.mockResolvedValue(insight);
      mockPrisma.insight.update.mockResolvedValue({ ...insight, dismissed_at: new Date() });

      await service.dismiss('u1', 'i1');

      expect(mockPrisma.insight.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { dismissed_at: expect.any(Date) },
      });
    });

    it('throws NotFoundException when insight does not exist', async () => {
      mockPrisma.insight.findUnique.mockResolvedValue(null);

      await expect(service.dismiss('u1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getHistory ───────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('throws NotFoundException when patient does not exist', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.getHistory('u1')).rejects.toThrow(NotFoundException);
    });

    it('returns up to 50 insights ordered by created_at descending', async () => {
      const insights = Array.from({ length: 10 }, (_, i) => buildInsight({ id: `i${i}` }));
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.insight.findMany.mockResolvedValue(insights);

      const result = await service.getHistory('u1');

      expect(result).toHaveLength(10);
      expect(mockPrisma.insight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patient_id: 'p1' },
          orderBy: { created_at: 'desc' },
          take: 50,
        }),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AlertsService
// ─────────────────────────────────────────────────────────────────────────────

describe('AlertsService', () => {
  let service: AlertsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AlertsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  describe('create', () => {
    const dto = { patient_id: 'p1', type: 'high_glucose' as any, trigger_value: 220 };

    it('creates an alert when called by a doctor', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.alert.create.mockResolvedValue({ id: 'a1', ...dto, doctor_id: 'd1' });

      const result = await service.create('u2', dto);

      expect(mockPrisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            doctor_id: 'd1',
            patient_id: 'p1',
            type: 'high_glucose',
          }),
        }),
      );
      expect(result.id).toBe('a1');
    });

    it('throws ForbiddenException when called by a non-doctor', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(null);

      await expect(service.create('u1', dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resolve', () => {
    it('marks an alert as resolved when called by a doctor', async () => {
      const alert = { id: 'a1', patient_id: 'p1', is_resolved: false };
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.alert.findUnique.mockResolvedValue(alert);
      mockPrisma.alert.update.mockResolvedValue({ ...alert, is_resolved: true });

      await service.resolve('u2', 'a1');

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { is_resolved: true, resolved_at: expect.any(Date) },
      });
    });

    it('throws ForbiddenException when called by a non-doctor', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(null);

      await expect(service.resolve('u1', 'a1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the alert does not exist', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.alert.findUnique.mockResolvedValue(null);

      await expect(service.resolve('u2', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findUnresolved', () => {
    it('returns unresolved alerts for a patient', async () => {
      const patient = { id: 'p1', user_id: 'u1' };
      const alerts = [{ id: 'a1', is_resolved: false }];
      mockPrisma.patient.findUnique.mockResolvedValue(patient);
      mockPrisma.alert.findMany.mockResolvedValue(alerts);

      const result = await service.findUnresolved('u1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ patient_id: 'p1', is_resolved: false }),
        }),
      );
    });

    it('returns unresolved alerts across all patients for a doctor', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
      mockPrisma.alert.findMany.mockResolvedValue([
        { id: 'a1', patient_id: 'p1', is_resolved: false },
        { id: 'a2', patient_id: 'p2', is_resolved: false },
      ]);

      const result = await service.findUnresolved('u2');

      expect(result).toHaveLength(2);
    });
  });
});
