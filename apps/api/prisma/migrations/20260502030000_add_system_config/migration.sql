-- CreateTable: persistent key-value store for runtime-configurable system settings.
-- Categories: feature_flag | ai_routing | ai_budget
-- Keys are namespaced, e.g. "feature_flag.LISTING_AI", "ai_routing.listing.en"
CREATE TABLE public."SystemConfig" (
    "id"        TEXT NOT NULL,
    "category"  TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "label"     TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON public."SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_category_idx" ON public."SystemConfig"("category");
