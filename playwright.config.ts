import { defineConfig, devices } from '@playwright/test';

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
      command:
        'ulimit -n 4096; pnpm --filter @yaemartos/api exec prisma generate && pnpm --filter @yaemartos/api dev',
      cwd: '.',
      url: 'http://127.0.0.1:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...process.env,
        PORT: '4000',
        CHOKIDAR_USEPOLLING: '1',
        WATCHPACK_POLLING: 'true',
      },
    },
    {
      command: 'ulimit -n 4096; pnpm --filter @yaemartos/web dev',
      cwd: '.',
      url: 'http://127.0.0.1:3000/en',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4000',
        CHOKIDAR_USEPOLLING: '1',
        WATCHPACK_POLLING: 'true',
      },
    },
  ],
});
