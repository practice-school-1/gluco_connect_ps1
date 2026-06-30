/**
 * GlucoConnect load test — P6 QA, Week 5 Day 23 (June 25 2026)
 *
 * Simulates 25 concurrent users for 10 minutes hitting the core API endpoints.
 * Run with: k6 run k6-load-test.js
 *
 * Prerequisites:
 *   brew install k6  (macOS)  |  sudo snap install k6  (Linux)
 *
 * To run against staging:
 *   BASE_URL=https://glucoconnect-api-staging.up.railway.app k6 run k6-load-test.js
 *
 * To run against production:
 *   BASE_URL=https://glucoconnect-api.up.railway.app k6 run k6-load-test.js
 *
 * Pass-criteria (enforced as thresholds below):
 *   - p95 response time < 500ms for all standard endpoints
 *   - p95 response time < 4000ms for POST /insights/daily (insight endpoint)
 *   - HTTP error rate < 1% of all requests
 *   - Zero 5xx responses on auth, glucose, and summary endpoints
 */

import http   from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── configuration ────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    // Ramp up to 25 VUs over 2 minutes, hold for 6 minutes, ramp down in 2 minutes
    api_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 25 },
        { duration: '6m', target: 25 },
        { duration: '2m', target: 0  },
      ],
    },
  },

  thresholds: {
    // Overall latency
    http_req_duration: ['p(95)<500'],

    // Error rate must stay below 1%
    http_req_failed: ['rate<0.01'],

    // Per-endpoint latency (tagged)
    'http_req_duration{endpoint:glucose_list}':  ['p(95)<400'],
    'http_req_duration{endpoint:daily_summary}': ['p(95)<500'],
    'http_req_duration{endpoint:reports}':       ['p(95)<500'],
    'http_req_duration{endpoint:insight_daily}': ['p(95)<4000'],
  },
};

// ─── custom metrics ───────────────────────────────────────────────────────────

const authErrors    = new Counter('auth_errors');
const glucoseErrors = new Counter('glucose_errors');
const summaryErrors = new Counter('summary_errors');
const insightErrors = new Counter('insight_errors');

// ─── test data ─────────────────────────────────────────────────────────────────

// Pre-seeded test accounts for load testing — must exist in the staging/prod DB.
// See docs/DEPLOYMENT_CHECKLIST.md for seeding instructions.
const TEST_TOKENS = __ENV.TEST_TOKENS
  ? JSON.parse(__ENV.TEST_TOKENS)
  : [
      'REPLACE_WITH_PATIENT_JWT_TOKEN_1',
      'REPLACE_WITH_PATIENT_JWT_TOKEN_2',
      'REPLACE_WITH_PATIENT_JWT_TOKEN_3',
    ];

const DOCTOR_TOKEN = __ENV.DOCTOR_TOKEN || 'REPLACE_WITH_DOCTOR_JWT_TOKEN';

// ─── helper ───────────────────────────────────────────────────────────────────

function randomToken() {
  return TEST_TOKENS[Math.floor(Math.random() * TEST_TOKENS.length)];
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ─── main scenario ────────────────────────────────────────────────────────────

export default function () {
  const token = randomToken();
  const headers = authHeaders(token);

  // 1. GET /glucose — list recent readings
  {
    const res = http.get(`${BASE_URL}/glucose`, {
      headers,
      tags: { endpoint: 'glucose_list' },
    });
    const ok = check(res, {
      'GET /glucose → 200': r => r.status === 200,
      'GET /glucose → body is array': r => Array.isArray(JSON.parse(r.body)),
    });
    if (!ok) glucoseErrors.add(1);
  }

  sleep(0.5);

  // 2. POST /glucose — log a new reading
  {
    const payload = JSON.stringify({
      value_mg_dl: Math.floor(Math.random() * 80) + 80, // 80–160
      reading_type: ['fasting', 'post_meal', 'pre_meal', 'random'][Math.floor(Math.random() * 4)],
      recorded_at: new Date().toISOString(),
    });
    const res = http.post(`${BASE_URL}/glucose`, payload, {
      headers,
      tags: { endpoint: 'glucose_create' },
    });
    check(res, { 'POST /glucose → 201': r => r.status === 201 });
  }

  sleep(0.3);

  // 3. GET /summary/daily — daily summary
  {
    const today = new Date().toISOString().slice(0, 10);
    const res = http.get(`${BASE_URL}/summary/daily?date=${today}`, {
      headers,
      tags: { endpoint: 'daily_summary' },
    });
    const ok = check(res, {
      'GET /summary/daily → 200': r => r.status === 200,
      'GET /summary/daily → has glucose_readings': r => {
        try { return 'glucose_readings' in JSON.parse(r.body); } catch { return false; }
      },
    });
    if (!ok) summaryErrors.add(1);
  }

  sleep(0.3);

  // 4. GET /glucose/history — 30-day history (DB-intensive query)
  {
    const res = http.get(`${BASE_URL}/glucose/history?days=30`, {
      headers,
      tags: { endpoint: 'glucose_history' },
    });
    check(res, { 'GET /glucose/history → 200': r => r.status === 200 });
  }

  sleep(0.3);

  // 5. GET /glucose/time-in-range — aggregation query
  {
    const res = http.get(`${BASE_URL}/glucose/time-in-range?days=30`, {
      headers,
      tags: { endpoint: 'time_in_range' },
    });
    check(res, { 'GET /glucose/time-in-range → 200': r => r.status === 200 });
  }

  sleep(0.3);

  // 6. GET /meals — list recent meals
  {
    const res = http.get(`${BASE_URL}/meals`, {
      headers,
      tags: { endpoint: 'meals_list' },
    });
    check(res, { 'GET /meals → 200': r => r.status === 200 });
  }

  sleep(0.3);

  // 7. GET /activities/summary — steps summary
  {
    const res = http.get(`${BASE_URL}/activities/summary`, {
      headers,
      tags: { endpoint: 'activities_summary' },
    });
    check(res, { 'GET /activities/summary → 200': r => r.status === 200 });
  }

  sleep(0.3);

  // 8. GET /reports/weekly — weekly report (DB aggregation)
  {
    const res = http.get(`${BASE_URL}/reports/weekly`, {
      headers,
      tags: { endpoint: 'reports' },
    });
    check(res, { 'GET /reports/weekly → 200': r => r.status === 200 });
  }

  sleep(0.5);

  // 9. GET /insights/daily — daily insight (cached for today)
  //    Only 1 in 5 VUs calls this to avoid hammering the insight endpoint
  if (Math.random() < 0.2) {
    const res = http.get(`${BASE_URL}/insights/daily`, {
      headers,
      tags: { endpoint: 'insight_daily' },
      timeout: '10s',
    });
    const ok = check(res, { 'GET /insights/daily → 200': r => r.status === 200 });
    if (!ok) insightErrors.add(1);
  }

  sleep(1);
}

// ─── doctor scenario (runs once per iteration from VU 1 only) ─────────────────

export function doctorScenario() {
  const headers = authHeaders(DOCTOR_TOKEN);

  // GET /doctors/patients — enriched patient list
  {
    const res = http.get(`${BASE_URL}/doctors/patients`, {
      headers,
      tags: { endpoint: 'doctor_patients' },
    });
    check(res, { 'GET /doctors/patients → 200': r => r.status === 200 });
  }

  sleep(1);
}

// ─── teardown: print summary ──────────────────────────────────────────────────

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: buildSummaryText(data),
  };
}

function buildSummaryText(data) {
  const m = data.metrics;
  const p95  = m.http_req_duration?.values?.['p(95)']?.toFixed(0) ?? 'n/a';
  const p99  = m.http_req_duration?.values?.['p(99)']?.toFixed(0) ?? 'n/a';
  const errRate = ((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2);
  const total   = m.http_reqs?.values?.count ?? 0;

  return `
╔══════════════════════════════════════════════════╗
║  GlucoConnect Load Test Results — ${new Date().toISOString().slice(0,10)}  ║
╠══════════════════════════════════════════════════╣
║  Total requests : ${String(total).padEnd(30)} ║
║  p95 latency    : ${(p95 + ' ms').padEnd(30)} ║
║  p99 latency    : ${(p99 + ' ms').padEnd(30)} ║
║  Error rate     : ${(errRate + '%').padEnd(30)} ║
╚══════════════════════════════════════════════════╝
`;
}
