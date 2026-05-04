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
