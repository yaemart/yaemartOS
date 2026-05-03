/**
 * S2 launch pre-flight environment variable check.
 * Run: pnpm --filter @yaemartos/api run check:env:s2
 *
 * Exit code 0 = all required vars present
 * Exit code 1 = one or more required vars missing
 */

type VarSpec = {
  key: string;
  required: boolean;
  expectedValue?: string;
  description: string;
};

const SPECS: VarSpec[] = [
  {
    key: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL connection string',
  },
  {
    key: 'REDIS_URL',
    required: true,
    description: 'Redis connection string (used for caching & rate limiting)',
  },
  {
    key: 'GEMINI_API_KEY',
    required: true,
    description: 'Google Gemini API key (AI listing generation + embeddings)',
  },
  {
    key: 'GEMINI_EMBED_MODEL',
    required: true,
    expectedValue: 'text-embedding-004',
    description: 'Gemini embedding model identifier',
  },
  {
    key: 'NEXTAUTH_SECRET',
    required: true,
    description: 'NextAuth.js session signing secret',
  },
  {
    key: 'LINGXING_APP_ID',
    required: true,
    description: 'Lingxing OpenAPI application ID',
  },
  {
    key: 'LINGXING_APP_SECRET',
    required: true,
    description: 'Lingxing OpenAPI application secret',
  },
  {
    key: 'JWT_SECRET',
    required: true,
    description: 'JWT signing secret',
  },
  {
    key: 'GEMINI_MODEL',
    required: false,
    description: 'Gemini generation model (defaults to gemini-2.5-flash if absent)',
  },
];

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

/** Left-pad a visible string to `width` characters, ignoring ANSI escape codes. */
function pad(text: string, visibleText: string, width: number): string {
  const padding = Math.max(0, width - visibleText.length);
  return text + ' '.repeat(padding);
}

export function run(env: Record<string, string | undefined> = process.env): boolean {
  let hasError = false;

  console.log('\n=== S2 Launch — Environment Pre-flight Check ===\n');
  console.log(`${'Variable'.padEnd(30)} ${'Status'.padEnd(12)} Description`);
  console.log('─'.repeat(72));

  for (const spec of SPECS) {
    const value = env[spec.key];
    const present = value !== undefined && value.trim() !== '';

    if (!present) {
      if (spec.required) {
        console.log(
          `${spec.key.padEnd(30)} ${pad(RED + '✗ MISSING' + RESET, '✗ MISSING', 12)} ${spec.description}`,
        );
        hasError = true;
      } else {
        console.log(
          `${spec.key.padEnd(30)} ${pad(YELLOW + '— optional' + RESET, '— optional', 12)} ${spec.description}`,
        );
      }
    } else if (spec.expectedValue && value !== spec.expectedValue) {
      console.log(
        `${spec.key.padEnd(30)} ${pad(YELLOW + '⚠ WARNING' + RESET, '⚠ WARNING', 12)} Expected "${spec.expectedValue}", got "${value}"`,
      );
    } else {
      console.log(
        `${spec.key.padEnd(30)} ${pad(GREEN + '✓ OK' + RESET, '✓ OK', 12)} ${spec.description}`,
      );
    }
  }

  console.log('─'.repeat(72));

  if (hasError) {
    console.log(`\n${RED}✗ Pre-flight FAILED — set missing variables before deploying.${RESET}\n`);
  } else {
    console.log(`\n${GREEN}✓ Pre-flight PASSED — environment is ready for S2 launch.${RESET}\n`);
  }

  return !hasError;
}

if (require.main === module) {
  const passed = run();
  process.exit(passed ? 0 : 1);
}
