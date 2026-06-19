import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExportService } from './export';
import { PrismaService } from './prisma/prisma.service';

const mockPrisma = {
  doctor: { findUnique: jest.fn() },
  patient: { findUnique: jest.fn() },
  glucoseReading: { findMany: jest.fn() },
  meal: { findMany: jest.fn() },
  activity: { findMany: jest.fn() },
  medication: { findMany: jest.fn() },
};

const DOCTOR = { id: 'd1', user_id: 'u_doc' };
const PATIENT = {
  id: 'p1',
  user_id: 'u_pat',
  doctor_id: 'd1',
  full_name: 'Priya Menon',
  diabetes_type: 'Type 2',
};

const makeDate = (iso: string) => new Date(iso);

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ExportService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // exportPatientReport
  // ─────────────────────────────────────────────────────────────────────────────

  describe('exportPatientReport', () => {
    it('throws ForbiddenException when the caller is not a doctor', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(null);

      await expect(service.exportPatientReport('u_pat', 'p1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the patient does not exist', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.exportPatientReport('u_doc', 'p_bad')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the patient is not linked to this doctor', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue({ ...PATIENT, doctor_id: 'other-doctor' });

      await expect(service.exportPatientReport('u_doc', 'p1')).rejects.toThrow(ForbiddenException);
    });

    it('returns a string that starts with GlucoConnect report headers', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.medication.findMany.mockResolvedValue([]);

      const result = await service.exportPatientReport('u_doc', 'p1');

      expect(typeof result).toBe('string');
      expect(result).toContain('# GlucoConnect Patient Report');
      expect(result).toContain('Priya Menon');
      expect(result).toContain('Type 2');
    });

    it('includes glucose section with correct column headers', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.medication.findMany.mockResolvedValue([]);

      const result = await service.exportPatientReport('u_doc', 'p1');

      expect(result).toContain('## GLUCOSE READINGS');
      expect(result).toContain('Date,Time,Value (mg/dL),Reading Type,Source,Notes');
    });

    it('includes meals section with correct column headers', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.medication.findMany.mockResolvedValue([]);

      const result = await service.exportPatientReport('u_doc', 'p1');

      expect(result).toContain('## MEALS');
      expect(result).toContain('Date,Time,Meal Type,Total Carbs (g),Total Calories,Notes');
    });

    it('includes activities section with correct column headers', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.medication.findMany.mockResolvedValue([]);

      const result = await service.exportPatientReport('u_doc', 'p1');

      expect(result).toContain('## ACTIVITIES');
      expect(result).toContain('Date,Activity Type,Steps,Duration (min),Calories Burned,Intensity');
    });

    it('includes medications section with correct column headers', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.medication.findMany.mockResolvedValue([]);

      const result = await service.exportPatientReport('u_doc', 'p1');

      expect(result).toContain('## ACTIVE MEDICATIONS');
      expect(result).toContain('Medication,Dosage,Frequency,Route,Start Date');
    });

    it('writes glucose reading data rows with correct date, time, and value', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        {
          value_mg_dl: 112,
          reading_type: 'fasting',
          source: 'manual',
          notes: 'Morning reading',
          recorded_at: makeDate('2026-06-18T07:30:00Z'),
        },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.medication.findMany.mockResolvedValue([]);

      const result = await service.exportPatientReport('u_doc', 'p1');

      expect(result).toContain('2026-06-18');
      expect(result).toContain('07:30');
      expect(result).toContain('112');
      expect(result).toContain('fasting');
    });

    it('writes meal data rows with correct date, type, carbs, and calories', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([
        {
          meal_type: 'lunch',
          total_carbs_grams: 45,
          total_calories: 320,
          notes: null,
          logged_at: makeDate('2026-06-18T13:00:00Z'),
        },
      ]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.medication.findMany.mockResolvedValue([]);

      const result = await service.exportPatientReport('u_doc', 'p1');

      expect(result).toContain('2026-06-18');
      expect(result).toContain('lunch');
      expect(result).toContain('45');
      expect(result).toContain('320');
    });

    it('writes activity data rows with correct date, steps, and duration', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([
        {
          activity_type: 'walking',
          steps: 6200,
          active_minutes: 45,
          calories_burned: 280,
          intensity: 'moderate',
          date: makeDate('2026-06-18T00:00:00Z'),
        },
      ]);
      mockPrisma.medication.findMany.mockResolvedValue([]);

      const result = await service.exportPatientReport('u_doc', 'p1');

      expect(result).toContain('walking');
      expect(result).toContain('6200');
      expect(result).toContain('45');
    });

    it('writes medication data rows with name, dosage, and start date', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.medication.findMany.mockResolvedValue([
        {
          name: 'Metformin',
          dosage: '500mg',
          frequency: 'twice daily',
          route: 'oral',
          start_date: makeDate('2026-05-01T00:00:00Z'),
        },
      ]);

      const result = await service.exportPatientReport('u_doc', 'p1');

      expect(result).toContain('Metformin');
      expect(result).toContain('500mg');
      expect(result).toContain('2026-05-01');
    });

    it('escapes commas in string values to prevent broken CSV columns', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        {
          value_mg_dl: 130,
          reading_type: 'random',
          source: 'manual',
          notes: 'After lunch, felt dizzy',
          recorded_at: makeDate('2026-06-18T14:00:00Z'),
        },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.medication.findMany.mockResolvedValue([]);

      const result = await service.exportPatientReport('u_doc', 'p1');

      expect(result).toContain('"After lunch, felt dizzy"');
    });

    it('queries the correct patient ID for both glucose and meals', async () => {
      mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.medication.findMany.mockResolvedValue([]);

      await service.exportPatientReport('u_doc', 'p1');

      expect(mockPrisma.glucoseReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ patient_id: 'p1' }) }),
      );
      expect(mockPrisma.meal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ patient_id: 'p1' }) }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // exportMyData
  // ─────────────────────────────────────────────────────────────────────────────

  describe('exportMyData', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.exportMyData('u_pat')).rejects.toThrow(NotFoundException);
    });

    it('returns a string with the personal data export header', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);

      const result = await service.exportMyData('u_pat');

      expect(typeof result).toBe('string');
      expect(result).toContain('# My GlucoConnect Data Export');
    });

    it('includes glucose, meals, and activities sections', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);

      const result = await service.exportMyData('u_pat');

      expect(result).toContain('## GLUCOSE READINGS');
      expect(result).toContain('## MEALS');
      expect(result).toContain('## ACTIVITIES');
    });

    it('queries using the correct patient ID', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);

      await service.exportMyData('u_pat');

      expect(mockPrisma.glucoseReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ patient_id: 'p1' }) }),
      );
    });

    it('writes actual glucose readings into the output', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.glucoseReading.findMany.mockResolvedValue([
        {
          value_mg_dl: 98,
          reading_type: 'fasting',
          notes: null,
          recorded_at: makeDate('2026-06-17T07:00:00Z'),
        },
      ]);
      mockPrisma.meal.findMany.mockResolvedValue([]);
      mockPrisma.activity.findMany.mockResolvedValue([]);

      const result = await service.exportMyData('u_pat');

      expect(result).toContain('2026-06-17');
      expect(result).toContain('98');
      expect(result).toContain('fasting');
    });
  });
});
