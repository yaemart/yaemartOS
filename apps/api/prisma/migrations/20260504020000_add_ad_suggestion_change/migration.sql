-- CreateEnum
CREATE TYPE "public"."AdActionType" AS ENUM ('increase_bid', 'decrease_bid', 'pause', 'enable');

-- CreateEnum
CREATE TYPE "public"."AdSuggestionStatus" AS ENUM ('pending', 'accepted', 'rejected', 'executed', 'expired');

-- CreateEnum
CREATE TYPE "public"."AdChangeStatus" AS ENUM ('executed', 'rolled_back');

-- CreateTable
CREATE TABLE "public"."AdSuggestion" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT,
    "adType" "public"."AdType" NOT NULL,
    "actionType" "public"."AdActionType" NOT NULL,
    "field" TEXT NOT NULL,
    "currentValue" DECIMAL(12,6),
    "suggestedValue" DECIMAL(12,6),
    "reason" TEXT NOT NULL,
    "status" "public"."AdSuggestionStatus" NOT NULL DEFAULT 'pending',
    "generatedBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdChange" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT,
    "shopId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "actionType" "public"."AdActionType" NOT NULL,
    "field" TEXT NOT NULL,
    "valueBefore" DECIMAL(12,6),
    "valueAfter" DECIMAL(12,6),
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedBy" TEXT,
    "reversibleBefore" TIMESTAMP(3) NOT NULL,
    "rolledBackAt" TIMESTAMP(3),
    "rolledBackBy" TEXT,
    "status" "public"."AdChangeStatus" NOT NULL DEFAULT 'executed',
    "metadata" JSONB,

    CONSTRAINT "AdChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdSuggestion_shopId_status_idx" ON "public"."AdSuggestion"("shopId", "status");

-- CreateIndex
CREATE INDEX "AdSuggestion_brandId_status_idx" ON "public"."AdSuggestion"("brandId", "status");

-- CreateIndex
CREATE INDEX "AdSuggestion_batchId_idx" ON "public"."AdSuggestion"("batchId");

-- CreateIndex
CREATE INDEX "AdSuggestion_expiresAt_idx" ON "public"."AdSuggestion"("expiresAt");

-- CreateIndex
CREATE INDEX "AdChange_shopId_executedAt_idx" ON "public"."AdChange"("shopId", "executedAt");

-- CreateIndex
CREATE INDEX "AdChange_brandId_status_idx" ON "public"."AdChange"("brandId", "status");

-- CreateIndex
CREATE INDEX "AdChange_reversibleBefore_idx" ON "public"."AdChange"("reversibleBefore");

-- AddForeignKey
ALTER TABLE "public"."AdSuggestion" ADD CONSTRAINT "AdSuggestion_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdChange" ADD CONSTRAINT "AdChange_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "public"."AdSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdChange" ADD CONSTRAINT "AdChange_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
