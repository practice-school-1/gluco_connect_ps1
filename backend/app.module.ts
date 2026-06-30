import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles';
import { HealthTrackingModule } from './health-tracking';
import { ClinicalCareModule } from './clinical-care';
import { IntegrationsModule } from './integrations';
import { FoodsModule } from './foods';
import { ExportModule } from './export';
import { CronModule } from './cron';
import { ReportsModule } from './reports';
import { SummaryModule } from './summary';
import { MonitoringModule } from './monitoring';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ProfilesModule,
    HealthTrackingModule,
    ClinicalCareModule,
    IntegrationsModule,
    FoodsModule,
    ExportModule,
    CronModule,
    ReportsModule,
    SummaryModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
