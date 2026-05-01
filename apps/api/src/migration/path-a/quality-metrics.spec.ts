import { describe, expect, it } from 'vitest';
import { calculateValidationMetrics } from './quality-metrics';

describe('calculateValidationMetrics', () => {
  it('calculates row and field accuracies', () => {
    const result = calculateValidationMetrics([
      {
        sku: 'A',
        fieldChecks: { title: true, bullets: true, description: false },
      },
      {
        sku: 'B',
        fieldChecks: { title: true, bullets: true, description: true },
      },
    ]);

    expect(result.totalRows).toBe(2);
    expect(result.passedRows).toBe(1);
    expect(result.rowAccuracy).toBe(50);
    expect(result.fieldAccuracy).toBe(83.33);
    expect(result.fieldBreakdown.description.accuracy).toBe(50);
  });
});
