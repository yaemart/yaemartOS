import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

/**
 * In CI the servers are pre-built before Playwright runs (see ci.yml e2e job).
 * Production binaries start in ~5 seconds, well within the 30-second timeout.
 *
 * Locally we keep dev mode with hot-reload and a generous 3-minute timeout
 * to accommodate first-compilation warm-up.
 */
const apiCommand = isCI
  ? 'node apps/api/dist/main.js'
  : 'ulimit -n 4096; pnpm --filter @yaemartos/api exec prisma generate && pnpm --filter @yaemartos/api dev';

const webCommand = isCI
  ? 'pnpm --filter @yaemartos/web start'
  : 'ulimit -n 4096; pnpm --filter @yaemartos/web dev';

const serverTimeout = isCI ? 30_000 : 180_000;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3000',
  },
  webServer: [
    {
      command: apiCommand,
      cwd: '.',
      url: 'http://127.0.0.1:4000/health',
      reuseExistingServer: !isCI,
      timeout: serverTimeout,
      env: {
        ...process.env,
        PORT: '4000',
        ...(isCI ? {} : { CHOKIDAR_USEPOLLING: '1', WATCHPACK_POLLING: 'true' }),
      },
    },
    {
      command: webCommand,
      cwd: '.',
      url: 'http://127.0.0.1:3000/en',
      reuseExistingServer: !isCI,
      timeout: serverTimeout,
      env: {
        ...process.env,
        PORT: '3000',
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4000',
        ...(isCI ? {} : { CHOKIDAR_USEPOLLING: '1', WATCHPACK_POLLING: 'true' }),
      },
    },
  ],
});
