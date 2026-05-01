import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  calculateValidationMetrics,
  type ValidationRow,
} from '../../apps/api/src/migration/path-a/quality-metrics';

async function main() {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3] ?? 'docs/reports/w12-homtone-validation-report.json';

  if (!inputArg) {
    throw new Error(
      'Usage: node scripts/migration/export-homtone-validation-report.ts <validation-rows.json> [output.json]',
    );
  }

  const inputPath = resolve(process.cwd(), inputArg);
  const outputPath = resolve(process.cwd(), outputArg);
  const payload = await readFile(inputPath, 'utf8');
  const rows = JSON.parse(payload) as ValidationRow[];
  const metrics = calculateValidationMetrics(rows);

  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        metrics,
      },
      null,
      2,
    ),
    'utf8',
  );
  // eslint-disable-next-line no-console
  console.log(`Validation report generated: ${outputPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
