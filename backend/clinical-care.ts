import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Injectable, NotFoundException, ForbiddenException, Module, Delete } from '@nestjs/common';
import { JwtAuthGuard } from './auth';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { IsOptional, IsString, IsUUID, IsNotEmpty, IsNumber, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { AlertType, Route } from '@prisma/client';

export class CreateAlertDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsNotEmpty()
  @IsUUID()
  patient_id: string;

  @ApiProperty({ enum: AlertType, example: AlertType.high_glucose })
  @IsNotEmpty()
  @IsEnum(AlertType)
  type: AlertType;

  @ApiPropertyOptional({ example: 180.5 })
  @IsOptional()
  @IsNumber()
  trigger_value?: number;

  @ApiPropertyOptional({ example: 'Glucose reading exceeded 180 mg/dL' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class InsightResponseDto {
  // Read-only system generated DTO
}

export class CreateMedicationDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsNotEmpty()
  @IsUUID()
  patient_id: string;

  @ApiProperty({ example: 'Metformin' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '500mg' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ example: 'Twice daily' })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({ enum: Route, default: Route.oral })
  @IsOptional()
  @IsEnum(Route)
  route?: Route;

  @ApiProperty({ example: '2023-10-01T00:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  start_date: string;

  @ApiPropertyOptional({ example: '2023-12-31T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ example: 'Take after meals' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMedicationDto {
  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsEnum(Route)
  route?: Route;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateNoteDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsNotEmpty()
  @IsUUID()
  patient_id: string;

  @ApiProperty({ example: 'Patient responding well to new medication.' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_visible_to_patient?: boolean;
}

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  is_visible_to_patient?: boolean;
}

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAlertDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { user_id: userId },
    });
    // System or doctor can create alerts. Here we assume manual creation by doctor.
    if (!doctor) throw new ForbiddenException('Only doctors can manually trigger alerts');

    return this.prisma.alert.create({
      data: {
        doctor_id: doctor.id,
        patient_id: dto.patient_id,
        type: dto.type,
        trigger_value: dto.trigger_value,
        message: dto.message,
      },
    });
  }

  async findAll(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (patient) {
      return this.prisma.alert.findMany({
        where: { patient_id: patient.id },
        orderBy: { created_at: 'desc' },
      });
    }

    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (doctor) {
      // Find alerts for all patients of this doctor
      const patients = await this.prisma.patient.findMany({ where: { doctor_id: doctor.id } });
      const patientIds = patients.map(p => p.id);
      return this.prisma.alert.findMany({
        where: { patient_id: { in: patientIds } },
        orderBy: { created_at: 'desc' },
      });
    }

    return [];
  }

  async findUnresolved(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (patient) {
      return this.prisma.alert.findMany({
        where: { patient_id: patient.id, is_resolved: false },
        orderBy: { created_at: 'desc' },
      });
    }

    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (doctor) {
      const patients = await this.prisma.patient.findMany({ where: { doctor_id: doctor.id } });
      const patientIds = patients.map(p => p.id);
      return this.prisma.alert.findMany({
        where: { patient_id: { in: patientIds }, is_resolved: false },
        orderBy: { created_at: 'desc' },
      });
    }

    return [];
  }

  async resolve(userId: string, id: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Only doctors can resolve alerts');

    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');

    return this.prisma.alert.update({
      where: { id },
      data: { is_resolved: true, resolved_at: new Date() },
    });
  }
}

// ─── Rule engine ─────────────────────────────────────────────────────────────
const RULES = [
  {
    id: 'hypo_risk',
    check: (readings: any[]) => readings.some(r => r.value_mg_dl < 70),
    flag: 'danger',
    message: 'One or more readings below 70 mg/dL detected — this is hypoglycemia territory. Have a small snack like a banana or a glass of juice, and contact your doctor if it happens again.',
  },
  {
    id: 'fasting_high',
    check: (readings: any[]) => readings.filter(r => r.reading_type === 'fasting').some(r => r.value_mg_dl > 126),
    flag: 'warning',
    message: 'Your fasting glucose is above 126 mg/dL. Try to avoid late-night carbohydrates like rice or roti, and check your reading again tomorrow morning.',
  },
  {
    id: 'post_meal_spike',
    check: (readings: any[]) => readings.filter(r => r.reading_type === 'post_meal').some(r => r.value_mg_dl > 180),
    flag: 'warning',
    message: 'Your post-meal glucose spiked above 180 mg/dL. Try eating sabzi and dal before rice — this order can reduce your glucose spike after meals.',
  },
  {
    id: 'very_high',
    check: (readings: any[]) => readings.some(r => r.value_mg_dl > 300),
    flag: 'danger',
    message: 'A reading above 300 mg/dL was recorded. This is very high — please contact your doctor as soon as possible and avoid high-carb foods today.',
  },
  {
    id: 'missed_logging',
    check: (_: any[], mealCount: number) => mealCount === 0,
    flag: 'info',
    message: 'You haven\'t logged any meals today. Regular logging helps your doctor give you better guidance — even a quick note like "1 roti + dal" is very helpful.',
  },
  {
    id: 'good_control',
    check: (readings: any[]) => readings.length >= 2 && readings.every(r => r.value_mg_dl >= 70 && r.value_mg_dl <= 140),
    flag: 'normal',
    message: 'All your readings today are in the healthy range (70–140 mg/dL). Excellent! Keep following your current meal and activity routine.',
  },
  {
    id: 'no_readings',
    check: (readings: any[]) => readings.length === 0,
    flag: 'info',
    message: 'No glucose readings logged today. Try to log your fasting glucose every morning — it\'s the most important reading of the day.',
  },
  {
    id: 'low_activity',
    check: (_: any[], __: number, steps: number) => steps < 3000,
    flag: 'info',
    message: 'You\'ve walked fewer than 3,000 steps today. Even a 15-minute walk after dinner can help lower your post-meal glucose. Try a short stroll around your building.',
  },
  {
    id: 'good_activity',
    check: (_: any[], __: number, steps: number) => steps >= 8000,
    flag: 'normal',
    message: 'Great job staying active today — over 8,000 steps! Physical activity is one of the best tools to manage your blood sugar.',
  },
  {
    id: 'pre_meal_elevated',
    check: (readings: any[]) => readings.filter(r => r.reading_type === 'pre_meal').some(r => r.value_mg_dl > 110),
    flag: 'info',
    message: 'Your pre-meal glucose is a bit elevated. Consider having a small portion of protein (like dal or paneer) before your main meal to help slow sugar absorption.',
  },
];

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateInsight(patient: any): Promise<{ flag: string; message: string; type: string }> {
    const today = new Date(); today.setHours(0,0,0,0);
    const [readings, meals, activities] = await Promise.all([
      this.prisma.glucoseReading.findMany({
        where: { patient_id: patient.id, recorded_at: { gte: today } },
        orderBy: { recorded_at: 'asc' },
      }),
      this.prisma.meal.findMany({
        where: { patient_id: patient.id, logged_at: { gte: today } },
      }),
      this.prisma.activity.findMany({
        where: { patient_id: patient.id, date: { gte: today } },
      }),
    ]);

    const totalSteps = activities.reduce((s, a) => s + (a.steps ?? 0), 0);

    for (const rule of RULES) {
      if (rule.check(readings, meals.length, totalSteps)) {
        return { flag: rule.flag, message: rule.message, type: 'daily_nudge' };
      }
    }

    return {
      flag: 'normal',
      message: 'Keep up the good work! Log your readings consistently so your doctor can track your progress.',
      type: 'daily_nudge',
    };
  }

  async getDaily(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    // Return cached insight if generated today
    const today = new Date(); today.setHours(0,0,0,0);
    const cached = await this.prisma.insight.findFirst({
      where: { patient_id: patient.id, type: 'daily_nudge', created_at: { gte: today } },
    });
    if (cached) return cached;

    const { flag, message, type } = await this.generateInsight(patient);

    return this.prisma.insight.create({
      data: { patient_id: patient.id, type, flag, message, content: message, generated_by: 'rule_engine' },
    });
  }

  async getWeekly(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0,0,0,0);

    const [readings, meals] = await Promise.all([
      this.prisma.glucoseReading.findMany({
        where: { patient_id: patient.id, recorded_at: { gte: weekStart } },
      }),
      this.prisma.meal.findMany({
        where: { patient_id: patient.id, logged_at: { gte: weekStart } },
      }),
    ]);

    const min = patient.target_glucose_min ?? 70;
    const max = patient.target_glucose_max ?? 140;
    const vals = readings.map(r => r.value_mg_dl);
    const inRange = vals.filter(v => v >= min && v <= max).length;
    const avgGlucose = vals.length ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : null;
    const tir = vals.length ? Math.round((inRange / vals.length) * 100) : 0;

    let message = `This week you logged ${readings.length} glucose readings and ${meals.length} meals. `;
    if (avgGlucose) message += `Your average glucose was ${avgGlucose} mg/dL with ${tir}% time in range. `;
    if (tir >= 70) message += 'Excellent control — keep going!';
    else if (tir >= 50) message += 'Good progress. Try to log more consistently to improve your time in range.';
    else message += 'There is room to improve. Discuss your meal plan with your doctor at the next visit.';

    const cached = await this.prisma.insight.findFirst({
      where: { patient_id: patient.id, type: 'weekly_summary' },
      orderBy: { created_at: 'desc' },
    });

    const thisWeekMonday = new Date(); thisWeekMonday.setDate(thisWeekMonday.getDate() - thisWeekMonday.getDay() + 1); thisWeekMonday.setHours(0,0,0,0);
    if (cached && cached.created_at >= thisWeekMonday) return cached;

    return this.prisma.insight.create({
      data: {
        patient_id: patient.id,
        type: 'weekly_summary',
        flag: tir >= 70 ? 'normal' : tir >= 50 ? 'info' : 'warning',
        message,
        content: message,
        generated_by: 'rule_engine',
      },
    });
  }

  async getHistory(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    return this.prisma.insight.findMany({
      where: { patient_id: patient.id },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async dismiss(userId: string, id: string) {
    const insight = await this.prisma.insight.findUnique({ where: { id } });
    if (!insight) throw new NotFoundException('Insight not found');

    return this.prisma.insight.update({
      where: { id },
      data: { dismissed_at: new Date() },
    });
  }

  async getPatterns(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    return this.prisma.insight.findMany({
      where: { patient_id: patient.id, type: 'pattern_alert' },
      orderBy: { created_at: 'desc' },
    });
  }
}

@Injectable()
export class MedicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMedicationDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { user_id: userId },
    });
    if (!doctor) throw new ForbiddenException('Only doctors can prescribe medication');

    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patient_id }});
    if (!patient) throw new NotFoundException('Patient not found');

    return this.prisma.medication.create({
      data: {
        prescribed_by: doctor.id,
        patient_id: dto.patient_id,
        name: dto.name,
        dosage: dto.dosage,
        frequency: dto.frequency,
        route: dto.route,
        start_date: new Date(dto.start_date),
        end_date: dto.end_date ? new Date(dto.end_date) : null,
        notes: dto.notes,
      },
    });
  }

  async findAll(userId: string) {
    // For simplicity: check if patient
    const patient = await this.prisma.patient.findUnique({
      where: { user_id: userId },
    });
    if (patient) {
      return this.prisma.medication.findMany({
        where: { patient_id: patient.id, is_active: true },
        orderBy: { start_date: 'desc' },
      });
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { user_id: userId },
    });
    if (doctor) {
      return this.prisma.medication.findMany({
        where: { prescribed_by: doctor.id, is_active: true },
        orderBy: { start_date: 'desc' },
      });
    }

    return [];
  }

  async findOne(userId: string, id: string) {
    const medication = await this.prisma.medication.findUnique({ where: { id } });
    if (!medication) throw new NotFoundException('Medication not found');
    return medication;
  }

  async update(userId: string, id: string, dto: UpdateMedicationDto) {
    await this.findOne(userId, id);
    return this.prisma.medication.update({
      where: { id },
      data: {
        ...dto,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.medication.update({ 
      where: { id },
      data: { is_active: false }
    });
  }
}

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateNoteDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { user_id: userId },
    });
    if (!doctor) throw new ForbiddenException('Only doctors can write notes');

    return this.prisma.doctorNote.create({
      data: {
        doctor_id: doctor.id,
        patient_id: dto.patient_id,
        content: dto.content,
        is_visible_to_patient: dto.is_visible_to_patient ?? true,
      },
    });
  }

  async findAll(userId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (doctor) {
      return this.prisma.doctorNote.findMany({
        where: { doctor_id: doctor.id },
        orderBy: { created_at: 'desc' },
      });
    }

    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (patient) {
      return this.prisma.doctorNote.findMany({
        where: { patient_id: patient.id, is_visible_to_patient: true },
        orderBy: { created_at: 'desc' },
      });
    }

    return [];
  }

  async findOne(userId: string, id: string) {
    const note = await this.prisma.doctorNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Only doctors can update notes');

    return this.prisma.doctorNote.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Only doctors can delete notes');

    return this.prisma.doctorNote.delete({
      where: { id },
    });
  }
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreVisitSummary(userId: string, patientId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Only doctors can generate reports');

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        medications: { where: { is_active: true } },
        alerts: { where: { is_resolved: false }, take: 5 },
        doctor_notes: { take: 5, orderBy: { created_at: 'desc' } },
      }
    });

    if (!patient) throw new NotFoundException('Patient not found');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const glucoseStats = await this.prisma.glucoseReading.aggregate({
      where: { patient_id: patient.id, recorded_at: { gte: thirtyDaysAgo } },
      _avg: { value_mg_dl: true },
      _min: { value_mg_dl: true },
      _max: { value_mg_dl: true },
      _count: { _all: true },
    });

    const mealCount = await this.prisma.meal.count({
      where: { patient_id: patient.id, logged_at: { gte: thirtyDaysAgo } },
    });

    return {
      patient_info: {
        name: patient.full_name,
        dob: patient.date_of_birth,
        diabetes_type: patient.diabetes_type,
      },
      glucose_summary_30d: glucoseStats,
      meals_logged_30d: mealCount,
      active_medications: patient.medications,
      recent_alerts: patient.alerts,
      recent_notes: patient.doctor_notes,
    };
  }

  async getWeeklyReport(userId: string, patientId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Only doctors can view reports');

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [readings, activities, medications] = await Promise.all([
      this.prisma.glucoseReading.findMany({
        where: { patient_id: patientId, recorded_at: { gte: sevenDaysAgo } },
        orderBy: { recorded_at: 'desc' },
      }),
      this.prisma.activity.findMany({
        where: { patient_id: patientId, date: { gte: sevenDaysAgo } },
      }),
      this.prisma.medication.findMany({
        where: { patient_id: patientId, is_active: true },
      }),
    ]);

    const vals = readings.map(r => r.value_mg_dl);
    const min = patient.target_glucose_min ?? 70;
    const max = patient.target_glucose_max ?? 140;
    const inRange = vals.filter(v => v >= min && v <= max).length;
    const highEvents = readings.filter(r => r.value_mg_dl > max);

    return {
      timeframe: 'last_7_days',
      avg_glucose: vals.length ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : null,
      time_in_range_pct: vals.length ? Math.round((inRange / vals.length) * 100) : 0,
      total_readings: vals.length,
      high_events: highEvents.slice(0, 10),
      avg_daily_steps: Math.round(activities.reduce((s,a) => s + (a.steps ?? 0), 0) / 7),
      active_medications: medications,
    };
  }

  async getMonthlyReport(userId: string, patientId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: userId } });
    if (!doctor) throw new ForbiddenException('Only doctors can view reports');

    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const readings = await this.prisma.glucoseReading.findMany({
      where: { patient_id: patientId, recorded_at: { gte: thirtyDaysAgo } },
    });

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    const vals = readings.map(r => r.value_mg_dl);
    const min = patient?.target_glucose_min ?? 70;
    const max = patient?.target_glucose_max ?? 140;
    const inRange = vals.filter(v => v >= min && v <= max).length;

    return {
      timeframe: 'last_30_days',
      avg_glucose: vals.length ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : null,
      time_in_range_pct: vals.length ? Math.round((inRange / vals.length) * 100) : 0,
      total_readings: vals.length,
    };
  }
}

@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @ApiOperation({ summary: 'Doctor manually triggers an alert' })
  create(@Request() req, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all alerts for the user' })
  findAll(@Request() req) {
    return this.alertsService.findAll(req.user.userId);
  }

  @Get('unresolved')
  @ApiOperation({ summary: 'Get only active unresolved alerts' })
  findUnresolved(@Request() req) {
    return this.alertsService.findUnresolved(req.user.userId);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an alert' })
  resolve(@Request() req, @Param('id') id: string) {
    return this.alertsService.resolve(req.user.userId, id);
  }
}

@ApiTags('Insights & Nudges')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all insights for the patient (history)' })
  getAll(@Request() req) {
    return this.insightsService.getHistory(req.user.userId);
  }

  @Get('daily')
  @ApiOperation({ summary: "Get today's personalized nudge (generated from rule engine)" })
  getDaily(@Request() req) {
    return this.insightsService.getDaily(req.user.userId);
  }

  @Get('weekly')
  @ApiOperation({ summary: "Get this week's summary insight" })
  getWeekly(@Request() req) {
    return this.insightsService.getWeekly(req.user.userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get past insights' })
  getHistory(@Request() req) {
    return this.insightsService.getHistory(req.user.userId);
  }

  @Patch(':id/dismiss')
  @ApiOperation({ summary: 'Mark an insight as dismissed' })
  dismiss(@Request() req, @Param('id') id: string) {
    return this.insightsService.dismiss(req.user.userId, id);
  }

  @Get('patterns')
  @ApiOperation({ summary: 'Get detected patterns' })
  getPatterns(@Request() req) {
    return this.insightsService.getPatterns(req.user.userId);
  }
}

@ApiTags('Medications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('medications')
export class MedicationsController {
  constructor(private readonly medicationsService: MedicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a medication for a patient (Doctor only)' })
  create(@Request() req, @Body() dto: CreateMedicationDto) {
    return this.medicationsService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active medications' })
  findAll(@Request() req) {
    return this.medicationsService.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single medication' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.medicationsService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update dosage or frequency' })
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateMedicationDto) {
    return this.medicationsService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a medication' })
  remove(@Request() req, @Param('id') id: string) {
    return this.medicationsService.remove(req.user.userId, id);
  }
}

@ApiTags('Doctor Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @ApiOperation({ summary: 'Doctor adds a note' })
  create(@Request() req, @Body() dto: CreateNoteDto) {
    return this.notesService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all notes' })
  findAll(@Request() req) {
    return this.notesService.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single note' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.notesService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a note' })
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a note' })
  remove(@Request() req, @Param('id') id: string) {
    return this.notesService.remove(req.user.userId, id);
  }
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('pre-visit/:patientId')
  @ApiOperation({ summary: 'Generate pre-visit clinical summary' })
  getPreVisitSummary(@Request() req, @Param('patientId') patientId: string) {
    return this.reportsService.getPreVisitSummary(req.user.userId, patientId);
  }

  @Get('weekly/:patientId')
  @ApiOperation({ summary: 'Get weekly patient report data' })
  getWeeklyReport(@Request() req, @Param('patientId') patientId: string) {
    return this.reportsService.getWeeklyReport(req.user.userId, patientId);
  }

  @Get('monthly/:patientId')
  @ApiOperation({ summary: 'Get monthly trend report' })
  getMonthlyReport(@Request() req, @Param('patientId') patientId: string) {
    return this.reportsService.getMonthlyReport(req.user.userId, patientId);
  }
}

export class LogAdherenceDto {
  @ApiPropertyOptional({ example: false, description: 'true = skipped the dose' })
  @IsOptional()
  @IsBoolean()
  skipped?: boolean;

  @ApiPropertyOptional({ example: 'Felt nauseous' })
  @IsOptional()
  @IsString()
  skip_reason?: string;

  @ApiPropertyOptional({ example: 'Took with food' })
  @IsOptional()
  @IsString()
  notes?: string;
}

@Injectable()
export class AdherenceService {
  constructor(private readonly prisma: PrismaService) {}

  async logDose(userId: string, medicationId: string, dto: LogAdherenceDto) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new ForbiddenException('Only patients can log medication adherence');

    const medication = await this.prisma.medication.findUnique({ where: { id: medicationId } });
    if (!medication) throw new NotFoundException('Medication not found');
    if (medication.patient_id !== patient.id) throw new ForbiddenException('This medication does not belong to you');

    return this.prisma.medicationLog.create({
      data: {
        medication_id: medicationId,
        patient_id: patient.id,
        skipped: dto.skipped ?? false,
        skip_reason: dto.skip_reason,
        notes: dto.notes,
      },
    });
  }

  async getAdherenceLogs(userId: string, medicationId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new ForbiddenException('Only patients can view their adherence logs');

    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.prisma.medicationLog.findMany({
      where: { medication_id: medicationId, patient_id: patient.id, taken_at: { gte: sevenDaysAgo } },
      orderBy: { taken_at: 'desc' },
    });
  }

  async getTodayAdherence(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new ForbiddenException('Patient profile not found');

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [medications, todayLogs] = await Promise.all([
      this.prisma.medication.findMany({ where: { patient_id: patient.id, is_active: true } }),
      this.prisma.medicationLog.findMany({
        where: { patient_id: patient.id, taken_at: { gte: today } },
      }),
    ]);

    const loggedIds = new Set(todayLogs.map(l => l.medication_id));

    return medications.map(med => ({
      medication_id: med.id,
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      logged_today: loggedIds.has(med.id),
      today_log: todayLogs.find(l => l.medication_id === med.id) ?? null,
    }));
  }
}

@ApiTags('Medications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('medications')
export class AdherenceController {
  constructor(private readonly adherenceService: AdherenceService) {}

  @Post(':id/log')
  @ApiOperation({ summary: 'Patient: log a medication dose (taken or skipped)' })
  logDose(@Request() req, @Param('id') id: string, @Body() dto: LogAdherenceDto) {
    return this.adherenceService.logDose(req.user.userId, id, dto);
  }

  @Get(':id/adherence')
  @ApiOperation({ summary: 'Get last 7 days of adherence logs for a medication' })
  getAdherenceLogs(@Request() req, @Param('id') id: string) {
    return this.adherenceService.getAdherenceLogs(req.user.userId, id);
  }

  @Get('adherence/today')
  @ApiOperation({ summary: "Get today's medication checklist with adherence status" })
  getTodayAdherence(@Request() req) {
    return this.adherenceService.getTodayAdherence(req.user.userId);
  }
}

@Module({
  controllers: [
    MedicationsController,
    AdherenceController,
    AlertsController,
    NotesController,
    ReportsController,
    InsightsController
  ],
  providers: [
    MedicationsService,
    AdherenceService,
    AlertsService,
    NotesService,
    ReportsService,
    InsightsService
  ]
})
export class ClinicalCareModule {}
