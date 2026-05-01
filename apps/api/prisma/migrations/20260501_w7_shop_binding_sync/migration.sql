ALTER TABLE "public"."ShopBinding" ADD COLUMN IF NOT EXISTS "syncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."ShopBinding" ADD COLUMN IF NOT EXISTS "lingxingShopId" TEXT;
