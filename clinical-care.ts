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

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDaily(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    let insight = await this.prisma.insight.findFirst({
      where: { patient_id: patient.id, type: 'daily_nudge' },
      orderBy: { created_at: 'desc' },
    });

    if (!insight) {
      insight = await this.prisma.insight.create({
        data: {
          patient_id: patient.id,
          type: 'daily_nudge',
          content: 'Your average glucose this week was stable. Keep it up!',
          generated_by: 'rule_engine',
        },
      });
    }

    return insight;
  }

  async getWeekly(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    let insight = await this.prisma.insight.findFirst({
      where: { patient_id: patient.id, type: 'weekly_summary' },
      orderBy: { created_at: 'desc' },
    });

    if (!insight) {
      insight = await this.prisma.insight.create({
        data: {
          patient_id: patient.id,
          type: 'weekly_summary',
          content: 'Weekly Summary: You logged 14 meals and 21 glucose readings.',
          generated_by: 'rule_engine',
        },
      });
    }

    return insight;
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
    // simplified implementation
    return {
      timeframe: 'last_7_days',
      message: 'Weekly report data would go here',
    };
  }

  async getMonthlyReport(userId: string, patientId: string) {
    // simplified implementation
    return {
      timeframe: 'last_30_days',
      message: 'Monthly report data would go here',
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

  @Get('daily')
  @ApiOperation({ summary: "Get today's personalized nudge" })
  getDaily(@Request() req) {
    return this.insightsService.getDaily(req.user.userId);
  }

  @Get('weekly')
  @ApiOperation({ summary: "Get this week's summary" })
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

@Module({
  controllers: [
    MedicationsController,
    AlertsController,
    NotesController,
    ReportsController,
    InsightsController
  ],
  providers: [
    MedicationsService,
    AlertsService,
    NotesService,
    ReportsService,
    InsightsService
  ]
})
export class ClinicalCareModule {}
