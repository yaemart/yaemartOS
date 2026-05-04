import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Two roots: (1) `src/**` for the NestJS app source under apps/api;
    // (2) `../../scripts/**` for repo-root staging/ops scripts whose
    // specs live next to their .ts source. F-19 hotfix (W49 D2)
    // discovered that without (2), `scripts/staging/smoke-chat-tool.spec.ts`
    // was a dead test — vitest filtered it out so the W49 D1 drift
    // protection never ran in CI.
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts', '../../scripts/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
