-- CreateEnum: AdType
CREATE TYPE "AdType" AS ENUM ('sp', 'sd', 'sb', 'walmart_sp');

-- CreateTable: AdDailyStat
CREATE TABLE "AdDailyStat" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "adType" "AdType" NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT,
    "spend" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "sales" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique per shop × date × adType × campaign (idempotent upsert)
CREATE UNIQUE INDEX "AdDailyStat_shopId_date_adType_campaignId_key" ON "AdDailyStat"("shopId", "date", "adType", "campaignId");

-- CreateIndex: shop + date range queries
CREATE INDEX "AdDailyStat_shopId_date_idx" ON "AdDailyStat"("shopId", "date");

-- CreateIndex: global date range queries
CREATE INDEX "AdDailyStat_date_idx" ON "AdDailyStat"("date");

-- AddForeignKey: AdDailyStat → Shop
ALTER TABLE "AdDailyStat" ADD CONSTRAINT "AdDailyStat_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
