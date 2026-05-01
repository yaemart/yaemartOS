/**
 * k6 performance test: POST /listings/:id/generate
 *
 * M-02 acceptance criteria: P95 response time < 15,000ms, success rate > 95%
 *
 * Usage (run against staging, not production):
 *   k6 run --env BASE_URL=https://staging-api.example.com \
 *           --env ACCESS_TOKEN=<jwt> \
 *           --env LISTING_ID=<listing_id> \
 *           scripts/k6-listing-generate.js
 *
 * Install k6: https://grafana.com/docs/k6/latest/get-started/installation/
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const generateP95 = new Trend('listing_generate_p95', true);
const successRate = new Rate('listing_generate_success');

export const options = {
  vus: 3,
  duration: '2m',
  thresholds: {
    listing_generate_p95: ['p(95)<15000'],
    listing_generate_success: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:4000';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN ?? '';
const LISTING_ID = __ENV.LISTING_ID ?? '';

export default function () {
  const payload = JSON.stringify({
    productTitle: 'Homtone 6QT Stainless Steel Slow Cooker',
    productCategory: 'Kitchen Appliances',
  });

  const params = {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'x-yaemart-brand': 'homtone',
    },
    timeout: '20s',
  };

  const res = http.post(`${BASE_URL}/listings/${LISTING_ID}/generate`, payload, params);

  const ok = check(res, {
    'status is 201': (r) => r.status === 201,
    'has versionNumber': (r) => {
      try {
        return JSON.parse(r.body).versionNumber >= 1;
      } catch {
        return false;
      }
    },
  });

  generateP95.add(res.timings.duration);
  successRate.add(ok ? 1 : 0);

  sleep(2);
}
