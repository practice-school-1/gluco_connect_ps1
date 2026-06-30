import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { MetricsStore, HealthController, MetricsController } from './monitoring';
import { PrismaService } from './prisma/prisma.service';

const mockPrisma = {
  $queryRaw: jest.fn(),
};

describe('MetricsStore', () => {
  let store: MetricsStore;

  beforeEach(() => {
    store = new MetricsStore();
  });

  // ─── record + snapshot ─────────────────────────────────────────────────────

  it('starts with zero requests and errors', () => {
    const snap = store.snapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.errorCount5xx).toBe(0);
    expect(snap.p95ResponseMs).toBeDefined();
  });

  it('counts total requests regardless of status code', () => {
    store.record(200, 50);
    store.record(201, 30);
    store.record(404, 20);
    expect(store.snapshot().totalRequests).toBe(3);
  });

  it('counts only 5xx responses as errors', () => {
    store.record(200, 40);
    store.record(400, 10);
    store.record(500, 80);
    store.record(503, 90);
    expect(store.snapshot().errorCount5xx).toBe(2);
  });

  it('does not count 4xx responses as 5xx errors', () => {
    store.record(401, 15);
    store.record(403, 12);
    store.record(404, 10);
    expect(store.snapshot().errorCount5xx).toBe(0);
  });

  it('computes p95 response time across recorded durations', () => {
    // 20 requests — p95 should be the 19th value (index 18) when sorted
    for (let i = 1; i <= 20; i++) store.record(200, i * 10);
    const { p95ResponseMs } = store.snapshot();
    // sorted: 10, 20, ..., 200 — p95 index = ceil(20 * 0.95) - 1 = 18 → value 190
    expect(p95ResponseMs).toBe(190);
  });

  it('returns p95 of 0 when no requests have been recorded', () => {
    expect(store.snapshot().p95ResponseMs).toBe(0);
  });

  it('reset() clears all counters', () => {
    store.record(200, 100);
    store.record(500, 200);
    store.reset();
    const snap = store.snapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.errorCount5xx).toBe(0);
    expect(snap.p95ResponseMs).toBe(0);
  });

  it('snapshot() includes uptimeSec as a non-negative integer', () => {
    const { uptimeSec } = store.snapshot();
    expect(uptimeSec).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(uptimeSec)).toBe(true);
  });

  it('snapshot() includes a valid ISO startedAt timestamp', () => {
    const { startedAt } = store.snapshot();
    expect(new Date(startedAt).toISOString()).toBe(startedAt);
  });
});

// ─── HealthController ──────────────────────────────────────────────────────────

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns status ok and db connected when the DB query succeeds', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.db).toBe('connected');
    expect(typeof result.timestamp).toBe('string');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('throws ServiceUnavailableException when the DB is unreachable', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });

  it('includes the current UTC timestamp in the ok response', async () => {
    const before = Date.now();
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const result = await controller.check();
    const after = Date.now();

    const ts = new Date(result.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ─── MetricsController ────────────────────────────────────────────────────────

describe('MetricsController', () => {
  let controller: MetricsController;
  let store: MetricsStore;

  beforeEach(async () => {
    store = new MetricsStore();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsStore, useValue: store }],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  it('returns zero error rate when there are no requests', () => {
    const result = controller.getMetrics();
    expect(result.errorRatePct).toBe(0);
    expect(result.totalRequests).toBe(0);
  });

  it('calculates errorRatePct correctly', () => {
    store.record(200, 50);
    store.record(200, 60);
    store.record(500, 80);
    store.record(503, 100);

    const result = controller.getMetrics();
    // 2 errors out of 4 requests = 50%
    expect(result.errorRatePct).toBe(50);
    expect(result.errorCount5xx).toBe(2);
    expect(result.totalRequests).toBe(4);
  });

  it('returns errorRatePct as a number with at most 2 decimal places', () => {
    store.record(200, 30);
    store.record(500, 50);
    store.record(200, 20);

    const result = controller.getMetrics();
    // 1/3 = 33.33%
    expect(result.errorRatePct).toBe(33.33);
  });

  it('includes p95ResponseMs, uptimeSec, and startedAt in the response', () => {
    store.record(200, 120);

    const result = controller.getMetrics();
    expect(typeof result.p95ResponseMs).toBe('number');
    expect(typeof result.uptimeSec).toBe('number');
    expect(typeof result.startedAt).toBe('string');
  });

  it('returns 100% error rate when every request is a 5xx', () => {
    store.record(500, 200);
    store.record(503, 300);

    const result = controller.getMetrics();
    expect(result.errorRatePct).toBe(100);
  });
});
