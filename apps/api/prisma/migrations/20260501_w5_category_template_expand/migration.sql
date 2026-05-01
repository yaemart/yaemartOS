-- ============================================================
-- RECOVERY SECTION
-- If _prisma_migrations shows w2/w3 as "applied" but their SQL
-- transactions were rolled back, this section recreates every
-- missing type, table, index, and FK before the w5 changes.
-- All statements are fully idempotent (IF NOT EXISTS / DO-EXCEPTION).
-- ============================================================

-- W2 types
DO $$ BEGIN CREATE TYPE "public"."UserRole" AS ENUM ('admin', 'operator', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."LocaleCode" AS ENUM ('en', 'es', 'fr', 'de', 'it'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."PlatformCode" AS ENUM ('amazon', 'walmart', 'shopify', 'tiktok'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."ListingStatus" AS ENUM ('draft', 'review', 'approved', 'published', 'paused', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."ListingVersionStatus" AS ENUM ('draft', 'active', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."TrafficStrategy" AS ENUM ('primary', 'variant', 'bundle', 'keyword_grab', 'seasonal', 'cohort_test'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."ProductContentSource" AS ENUM ('manual', 'ai_generated', 'erp_import'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."ProductContentStatus" AS ENUM ('draft', 'review', 'approved', 'active', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- W3 types
DO $$ BEGIN CREATE TYPE "public"."AuthProvider" AS ENUM ('email', 'google', 'facebook'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."InvitationStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- W2 column additions on existing tables
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "public"."Brand" ADD COLUMN IF NOT EXISTS "themeColor" TEXT;
ALTER TABLE "public"."Brand" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "public"."Brand" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- W3 column additions on existing tables
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- W2 tables
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
CREATE TABLE IF NOT EXISTS "public"."Product" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."ProductContent" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "locale" "public"."LocaleCode" NOT NULL,
  "source" "public"."ProductContentSource" NOT NULL,
  "status" "public"."ProductContentStatus" NOT NULL DEFAULT 'draft',
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductContent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Market" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Article" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Platform" (
  "id" TEXT NOT NULL,
  "code" "public"."PlatformCode" NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Shop" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "platformId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."ShopBinding" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "bindingToken" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopBinding_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Listing" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "platformId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "language" "public"."LocaleCode" NOT NULL,
  "platformListingId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "trafficStrategy" "public"."TrafficStrategy" NOT NULL DEFAULT 'primary',
  "status" "public"."ListingStatus" NOT NULL DEFAULT 'draft',
  "title" TEXT,
  "bullets" JSONB,
  "description" TEXT,
  "searchTerms" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."ListingVersion" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "contentSnapshot" JSONB NOT NULL,
  "status" "public"."ListingVersionStatus" NOT NULL DEFAULT 'draft',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "ListingVersion_pkey" PRIMARY KEY ("id")
);

-- W3 tables
CREATE TABLE IF NOT EXISTS "public"."AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "tenant" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Invitation" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "role" "public"."UserRole" NOT NULL,
  "token" TEXT NOT NULL,
  "status" "public"."InvitationStatus" NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."AuthAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "public"."AuthProvider" NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."RefreshToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- W2 indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Category_brandId_slug_key" ON "public"."Category"("brandId", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "CategoryContentTemplate_categoryId_locale_key" ON "public"."CategoryContentTemplate"("categoryId", "locale");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_brandId_sku_key" ON "public"."Product"("brandId", "sku");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductContent_productId_locale_source_key" ON "public"."ProductContent"("productId", "locale", "source");
CREATE UNIQUE INDEX IF NOT EXISTS "Market_brandId_code_key" ON "public"."Market"("brandId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "Article_marketId_slug_key" ON "public"."Article"("marketId", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Platform_code_key" ON "public"."Platform"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Shop_platformId_externalId_key" ON "public"."Shop"("platformId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopBinding_shopId_key" ON "public"."ShopBinding"("shopId");
CREATE UNIQUE INDEX IF NOT EXISTS "listing_platform_shop_listing_id_unique" ON "public"."Listing"("platformId", "shopId", "platformListingId");
CREATE INDEX IF NOT EXISTS "Listing_productId_brandId_marketId_platformId_shopId_language_idx" ON "public"."Listing"("productId", "brandId", "marketId", "platformId", "shopId", "language");
CREATE UNIQUE INDEX IF NOT EXISTS "ListingVersion_listingId_versionNumber_key" ON "public"."ListingVersion"("listingId", "versionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "listing_primary_per_dimension_unique" ON "public"."Listing"("productId", "brandId", "marketId", "platformId", "shopId", "language") WHERE "isPrimary" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "listing_version_single_active_unique" ON "public"."ListingVersion"("listingId") WHERE "status" = 'active';

-- W3 indexes
CREATE INDEX IF NOT EXISTS "AuditLog_tenant_action_createdAt_idx" ON "public"."AuditLog"("tenant", "action", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "public"."Invitation"("token");
CREATE INDEX IF NOT EXISTS "Invitation_email_status_idx" ON "public"."Invitation"("email", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "AuthAccount_provider_providerAccountId_key" ON "public"."AuthAccount"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_expiresAt_idx" ON "public"."RefreshToken"("userId", "expiresAt");

-- W2 FK constraints
DO $$ BEGIN ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."CategoryContentTemplate" ADD CONSTRAINT "CategoryContentTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."ProductContent" ADD CONSTRAINT "ProductContent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Market" ADD CONSTRAINT "Market_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "public"."Market"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Shop" ADD CONSTRAINT "Shop_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Shop" ADD CONSTRAINT "Shop_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "public"."Market"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Shop" ADD CONSTRAINT "Shop_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "public"."Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."ShopBinding" ADD CONSTRAINT "ShopBinding_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "public"."Market"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "public"."Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."ListingVersion" ADD CONSTRAINT "ListingVersion_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Metric" ADD CONSTRAINT "Metric_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."User" ADD CONSTRAINT "User_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- W3 FK constraints
DO $$ BEGIN ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- W5 ACTUAL CHANGES
-- ============================================================

-- Ensure ProductContentSource has the new enum value
ALTER TYPE "public"."ProductContentSource" ADD VALUE IF NOT EXISTS 'category_inherit';

-- Add requiresRecipe column to Category
ALTER TABLE "public"."Category"
  ADD COLUMN IF NOT EXISTS "requiresRecipe" BOOLEAN NOT NULL DEFAULT false;

-- Add new template columns to CategoryContentTemplate
ALTER TABLE "public"."CategoryContentTemplate"
  ADD COLUMN IF NOT EXISTS "specParams" JSONB,
  ADD COLUMN IF NOT EXISTS "featureWords" JSONB,
  ADD COLUMN IF NOT EXISTS "sellingPoints" JSONB,
  ADD COLUMN IF NOT EXISTS "faqTemplate" JSONB,
  ADD COLUMN IF NOT EXISTS "recipeTemplate" JSONB;
