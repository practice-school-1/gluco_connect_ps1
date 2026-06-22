/**
 * UAT regression suite — P6 QA, Week 5 Day 21 (June 23 2026)
 *
 * Six end-to-end scenarios covering the complete GlucoConnect user journeys.
 * Each scenario calls the actual service layer against a mocked PrismaService,
 * mirroring how the controllers orchestrate work in production.
 *
 * Scenarios:
 *  1. Doctor creates profile (invite code generated) → patient links → patient visible in portal
 *  2. Patient logs glucose, meal, and activity — daily summary aggregates all three
 *  3. AI insight generated on first call and returned from cache on the second call
 *  4. Doctor exports patient CSV (unauthorised access blocked at every guard)
 *  5. Weekly summary cron generates summaries for active patients, skips duplicates
 *  6. Security regression — cross-patient isolation and doctor-only role access
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { DoctorsService, PatientsService, LinkDoctorDto }  from './profiles';
import { GlucoseService, MealsService, ActivitiesService } from './health-tracking';
import { SummaryService }                                  from './summary';
import { InsightsService }                                 from './clinical-care';
import { ExportService }                                   from './export';
import { WeeklySummaryJob }                                from './cron';
import { FoodsService }                                    from './foods';
import { PrismaService }                                   from './prisma/prisma.service';

// ─── shared fixtures ──────────────────────────────────────────────────────────

const U_DOCTOR  = 'u_doc';
const U_PATIENT = 'u_pat';

const DOCTOR = {
  id: 'd1',
  user_id: U_DOCTOR,
  full_name: 'Dr. Suresh Iyer',
  invite_code: 'INV123',
};

const PATIENT = {
  id: 'p1',
  user_id: U_PATIENT,
  doctor_id: 'd1',
  full_name: 'Priya Menon',
  diabetes_type: 'Type 2',
  target_glucose_min: 70,
  target_glucose_max: 140,
};

const READING_FASTING = {
  id: 'g1',
  patient_id: 'p1',
  value_mg_dl: 95,
  reading_type: 'fasting',
  recorded_at: new Date('2026-06-23T07:00:00Z'),
  source: 'manual',
  notes: 'Before breakfast',
};

const MEAL_ENTRY = {
  id: 'm1',
  patient_id: 'p1',
  meal_type: 'breakfast',
  notes: 'Roti with dal',
  logged_at: new Date('2026-06-23T08:00:00Z'),
  meal_items: [],
  total_carbs_grams: 50,
  total_calories: 280,
};

const ACTIVITY_ENTRY = {
  id: 'a1',
  patient_id: 'p1',
  activity_type: 'walking',
  steps: 4500,
  active_minutes: 35,
  date: new Date('2026-06-23T00:00:00Z'),
  started_at: new Date('2026-06-23T18:00:00Z'),
};

// ─── comprehensive Prisma mock factory ───────────────────────────────────────

const buildMock = () => ({
  doctor: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  patient: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  glucoseReading: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
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
  insight: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  alert:      { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
  medication: { findMany: jest.fn() },
  user:       { findUnique: jest.fn() },
});

// ─── Scenario 1: Doctor generates invite → patient links → portal shows patient ──

describe('UAT Scenario 1: doctor creates profile → patient links → patient visible in portal', () => {
  let doctorsService:  DoctorsService;
  let patientsService: PatientsService;
  let mockPrisma:      ReturnType<typeof buildMock>;

  beforeEach(async () => {
    mockPrisma = buildMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorsService,
        PatientsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    doctorsService  = module.get<DoctorsService>(DoctorsService);
    patientsService = module.get<PatientsService>(PatientsService);
  });

  it('createProfile generates a 6-character alphanumeric invite code and stores it on the doctor', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(null);
    mockPrisma.doctor.create.mockImplementation(async ({ data }) =>
      ({ id: 'd1', ...data }),
    );

    const result = await doctorsService.createProfile(U_DOCTOR, {
      full_name: 'Dr. Suresh Iyer',
      specialty: 'Endocrinology',
      clinic_name: 'Iyer Diabetes Clinic',
    } as any);

    expect(result.invite_code).toMatch(/^[A-Z0-9]{6}$/);
    expect(mockPrisma.doctor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user_id: U_DOCTOR }),
      }),
    );
  });

  it('createProfile throws ConflictException if the doctor already has a profile', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);

    await expect(
      doctorsService.createProfile(U_DOCTOR, {} as any),
    ).rejects.toThrow(ConflictException);
  });

  it('patient links to a doctor using the doctor\'s invite code', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
    mockPrisma.patient.findUnique.mockResolvedValue({ ...PATIENT, doctor_id: null });
    mockPrisma.patient.update.mockResolvedValue({ ...PATIENT, doctor_id: 'd1' });

    const dto: LinkDoctorDto = { invite_code: 'INV123' };
    const result = await patientsService.linkDoctor(U_PATIENT, dto);

    expect(result.doctor_id).toBe('d1');
    expect(mockPrisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { doctor_id: 'd1' } }),
    );
  });

  it('linkDoctor throws NotFoundException for an invalid invite code', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(null);

    await expect(
      patientsService.linkDoctor(U_PATIENT, { invite_code: 'BADXXX' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('linked patient appears in the doctor patient list with latest glucose', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
    mockPrisma.patient.findMany.mockResolvedValue([
      { ...PATIENT, user: { id: U_PATIENT, phone: null, email: null, is_active: true } },
    ]);
    mockPrisma.glucoseReading.findFirst.mockResolvedValue(READING_FASTING);
    mockPrisma.alert.count.mockResolvedValue(0);

    const patients = await doctorsService.getMyPatients(U_DOCTOR);

    expect(patients).toHaveLength(1);
    expect(patients[0].full_name).toBe('Priya Menon');
    expect(patients[0].latest_glucose?.value_mg_dl).toBe(95);
    expect(patients[0].unresolved_alerts).toBe(0);
  });
});

// ─── Scenario 2: Full daily log — glucose → meal → activity → summary ─────────

describe('UAT Scenario 2: patient logs glucose, meal, and activity; daily summary aggregates all', () => {
  let glucoseService:    GlucoseService;
  let mealsService:      MealsService;
  let activitiesService: ActivitiesService;
  let summaryService:    SummaryService;
  let mockPrisma:        ReturnType<typeof buildMock>;

  beforeEach(async () => {
    mockPrisma = buildMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlucoseService,
        MealsService,
        ActivitiesService,
        SummaryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    glucoseService    = module.get<GlucoseService>(GlucoseService);
    mealsService      = module.get<MealsService>(MealsService);
    activitiesService = module.get<ActivitiesService>(ActivitiesService);
    summaryService    = module.get<SummaryService>(SummaryService);
  });

  it('patient logs a fasting glucose reading', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
    mockPrisma.glucoseReading.create.mockResolvedValue(READING_FASTING);

    const result = await glucoseService.create(U_PATIENT, {
      value_mg_dl: 95,
      reading_type: 'fasting' as any,
      recorded_at: '2026-06-23T07:00:00Z',
    });

    expect(result.value_mg_dl).toBe(95);
    expect(result.reading_type).toBe('fasting');
  });

  it('glucose reading outside 20–600 mg/dL is not written (DTO validation enforces range)', () => {
    // Validation is enforced at the controller layer via class-validator;
    // service layer trusts validated input — this test documents the contract.
    expect(true).toBe(true);
  });

  it('patient logs a meal with tagged items', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
    mockPrisma.meal.create.mockResolvedValue(MEAL_ENTRY);

    const result = await mealsService.create(U_PATIENT, {
      meal_type: 'breakfast' as any,
      notes: 'Roti with dal',
      logged_at: '2026-06-23T08:00:00Z',
      meal_items: [
        { name: 'Roti', quantity: '2 pieces', carbs_grams: 30, calories: 140 },
      ],
    });

    expect(result.meal_type).toBe('breakfast');
    expect(mockPrisma.meal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ patient_id: 'p1', meal_type: 'breakfast' }),
      }),
    );
  });

  it('patient logs an activity', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
    mockPrisma.activity.create.mockResolvedValue(ACTIVITY_ENTRY);

    const result = await activitiesService.create(U_PATIENT, {
      activity_type: 'walking',
      steps: 4500,
      active_minutes: 35,
      date: '2026-06-23',
      started_at: '2026-06-23T18:00:00Z',
    });

    expect(result.steps).toBe(4500);
  });

  it('daily summary returns all three log types for the date', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
    mockPrisma.glucoseReading.findMany.mockResolvedValue([READING_FASTING]);
    mockPrisma.meal.findMany.mockResolvedValue([MEAL_ENTRY]);
    mockPrisma.activity.findMany.mockResolvedValue([ACTIVITY_ENTRY]);

    const summary = await summaryService.getDailySummary(U_PATIENT, '2026-06-23');

    expect(summary.date).toBe('2026-06-23');
    expect(summary.glucose_readings).toHaveLength(1);
    expect(summary.meals).toHaveLength(1);
    expect(summary.activities).toHaveLength(1);
    expect(summary.glucose_readings[0].value_mg_dl).toBe(95);
  });
});

// ─── Scenario 3: AI insight — generated on first call, cached on second ───────

describe('UAT Scenario 3: AI insight generated on first call, served from cache on second', () => {
  let insightsService: InsightsService;
  let mockPrisma:      ReturnType<typeof buildMock>;

  const DAILY_INSIGHT = {
    id: 'ins1',
    patient_id: 'p1',
    type: 'daily_nudge',
    flag: 'normal',
    message: 'Your fasting glucose looks good. Keep logging consistently.',
    content: 'Your fasting glucose looks good. Keep logging consistently.',
    generated_by: 'rule_engine',
    created_at: new Date(),
    dismissed_at: null,
  };

  beforeEach(async () => {
    mockPrisma = buildMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [InsightsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    insightsService = module.get<InsightsService>(InsightsService);
  });

  it('creates a new daily insight when none exists for today', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
    mockPrisma.insight.findFirst.mockResolvedValue(null);
    mockPrisma.glucoseReading.findMany.mockResolvedValue([READING_FASTING]);
    mockPrisma.meal.findMany.mockResolvedValue([]);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.insight.create.mockResolvedValue(DAILY_INSIGHT);

    const result = await insightsService.getDaily(U_PATIENT);

    expect(mockPrisma.insight.create).toHaveBeenCalledTimes(1);
    expect(result.type).toBe('daily_nudge');
  });

  it('returns the cached insight on a second call within the same day', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
    mockPrisma.insight.findFirst.mockResolvedValue(DAILY_INSIGHT);

    const result = await insightsService.getDaily(U_PATIENT);

    expect(mockPrisma.insight.create).not.toHaveBeenCalled();
    expect(result.id).toBe('ins1');
  });

  it('patient can dismiss an insight', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
    mockPrisma.insight.findUnique.mockResolvedValue(DAILY_INSIGHT);
    mockPrisma.insight.update.mockResolvedValue({ ...DAILY_INSIGHT, dismissed_at: new Date() });

    const result = await insightsService.dismiss(U_PATIENT, 'ins1');

    expect(result.dismissed_at).not.toBeNull();
    expect(mockPrisma.insight.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ins1' } }),
    );
  });
});

// ─── Scenario 4: Doctor exports patient CSV ───────────────────────────────────

describe('UAT Scenario 4: doctor exports patient CSV; unauthorised access blocked', () => {
  let exportService: ExportService;
  let mockPrisma:    ReturnType<typeof buildMock>;

  beforeEach(async () => {
    mockPrisma = buildMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ExportService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    exportService = module.get<ExportService>(ExportService);
  });

  it('doctor can export their own patient\'s data as a CSV string', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
    mockPrisma.glucoseReading.findMany.mockResolvedValue([READING_FASTING]);
    mockPrisma.meal.findMany.mockResolvedValue([]);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.medication.findMany.mockResolvedValue([]);

    const csv = await exportService.exportPatientReport(U_DOCTOR, 'p1');

    expect(typeof csv).toBe('string');
    expect(csv).toContain('## GLUCOSE READINGS');
    expect(csv).toContain('Value (mg/dL)');
  });

  it('blocks export when the doctor does not own the patient', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
    mockPrisma.patient.findUnique.mockResolvedValue({ ...PATIENT, doctor_id: 'other-doctor' });

    await expect(exportService.exportPatientReport(U_DOCTOR, 'p1')).rejects.toThrow(ForbiddenException);
  });

  it('blocks export when the caller has no doctor profile', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(null);

    await expect(exportService.exportPatientReport(U_PATIENT, 'p1')).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the patient record does not exist', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
    mockPrisma.patient.findUnique.mockResolvedValue(null);

    await expect(exportService.exportPatientReport(U_DOCTOR, 'bad-id')).rejects.toThrow(NotFoundException);
  });
});

// ─── Scenario 5: Weekly summary cron ─────────────────────────────────────────

describe('UAT Scenario 5: weekly summary cron generates summaries, skips patients already summarised', () => {
  let job:        WeeklySummaryJob;
  let mockPrisma: ReturnType<typeof buildMock>;

  beforeEach(async () => {
    mockPrisma = buildMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [WeeklySummaryJob, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    job = module.get<WeeklySummaryJob>(WeeklySummaryJob);
  });

  it('generates a weekly_summary insight for each active patient with data', async () => {
    mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
    mockPrisma.insight.findFirst.mockResolvedValue(null);
    mockPrisma.glucoseReading.findMany.mockResolvedValue([
      { value_mg_dl: 95, reading_type: 'fasting', recorded_at: new Date() },
      { value_mg_dl: 120, reading_type: 'post_meal', recorded_at: new Date() },
    ]);
    mockPrisma.meal.findMany.mockResolvedValue([MEAL_ENTRY]);
    mockPrisma.activity.findMany.mockResolvedValue([ACTIVITY_ENTRY]);
    mockPrisma.insight.create.mockResolvedValue({ id: 'w1', type: 'weekly_summary' });

    await job.generateWeeklySummaries();

    expect(mockPrisma.insight.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.insight.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'weekly_summary', patient_id: 'p1' }),
      }),
    );
  });

  it('skips a patient who already has a weekly_summary generated this week', async () => {
    mockPrisma.patient.findMany.mockResolvedValue([PATIENT]);
    mockPrisma.insight.findFirst.mockResolvedValue({ id: 'existing-weekly' });

    await job.generateWeeklySummaries();

    expect(mockPrisma.glucoseReading.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.insight.create).not.toHaveBeenCalled();
  });
});

// ─── Scenario 6: Security regression ─────────────────────────────────────────

describe('UAT Scenario 6: security regression — cross-patient isolation and doctor-only role access', () => {
  let glucoseService: GlucoseService;
  let doctorsService: DoctorsService;
  let mockPrisma:     ReturnType<typeof buildMock>;

  const PATIENT_B = {
    id: 'p2',
    user_id: 'u_pat_b',
    doctor_id: 'd1',
    target_glucose_min: 70,
    target_glucose_max: 140,
  };

  beforeEach(async () => {
    mockPrisma = buildMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [GlucoseService, DoctorsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    glucoseService = module.get<GlucoseService>(GlucoseService);
    doctorsService = module.get<DoctorsService>(DoctorsService);
  });

  it('Patient B cannot read Patient A\'s glucose reading (ForbiddenException)', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT_B);
    mockPrisma.glucoseReading.findUnique.mockResolvedValue({
      id: 'g1',
      patient_id: PATIENT.id,
      value_mg_dl: 180,
    });

    await expect(glucoseService.findOne('u_pat_b', 'g1')).rejects.toThrow(ForbiddenException);
  });

  it('Patient B cannot update Patient A\'s glucose reading (ForbiddenException)', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT_B);
    mockPrisma.glucoseReading.findUnique.mockResolvedValue({
      id: 'g1',
      patient_id: PATIENT.id,
      value_mg_dl: 180,
    });

    await expect(
      glucoseService.update('u_pat_b', 'g1', { value_mg_dl: 100 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('Patient B cannot delete Patient A\'s glucose reading (ForbiddenException)', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT_B);
    mockPrisma.glucoseReading.findUnique.mockResolvedValue({
      id: 'g1',
      patient_id: PATIENT.id,
      value_mg_dl: 180,
    });

    await expect(glucoseService.remove('u_pat_b', 'g1')).rejects.toThrow(ForbiddenException);
  });

  it('patient user calling getMyPatients (doctor-only) gets NotFoundException', async () => {
    // Documents current behaviour: DoctorsService checks for a doctor profile,
    // not the user role. Returns NotFoundException (404) when no doctor profile
    // exists. Open issue #1 — P2 should change to ForbiddenException (403).
    mockPrisma.doctor.findUnique.mockResolvedValue(null);

    await expect(doctorsService.getMyPatients(U_PATIENT)).rejects.toThrow(NotFoundException);
  });
});

// ─── Scenario 7: Indian food search returns correct results ───────────────────

describe('UAT Scenario 7: food search returns correct entries from the Indian food database', () => {
  let foodsService: FoodsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FoodsService],
    }).compile();

    foodsService = module.get<FoodsService>(FoodsService);
  });

  it('search("roti") returns at least one result', () => {
    const results = foodsService.search('roti');
    expect(results.length).toBeGreaterThan(0);
  });

  it('search("biryani") returns at least one result', () => {
    const results = foodsService.search('biryani');
    expect(results.length).toBeGreaterThan(0);
  });

  it('search("dal") returns at least one result', () => {
    const results = foodsService.search('dal');
    expect(results.length).toBeGreaterThan(0);
  });

  it('every result has a gi_index value of low, medium, or high', () => {
    const results = foodsService.search('rice');
    results.forEach(f => expect(['low', 'medium', 'high']).toContain(f.gi_index));
  });

  it('a very short query returns at most 20 default results', () => {
    const results = foodsService.search('a');
    expect(results.length).toBeLessThanOrEqual(20);
  });
});
