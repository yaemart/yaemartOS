export type ValidationRow = {
  sku: string;
  fieldChecks: Record<string, boolean>;
};

export type ValidationMetrics = {
  totalRows: number;
  passedRows: number;
  rowAccuracy: number;
  fieldAccuracy: number;
  fieldBreakdown: Record<string, { passed: number; total: number; accuracy: number }>;
};

function ratio(passed: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Number(((passed / total) * 100).toFixed(2));
}

export function calculateValidationMetrics(rows: ValidationRow[]): ValidationMetrics {
  const totalRows = rows.length;
  let passedRows = 0;
  let totalFieldChecks = 0;
  let passedFieldChecks = 0;
  const fieldStats: Record<string, { passed: number; total: number }> = {};

  for (const row of rows) {
    const checks = Object.entries(row.fieldChecks);
    const rowPassed = checks.every(([, pass]) => pass);
    if (rowPassed) {
      passedRows += 1;
    }

    for (const [field, pass] of checks) {
      if (!fieldStats[field]) {
        fieldStats[field] = { passed: 0, total: 0 };
      }
      fieldStats[field].total += 1;
      totalFieldChecks += 1;
      if (pass) {
        fieldStats[field].passed += 1;
        passedFieldChecks += 1;
      }
    }
  }

  const fieldBreakdown: ValidationMetrics['fieldBreakdown'] = {};
  for (const [field, stat] of Object.entries(fieldStats)) {
    fieldBreakdown[field] = {
      passed: stat.passed,
      total: stat.total,
      accuracy: ratio(stat.passed, stat.total),
    };
  }

  return {
    totalRows,
    passedRows,
    rowAccuracy: ratio(passedRows, totalRows),
    fieldAccuracy: ratio(passedFieldChecks, totalFieldChecks),
    fieldBreakdown,
  };
}
