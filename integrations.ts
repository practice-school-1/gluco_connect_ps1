import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, Get, Post, Delete, Body, Query, UseGuards, Request, Injectable, NotFoundException, Module, Patch } from '@nestjs/common';
import { JwtAuthGuard } from './auth';
import { PrismaService } from './prisma/prisma.service';

export class FitbitCallbackDto {
  @ApiProperty({ example: 'oauth_auth_code_123' })
  @IsNotEmpty()
  @IsString()
  code: string;
}

export class RegisterDeviceDto {
  @ApiProperty({ example: 'fcm_token_xyz123' })
  @IsNotEmpty()
  @IsString()
  fcm_token: string;

  @ApiPropertyOptional({ example: 'android' })
  @IsOptional()
  @IsString()
  device_type?: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  glucose_alerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  meal_reminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activity_reminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  doctor_messages?: boolean;
}

@Injectable()
export class FitbitService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuthUrl(userId: string) {
    return { 
      auth_url: 'https://www.fitbit.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&response_type=code&scope=activity+heartrate+sleep&redirect_uri=http://localhost:3000/fitbit/callback' 
    };
  }

  async handleCallback(userId: string, dto: FitbitCallbackDto) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    await this.prisma.patientIntegration.create({
      data: {
        patient_id: patient.id,
        provider_name: 'fitbit',
        access_token: 'mock_access_token_' + dto.code,
        refresh_token: 'mock_refresh_token',
        scopes: 'activity heartrate sleep',
      }
    });

    return { message: 'Fitbit connected successfully' };
  }

  async sync(userId: string) {
    return { 
      message: 'Fitbit data synced', 
      steps: 8500, 
      active_minutes: 45, 
      calories_burned: 2100, 
      heart_rate_avg: 72 
    };
  }

  async disconnect(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    await this.prisma.patientIntegration.deleteMany({
      where: { patient_id: patient.id, provider_name: 'fitbit' }
    });

    return { message: 'Fitbit disconnected' };
  }

  async getStatus(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const integration = await this.prisma.patientIntegration.findFirst({
      where: { patient_id: patient.id, provider_name: 'fitbit' }
    });

    if (integration) {
      return { connected: true, connected_at: integration.connected_at };
    }
    return { connected: false };
  }
}

@Injectable()
export class NotificationsService {
  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    // Stub: In production, save to a DeviceToken table
    return { message: 'Device registered successfully', fcm_token: dto.fcm_token };
  }

  async getPreferences(userId: string) {
    // Stub
    return {
      glucose_alerts: true,
      meal_reminders: true,
      activity_reminders: true,
      doctor_messages: true,
    };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    // Stub
    return {
      message: 'Preferences updated',
      ...dto,
    };
  }

  async getHistory(userId: string) {
    // Stub
    return [];
  }
}

@ApiTags('Fitbit Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fitbit')
export class FitbitController {
  constructor(private readonly fitbitService: FitbitService) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Get Fitbit OAuth authorization URL' })
  getAuthUrl(@Request() req) {
    return this.fitbitService.getAuthUrl(req.user.userId);
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle OAuth redirect code' })
  handleCallback(@Request() req, @Body() dto: FitbitCallbackDto) {
    return this.fitbitService.handleCallback(req.user.userId, dto);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Manually trigger a Fitbit data sync' })
  sync(@Request() req) {
    return this.fitbitService.sync(req.user.userId);
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Remove Fitbit connection' })
  disconnect(@Request() req) {
    return this.fitbitService.disconnect(req.user.userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check if Fitbit is connected' })
  getStatus(@Request() req) {
    return this.fitbitService.getStatus(req.user.userId);
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-device')
  @ApiOperation({ summary: 'Register FCM token' })
  registerDevice(@Request() req, @Body() dto: RegisterDeviceDto) {
    return this.notificationsService.registerDevice(req.user.userId, dto);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification settings' })
  getPreferences(@Request() req) {
    return this.notificationsService.getPreferences(req.user.userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification settings' })
  updatePreferences(@Request() req, @Body() dto: UpdatePreferencesDto) {
    return this.notificationsService.updatePreferences(req.user.userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get past notifications' })
  getHistory(@Request() req) {
    return this.notificationsService.getHistory(req.user.userId);
  }
}

@Module({
  controllers: [
    FitbitController,
    NotificationsController
  ],
  providers: [
    FitbitService,
    NotificationsService
  ]
})
export class IntegrationsModule {}
