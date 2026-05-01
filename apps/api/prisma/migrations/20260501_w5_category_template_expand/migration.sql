-- Guard: create ProductContentSource if w2 did not commit it (recovery path)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ProductContentSource'
  ) THEN
    CREATE TYPE "public"."ProductContentSource" AS ENUM ('manual', 'ai_generated', 'erp_import');
  END IF;
END $$;

-- Add new enum value (IF NOT EXISTS is idempotent; runs outside PL/pgSQL to avoid SPI lookup issues)
ALTER TYPE "public"."ProductContentSource" ADD VALUE IF NOT EXISTS 'category_inherit';

-- Recovery guard: recreate Category if w2 was partially applied
-- (e.g. _prisma_migrations records w2 as applied but its SQL transaction was rolled back)
CREATE TABLE IF NOT EXISTS "public"."Category" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Category_brandId_slug_key" ON "public"."Category"("brandId", "slug");

CREATE TABLE IF NOT EXISTS "public"."CategoryContentTemplate" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "locale" "public"."LocaleCode" NOT NULL,
  "titleTemplate" TEXT,
  "bulletsTemplate" JSONB,
  "descriptionGuide" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CategoryContentTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CategoryContentTemplate_categoryId_locale_key" ON "public"."CategoryContentTemplate"("categoryId", "locale");

DO $$ BEGIN
  ALTER TABLE "public"."Category"
    ADD CONSTRAINT "Category_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "public"."Category"
    ADD CONSTRAINT "Category_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "public"."Category"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "public"."CategoryContentTemplate"
    ADD CONSTRAINT "CategoryContentTemplate_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."Category"
  ADD COLUMN IF NOT EXISTS "requiresRecipe" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."CategoryContentTemplate"
  ADD COLUMN IF NOT EXISTS "specParams" JSONB,
  ADD COLUMN IF NOT EXISTS "featureWords" JSONB,
  ADD COLUMN IF NOT EXISTS "sellingPoints" JSONB,
  ADD COLUMN IF NOT EXISTS "faqTemplate" JSONB,
  ADD COLUMN IF NOT EXISTS "recipeTemplate" JSONB;
