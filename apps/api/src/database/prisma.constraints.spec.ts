import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb('database constraints', () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`
      TRUNCATE TABLE
        "public"."ListingVersion",
        "public"."Listing",
        "public"."ShopBinding",
        "public"."Shop",
        "public"."Platform",
        "public"."Article",
        "public"."Market",
        "public"."ProductContent",
        "public"."Product",
        "public"."CategoryContentTemplate",
        "public"."Category",
        "public"."Metric",
        "public"."User",
        "public"."Brand"
      CASCADE
    `);
  });

  async function seedListingDependencies() {
    await client.query(
      `INSERT INTO "public"."Brand" ("id", "name", "slug", "updatedAt") VALUES ('homtone', 'Homtone', 'homtone', NOW())`,
    );
    await client.query(
      `INSERT INTO "public"."Category" ("id", "brandId", "name", "slug", "updatedAt") VALUES ('cat-1', 'homtone', 'Kitchen', 'kitchen', NOW())`,
    );
    await client.query(
      `INSERT INTO "public"."Product" ("id", "brandId", "categoryId", "sku", "title", "updatedAt") VALUES ('prd-1', 'homtone', 'cat-1', 'SKU-1', 'Slow Cooker', NOW())`,
    );
    await client.query(
      `INSERT INTO "public"."Market" ("id", "brandId", "code", "name", "currency", "timezone", "updatedAt") VALUES ('mkt-1', 'homtone', 'US', 'United States', 'USD', 'America/New_York', NOW())`,
    );
    await client.query(
      `INSERT INTO "public"."Platform" ("id", "code", "name", "updatedAt") VALUES ('plt-1', 'amazon', 'Amazon', NOW())`,
    );
    await client.query(
      `INSERT INTO "public"."Shop" ("id", "brandId", "marketId", "platformId", "name", "externalId", "updatedAt") VALUES ('shop-1', 'homtone', 'mkt-1', 'plt-1', 'US Main Shop', 'AMZ-US-1', NOW())`,
    );
  }

  it('enforces unique platform/shop/platformListingId', async () => {
    await seedListingDependencies();

    await client.query(`
      INSERT INTO "public"."Listing" (
        "id", "productId", "brandId", "marketId", "platformId", "shopId", "language", "platformListingId", "updatedAt"
      ) VALUES (
        'lst-1', 'prd-1', 'homtone', 'mkt-1', 'plt-1', 'shop-1', 'en', 'AMZ-LISTING-001', NOW()
      )
    `);

    await expect(
      client.query(`
        INSERT INTO "public"."Listing" (
          "id", "productId", "brandId", "marketId", "platformId", "shopId", "language", "platformListingId", "updatedAt"
        ) VALUES (
          'lst-2', 'prd-1', 'homtone', 'mkt-1', 'plt-1', 'shop-1', 'en', 'AMZ-LISTING-001', NOW()
        )
      `),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('allows only one primary listing per dimension', async () => {
    await seedListingDependencies();

    await client.query(`
      INSERT INTO "public"."Listing" (
        "id", "productId", "brandId", "marketId", "platformId", "shopId", "language", "platformListingId", "isPrimary", "updatedAt"
      ) VALUES (
        'lst-1', 'prd-1', 'homtone', 'mkt-1', 'plt-1', 'shop-1', 'en', 'AMZ-LISTING-001', true, NOW()
      )
    `);

    await expect(
      client.query(`
        INSERT INTO "public"."Listing" (
          "id", "productId", "brandId", "marketId", "platformId", "shopId", "language", "platformListingId", "isPrimary", "updatedAt"
        ) VALUES (
          'lst-2', 'prd-1', 'homtone', 'mkt-1', 'plt-1', 'shop-1', 'en', 'AMZ-LISTING-002', true, NOW()
        )
      `),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('allows only one active listing version per listing', async () => {
    await seedListingDependencies();

    await client.query(`
      INSERT INTO "public"."Listing" (
        "id", "productId", "brandId", "marketId", "platformId", "shopId", "language", "platformListingId", "updatedAt"
      ) VALUES (
        'lst-1', 'prd-1', 'homtone', 'mkt-1', 'plt-1', 'shop-1', 'en', 'AMZ-LISTING-001', NOW()
      )
    `);

    await client.query(`
      INSERT INTO "public"."ListingVersion" (
        "id", "listingId", "versionNumber", "contentSnapshot", "status"
      ) VALUES (
        'ver-1', 'lst-1', 1, '{"title":"v1"}', 'active'
      )
    `);

    await expect(
      client.query(`
        INSERT INTO "public"."ListingVersion" (
          "id", "listingId", "versionNumber", "contentSnapshot", "status"
        ) VALUES (
          'ver-2', 'lst-1', 2, '{"title":"v2"}', 'active'
        )
      `),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('isolates tenant data by schema', async () => {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "homtone"`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS "spoonlemon"`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "homtone".customer (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "spoonlemon".customer (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL
      )
    `);

    await client.query(`TRUNCATE TABLE "homtone".customer, "spoonlemon".customer CASCADE`);
    await client.query(`INSERT INTO "homtone".customer (id, email) VALUES ('c1', 'h@example.com')`);
    await client.query(
      `INSERT INTO "spoonlemon".customer (id, email) VALUES ('c2', 's@example.com')`,
    );

    const homtoneCount = await client.query(
      `SELECT COUNT(*)::int AS count FROM "homtone".customer`,
    );
    const spoonlemonCount = await client.query(
      `SELECT COUNT(*)::int AS count FROM "spoonlemon".customer`,
    );

    expect(homtoneCount.rows[0].count).toBe(1);
    expect(spoonlemonCount.rows[0].count).toBe(1);
  });
});
