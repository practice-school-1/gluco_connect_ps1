/**
 * Security access-control tests — P6 QA, Week 4 Day 19 (June 19 2026)
 *
 * Scenarios verified:
 *  1. Patient A cannot read Patient B's glucose, meal, or activity data  → ForbiddenException (HTTP 403)
 *  2. A patient user cannot call the doctor-only patient-list endpoint    → NotFoundException (HTTP 404)
 *     NOTE: this returns 404 instead of 403 because the guard checks for
 *     the existence of a doctor profile rather than the user's role field.
 *     Recommend P2 replace the NotFoundException with ForbiddenException
 *     in DoctorsService.getMyPatients for cleaner security semantics.
 *  3. A patient cannot create or resolve clinical alerts                  → ForbiddenException (HTTP 403)
 *
 * Findings for P2:
 *  - BUG (P1): DoctorsService.getMyPatients returns 404 instead of 403
 *    when called by a non-doctor user. A patient can infer no doctor
 *    profile exists. Should throw ForbiddenException.
 *  - No SQL-injection risk: all queries go through Prisma's parameterised
 *    query builder — raw string interpolation is not used in any endpoint.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GlucoseService, MealsService, ActivitiesService } from './health-tracking';
import { DoctorsService } from './profiles';
import { AlertsService } from './clinical-care';
import { PrismaService } from './prisma/prisma.service';

// ─── shared mock ─────────────────────────────────────────────────────────────

const mockPrisma = {
  patient: { findUnique: jest.fn(), findMany: jest.fn() },
  doctor: { findUnique: jest.fn() },
  glucoseReading: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  meal: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  activity: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
  },
  alert: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  insight: { findFirst: jest.fn() },
};

// Patient A owns the resource; Patient B is the requester
const PATIENT_A = { id: 'p_a', user_id: 'u_a', target_glucose_min: 70, target_glucose_max: 140 };
const PATIENT_B = { id: 'p_b', user_id: 'u_b', target_glucose_min: 70, target_glucose_max: 140 };

// ─────────────────────────────────────────────────────────────────────────────
// Cross-patient data isolation — glucose readings
// ─────────────────────────────────────────────────────────────────────────────

describe('Security: cross-patient glucose data isolation', () => {
  let service: GlucoseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [GlucoseService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<GlucoseService>(GlucoseService);
  });

  it('returns 403 when Patient B tries to read Patient A\'s glucose reading', async () => {
    // Patient B is authenticated (user_id = u_b)
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT_B);
    // The reading belongs to Patient A
    mockPrisma.glucoseReading.findUnique.mockResolvedValue({
      id: 'g1',
      patient_id: PATIENT_A.id,
      value_mg_dl: 180,
    });

    await expect(service.findOne('u_b', 'g1')).rejects.toThrow(ForbiddenException);
  });

  it('returns 403 when Patient B tries to update Patient A\'s glucose reading', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT_B);
    mockPrisma.glucoseReading.findUnique.mockResolvedValue({
      id: 'g1',
      patient_id: PATIENT_A.id,
      value_mg_dl: 180,
    });

    await expect(service.update('u_b', 'g1', { value_mg_dl: 100 })).rejects.toThrow(ForbiddenException);
  });

  it('returns 403 when Patient B tries to delete Patient A\'s glucose reading', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT_B);
    mockPrisma.glucoseReading.findUnique.mockResolvedValue({
      id: 'g1',
      patient_id: PATIENT_A.id,
    });

    await expect(service.remove('u_b', 'g1')).rejects.toThrow(ForbiddenException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-patient data isolation — meals
// ─────────────────────────────────────────────────────────────────────────────

describe('Security: cross-patient meal data isolation', () => {
  let service: MealsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MealsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<MealsService>(MealsService);
  });

  it('returns 403 when Patient B tries to read Patient A\'s meal', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT_B);
    mockPrisma.meal.findUnique.mockResolvedValue({
      id: 'm1',
      patient_id: PATIENT_A.id,
      meal_items: [],
    });

    await expect(service.findOne('u_b', 'm1')).rejects.toThrow(ForbiddenException);
  });

  it('returns 403 when Patient B tries to delete Patient A\'s meal', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT_B);
    mockPrisma.meal.findUnique.mockResolvedValue({
      id: 'm1',
      patient_id: PATIENT_A.id,
      meal_items: [],
    });

    await expect(service.remove('u_b', 'm1')).rejects.toThrow(ForbiddenException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-patient data isolation — activities
// ─────────────────────────────────────────────────────────────────────────────

describe('Security: cross-patient activity data isolation', () => {
  let service: ActivitiesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivitiesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  it('returns 403 when Patient B tries to read Patient A\'s activity entry', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT_B);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: 'a1',
      patient_id: PATIENT_A.id,
    });

    await expect(service.findOne('u_b', 'a1')).rejects.toThrow(ForbiddenException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Role-based access — doctor-only endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe('Security: patient accessing doctor-only patient list', () => {
  let service: DoctorsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DoctorsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<DoctorsService>(DoctorsService);
  });

  it('returns 404 when a patient user calls getMyPatients (no doctor profile exists)', async () => {
    // A patient's user_id will not match any doctor profile
    mockPrisma.doctor.findUnique.mockResolvedValue(null);

    // Currently returns NotFoundException (404). P2 to change to ForbiddenException (403).
    await expect(service.getMyPatients('u_b')).rejects.toThrow(NotFoundException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Role-based access — alerts (doctor-only write operations)
// ─────────────────────────────────────────────────────────────────────────────

describe('Security: patient accessing doctor-only alerts endpoints', () => {
  let service: AlertsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AlertsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  it('returns 403 when a patient user tries to create a clinical alert', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(null);

    await expect(
      service.create('u_b', { patient_id: 'p_a', type: 'high_glucose' as any, trigger_value: 220 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns 403 when a patient user tries to resolve a clinical alert', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(null);

    await expect(service.resolve('u_b', 'a1')).rejects.toThrow(ForbiddenException);
  });
});
