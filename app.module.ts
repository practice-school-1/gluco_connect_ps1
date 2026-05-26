import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles';
import { HealthTrackingModule } from './health-tracking';
import { ClinicalCareModule } from './clinical-care';
import { IntegrationsModule } from './integrations';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ProfilesModule,
    HealthTrackingModule,
    ClinicalCareModule,
    IntegrationsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
