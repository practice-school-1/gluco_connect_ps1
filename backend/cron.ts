import { Injectable, Module, Logger } from '@nestjs/common';
import { ScheduleModule, Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class WeeklySummaryJob {
  private readonly logger = new Logger(WeeklySummaryJob.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs every Sunday at 11 PM
  @Cron('0 23 * * 0')
  async generateWeeklySummaries() {
    this.logger.log('Starting weekly summary generation for all active patients...');

    const patients = await this.prisma.patient.findMany({
      where: { user: { is_active: true } },
      select: {
        id: true,
        full_name: true,
        target_glucose_min: true,
        target_glucose_max: true,
      },
    });

    this.logger.log(`Processing ${patients.length} patients`);

    let success = 0;
    let failed = 0;

    for (const patient of patients) {
      try {
        await this.generateForPatient(patient);
        success++;
      } catch (err) {
        failed++;
        this.logger.error(`Failed for patient ${patient.id}: ${err.message}`);
      }
    }

    this.logger.log(`Weekly summary done — ${success} succeeded, ${failed} failed`);
  }

  private async generateForPatient(patient: {
    id: string;
    full_name: string;
    target_glucose_min: number | null;
    target_glucose_max: number | null;
  }) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const thisWeekMonday = new Date();
    thisWeekMonday.setDate(thisWeekMonday.getDate() - thisWeekMonday.getDay() + 1);
    thisWeekMonday.setHours(0, 0, 0, 0);

    // Skip if already generated this week
    const existing = await this.prisma.insight.findFirst({
      where: {
        patient_id: patient.id,
        type: 'weekly_summary',
        created_at: { gte: thisWeekMonday },
      },
    });
    if (existing) return;

    const [readings, meals, activities] = await Promise.all([
      this.prisma.glucoseReading.findMany({
        where: { patient_id: patient.id, recorded_at: { gte: weekStart } },
      }),
      this.prisma.meal.findMany({
        where: { patient_id: patient.id, logged_at: { gte: weekStart } },
      }),
      this.prisma.activity.findMany({
        where: { patient_id: patient.id, date: { gte: weekStart } },
      }),
    ]);

    const min = patient.target_glucose_min ?? 70;
    const max = patient.target_glucose_max ?? 140;
    const vals = readings.map(r => r.value_mg_dl);
    const inRange = vals.filter(v => v >= min && v <= max).length;
    const avgGlucose = vals.length
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : null;
    const tir = vals.length ? Math.round((inRange / vals.length) * 100) : 0;
    const totalSteps = activities.reduce((s, a) => s + (a.steps ?? 0), 0);
    const avgSteps = activities.length ? Math.round(totalSteps / 7) : 0;
    const totalCarbs = meals.reduce((s, m) => s + (m.total_carbs_grams ?? 0), 0);

    let message = `Weekly summary for ${patient.full_name}: you logged ${readings.length} glucose readings and ${meals.length} meals this week. `;
    if (avgGlucose) {
      message += `Average glucose: ${avgGlucose} mg/dL, time in range: ${tir}%. `;
    }
    if (avgSteps > 0) {
      message += `Average steps: ${avgSteps}/day. `;
    }
    if (totalCarbs > 0) {
      message += `Total carbs logged: ${Math.round(totalCarbs)}g. `;
    }

    if (tir >= 70) message += 'Excellent glucose control this week!';
    else if (tir >= 50) message += 'Good progress — keep logging consistently.';
    else if (readings.length === 0) message += 'No readings this week — remind patient to log daily.';
    else message += 'Control needs improvement — consider reviewing meal plan with patient.';

    const flag = tir >= 70 ? 'normal' : tir >= 50 ? 'info' : 'warning';

    await this.prisma.insight.create({
      data: {
        patient_id: patient.id,
        type: 'weekly_summary',
        flag,
        message,
        content: message,
        generated_by: 'cron_job',
      },
    });
  }
}

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [WeeklySummaryJob],
})
export class CronModule {}
