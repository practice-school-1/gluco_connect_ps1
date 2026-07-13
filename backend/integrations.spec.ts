import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FitbitService } from './integrations';
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
  provider_name: 'fitbit',
  access_token: 'access_1',
  refresh_token: 'refresh_1',
  connected_at: '2026-07-01T00:00:00Z',
};

function jsonResponse(body: any, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body };
}

describe('FitbitService', () => {
  let service: FitbitService;
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.FITBIT_CLIENT_ID = 'client123';
    process.env.FITBIT_CLIENT_SECRET = 'secret456';
    process.env.FITBIT_REDIRECT_URI = 'http://localhost:5173/patient/log-activity';

    const module: TestingModule = await Test.createTestingModule({
      providers: [FitbitService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<FitbitService>(FitbitService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe('getAuthUrl', () => {
    it('builds the Fitbit authorize URL from env config', async () => {
      const result = await service.getAuthUrl('u1');

      expect(result.auth_url).toContain('https://www.fitbit.com/oauth2/authorize?');
      expect(result.auth_url).toContain('client_id=client123');
      expect(result.auth_url).toContain('response_type=code');
      expect(result.auth_url).toContain('scope=activity+heartrate+profile');
      expect(result.auth_url).toContain(encodeURIComponent(process.env.FITBIT_REDIRECT_URI as string));
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
        jsonResponse({ access_token: 'new_access', refresh_token: 'new_refresh', scope: 'activity heartrate profile' }),
      );
      mockPrisma.patientIntegration.upsert.mockResolvedValue(INTEGRATION);

      const result = await service.handleCallback('u1', { code: 'abc' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.fitbit.com/oauth2/token',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockPrisma.patientIntegration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patient_id_provider_name: { patient_id: 'p1', provider_name: 'fitbit' } },
          create: expect.objectContaining({ access_token: 'new_access', refresh_token: 'new_refresh' }),
          update: expect.objectContaining({ access_token: 'new_access', refresh_token: 'new_refresh' }),
        }),
      );
      expect(result).toEqual({ message: 'Fitbit connected successfully' });
    });

    it('throws when the token exchange fails', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ error: 'invalid_grant' }, false, 400));

      await expect(service.handleCallback('u1', { code: 'bad' })).rejects.toThrow('Fitbit token request failed');
    });
  });

  describe('sync', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.sync('u1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when Fitbit is not connected', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(null);

      await expect(service.sync('u1')).rejects.toThrow(NotFoundException);
    });

    it('fetches activity + heart data and creates a new activity record', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);
      mockPrisma.activity.findFirst.mockResolvedValue(null);
      mockPrisma.activity.create.mockResolvedValue({ id: 'a1' });

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/activities/heart/')) {
          return Promise.resolve(
            jsonResponse({ 'activities-heart': [{ value: { restingHeartRate: 65 } }] }),
          );
        }
        return Promise.resolve(
          jsonResponse({ summary: { steps: 8500, veryActiveMinutes: 20, fairlyActiveMinutes: 10, caloriesOut: 2100 } }),
        );
      });

      const result = await service.sync('u1');

      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patient_id: 'p1',
          source: 'fitbit',
          steps: 8500,
          active_minutes: 30,
          calories_burned: 2100,
          heart_rate_avg: 65,
        }),
      });
      expect(result.message).toBe('Fitbit data synced');
    });

    it('updates an existing activity record for today instead of creating a new one', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);
      mockPrisma.activity.findFirst.mockResolvedValue({ id: 'existing1' });
      mockPrisma.activity.update.mockResolvedValue({ id: 'existing1' });

      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ summary: { steps: 100, veryActiveMinutes: 0, fairlyActiveMinutes: 0, caloriesOut: 50 } }),
      );

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

      let activityCallCount = 0;
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/oauth2/token')) {
          return Promise.resolve(jsonResponse({ access_token: 'refreshed_access', refresh_token: 'refreshed_refresh', scope: 'activity' }));
        }
        if (url.includes('/activities/heart/')) {
          return Promise.resolve(jsonResponse({}));
        }
        activityCallCount += 1;
        if (activityCallCount === 1) {
          return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
        }
        return Promise.resolve(jsonResponse({ summary: { steps: 1, veryActiveMinutes: 0, fairlyActiveMinutes: 0 } }));
      });

      await service.sync('u1');

      expect(mockPrisma.patientIntegration.update).toHaveBeenCalledWith({
        where: { id: 'int1' },
        data: { access_token: 'refreshed_access', refresh_token: 'refreshed_refresh' },
      });
      expect(activityCallCount).toBe(2);
    });

    it('throws when the activity request fails even after a token refresh', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);
      mockPrisma.patientIntegration.update.mockResolvedValue({});

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/oauth2/token')) {
          return Promise.resolve(jsonResponse({ access_token: 'x', refresh_token: 'y', scope: 'activity' }));
        }
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
      });

      await expect(service.sync('u1')).rejects.toThrow('Fitbit activity request failed');
    });
  });

  describe('disconnect', () => {
    it('throws NotFoundException when the user has no patient profile', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.disconnect('u1')).rejects.toThrow(NotFoundException);
    });

    it('revokes the Fitbit token and deletes the local integration', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(PATIENT);
      mockPrisma.patientIntegration.findFirst.mockResolvedValue(INTEGRATION);
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));
      mockPrisma.patientIntegration.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.disconnect('u1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.fitbit.com/oauth2/revoke',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockPrisma.patientIntegration.deleteMany).toHaveBeenCalledWith({
        where: { patient_id: 'p1', provider_name: 'fitbit' },
      });
      expect(result).toEqual({ message: 'Fitbit disconnected' });
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
