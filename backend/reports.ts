import { Controller, Get, Query, UseGuards, Request, Injectable, NotFoundException, Module, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './auth';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getWeeklyReport(userId: string, patientId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { doctor: true, patient: true } });
    if (!user) throw new NotFoundException('User not found');

    let targetPatientId = patientId;

    if (user.role === 'patient') {
      if (!user.patient) throw new NotFoundException('Patient profile not found for user');
      targetPatientId = user.patient.id;
    } else if (user.role === 'doctor') {
      if (!patientId) {
        throw new NotFoundException('patient_id is required for doctors');
      }
    } else {
      throw new ForbiddenException();
    }

    const patient = await this.prisma.patient.findUnique({ where: { id: targetPatientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [glucoseReadings, activities] = await Promise.all([
      this.prisma.glucoseReading.findMany({
        where: { patient_id: targetPatientId, recorded_at: { gte: sevenDaysAgo } }
      }),
      this.prisma.activity.findMany({
        where: { patient_id: targetPatientId, date: { gte: sevenDaysAgo } }
      })
    ]);

    // Calculate time-in-range (% of readings between 70 and 140 mg/dL)
    let inRangeCount = 0;
    let fastingSum = 0;
    let fastingCount = 0;
    let postMealSpikeCount = 0;

    glucoseReadings.forEach(reading => {
      if (reading.value_mg_dl >= 70 && reading.value_mg_dl <= 140) {
        inRangeCount++;
      }
      if (reading.reading_type === 'fasting') {
        fastingSum += reading.value_mg_dl;
        fastingCount++;
      }
      if (reading.reading_type === 'post_meal' && reading.value_mg_dl > 140) {
        postMealSpikeCount++;
      }
    });

    const timeInRangePercentage = glucoseReadings.length > 0 
      ? (inRangeCount / glucoseReadings.length) * 100 
      : 0;
    const averageFastingGlucose = fastingCount > 0 
      ? (fastingSum / fastingCount) 
      : null;

    // Calculate average daily steps
    let totalSteps = 0;
    activities.forEach(activity => {
      totalSteps += activity.steps || 0;
    });
    const averageDailySteps = totalSteps / 7;

    return {
      patient_id: targetPatientId,
      time_in_range_percentage: parseFloat(timeInRangePercentage.toFixed(2)),
      average_fasting_glucose: averageFastingGlucose ? parseFloat(averageFastingGlucose.toFixed(2)) : null,
      post_meal_spike_frequency: postMealSpikeCount,
      average_daily_steps: Math.round(averageDailySteps)
    };
  }
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('weekly')
  @Roles(Role.doctor, Role.patient)
  @ApiOperation({ summary: 'Get key weekly metrics for 90-second review' })
  @ApiQuery({ name: 'patient_id', required: false, description: 'Required if user is a doctor' })
  getWeekly(@Request() req, @Query('patient_id') patientId?: string) {
    return this.reportsService.getWeeklyReport(req.user.userId, patientId);
  }
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
