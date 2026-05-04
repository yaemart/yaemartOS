import { describe, it, expect } from 'vitest';
import { aggregateChatToolKpis, type MetricRecord } from './metric-client';

function rec(
  brandId: string | null,
  recordedAt: string,
  value: number | string = 1,
  name = 'x',
): MetricRecord {
  return { id: `r-${recordedAt}-${brandId}`, name, value, unit: 'count', brandId, recordedAt };
}

describe('aggregateChatToolKpis', () => {
  const NOW = new Date('2026-05-04T12:00:00Z').getTime();

  it('returns null call/error rates and zero counts when no records', () => {
    const summary = aggregateChatToolKpis({
      invocationRecords: [],
      errorRecords: [],
      sessionRecords: [],
      now: NOW,
    });
    expect(summary.invocations).toBe(0);
    expect(summary.errors).toBe(0);
    expect(summary.sessions).toBe(0);
    expect(summary.callRate).toBeNull();
    expect(summary.errorRate).toBeNull();
    expect(summary.perBrand).toEqual([]);
  });

  it('sums only records inside the 24h window', () => {
    const summary = aggregateChatToolKpis({
      invocationRecords: [
        rec('homtone', '2026-05-04T11:00:00Z'), // in window
        rec('homtone', '2026-05-03T11:00:00Z'), // 25h ago, out
      ],
      errorRecords: [rec('homtone', '2026-05-04T08:00:00Z')],
      sessionRecords: [
        rec('homtone', '2026-05-04T10:00:00Z'),
        rec('homtone', '2026-05-04T09:00:00Z'),
      ],
      now: NOW,
    });
    expect(summary.invocations).toBe(1);
    expect(summary.errors).toBe(1);
    expect(summary.sessions).toBe(2);
    expect(summary.callRate).toBeCloseTo(0.5);
    expect(summary.errorRate).toBe(1); // 1/1
  });

  it('groups perBrand and sorts by invocation count desc', () => {
    const summary = aggregateChatToolKpis({
      invocationRecords: [
        rec('homtone', '2026-05-04T11:00:00Z'),
        rec('homtone', '2026-05-04T10:00:00Z'),
        rec('spoonlemon', '2026-05-04T09:00:00Z'),
      ],
      errorRecords: [rec('spoonlemon', '2026-05-04T09:00:00Z')],
      sessionRecords: [],
      now: NOW,
    });
    expect(summary.perBrand).toEqual([
      { brandId: 'homtone', invocations: 2, errors: 0 },
      { brandId: 'spoonlemon', invocations: 1, errors: 1 },
    ]);
  });

  it('respects custom window size', () => {
    const summary = aggregateChatToolKpis({
      invocationRecords: [rec('homtone', '2026-05-04T10:00:00Z')], // 2h ago
      errorRecords: [],
      sessionRecords: [],
      windowMs: 60 * 60 * 1000, // 1h window
      now: NOW,
    });
    expect(summary.invocations).toBe(0);
  });

  it('treats a null brandId as "(none)" rather than crashing', () => {
    const summary = aggregateChatToolKpis({
      invocationRecords: [rec(null, '2026-05-04T11:00:00Z')],
      errorRecords: [],
      sessionRecords: [],
      now: NOW,
    });
    expect(summary.perBrand[0]?.brandId).toBe('(none)');
  });

  // ---- F-1 regression guard ------------------------------------------
  // Prisma `Metric.value` is `Decimal @db.Decimal(18, 6)`, which Nest
  // serializes via `Decimal.toJSON()` → string `"1"`. Before this fix,
  // `total += r.value` would walk `0 + "1"` → `"01"` (string concat).
  // This test reproduces the wire shape and asserts numeric correctness.
  describe('F-1 — Prisma Decimal wire shape (string)', () => {
    it('sums string-typed values as numbers, not concatenations', () => {
      const summary = aggregateChatToolKpis({
        invocationRecords: [
          rec('homtone', '2026-05-04T11:30:00Z', '1'),
          rec('homtone', '2026-05-04T11:00:00Z', '1'),
          rec('homtone', '2026-05-04T10:30:00Z', '1'),
        ],
        errorRecords: [rec('homtone', '2026-05-04T11:00:00Z', '1')],
        sessionRecords: [
          rec('homtone', '2026-05-04T11:00:00Z', '1'),
          rec('homtone', '2026-05-04T10:00:00Z', '1'),
        ],
        now: NOW,
      });
      expect(typeof summary.invocations).toBe('number');
      expect(summary.invocations).toBe(3); // not "0111"
      expect(summary.errors).toBe(1);
      expect(summary.sessions).toBe(2);
      expect(summary.callRate).toBeCloseTo(1.5);
      expect(summary.errorRate).toBeCloseTo(1 / 3);
      expect(summary.perBrand[0]).toEqual({
        brandId: 'homtone',
        invocations: 3,
        errors: 1,
      });
    });

    it('handles mixed number / string / fractional Decimal strings', () => {
      const summary = aggregateChatToolKpis({
        invocationRecords: [
          rec('homtone', '2026-05-04T11:00:00Z', 1), // number
          rec('homtone', '2026-05-04T10:30:00Z', '1.000000'), // Decimal full precision
          rec('homtone', '2026-05-04T10:00:00Z', '2.5'), // fractional string
        ],
        errorRecords: [],
        sessionRecords: [],
        now: NOW,
      });
      expect(summary.invocations).toBe(4.5);
    });

    it('treats malformed values as 0 rather than NaN-poisoning the total', () => {
      const summary = aggregateChatToolKpis({
        invocationRecords: [
          rec('homtone', '2026-05-04T11:00:00Z', '1'),
          rec('homtone', '2026-05-04T10:30:00Z', 'not-a-number'),
          rec('homtone', '2026-05-04T10:00:00Z', '2'),
        ],
        errorRecords: [],
        sessionRecords: [],
        now: NOW,
      });
      expect(summary.invocations).toBe(3); // 1 + 0 + 2, not NaN
      expect(Number.isFinite(summary.invocations)).toBe(true);
    });
  });
});
