// Prerequisite: pg and @types/pg must be installed.
// If not present, run: pnpm add pg @types/pg -w
import { Pool } from 'pg';

const TENANT_SCHEMAS = ['homtone', 'spoonlemon', 'davivy', 'tysun'] as const;

function requireDirectUrl(): string {
  const url = process.env.DIRECT_URL;
  if (!url) {
    console.error('ERROR: DIRECT_URL environment variable is not set.');
    console.error(
      'Set DIRECT_URL to a direct (non-pooled) PostgreSQL connection string and retry.',
    );
    process.exit(1);
  }
  return url;
}

async function migrateTenantSchema(pool: Pool, schema: string): Promise<void> {
  const s = `"${schema}"`;

  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.customer (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      name TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "emailVerifiedAt" TIMESTAMP(3),
      phone TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(email)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.customer_email_verification (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "customerId" TEXT NOT NULL REFERENCES ${s}.customer(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.customer_password_reset (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "customerId" TEXT NOT NULL REFERENCES ${s}.customer(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.customer_refresh_token (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "customerId" TEXT NOT NULL REFERENCES ${s}.customer(id) ON DELETE CASCADE,
      "tokenHash" TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "revokedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.warranty_registration (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "customerId" TEXT NOT NULL REFERENCES ${s}.customer(id) ON DELETE CASCADE,
      "productSku" TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'registered',
      "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.order_lookup (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "customerId" TEXT,
      "orderNumber" TEXT NOT NULL,
      channel TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("orderNumber")
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.ticket (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "customerId" TEXT NOT NULL REFERENCES ${s}.customer(id) ON DELETE CASCADE,
      "ticketNo" TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("ticketNo")
    )
  `);
}

async function run(): Promise<void> {
  const connectionString = requireDirectUrl();
  const pool = new Pool({ connectionString });

  console.info('Starting tenant schema migrations (U1: Customer auth schema)');
  console.info(`Target schemas: ${TENANT_SCHEMAS.join(', ')}`);

  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const schema of TENANT_SCHEMAS) {
    try {
      await migrateTenantSchema(pool, schema);
      succeeded.push(schema);
      console.info(`✓ Migrated schema: ${schema}`);
    } catch (err) {
      failed.push(schema);
      console.error(`✗ Failed to migrate schema: ${schema}`);
      console.error(err);
    }
  }

  await pool.end();

  console.info('\n--- Migration Summary ---');
  console.info(`Succeeded (${succeeded.length}): ${succeeded.join(', ') || 'none'}`);
  if (failed.length > 0) {
    console.error(`Failed    (${failed.length}): ${failed.join(', ')}`);
    process.exit(1);
  } else {
    console.info('All tenant schemas migrated successfully.');
  }
}

run();
