-- Add composite index on (shopId, date, adType) to support groupBy dashboard queries efficiently.
-- This covers the common query pattern: GROUP BY date, adType WHERE shopId IN (...).
CREATE INDEX "AdDailyStat_shopId_date_adType_idx" ON "public"."AdDailyStat"("shopId", "date", "adType");
