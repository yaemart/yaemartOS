import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaClientManager } from '../../database/prisma.service';
import { PathAImportService } from './path-a-import.service';
import { pathAExtractionInputSchema } from './schema';
import type { PathAExtractionInput } from './types';

async function loadInputs(filePath: string): Promise<PathAExtractionInput[]> {
  const payload = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(payload);
  if (!Array.isArray(parsed)) {
    throw new Error('Input JSON must be an array');
  }
  return parsed.map((item) => pathAExtractionInputSchema.parse(item));
}

async function main() {
  const inputPathArg = process.argv[2];
  if (!inputPathArg) {
    throw new Error('Usage: node dist/migration/path-a/path-a-runner.js <input-json-file>');
  }

  const inputPath = resolve(process.cwd(), inputPathArg);
  const prismaManager = new PrismaClientManager();
  await prismaManager.onModuleInit();

  try {
    const inputs = await loadInputs(inputPath);
    const auditService = new AuditService(prismaManager);
    const importer = new PathAImportService(prismaManager, auditService);
    const summary = await importer.importFromExtractionInputs(inputs);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prismaManager.onModuleDestroy();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
