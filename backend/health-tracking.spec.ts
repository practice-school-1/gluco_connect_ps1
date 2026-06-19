import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  GlucoseService,
  MealsService,
  ActivitiesService,
  SummaryService,
} from './health-tracking';
import { PrismaService } from './prisma/prisma.service';

const mockPrisma = {
  patient: { findUnique: jest.fn() },
  doctor: { findUnique: jest.fn() },
  glucoseReading: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  meal: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  activity: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
  },
};

const PATIENT = {
  id: 'p1',
  user_id: 'u1',
  target_glucose_min: 70,
  target_glucose_max: 140,
};

// ─────────────────────────────────────────────────────────────────────────────
// GlucoseService
// ─────────────────────────────────────────────────────────────────────────────

describe('GlucoseService', () => {
  let service: GlucoseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [GlucoseService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<GlucoseService>(GlucoseService);
  });

  describe('create', () => {
    const dto = {
      value_mg_dl: 110,
      reading_type: 'fasting' as any,
      recorded_at: '2026-06-19T08:00:00Z',
    };

    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.create('u1', dto)).rejects.toThrow(NotFoundException);
    });

    it('creates a glucose reading linked to the patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.create.mockResolvedValue({ id: 'g1', ...dto, patient_id: 'p1' });

      const result = await service.create('u1', dto);

      expect(mockPrisma.glucoseReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ patient_id: 'p1', value_mg_dl: 110 }),
        }),
      );
      expect(result.id).toBe('g1');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the reading does not exist', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findUnique.mockResolvedValue(null);

      await expect(service.findOne('u1', 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the reading belongs to a different patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findUnique.mockResolvedValue({
        id: 'g1',
        patient_id: 'OTHER_PATIENT',
        value_mg_dl: 120,
      });

      await expect(service.findOne('u1', 'g1')).rejects.toThrow(ForbiddenException);
    });

    it('returns the reading when the patient is the owner', async () => {
      const reading = { id: 'g1', patient_id: 'p1', value_mg_dl: 110 };
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findUnique.mockResolvedValue(reading);

      const result = await service.findOne('u1', 'g1');

      expect(result).toEqual(reading);
    });
  });

  describe('update', () => {
    it('updates the reading after validating ownership', async () => {
      const reading = { id: 'g1', patient_id: 'p1', value_mg_dl: 110 };
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findUnique.mockResolvedValue(reading);
      mockPrisma.glucoseReading.update.mockResolvedValue({ ...reading, value_mg_dl: 115 });

      const result = await service.update('u1', 'g1', { value_mg_dl: 115 });

      expect(mockPrisma.glucoseReading.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'g1' } }),
      );
      expect(result.value_mg_dl).toBe(115);
    });
  });

  describe('remove', () => {
    it('deletes the reading after validating ownership', async () => {
      const reading = { id: 'g1', patient_id: 'p1' };
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findUnique.mockResolvedValue(reading);
      mockPrisma.glucoseReading.delete.mockResolvedValue(reading);

      await service.remove('u1', 'g1');

      expect(mockPrisma.glucoseReading.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
    });
  });

  describe('getTimeInRange', () => {
    it('returns zero stats when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      const result = await service.getTimeInRange('u1');

      expect(result).toEqual({ time_in_range_pct: 0, total_readings: 0 });
    });

    it('returns zero stats when the patient has no readings', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);

      const result = await service.getTimeInRange('u1');

      expect(result).toEqual({ time_in_range_pct: 0, total_readings: 0 });
    });

    it('correctly calculates time-in-range for mixed readings', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 80 },  // in range
        { value_mg_dl: 120 }, // in range
        { value_mg_dl: 200 }, // above range
        { value_mg_dl: 60 },  // below range
      ]);

      const result = await service.getTimeInRange('u1');

      expect(result.time_in_range_pct).toBe(50);
      expect(result.in_range).toBe(2);
      expect(result.below_range).toBe(1);
      expect(result.above_range).toBe(1);
      expect(result.total_readings).toBe(4);
    });

    it('returns 100% when all readings are in range', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 90 },
        { value_mg_dl: 110 },
        { value_mg_dl: 130 },
      ]);

      const result = await service.getTimeInRange('u1');

      expect(result.time_in_range_pct).toBe(100);
    });

    it('uses the patient target range (not a hard-coded 70–140 default) when set', async () => {
      const patient = { ...PATIENT, target_glucose_min: 80, target_glucose_max: 160 };
      mockPrisma.patient.findUnique.mockResolvedValue(patient);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 75 }, // below 80 → out of range with custom target
        { value_mg_dl: 100 }, // in range
      ]);

      const result = await service.getTimeInRange('u1');

      expect(result.time_in_range_pct).toBe(50);
      expect(result.target_min).toBe(80);
      expect(result.target_max).toBe(160);
    });
  });

  describe('getHistory', () => {
    it('groups readings by date and returns daily aggregates', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 90,  recorded_at: new Date('2026-06-18T07:00:00Z') },
        { value_mg_dl: 110, recorded_at: new Date('2026-06-18T13:00:00Z') },
        { value_mg_dl: 130, recorded_at: new Date('2026-06-19T08:00:00Z') },
      ]);

      const result = await service.getHistory('u1');

      expect(result).toHaveLength(2);
      const june18 = result.find((r) => r.date === '2026-06-18');
      expect(june18).toBeDefined();
      expect(june18!.avg_glucose).toBe(100);
      expect(june18!.reading_count).toBe(2);
      expect(june18!.min).toBe(90);
      expect(june18!.max).toBe(110);
    });

    it('returns an empty array when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      const result = await service.getHistory('u1');

      expect(result).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MealsService
// ─────────────────────────────────────────────────────────────────────────────

describe('MealsService', () => {
  let service: MealsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MealsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<MealsService>(MealsService);
  });

  describe('create', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(
        service.create('u1', { meal_type: 'lunch' as any, logged_at: '2026-06-19T13:00:00Z' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('sums carbs and calories from meal items before saving', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.meal.create.mockResolvedValue({ id: 'm1', meal_items: [] });

      await service.create('u1', {
        meal_type: 'lunch' as any,
        logged_at: '2026-06-19T13:00:00Z',
        meal_items: [
          { name: 'Roti', carbs_grams: 25, calories: 120 },
          { name: 'Dal', carbs_grams: 18, calories: 150 },
        ],
      });

      expect(mockPrisma.meal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            total_carbs_grams: 43,
            total_calories: 270,
          }),
        }),
      );
    });

    it('creates a meal with zero carbs and calories when no meal items are provided', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.meal.create.mockResolvedValue({ id: 'm1', meal_items: [] });

      await service.create('u1', {
        meal_type: 'snack' as any,
        logged_at: '2026-06-19T16:00:00Z',
      });

      expect(mockPrisma.meal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ total_carbs_grams: 0, total_calories: 0 }),
        }),
      );
    });
  });

  describe('analyzePhoto', () => {
    it('returns a stub analysis with detected items and estimated totals', async () => {
      const result = await service.analyzePhoto({ photo_url: 'https://example.com/meal.jpg' });

      expect(result.detected_items).toBeDefined();
      expect(result.detected_items.length).toBeGreaterThan(0);
      expect(result.estimated_total_carbs).toBeDefined();
      expect(result.estimated_total_calories).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the meal does not exist', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.meal.findUnique.mockResolvedValue(null);

      await expect(service.findOne('u1', 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the meal belongs to a different patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.meal.findUnique.mockResolvedValue({
        id: 'm1',
        patient_id: 'OTHER_PATIENT',
        meal_items: [],
      });

      await expect(service.findOne('u1', 'm1')).rejects.toThrow(ForbiddenException);
    });

    it('returns the meal when the patient is the owner', async () => {
      const meal = { id: 'm1', patient_id: 'p1', meal_items: [] };
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.meal.findUnique.mockResolvedValue(meal);

      const result = await service.findOne('u1', 'm1');

      expect(result).toEqual(meal);
    });
  });

  describe('remove', () => {
    it('deletes the meal after validating ownership', async () => {
      const meal = { id: 'm1', patient_id: 'p1', meal_items: [] };
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.meal.findUnique.mockResolvedValue(meal);
      mockPrisma.meal.delete.mockResolvedValue(meal);

      await service.remove('u1', 'm1');

      expect(mockPrisma.meal.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ActivitiesService
// ─────────────────────────────────────────────────────────────────────────────

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivitiesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  describe('create', () => {
    const dto = {
      activity_type: 'walking',
      steps: 5000,
      started_at: '2026-06-19T07:00:00Z',
      date: '2026-06-19',
    };

    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.create('u1', dto as any)).rejects.toThrow(NotFoundException);
    });

    it('creates an activity linked to the patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.activity.create.mockResolvedValue({ id: 'a1', patient_id: 'p1', ...dto });

      const result = await service.create('u1', dto as any);

      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ patient_id: 'p1', steps: 5000 }),
        }),
      );
      expect(result.id).toBe('a1');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the activity does not exist', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue(null);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);

      await expect(service.findOne('u1', 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the activity belongs to a different patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.activity.findUnique.mockResolvedValue({
        id: 'a1',
        patient_id: 'OTHER_PATIENT',
      });

      await expect(service.findOne('u1', 'a1')).rejects.toThrow(ForbiddenException);
    });

    it('returns the activity when the patient is the owner', async () => {
      const activity = { id: 'a1', patient_id: 'p1' };
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.activity.findUnique.mockResolvedValue(activity);

      const result = await service.findOne('u1', 'a1');

      expect(result).toEqual(activity);
    });
  });

  describe('getSummary', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.getSummary('u1')).rejects.toThrow(NotFoundException);
    });

    it('returns grouped daily activity data for the last 7 days', async () => {
      const groupByResult = [
        {
          date: new Date('2026-06-17'),
          _sum: { steps: 8000, active_minutes: 45, calories_burned: 350 },
        },
      ];
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.activity.groupBy.mockResolvedValue(groupByResult);

      const result = await service.getSummary('u1');

      expect(result).toEqual(groupByResult);
      expect(mockPrisma.activity.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['date'],
          where: expect.objectContaining({ patient_id: 'p1' }),
          _sum: expect.objectContaining({ steps: true }),
        }),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SummaryService
// ─────────────────────────────────────────────────────────────────────────────

describe('SummaryService', () => {
  let service: SummaryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SummaryService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SummaryService>(SummaryService);
  });

  describe('getDaily', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.getDaily('u1')).rejects.toThrow(NotFoundException);
    });

    it('returns combined glucose, meals, and activity for the day', async () => {
      const readings = [
        { value_mg_dl: 90, recorded_at: new Date() },
        { value_mg_dl: 130, recorded_at: new Date() },
      ];
      const meals = [{ id: 'm1', meal_items: [] }];
      const activities = [{ id: 'a1', steps: 4000 }];

      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue(readings);
      mockPrisma.meal.findMany.mockResolvedValue(meals);
      mockPrisma.activity.findMany.mockResolvedValue(activities);

      const result = await service.getDaily('u1');

      expect(result.glucose_count).toBe(2);
      expect(result.avg_glucose).toBe(110);
      expect(result.meal_count).toBe(1);
      expect(result.total_steps).toBe(4000);
      expect(result.glucose_readings).toEqual(readings);
      expect(result.meals).toEqual(meals);
    });

    it('returns null avg_glucose when there are no readings for the day', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);

      const result = await service.getDaily('u1');

      expect(result.avg_glucose).toBeNull();
      expect(result.total_steps).toBe(0);
    });
  });

  describe('getWeekly', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.getWeekly('u1')).rejects.toThrow(NotFoundException);
    });

    it('returns a 7-day breakdown with weekly aggregate stats', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        { value_mg_dl: 100, recorded_at: new Date() },
        { value_mg_dl: 120, recorded_at: new Date() },
      ]);
      mockPrisma.activity.findMany.mockResolvedValue([
        { steps: 5000, date: new Date() },
        { steps: 3000, date: new Date() },
      ]);

      const result = await service.getWeekly('u1');

      expect(result.days).toHaveLength(7);
      expect(result.weekly_avg_glucose).toBe(110);
      expect(result.total_readings).toBe(2);
      expect(typeof result.time_in_range_pct).toBe('number');
      expect(typeof result.avg_daily_steps).toBe('number');
    });

    it('returns null weekly_avg_glucose when no readings exist for the week', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);

      const result = await service.getWeekly('u1');

      expect(result.weekly_avg_glucose).toBeNull();
      expect(result.time_in_range_pct).toBe(0);
      expect(result.total_readings).toBe(0);
    });
  });
});
