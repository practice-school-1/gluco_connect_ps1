import {
  Injectable,
  Module,
  Controller,
  Get,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ServiceUnavailableException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from './prisma/prisma.service';

// ─── MetricsStore ─────────────────────────────────────────────────────────────

@Injectable()
export class MetricsStore {
  private readonly startedAt = new Date();
  private totalRequests = 0;
  private errorCount5xx = 0;
  private readonly durations: number[] = [];

  record(statusCode: number, durationMs: number): void {
    this.totalRequests++;
    this.durations.push(durationMs);
    if (statusCode >= 500) {
      this.errorCount5xx++;
    }
  }

  snapshot() {
    const sorted = [...this.durations].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    const p95 = sorted.length > 0 ? (sorted[Math.max(0, p95Index)] ?? 0) : 0;
    return {
      totalRequests: this.totalRequests,
      errorCount5xx: this.errorCount5xx,
      p95ResponseMs: p95,
      uptimeSec: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      startedAt: this.startedAt.toISOString(),
    };
  }

  reset(): void {
    this.totalRequests = 0;
    this.errorCount5xx = 0;
    this.durations.length = 0;
  }
}

// ─── MetricsInterceptor ───────────────────────────────────────────────────────
// Tracks every request's duration and status code.
// Emits a structured error log for any 5xx so ops tooling can alert on it.

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('5xx-alert');

  constructor(private readonly store: MetricsStore) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<{ statusCode: number }>();
          this.store.record(res.statusCode, Date.now() - start);
        },
        error: (err: unknown) => {
          const status = err instanceof HttpException ? err.getStatus() : 500;
          const message = err instanceof Error ? err.message : String(err);
          const duration = Date.now() - start;
          this.store.record(status, duration);
          if (status >= 500) {
            this.logger.error(
              `${req.method} ${req.url} → HTTP ${status} in ${duration}ms | ${message}`,
            );
          }
        },
      }),
    );
  }
}

// ─── HealthController ──────────────────────────────────────────────────────────
// Used by UptimeRobot for liveness checks and by the smoke-test checklist.

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: string; db: string; timestamp: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'unreachable' });
    }
  }
}

// ─── MetricsController ────────────────────────────────────────────────────────
// Internal endpoint for the Day 3 production health check and daily dashboards.
// Not exposed publicly — restrict via network policy or a simple IP allowlist in prod.

@Controller('metrics')
export class MetricsController {
  constructor(private readonly store: MetricsStore) {}

  @Get()
  getMetrics() {
    const snap = this.store.snapshot();
    const errorRatePct =
      snap.totalRequests > 0
        ? parseFloat(((snap.errorCount5xx / snap.totalRequests) * 100).toFixed(2))
        : 0;
    return { ...snap, errorRatePct };
  }
}

// ─── MonitoringModule ─────────────────────────────────────────────────────────

@Module({
  providers: [
    MetricsStore,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  controllers: [HealthController, MetricsController],
  exports: [MetricsStore],
})
export class MonitoringModule {}
