DO $$ BEGIN
  ALTER TYPE "public"."ProductContentSource" ADD VALUE IF NOT EXISTS 'category_inherit';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."Category"
  ADD COLUMN IF NOT EXISTS "requiresRecipe" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."CategoryContentTemplate"
  ADD COLUMN IF NOT EXISTS "specParams" JSONB,
  ADD COLUMN IF NOT EXISTS "featureWords" JSONB,
  ADD COLUMN IF NOT EXISTS "sellingPoints" JSONB,
  ADD COLUMN IF NOT EXISTS "faqTemplate" JSONB,
  ADD COLUMN IF NOT EXISTS "recipeTemplate" JSONB;
