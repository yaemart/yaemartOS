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
      password_hash TEXT NOT NULL,
      name TEXT,
      is_active BOOLEAN NOT NULL DEFAULT false,
      email_verified_at TIMESTAMP(3),
      phone TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(email)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.customer_email_verification (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      customer_id TEXT NOT NULL REFERENCES ${s}.customer(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP(3) NOT NULL,
      used_at TIMESTAMP(3),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.customer_password_reset (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      customer_id TEXT NOT NULL REFERENCES ${s}.customer(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP(3) NOT NULL,
      used_at TIMESTAMP(3),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.customer_refresh_token (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      customer_id TEXT NOT NULL REFERENCES ${s}.customer(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP(3) NOT NULL,
      revoked_at TIMESTAMP(3),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.warranty_registration (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      customer_id TEXT NOT NULL REFERENCES ${s}.customer(id) ON DELETE CASCADE,
      product_sku TEXT NOT NULL,
      serial_number TEXT NOT NULL DEFAULT '',
      purchase_date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      platform TEXT,
      shop_order_id TEXT,
      invoice_image_url TEXT,
      invoice_public_id TEXT,
      warranty_expires_at TIMESTAMP(3),
      reminder_sent_at TIMESTAMP(3),
      status TEXT NOT NULL DEFAULT 'active',
      registered_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Idempotent column additions for existing warranty_registration tables (re-run safe)
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.warranty_registration ADD COLUMN IF NOT EXISTS serial_number TEXT NOT NULL DEFAULT ''`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.warranty_registration ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.warranty_registration ADD COLUMN IF NOT EXISTS platform TEXT`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.warranty_registration ADD COLUMN IF NOT EXISTS shop_order_id TEXT`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.warranty_registration ADD COLUMN IF NOT EXISTS invoice_image_url TEXT`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.warranty_registration ADD COLUMN IF NOT EXISTS invoice_public_id TEXT`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.warranty_registration ADD COLUMN IF NOT EXISTS warranty_expires_at TIMESTAMP(3)`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.warranty_registration ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP(3)`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.warranty_registration ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.warranty_registration ALTER COLUMN status SET DEFAULT 'active'`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.product_manual (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      product_sku TEXT NOT NULL,
      locale TEXT NOT NULL,
      filename TEXT NOT NULL,
      public_id TEXT NOT NULL,
      secure_url TEXT NOT NULL,
      uploaded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_sku, locale)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.order_lookup (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      customer_id TEXT,
      order_number TEXT NOT NULL,
      channel TEXT,
      ip_hash TEXT,
      result_status TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Idempotent column additions for existing order_lookup tables (re-run safe)
  await pool.query(`ALTER TABLE IF EXISTS ${s}.order_lookup ADD COLUMN IF NOT EXISTS ip_hash TEXT`);
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.order_lookup ADD COLUMN IF NOT EXISTS result_status TEXT`,
  );

  // Atomic sequence for ticket numbers — prevents TOCTOU races under concurrency
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS ${s}.ticket_seq START WITH 1`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.ticket (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      customer_id TEXT NOT NULL REFERENCES ${s}.customer(id) ON DELETE CASCADE,
      session_id TEXT,
      ticket_no TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      tags TEXT[] NOT NULL DEFAULT '{}',
      assignee_id TEXT,
      sla_hours INT NOT NULL DEFAULT 24,
      sla_due_at TIMESTAMP(3),
      closed_at TIMESTAMP(3),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ticket_no)
    )
  `);

  // Idempotent column additions for existing ticket tables (re-run safe)
  await pool.query(`ALTER TABLE IF EXISTS ${s}.ticket ADD COLUMN IF NOT EXISTS session_id TEXT`);
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.ticket ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.ticket ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'`,
  );
  await pool.query(`ALTER TABLE IF EXISTS ${s}.ticket ADD COLUMN IF NOT EXISTS assignee_id TEXT`);
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.ticket ADD COLUMN IF NOT EXISTS sla_hours INT NOT NULL DEFAULT 24`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.ticket ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP(3)`,
  );
  await pool.query(
    `ALTER TABLE IF EXISTS ${s}.ticket ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP(3)`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.ticket_message (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      ticket_id TEXT NOT NULL REFERENCES ${s}.ticket(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.chat_session (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      customer_id TEXT REFERENCES ${s}.customer(id) ON DELETE SET NULL,
      session_token TEXT NOT NULL UNIQUE,
      brand_id TEXT NOT NULL,
      last_activity_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.chat_message (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      session_id TEXT NOT NULL REFERENCES ${s}.chat_session(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Trigger to auto-update ticket.updated_at on every row update.
  // PostgreSQL does not auto-refresh CURRENT_TIMESTAMP columns like MySQL does.
  await pool.query(`
    CREATE OR REPLACE FUNCTION ${s}.set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await pool.query(`
    DROP TRIGGER IF EXISTS trg_ticket_updated_at ON ${s}.ticket;
    CREATE TRIGGER trg_ticket_updated_at
    BEFORE UPDATE ON ${s}.ticket
    FOR EACH ROW EXECUTE FUNCTION ${s}.set_updated_at();
  `);

  await pool.query(`
    DROP TRIGGER IF EXISTS trg_warranty_updated_at ON ${s}.warranty_registration;
    CREATE TRIGGER trg_warranty_updated_at
    BEFORE UPDATE ON ${s}.warranty_registration
    FOR EACH ROW EXECUTE FUNCTION ${s}.set_updated_at();
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ticket_customer ON ${s}.ticket(customer_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ticket_session ON ${s}.ticket(session_id) WHERE session_id IS NOT NULL;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ticket_message_ticket ON ${s}.ticket_message(ticket_id, created_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_message_session ON ${s}.chat_message(session_id, created_at);
  `);
}

async function run(): Promise<void> {
  const connectionString = requireDirectUrl();
  const pool = new Pool({ connectionString });

  console.info('Starting tenant schema migrations (U1+: Customer auth + Chat/Ticket schema)');
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
