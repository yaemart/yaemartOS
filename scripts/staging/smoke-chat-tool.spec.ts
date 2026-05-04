import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Drift-protection: the W49 staging smoke script names three metric
 * constants that MUST match the strings recorded by `chat.service.ts`.
 * If someone renames `chat.tool.invocation_count` upstream, this test
 * fails before staging runs blind.
 */
describe('W49 staging smoke <-> chat.service KPI string contract', () => {
  it('all KPI names referenced by smoke also appear in chat.service.ts', async () => {
    const root = resolve(__dirname, '../..');
    const [smoke, chatService] = await Promise.all([
      readFile(resolve(root, 'scripts/staging/smoke-chat-tool.ts'), 'utf8'),
      readFile(resolve(root, 'apps/api/src/customer-portal/chat/chat.service.ts'), 'utf8'),
    ]);

    const kpiMatches = smoke.match(/'chat\.[a-z._]+'/g) ?? [];
    const uniqueKpis = [...new Set(kpiMatches)].filter(
      (k) => k.startsWith("'chat.tool.") || k.startsWith("'chat.session."),
    );

    expect(uniqueKpis.length).toBeGreaterThanOrEqual(3);
    for (const kpi of uniqueKpis) {
      expect(
        chatService.includes(kpi),
        `chat.service.ts is missing KPI string ${kpi} that smoke-chat-tool.ts references`,
      ).toBe(true);
    }
  });
});

/**
 * Drift-protection for F-19 (W49 D2 hotfix): smoke must NOT regress
 * back to first-fail `envOrDie` style on missing env. The required
 * shape is `requireEnv(key, missing)` accumulating into a `missing[]`
 * array, followed by a single `finalize(..., 2)` call that writes a
 * parseable JSON report to stdout. If someone refactors back to
 * `process.exit(2)` directly inside the env helper, smoke-output.json
 * will be empty in CI again and the Slack alert will lose the missing-
 * key list — this test catches that before staging runs blind.
 */
describe('W49 staging smoke <-> F-19 hotfix shape (config-missing JSON output)', () => {
  it('smoke-chat-tool.ts uses collect-all requireEnv, not first-fail envOrDie', async () => {
    const root = resolve(__dirname, '../..');
    const smoke = await readFile(resolve(root, 'scripts/staging/smoke-chat-tool.ts'), 'utf8');

    expect(
      smoke,
      'F-19 regression: envOrDie() reintroduced. Use requireEnv(key, missing) and call finalize(..., 2) once on missing.length > 0 so smoke-output.json is parseable on the config-missing path.',
    ).not.toMatch(/function envOrDie\b/);

    expect(
      smoke,
      'F-19 regression: requireEnv(key, missing) signature missing. The collect-all pattern is required so artifact and Slack can name every missing env var, not just the first.',
    ).toMatch(/function requireEnv\(key: string, missing: string\[\]\)/);

    expect(
      smoke,
      'F-19 regression: missing-env path no longer routes through finalize(..., 2). The early-exit must reuse finalize so it writes a parseable JSON report to stdout (matching the happy-path SmokeReport shape).',
    ).toMatch(/missing\.length > 0[\s\S]*?finalize\([\s\S]*?2,\s*\)/);

    // Match only statement-form `process.exit(2);` at the start of a
    // line, not docstring/comment references like `` `process.exit(2)` ``.
    const directExitMatches = smoke.match(/^\s*process\.exit\(2\);?\s*$/gm) ?? [];
    expect(
      directExitMatches.length,
      `F-19 regression: smoke must not call process.exit(2) directly outside finalize(). Found ${directExitMatches.length} occurrences; only finalize() should hold the single exit(<code>) site.`,
    ).toBeLessThanOrEqual(0);
  });
});
