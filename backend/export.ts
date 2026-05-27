import { Controller, Get, Query, Res, UseGuards, Request, Injectable, NotFoundException, ForbiddenException, Module } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from './auth';
import { PrismaService } from './prisma/prisma.service';

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportPatientReport(doctorUserId: string, patientId: string, days = 30): Promise<string> {
    const doctor = await this.prisma.doctor.findUnique({ where: { user_id: doctorUserId } });
    if (!doctor) throw new ForbiddenException('Only doctors can export patient reports');

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    if (patient.doctor_id !== doctor.id) throw new ForbiddenException('Patient not linked to your account');

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [glucose, meals, activities, medications] = await Promise.all([
      this.prisma.glucoseReading.findMany({
        where: { patient_id: patientId, recorded_at: { gte: since } },
        orderBy: { recorded_at: 'asc' },
      }),
      this.prisma.meal.findMany({
        where: { patient_id: patientId, logged_at: { gte: since } },
        orderBy: { logged_at: 'asc' },
      }),
      this.prisma.activity.findMany({
        where: { patient_id: patientId, date: { gte: since } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.medication.findMany({
        where: { patient_id: patientId, is_active: true },
      }),
    ]);

    const sections: string[] = [];

    sections.push(`# GlucoConnect Patient Report`);
    sections.push(`# Patient: ${patient.full_name}`);
    sections.push(`# Diabetes Type: ${patient.diabetes_type ?? 'Not specified'}`);
    sections.push(`# Report Period: Last ${days} days`);
    sections.push(`# Generated: ${new Date().toISOString()}`);
    sections.push('');

    sections.push('## GLUCOSE READINGS');
    sections.push(toCsv(
      ['Date', 'Time', 'Value (mg/dL)', 'Reading Type', 'Source', 'Notes'],
      glucose.map(r => [
        r.recorded_at.toISOString().slice(0,10),
        r.recorded_at.toISOString().slice(11,16),
        r.value_mg_dl,
        r.reading_type,
        r.source,
        r.notes,
      ])
    ));

    sections.push('');
    sections.push('## MEALS');
    sections.push(toCsv(
      ['Date', 'Time', 'Meal Type', 'Total Carbs (g)', 'Total Calories', 'Notes'],
      meals.map(m => [
        m.logged_at.toISOString().slice(0,10),
        m.logged_at.toISOString().slice(11,16),
        m.meal_type,
        m.total_carbs_grams,
        m.total_calories,
        m.notes,
      ])
    ));

    sections.push('');
    sections.push('## ACTIVITIES');
    sections.push(toCsv(
      ['Date', 'Activity Type', 'Steps', 'Duration (min)', 'Calories Burned', 'Intensity'],
      activities.map(a => [
        a.date.toISOString().slice(0,10),
        a.activity_type,
        a.steps,
        a.active_minutes,
        a.calories_burned,
        a.intensity,
      ])
    ));

    sections.push('');
    sections.push('## ACTIVE MEDICATIONS');
    sections.push(toCsv(
      ['Medication', 'Dosage', 'Frequency', 'Route', 'Start Date'],
      medications.map(m => [m.name, m.dosage, m.frequency, m.route, m.start_date.toISOString().slice(0,10)])
    ));

    return sections.join('\n');
  }

  async exportMyData(userId: string, days = 90): Promise<string> {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const since = new Date(); since.setDate(since.getDate() - days);

    const [glucose, meals, activities] = await Promise.all([
      this.prisma.glucoseReading.findMany({
        where: { patient_id: patient.id, recorded_at: { gte: since } },
        orderBy: { recorded_at: 'asc' },
      }),
      this.prisma.meal.findMany({
        where: { patient_id: patient.id, logged_at: { gte: since } },
        orderBy: { logged_at: 'asc' },
      }),
      this.prisma.activity.findMany({
        where: { patient_id: patient.id, date: { gte: since } },
        orderBy: { date: 'asc' },
      }),
    ]);

    const sections: string[] = [];
    sections.push(`# My GlucoConnect Data Export`);
    sections.push(`# Period: Last ${days} days | Generated: ${new Date().toISOString()}`);
    sections.push('');

    sections.push('## GLUCOSE READINGS');
    sections.push(toCsv(
      ['Date', 'Time', 'Value (mg/dL)', 'Type', 'Notes'],
      glucose.map(r => [r.recorded_at.toISOString().slice(0,10), r.recorded_at.toISOString().slice(11,16), r.value_mg_dl, r.reading_type, r.notes])
    ));
    sections.push('');
    sections.push('## MEALS');
    sections.push(toCsv(
      ['Date', 'Time', 'Type', 'Total Carbs (g)', 'Total Calories', 'Notes'],
      meals.map(m => [m.logged_at.toISOString().slice(0,10), m.logged_at.toISOString().slice(11,16), m.meal_type, m.total_carbs_grams, m.total_calories, m.notes])
    ));
    sections.push('');
    sections.push('## ACTIVITIES');
    sections.push(toCsv(
      ['Date', 'Type', 'Steps', 'Duration (min)', 'Calories'],
      activities.map(a => [a.date.toISOString().slice(0,10), a.activity_type, a.steps, a.active_minutes, a.calories_burned])
    ));

    return sections.join('\n');
  }
}

@ApiTags('Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('patient-report')
  @ApiOperation({ summary: 'Doctor: download patient CSV report' })
  @ApiQuery({ name: 'patient_id', required: true })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days (default 30)' })
  async exportPatientReport(
    @Request() req,
    @Query('patient_id') patientId: string,
    @Query('days') days: string,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportPatientReport(req.user.userId, patientId, days ? parseInt(days) : 30);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="glucoconnect-patient-${patientId.slice(0,8)}-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  }

  @Get('my-data')
  @ApiOperation({ summary: 'Patient: download own data as CSV' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days (default 90)' })
  async exportMyData(@Request() req, @Query('days') days: string, @Res() res: Response) {
    const csv = await this.exportService.exportMyData(req.user.userId, days ? parseInt(days) : 90);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="my-glucoconnect-data-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  }
}

@Module({
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
