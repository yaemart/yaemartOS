-- CreateTable
CREATE TABLE "public"."SystemConfig" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "public"."SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_category_idx" ON "public"."SystemConfig"("category");

-- Seed default feature flags (disabled globally)
INSERT INTO "public"."SystemConfig" ("id","category","key","value","label","updatedAt") VALUES
  (gen_random_uuid(),'feature_flag','feature_flag.LISTING_AI','false','AI 生成 Listing',now()),
  (gen_random_uuid(),'feature_flag','feature_flag.GLM_GENERATION','false','GLM 路由',now()),
  (gen_random_uuid(),'feature_flag','feature_flag.LINGXING_SYNC','false','领星同步',now()),
  (gen_random_uuid(),'feature_flag','feature_flag.PATH_A_IMPORT','false','路径 A 数据导入',now());

-- Seed default AI routing
INSERT INTO "public"."SystemConfig" ("id","category","key","value","label","updatedAt") VALUES
  (gen_random_uuid(),'ai_routing','ai_routing.listing.en','gemini','Listing 英文路由',now()),
  (gen_random_uuid(),'ai_routing','ai_routing.listing.zh','glm','Listing 中文路由',now()),
  (gen_random_uuid(),'ai_routing','ai_routing.faq.en','glm','FAQ 英文路由',now()),
  (gen_random_uuid(),'ai_routing','ai_routing.extraction.en','gemini','数据提取路由',now());

-- Seed default AI budgets
INSERT INTO "public"."SystemConfig" ("id","category","key","value","label","updatedAt") VALUES
  (gen_random_uuid(),'ai_budget','ai_budget.gemini_monthly_usd','50','Gemini 月预算（USD）',now()),
  (gen_random_uuid(),'ai_budget','ai_budget.glm_monthly_cny','500','GLM 月预算（CNY）',now()),
  (gen_random_uuid(),'ai_budget','ai_budget.alert_threshold_pct','80','预算告警阈值（%）',now());
