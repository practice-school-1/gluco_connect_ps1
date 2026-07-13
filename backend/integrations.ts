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

const FITBIT_SCOPE = 'activity heartrate profile';

@Injectable()
export class FitbitService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuthUrl(userId: string) {
    const params = new URLSearchParams({
      client_id: process.env.FITBIT_CLIENT_ID ?? '',
      response_type: 'code',
      scope: FITBIT_SCOPE,
      redirect_uri: process.env.FITBIT_REDIRECT_URI ?? '',
    });
    return { auth_url: `https://www.fitbit.com/oauth2/authorize?${params.toString()}` };
  }

  private async exchangeToken(body: URLSearchParams) {
    const basicAuth = Buffer.from(
      `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`,
    ).toString('base64');

    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Fitbit token request failed: ${JSON.stringify(data)}`);
    }
    return data as { access_token: string; refresh_token: string; scope: string };
  }

  async handleCallback(userId: string, dto: FitbitCallbackDto) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const tokens = await this.exchangeToken(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: dto.code,
        redirect_uri: process.env.FITBIT_REDIRECT_URI ?? '',
      }),
    );

    await this.prisma.patientIntegration.upsert({
      where: { patient_id_provider_name: { patient_id: patient.id, provider_name: 'fitbit' } },
      create: {
        patient_id: patient.id,
        provider_name: 'fitbit',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scopes: tokens.scope,
      },
      update: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scopes: tokens.scope,
      },
    });

    return { message: 'Fitbit connected successfully' };
  }

  private async fitbitGet(accessToken: string, path: string) {
    return fetch(`https://api.fitbit.com${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async sync(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const integration = await this.prisma.patientIntegration.findFirst({
      where: { patient_id: patient.id, provider_name: 'fitbit' },
    });
    if (!integration) throw new NotFoundException('Fitbit is not connected');

    let accessToken = integration.access_token;
    const today = new Date().toISOString().slice(0, 10);

    let activityRes = await this.fitbitGet(accessToken, `/1/user/-/activities/date/${today}.json`);

    if (activityRes.status === 401) {
      const refreshed = await this.exchangeToken(
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token ?? '',
        }),
      );
      accessToken = refreshed.access_token;
      await this.prisma.patientIntegration.update({
        where: { id: integration.id },
        data: { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token },
      });
      activityRes = await this.fitbitGet(accessToken, `/1/user/-/activities/date/${today}.json`);
    }

    if (!activityRes.ok) {
      throw new Error(`Fitbit activity request failed: ${activityRes.status}`);
    }
    const activityData = await activityRes.json();
    const summary = activityData.summary ?? {};

    const heartRes = await this.fitbitGet(accessToken, `/1/user/-/activities/heart/date/${today}/1d.json`);
    const heartData = heartRes.ok ? await heartRes.json() : null;
    const heartRateAvg = heartData?.['activities-heart']?.[0]?.value?.restingHeartRate ?? null;

    const steps = summary.steps ?? 0;
    const activeMinutes = (summary.veryActiveMinutes ?? 0) + (summary.fairlyActiveMinutes ?? 0);
    const caloriesBurned = summary.caloriesOut ?? null;

    const existing = await this.prisma.activity.findFirst({
      where: { patient_id: patient.id, source: 'fitbit', date: new Date(today) },
    });

    const activityRecord = existing
      ? await this.prisma.activity.update({
          where: { id: existing.id },
          data: {
            steps,
            active_minutes: activeMinutes,
            calories_burned: caloriesBurned,
            heart_rate_avg: heartRateAvg,
          },
        })
      : await this.prisma.activity.create({
          data: {
            patient_id: patient.id,
            source: 'fitbit',
            activity_type: 'fitbit_sync',
            steps,
            active_minutes: activeMinutes,
            calories_burned: caloriesBurned,
            heart_rate_avg: heartRateAvg,
            date: new Date(today),
          },
        });

    return { message: 'Fitbit data synced', activity: activityRecord };
  }

  async disconnect(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const integration = await this.prisma.patientIntegration.findFirst({
      where: { patient_id: patient.id, provider_name: 'fitbit' },
    });

    if (integration) {
      const basicAuth = Buffer.from(
        `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`,
      ).toString('base64');
      await fetch('https://api.fitbit.com/oauth2/revoke', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token: integration.access_token }).toString(),
      }).catch(() => {});
    }

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
