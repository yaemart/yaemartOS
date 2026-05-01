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

ALTER TABLE "public"."Category"
  ADD COLUMN IF NOT EXISTS "requiresRecipe" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."CategoryContentTemplate"
  ADD COLUMN IF NOT EXISTS "specParams" JSONB,
  ADD COLUMN IF NOT EXISTS "featureWords" JSONB,
  ADD COLUMN IF NOT EXISTS "sellingPoints" JSONB,
  ADD COLUMN IF NOT EXISTS "faqTemplate" JSONB,
  ADD COLUMN IF NOT EXISTS "recipeTemplate" JSONB;
