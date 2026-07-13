import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, Get, Post, Delete, Body, Query, UseGuards, Request, Injectable, NotFoundException, Module, Patch } from '@nestjs/common';
import { JwtAuthGuard } from './auth';
import { PrismaService } from './prisma/prisma.service';

export class GoogleHealthCallbackDto {
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

// Google Health API — successor to the Fitbit Web API (legacy Fitbit API
// shuts down September 2026). OAuth goes through Google's own consent
// screen, not fitbit.com. See backend/.env.example for the scopes/setup.
const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
].join(' ');

@Injectable()
export class GoogleHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuthUrl(userId: string) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID ?? '',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_HEALTH_SCOPES,
      redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI ?? '',
    });
    return { auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  }

  private async exchangeToken(extra: Record<string, string>) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_HEALTH_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET ?? '',
        ...extra,
      }).toString(),
    });
    const data = await response.json();
    if (!response.ok) {
      if (data?.error === 'invalid_grant') {
        throw new Error('That connection expired or was already used — please reconnect Google Health.');
      }
      throw new Error(data?.error_description || data?.error || `Google Health token request failed: ${JSON.stringify(data)}`);
    }
    return data as { access_token: string; refresh_token?: string; scope: string };
  }

  private async googleErrorMessage(res: Response, fallback: string) {
    const body: any = await res.json().catch(() => null);
    const reason = body?.error?.details?.find((d: any) => d.reason)?.reason;
    if (reason === 'ACCOUNT_NOT_LINKED') {
      return "This Google account isn't linked to a fitness data source yet. Link a Fitbit account or a Health Connect-synced device at https://fitbit.google.com/auth/signup, then sync again.";
    }
    if (res.status === 401 || res.status === 403) {
      return 'Your Google Health connection has expired or lost access. Disconnect and reconnect Google Health, then try again.';
    }
    return body?.error?.message || fallback;
  }

  async handleCallback(userId: string, dto: GoogleHealthCallbackDto) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const tokens = await this.exchangeToken({
      grant_type: 'authorization_code',
      code: dto.code,
      redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI ?? '',
    });

    await this.prisma.patientIntegration.upsert({
      where: { patient_id_provider_name: { patient_id: patient.id, provider_name: 'google_health' } },
      create: {
        patient_id: patient.id,
        provider_name: 'google_health',
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

    return { message: 'Google Health connected successfully' };
  }

  private async dataPointsGet(accessToken: string, dataType: string, filter: string) {
    const url = `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints?filter=${encodeURIComponent(filter)}`;
    return fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  }

  async sync(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const integration = await this.prisma.patientIntegration.findFirst({
      where: { patient_id: patient.id, provider_name: 'google_health' },
    });
    if (!integration) throw new NotFoundException('Google Health is not connected');

    let accessToken = integration.access_token;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    const today = startOfDay.toISOString().slice(0, 10);
    const startIso = startOfDay.toISOString();
    const endIso = endOfDay.toISOString();

    const fetchAll = async () => Promise.all([
      this.dataPointsGet(accessToken, 'steps', `steps.interval.start_time >= "${startIso}" AND steps.interval.start_time < "${endIso}"`),
      this.dataPointsGet(accessToken, 'active_minutes', `active_minutes.interval.start_time >= "${startIso}" AND active_minutes.interval.start_time < "${endIso}"`),
      this.dataPointsGet(accessToken, 'total_calories', `total_calories.interval.start_time >= "${startIso}" AND total_calories.interval.start_time < "${endIso}"`),
      this.dataPointsGet(accessToken, 'heart_rate', `heart_rate.sample_time.physical_time >= "${startIso}" AND heart_rate.sample_time.physical_time < "${endIso}"`),
    ]);

    let [stepsRes, activeMinRes, caloriesRes, heartRes] = await fetchAll();

    if (stepsRes.status === 401) {
      const refreshed = await this.exchangeToken({
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token ?? '',
      });
      accessToken = refreshed.access_token;
      await this.prisma.patientIntegration.update({
        where: { id: integration.id },
        data: { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token ?? integration.refresh_token },
      });
      [stepsRes, activeMinRes, caloriesRes, heartRes] = await fetchAll();
    }

    if (!stepsRes.ok) {
      throw new Error(await this.googleErrorMessage(stepsRes, `Google Health steps request failed: ${stepsRes.status}`));
    }

    // Each dataPoint nests its value under a key matching the data type
    // name (e.g. `steps.count`, `heart_rate.beatsPerMinute`) — see
    // https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints
    const sumField = (points: any[], typeKey: string, field: string) =>
      points.reduce((sum, p) => sum + (parseInt(p?.[typeKey]?.[field], 10) || 0), 0);
    const avgField = (points: any[], typeKey: string, field: string) => {
      const vals = points.map((p) => parseInt(p?.[typeKey]?.[field], 10)).filter((v) => !isNaN(v));
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };

    const stepsData = (await stepsRes.json())?.dataPoints ?? [];
    const activeMinData = activeMinRes.ok ? (await activeMinRes.json())?.dataPoints ?? [] : [];
    const caloriesData = caloriesRes.ok ? (await caloriesRes.json())?.dataPoints ?? [] : [];
    const heartData = heartRes.ok ? (await heartRes.json())?.dataPoints ?? [] : [];

    const steps = sumField(stepsData, 'steps', 'count');
    const activeMinutes = sumField(activeMinData, 'active_minutes', 'count');
    const caloriesBurned = sumField(caloriesData, 'total_calories', 'count') || null;
    const heartRateAvg = avgField(heartData, 'heart_rate', 'beatsPerMinute');

    const existing = await this.prisma.activity.findFirst({
      where: { patient_id: patient.id, source: 'google_health', date: new Date(today) },
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
            source: 'google_health',
            activity_type: 'google_health_sync',
            steps,
            active_minutes: activeMinutes,
            calories_burned: caloriesBurned,
            heart_rate_avg: heartRateAvg,
            date: new Date(today),
          },
        });

    return { message: 'Google Health data synced', activity: activityRecord };
  }

  async disconnect(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const integration = await this.prisma.patientIntegration.findFirst({
      where: { patient_id: patient.id, provider_name: 'google_health' },
    });

    if (integration) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${integration.access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(() => {});
    }

    await this.prisma.patientIntegration.deleteMany({
      where: { patient_id: patient.id, provider_name: 'google_health' }
    });

    return { message: 'Google Health disconnected' };
  }

  async getStatus(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { user_id: userId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const integration = await this.prisma.patientIntegration.findFirst({
      where: { patient_id: patient.id, provider_name: 'google_health' }
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

@ApiTags('Google Health Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('google-health')
export class GoogleHealthController {
  constructor(private readonly googleHealthService: GoogleHealthService) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Get Google Health OAuth authorization URL' })
  getAuthUrl(@Request() req) {
    return this.googleHealthService.getAuthUrl(req.user.userId);
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle OAuth redirect code' })
  handleCallback(@Request() req, @Body() dto: GoogleHealthCallbackDto) {
    return this.googleHealthService.handleCallback(req.user.userId, dto);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Manually trigger a Google Health data sync' })
  sync(@Request() req) {
    return this.googleHealthService.sync(req.user.userId);
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Remove Google Health connection' })
  disconnect(@Request() req) {
    return this.googleHealthService.disconnect(req.user.userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check if Google Health is connected' })
  getStatus(@Request() req) {
    return this.googleHealthService.getStatus(req.user.userId);
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
    GoogleHealthController,
    NotificationsController
  ],
  providers: [
    GoogleHealthService,
    NotificationsService
  ]
})
export class IntegrationsModule {}
