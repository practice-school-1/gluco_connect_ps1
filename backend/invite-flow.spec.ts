import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DoctorsService, PatientsService } from './profiles';
import { PrismaService } from './prisma/prisma.service';

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
  glucoseReading: { findFirst: jest.fn() },
  alert: { count: jest.fn() },
};

// ─────────────────────────────────────────────────────────────────────────────
// Invite code generation
// ─────────────────────────────────────────────────────────────────────────────

describe('Invite code — DoctorsService.createProfile', () => {
  let service: DoctorsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DoctorsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<DoctorsService>(DoctorsService);
  });

  it('generates an invite code on doctor profile creation', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(null);
    mockPrisma.doctor.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'd1', ...data }),
    );

    const result = await service.createProfile('u1', {
      full_name: 'Dr. Priya',
      license_number: 'MED001',
    });

    expect(result.invite_code).toBeDefined();
  });

  it('invite code is exactly 6 characters', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(null);
    mockPrisma.doctor.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'd1', ...data }),
    );

    const result = await service.createProfile('u1', {
      full_name: 'Dr. Priya',
      license_number: 'MED001',
    });

    expect(result.invite_code).toHaveLength(6);
  });

  it('invite code contains only uppercase alphanumeric characters', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(null);
    mockPrisma.doctor.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'd1', ...data }),
    );

    const result = await service.createProfile('u1', {
      full_name: 'Dr. Priya',
      license_number: 'MED001',
    });

    expect(result.invite_code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('throws ConflictException if doctor profile already exists', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue({ id: 'd1' });

    await expect(
      service.createProfile('u1', { full_name: 'Dr. Priya', license_number: 'MED001' }),
    ).rejects.toThrow(ConflictException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invite flow — patient linking
// ─────────────────────────────────────────────────────────────────────────────

describe('Invite flow — PatientsService.linkDoctor', () => {
  let patientsService: PatientsService;
  let doctorsService: DoctorsService;

  const DOCTOR = { id: 'd1', user_id: 'u_doc', invite_code: 'ABC123' };
  const PATIENT = { id: 'p1', user_id: 'u_pat', doctor_id: null };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorsService,
        PatientsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    patientsService = module.get<PatientsService>(PatientsService);
    doctorsService = module.get<DoctorsService>(DoctorsService);
  });

  // ─── Happy path ─────────────────────────────────────────────────────────

  it('links a patient to a doctor using a valid invite code', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
    mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
    mockPrisma.patient.update.mockResolvedValue({ ...PATIENT, doctor_id: 'd1' });

    const result = await patientsService.linkDoctor('u_pat', { invite_code: 'ABC123' });

    expect(mockPrisma.patient.update).toHaveBeenCalledWith({
      where: { user_id: 'u_pat' },
      data: { doctor_id: 'd1' },
    });
    expect(result.doctor_id).toBe('d1');
  });

  it('linked patient appears in the doctor patient list', async () => {
    const linkedPatient = { id: 'p1', user: { id: 'u_pat', email: 'p@test.com', is_active: true } };
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
    mockPrisma.patient.findMany.mockResolvedValue([linkedPatient]);
    mockPrisma.glucoseReading.findFirst.mockResolvedValue({ value_mg_dl: 110 });
    mockPrisma.alert.count.mockResolvedValue(0);

    const result = await doctorsService.getMyPatients('u_doc');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].latest_glucose).toEqual({ value_mg_dl: 110 });
    expect(result[0].unresolved_alerts).toBe(0);
  });

  it('patient with no glucose readings still appears in list with latest_glucose null', async () => {
    const linkedPatient = { id: 'p1', user: { id: 'u_pat', email: 'p@test.com', is_active: true } };
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
    mockPrisma.patient.findMany.mockResolvedValue([linkedPatient]);
    mockPrisma.glucoseReading.findFirst.mockResolvedValue(null);
    mockPrisma.alert.count.mockResolvedValue(0);

    const result = await doctorsService.getMyPatients('u_doc');

    expect(result[0].latest_glucose).toBeNull();
  });

  // ─── Error cases ─────────────────────────────────────────────────────────

  it('throws NotFoundException for an invalid invite code', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(null);

    await expect(
      patientsService.linkDoctor('u_pat', { invite_code: 'XXXXXX' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when patient profile does not exist', async () => {
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
    mockPrisma.patient.findUnique.mockResolvedValue(null);

    await expect(
      patientsService.linkDoctor('u_pat', { invite_code: 'ABC123' }),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── Bugs exposed — P2 to fix in Week 4 ──────────────────────────────────

  it('BUG: allows a patient already linked to a different doctor to re-link (no guard)', async () => {
    // Currently the service does not check if patient.doctor_id is already set.
    // A patient can silently switch doctors by using a different invite code.
    // Expected behaviour (to be enforced): throw ConflictException if already linked.
    const alreadyLinkedPatient = { ...PATIENT, doctor_id: 'other-doctor-id' };
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);
    mockPrisma.patient.findUnique.mockResolvedValue(alreadyLinkedPatient);
    mockPrisma.patient.update.mockResolvedValue({ ...alreadyLinkedPatient, doctor_id: 'd1' });

    // Currently succeeds — this is the bug
    const result = await patientsService.linkDoctor('u_pat', { invite_code: 'ABC123' });
    expect(result.doctor_id).toBe('d1'); // re-link succeeded silently
  });

  it('BUG: same invite code can be used by multiple patients (no single-use enforcement)', async () => {
    // The invite code is a permanent field on the Doctor model.
    // Any number of patients can use it. There is no usage count or expiry.
    // Expected behaviour (to be enforced): codes should expire after 72 hours or one use.
    mockPrisma.doctor.findUnique.mockResolvedValue(DOCTOR);

    // Patient 1 links
    mockPrisma.patient.findUnique.mockResolvedValueOnce({ id: 'p1', user_id: 'u1', doctor_id: null });
    mockPrisma.patient.update.mockResolvedValueOnce({ id: 'p1', doctor_id: 'd1' });
    await patientsService.linkDoctor('u1', { invite_code: 'ABC123' });

    // Patient 2 links with the SAME code — currently no error
    mockPrisma.patient.findUnique.mockResolvedValueOnce({ id: 'p2', user_id: 'u2', doctor_id: null });
    mockPrisma.patient.update.mockResolvedValueOnce({ id: 'p2', doctor_id: 'd1' });
    const result = await patientsService.linkDoctor('u2', { invite_code: 'ABC123' });

    // Both succeeded — this is the bug
    expect(result.doctor_id).toBe('d1');
  });

  it.todo('rejects an invite code that is older than 72 hours (expiry not yet implemented — P2 Week 4 task)');

  it.todo('rejects a code that has already been used once (single-use not yet implemented — P2 Week 4 task)');

  it.todo('POST /invites endpoint to generate a time-limited code (not yet implemented — P2 Week 4 task)');
});
