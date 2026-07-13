import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GoogleHealthService } from './integrations';
import { PrismaService } from './prisma/prisma.service';

const mockPrisma = {
  patient: { findUnique: jest.fn() },
  patientIntegration: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  activity: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const PATIENT = { id: 'p1', user_id: 'u1' };
const INTEGRATION = {
  id: 'int1',
  patient_id: 'p1',
  provider_name: 'google_health',
  access_token: 'access_1',
  refresh_token: 'refresh_1',
  connected_at: '2026-07-01T00:00:00Z',
};

function jsonResponse(body: any, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body };
}

function dataPointsResponse(typeKey: string, field: string, values: (string | number)[]) {
  return jsonResponse({ dataPoints: values.map((v) => ({ [typeKey]: { [field]: String(v) } })) });
}

describe('GoogleHealthService', () => {
  let service: GoogleHealthService;
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.GOOGLE_HEALTH_CLIENT_ID = 'client123';
    process.env.GOOGLE_HEALTH_CLIENT_SECRET = 'secret456';
    process.env.GOOGLE_HEALTH_REDIRECT_URI = 'http://localhost:5173/patient/log-activity';

    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleHealthService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<GoogleHealthService>(GoogleHealthService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe('getAuthUrl', () => {
    it('builds the Google OAuth authorize URL from env config', async () => {
      const result = await service.getAuthUrl('u1');

      expect(result.auth_url).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
      expect(result.auth_url).toContain('client_id=client123');
      expect(result.auth_url).toContain('response_type=code');
      expect(result.auth_url).toContain('access_type=offline');
      expect(result.auth_url).toContain(encodeURIComponent('googlehealth.activity_and_fitness.readonly'));
      expect(result.auth_url).toContain(encodeURIComponent(process.env.GOOGLE_HEALTH_REDIRECT_URI as string));
    });
  });

  describe('handleCallback', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.handleCallback('u1', { code: 'abc' })).rejects.toThrow(NotFoundException);
    });

    it('exchanges the code for tokens and upserts the integration', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ access_token: 'new_access', refresh_token: 'new_refresh', scope: 'googlehealth.activity_and_fitness.readonly' }),
      );
      mockPrisma.patientIntegration.upsert.mockResolvedValue(INTEGRATION);

      const result = await service.handleCallback('u1', { code: 'abc' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockPrisma.patientIntegration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patient_id_provider_name: { patient_id: 'p1', provider_name: 'google_health' } },
          create: expect.objectContaining({ access_token: 'new_access', refresh_token: 'new_refresh' }),
          update: expect.objectContaining({ access_token: 'new_access', refresh_token: 'new_refresh' }),
        }),
      );
      expect(result).toEqual({ message: 'Google Health connected successfully' });
    });

    it('throws when the token exchange fails', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ error: 'invalid_request', error_description: 'redirect_uri mismatch' }, false, 400));

      await expect(service.handleCallback('u1', { code: 'bad' })).rejects.toThrow('redirect_uri mismatch');
    });

    it('throws a friendly message when the authorization code is expired or reused', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ error: 'invalid_grant' }, false, 400));

      await expect(service.handleCallback('u1', { code: 'bad' })).rejects.toThrow(
        'That connection expired or was already used',
      );
    });
  });

  describe('sync', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.sync('u1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when Google Health is not connected', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(null);

      await expect(service.sync('u1')).rejects.toThrow(NotFoundException);
    });

    it('fetches steps/active-minutes/calories/heart-rate data points and creates a new activity record', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);
      mockPrisma.activity.findFirst.mockResolvedValue(null);
      mockPrisma.activity.create.mockResolvedValue({ id: 'a1' });

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/dataTypes/steps/')) return Promise.resolve(dataPointsResponse('steps', 'count', [5000, 3500]));
        if (url.includes('/dataTypes/active_minutes/')) return Promise.resolve(dataPointsResponse('active_minutes', 'count', [20, 10]));
        if (url.includes('/dataTypes/total_calories/')) return Promise.resolve(dataPointsResponse('total_calories', 'count', [2100]));
        if (url.includes('/dataTypes/heart_rate/')) return Promise.resolve(dataPointsResponse('heart_rate', 'beatsPerMinute', [60, 70]));
        throw new Error(`unexpected url ${url}`);
      });

      const result = await service.sync('u1');

      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patient_id: 'p1',
          source: 'google_health',
          steps: 8500,
          active_minutes: 30,
          calories_burned: 2100,
          heart_rate_avg: 65,
        }),
      });
      expect(result.message).toBe('Google Health data synced');
    });

    it('updates an existing activity record for today instead of creating a new one', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);
      mockPrisma.activity.findFirst.mockResolvedValue({ id: 'existing1' });
      mockPrisma.activity.update.mockResolvedValue({ id: 'existing1' });

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/dataTypes/steps/')) return Promise.resolve(dataPointsResponse('steps', 'count', [100]));
        return Promise.resolve(jsonResponse({ dataPoints: [] }));
      });

      await service.sync('u1');

      expect(mockPrisma.activity.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'existing1' } }),
      );
      expect(mockPrisma.activity.create).not.toHaveBeenCalled();
    });

    it('refreshes the access token on a 401 and retries the request', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);
      mockPrisma.patientIntegration.update.mockResolvedValue({});
      mockPrisma.activity.findFirst.mockResolvedValue(null);
      mockPrisma.activity.create.mockResolvedValue({ id: 'a1' });

      let stepsCallCount = 0;
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('oauth2.googleapis.com/token')) {
          return Promise.resolve(jsonResponse({ access_token: 'refreshed_access', refresh_token: 'refreshed_refresh', scope: 'googlehealth.activity_and_fitness.readonly' }));
        }
        if (url.includes('/dataTypes/steps/')) {
          stepsCallCount += 1;
          if (stepsCallCount === 1) return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
          return Promise.resolve(dataPointsResponse('steps', 'count', [1]));
        }
        return Promise.resolve(jsonResponse({ dataPoints: [] }));
      });

      await service.sync('u1');

      expect(mockPrisma.patientIntegration.update).toHaveBeenCalledWith({
        where: { id: 'int1' },
        data: { access_token: 'refreshed_access', refresh_token: 'refreshed_refresh' },
      });
      expect(stepsCallCount).toBe(2);
    });

    it('throws a friendly "connection expired" message when the steps request still 401s after a token refresh', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);
      mockPrisma.patientIntegration.update.mockResolvedValue({});

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('oauth2.googleapis.com/token')) {
          return Promise.resolve(jsonResponse({ access_token: 'x', refresh_token: 'y', scope: 'googlehealth.activity_and_fitness.readonly' }));
        }
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
      });

      await expect(service.sync('u1')).rejects.toThrow('Your Google Health connection has expired or lost access');
    });

    it('throws a friendly "not linked" message when Google reports ACCOUNT_NOT_LINKED', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/dataTypes/steps/')) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              error: {
                message: 'The account is not linked to Google Health.',
                details: [{ reason: 'ACCOUNT_NOT_LINKED' }],
              },
            }),
          });
        }
        return Promise.resolve(jsonResponse({ dataPoints: [] }));
      });

      await expect(service.sync('u1')).rejects.toThrow(
        "This Google account isn't linked to a fitness data source yet",
      );
    });

    it('falls back to a generic message when the steps failure has no recognizable reason', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/dataTypes/steps/')) {
          return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
        }
        return Promise.resolve(jsonResponse({ dataPoints: [] }));
      });

      await expect(service.sync('u1')).rejects.toThrow('Google Health steps request failed: 500');
    });
  });

  describe('disconnect', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.disconnect('u1')).rejects.toThrow(NotFoundException);
    });

    it('revokes the Google token and deletes the local integration', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));
      mockPrisma.patientIntegration.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.disconnect('u1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://oauth2.googleapis.com/revoke'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockPrisma.patientIntegration.deleteMany).toHaveBeenCalledWith({
        where: { patient_id: 'p1', provider_name: 'google_health' },
      });
      expect(result).toEqual({ message: 'Google Health disconnected' });
    });

    it('skips the revoke call and still deletes when nothing is connected', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(null);
      global.fetch = jest.fn();
      mockPrisma.patientIntegration.deleteMany.mockResolvedValue({ count: 0 });

      await service.disconnect('u1');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPrisma.patientIntegration.deleteMany).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('u1')).rejects.toThrow(NotFoundException);
    });

    it('returns connected: false when there is no integration', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(null);

      await expect(service.getStatus('u1')).resolves.toEqual({ connected: false });
    });

    it('returns connected: true with the connection date when integrated', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);

      await expect(service.getStatus('u1')).resolves.toEqual({
        connected: true,
        connected_at: INTEGRATION.connected_at,
      });
    });
  });
});
