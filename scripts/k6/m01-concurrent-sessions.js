/**
 * M-01 负载测试场景 — 并发登录 + Listing 列表
 *
 * 指标要求（docs/yaemartOS-implementation-plan.md §5）：
 *   M-01: 50 并发用户，P99 < 800ms，错误率 < 0.1%
 *
 * 使用方法：
 *   # 本地 dev（仅冒烟，不验证阈值）
 *   k6 run scripts/k6/m01-concurrent-sessions.js \
 *     --env BASE_URL=http://localhost:4000 \
 *     --env TEST_USER=dev@example.com \
 *     --env TEST_PASS=devpassword
 *
 *   # Staging（正式压测）
 *   k6 run scripts/k6/m01-concurrent-sessions.js \
 *     --env BASE_URL=https://api.staging.yaemartos.com \
 *     --env TEST_USER=$STAGING_TEST_USER \
 *     --env TEST_PASS=$STAGING_TEST_PASS \
 *     --out json=reports/m01-$(date +%Y%m%d_%H%M%S).json
 *
 * 报告归档：执行后填写 docs/reports/m01-template.md
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ─── Custom metrics ──────────────────────────────────────────────────────────

const loginDuration = new Trend('login_duration', true);
const listingListDuration = new Trend('listing_list_duration', true);
const errorRate = new Rate('error_rate');

// ─── Test configuration ───────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // 爬坡：0 → 10 VU
    { duration: '60s', target: 50 }, // 稳定：10 → 50 VU（M-01 峰值）
    { duration: '30s', target: 0 }, // 降压：50 → 0 VU
  ],
  thresholds: {
    // M-01 硬阈值
    http_req_duration: ['p(99)<800'],
    http_req_failed: ['rate<0.001'], // 错误率 < 0.1%
    // 场景级阈值（供趋势分析）
    login_duration: ['p(99)<600'],
    listing_list_duration: ['p(99)<400'],
    error_rate: ['rate<0.001'],
  },
};

// ─── Test configuration ───────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const TEST_USER = __ENV.TEST_USER || 'alpha-test@yaemartos.com';
const TEST_PASS = __ENV.TEST_PASS || 'change-me';

// ─── Virtual user scenario ────────────────────────────────────────────────────

export default function () {
  // Step 1: Login
  const loginStart = Date.now();
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: TEST_USER, password: TEST_PASS }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  loginDuration.add(Date.now() - loginStart);

  const loginOk = check(loginRes, {
    'login status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'login returns access_token': (r) => {
      try {
        return !!JSON.parse(String(r.body))['access_token'];
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!loginOk);

  if (!loginOk) {
    sleep(1);
    return;
  }

  const token = JSON.parse(String(loginRes.body))['access_token'];

  // Step 2: List listings (simulates typical operator dashboard load)
  const listStart = Date.now();
  const listRes = http.get(`${BASE_URL}/listings?brandId=homtone&pageSize=20`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  listingListDuration.add(Date.now() - listStart);

  const listOk = check(listRes, {
    'listings list status 200': (r) => r.status === 200,
    'listings list has data field': (r) => {
      try {
        return Array.isArray(JSON.parse(String(r.body))['data']);
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!listOk);

  sleep(0.5);
}
