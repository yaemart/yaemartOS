/**
 * k6 smoke test — hits NestJS /health/live (override BASE_URL for staging).
 * Usage: `k6 run scripts/k6/health-smoke.js`
 *
 * Thresholds align with M-01 P99 budget.
 * Use m01-concurrent-sessions.js for the full M-01 load scenario.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.001'],
    http_req_duration: ['p(99)<800'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export default function () {
  // Use /health/live for smoke (no I/O, stable regardless of DB state)
  const res = http.get(`${BASE_URL}/health/live`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body has ok': (r) => r.body && String(r.body).includes('ok'),
  });
  sleep(0.3);
}
