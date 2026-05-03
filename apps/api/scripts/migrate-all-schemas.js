#!/usr/bin/env node

const { Client } = require('pg');
const { TENANT_SCHEMAS } = require('@yaemartos/db');

function requireDirectUrl() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DIRECT_URL or DATABASE_URL is required to run tenant migrations');
  }
  return url;
}

async function migrateTenant(client, schema) {
  const safeSchema = `"${schema}"`;

  await client.query(`CREATE SCHEMA IF NOT EXISTS ${safeSchema}`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${safeSchema}.customer (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      phone TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // U3: add auth columns to customer if not present
  await client.query(`
    ALTER TABLE ${safeSchema}.customer
      ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${safeSchema}.customer_email_verification (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES ${safeSchema}.customer(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP(3) NOT NULL,
      used_at TIMESTAMP(3),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${safeSchema}.customer_password_reset (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES ${safeSchema}.customer(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP(3) NOT NULL,
      used_at TIMESTAMP(3),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${safeSchema}.customer_refresh_token (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES ${safeSchema}.customer(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP(3) NOT NULL,
      revoked_at TIMESTAMP(3),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${safeSchema}.warranty_registration (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES ${safeSchema}.customer(id) ON DELETE CASCADE,
      product_sku TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'registered',
      registered_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${safeSchema}.order_lookup (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      order_number TEXT NOT NULL,
      channel TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_number)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${safeSchema}.ticket (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES ${safeSchema}.customer(id) ON DELETE CASCADE,
      ticket_no TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ticket_no)
    )
  `);
}

async function run() {
  const connectionString = requireDirectUrl();
  const client = new Client({ connectionString });

  console.info('starting tenant schema migrations');
  console.info(`target schemas: ${TENANT_SCHEMAS.join(', ')}`);

  await client.connect();
  try {
    for (const schema of TENANT_SCHEMAS) {
      await migrateTenant(client, schema);
      console.info(`tenant schema migrated: ${schema}`);
    }
    console.info('tenant schema migrations completed');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('tenant schema migrations failed');
  console.error(error);
  process.exit(1);
});
