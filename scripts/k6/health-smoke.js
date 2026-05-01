/**
 * k6 hello-world — hits NestJS /health (override BASE_URL for staging).
 * Usage: `k6 run scripts/k6/health-smoke.js`
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 2,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body has ok': (r) => r.body && String(r.body).includes('ok'),
  });
  sleep(0.3);
}
