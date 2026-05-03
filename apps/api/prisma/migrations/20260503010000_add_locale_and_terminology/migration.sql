-- CreateTable: Locale (Market × Language)
CREATE TABLE "Locale" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "language" "LocaleCode" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Locale_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TerminologyEntry (brand × locale vocabulary)
CREATE TABLE "TerminologyEntry" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "locale" "LocaleCode" NOT NULL,
    "category" TEXT,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "example" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminologyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Locale unique constraint
CREATE UNIQUE INDEX "Locale_marketId_language_key" ON "Locale"("marketId", "language");

-- CreateIndex: TerminologyEntry unique constraint
CREATE UNIQUE INDEX "TerminologyEntry_brandId_locale_term_key" ON "TerminologyEntry"("brandId", "locale", "term");

-- AddForeignKey: Locale → Market
ALTER TABLE "Locale" ADD CONSTRAINT "Locale_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TerminologyEntry → Brand
ALTER TABLE "TerminologyEntry" ADD CONSTRAINT "TerminologyEntry_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
