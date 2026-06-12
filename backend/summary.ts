import { Controller, Get, Query, UseGuards, Request, Injectable, NotFoundException, Module } from '@nestjs/common';
import { JwtAuthGuard } from './auth';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class SummaryService {
  constructor(private prisma: PrismaService) {}

  async getDailySummary(userId: string, dateStr?: string) {
    if (!dateStr) {
      dateStr = new Date().toISOString().split('T')[0];
    }
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const startOfDay = new Date(dateStr);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const [glucose, meals, activities] = await Promise.all([
      this.prisma.glucoseReading.findMany({
        where: { patient_id: patient.id, recorded_at: { gte: startOfDay, lte: endOfDay } }
      }),
      this.prisma.meal.findMany({
        where: { patient_id: patient.id, logged_at: { gte: startOfDay, lte: endOfDay } },
        include: { meal_items: true }
      }),
      this.prisma.activity.findMany({
        where: { patient_id: patient.id, date: { gte: startOfDay, lte: endOfDay } }
      })
    ]);

    return {
      date: dateStr,
      glucose_readings: glucose,
      meals: meals,
      activities: activities
    };
  }

  async getWeeklySummary(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const summaries: any[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        summaries.push(await this.getDailySummary(userId, dateStr));
    }
    return summaries;
  }
}

@ApiTags('Summary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Get combined daily summary' })
  @ApiQuery({ name: 'date', required: false, example: '2023-10-01' })
  getDaily(@Request() req, @Query('date') date?: string) {
    return this.summaryService.getDailySummary(req.user.userId, date);
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Get daily summaries for the last 7 days' })
  getWeekly(@Request() req) {
    return this.summaryService.getWeeklySummary(req.user.userId);
  }
}

@Module({
  controllers: [SummaryController],
  providers: [SummaryService]
})
export class SummaryModule {}
