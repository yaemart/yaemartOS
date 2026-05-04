import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';
import { hash } from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const REALTIME_UI_BRANDS = ['homtone', 'spoonlemon', 'davivy', 'tysun'] as const;
type RealtimeUiBrand = (typeof REALTIME_UI_BRANDS)[number];

interface FeatureFlagSeed {
  key: string;
  value: 'true' | 'false';
  label: string;
}

/**
 * Compute the per-brand `AGENT_NATIVE_REALTIME_UI` flag values for this
 * seed run. The global toggle is always seeded `false` (operators flip
 * it on via the settings UI when the org-wide rollout completes); the
 * per-brand toggles default to `false` and switch to `true` only when
 * the brand id appears in `YAEMART_SEED_REALTIME_UI_BRANDS` (comma
 * separated, case-insensitive).
 *
 * Staging deploy steps for W47 → W48 single-brand canary:
 *
 *   $ YAEMART_SEED_REALTIME_UI_BRANDS=homtone pnpm seed
 *
 * The variable is intentionally narrow so dev / e2e seeds (which run
 * with no env override) keep the historical "all four brands off" shape
 * the SSE E2E suite relies on for its 403 baseline.
 */
function buildRealtimeUiFlags(): FeatureFlagSeed[] {
  const enabled = parseRealtimeUiBrands(process.env.YAEMART_SEED_REALTIME_UI_BRANDS);
  return [
    {
      key: 'feature_flag.AGENT_NATIVE_REALTIME_UI',
      value: 'false',
      label: 'Agent → UI 实时同步 (全局总开关，默认 off)',
    },
    ...REALTIME_UI_BRANDS.map<FeatureFlagSeed>((brand) => ({
      key: `feature_flag.AGENT_NATIVE_REALTIME_UI.${brand}`,
      value: enabled.has(brand) ? 'true' : 'false',
      label: `Agent → UI 实时同步 (${capitalise(brand)})`,
    })),
  ];
}

function parseRealtimeUiBrands(raw: string | undefined): Set<RealtimeUiBrand> {
  if (!raw) {
    return new Set();
  }
  const tokens = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out = new Set<RealtimeUiBrand>();
  for (const tok of tokens) {
    if ((REALTIME_UI_BRANDS as readonly string[]).includes(tok)) {
      out.add(tok as RealtimeUiBrand);
    } else {
      console.warn(
        `[seed] YAEMART_SEED_REALTIME_UI_BRANDS contains unknown brand "${tok}" — ignored.`,
      );
    }
  }
  return out;
}

function capitalise(s: string): string {
  return s.length === 0 ? s : `${s[0]!.toUpperCase()}${s.slice(1)}`;
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------
const brands = [
  {
    id: 'homtone',
    name: 'Homtone',
    slug: 'homtone',
    themeColor: '#b45309',
    logoUrl: 'https://cdn.yaemartos.com/brands/homtone/logo.svg',
  },
  {
    id: 'spoonlemon',
    name: 'Spoonlemon',
    slug: 'spoonlemon',
    themeColor: '#059669',
    logoUrl: 'https://cdn.yaemartos.com/brands/spoonlemon/logo.svg',
  },
  {
    id: 'davivy',
    name: 'Davivy',
    slug: 'davivy',
    themeColor: '#7c3aed',
    logoUrl: 'https://cdn.yaemartos.com/brands/davivy/logo.svg',
  },
  {
    id: 'tysun',
    name: 'Tysun',
    slug: 'tysun',
    themeColor: '#0284c7',
    logoUrl: 'https://cdn.yaemartos.com/brands/tysun/logo.svg',
  },
];

// ---------------------------------------------------------------------------
// Platforms (static reference)
// ---------------------------------------------------------------------------
const platforms = [
  { id: 'plt_amazon', code: 'amazon', name: 'Amazon' },
  { id: 'plt_walmart', code: 'walmart', name: 'Walmart' },
  { id: 'plt_wayfair', code: 'wayfair', name: 'Wayfair' },
  { id: 'plt_shopify', code: 'shopify', name: 'Shopify' },
  { id: 'plt_tiktok', code: 'tiktok', name: 'TikTok' },
];

// ---------------------------------------------------------------------------
// Markets (per brand – add rows as needed when new markets open)
// ---------------------------------------------------------------------------
const markets = [
  // Homtone
  {
    id: 'mkt_homtone_us',
    brandId: 'homtone',
    code: 'US',
    name: '美国',
    currency: 'USD',
    timezone: 'America/New_York',
  },
  {
    id: 'mkt_homtone_ca',
    brandId: 'homtone',
    code: 'CA',
    name: '加拿大',
    currency: 'CAD',
    timezone: 'America/Toronto',
  },
  {
    id: 'mkt_homtone_de',
    brandId: 'homtone',
    code: 'DE',
    name: '德国',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
  },
  {
    id: 'mkt_homtone_uk',
    brandId: 'homtone',
    code: 'UK',
    name: '英国',
    currency: 'GBP',
    timezone: 'Europe/London',
  },
  {
    id: 'mkt_homtone_fr',
    brandId: 'homtone',
    code: 'FR',
    name: '法国',
    currency: 'EUR',
    timezone: 'Europe/Paris',
  },
  {
    id: 'mkt_homtone_es',
    brandId: 'homtone',
    code: 'ES',
    name: '西班牙',
    currency: 'EUR',
    timezone: 'Europe/Madrid',
  },
  {
    id: 'mkt_homtone_it',
    brandId: 'homtone',
    code: 'IT',
    name: '意大利',
    currency: 'EUR',
    timezone: 'Europe/Rome',
  },
  {
    id: 'mkt_homtone_jp',
    brandId: 'homtone',
    code: 'JP',
    name: '日本',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
  },
  // Spoonlemon
  {
    id: 'mkt_spoon_us',
    brandId: 'spoonlemon',
    code: 'US',
    name: '美国',
    currency: 'USD',
    timezone: 'America/New_York',
  },
  {
    id: 'mkt_spoon_ca',
    brandId: 'spoonlemon',
    code: 'CA',
    name: '加拿大',
    currency: 'CAD',
    timezone: 'America/Toronto',
  },
  {
    id: 'mkt_spoon_de',
    brandId: 'spoonlemon',
    code: 'DE',
    name: '德国',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
  },
  {
    id: 'mkt_spoon_uk',
    brandId: 'spoonlemon',
    code: 'UK',
    name: '英国',
    currency: 'GBP',
    timezone: 'Europe/London',
  },
  // Davivy
  {
    id: 'mkt_davivy_us',
    brandId: 'davivy',
    code: 'US',
    name: '美国',
    currency: 'USD',
    timezone: 'America/New_York',
  },
  {
    id: 'mkt_davivy_de',
    brandId: 'davivy',
    code: 'DE',
    name: '德国',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
  },
  // Tysun
  {
    id: 'mkt_tysun_us',
    brandId: 'tysun',
    code: 'US',
    name: '美国',
    currency: 'USD',
    timezone: 'America/New_York',
  },
];

// ---------------------------------------------------------------------------
// Shops
// These are internal shop records. lingxingShopId is set later via ShopBinding
// (through the /shops UI). externalId = the platform's own merchant/shop ID.
//
// Populate with real Lingxing shopId values once the admin has selected which
// Lingxing shops belong to which brand. For now we seed placeholders so the
// /shops page is not empty.
// ---------------------------------------------------------------------------
const shops = [
  // Homtone × Amazon
  {
    id: 'shop_homtone_amz_us',
    brandId: 'homtone',
    platformId: 'plt_amazon',
    marketId: 'mkt_homtone_us',
    name: 'Homtone Amazon US',
    externalId: 'HOMTONE_AMZ_US',
    isActive: true,
  },
  {
    id: 'shop_homtone_amz_ca',
    brandId: 'homtone',
    platformId: 'plt_amazon',
    marketId: 'mkt_homtone_ca',
    name: 'Homtone Amazon CA',
    externalId: 'HOMTONE_AMZ_CA',
    isActive: true,
  },
  {
    id: 'shop_homtone_amz_de',
    brandId: 'homtone',
    platformId: 'plt_amazon',
    marketId: 'mkt_homtone_de',
    name: 'Homtone Amazon DE',
    externalId: 'HOMTONE_AMZ_DE',
    isActive: true,
  },
  {
    id: 'shop_homtone_amz_uk',
    brandId: 'homtone',
    platformId: 'plt_amazon',
    marketId: 'mkt_homtone_uk',
    name: 'Homtone Amazon UK',
    externalId: 'HOMTONE_AMZ_UK',
    isActive: true,
  },
  {
    id: 'shop_homtone_amz_fr',
    brandId: 'homtone',
    platformId: 'plt_amazon',
    marketId: 'mkt_homtone_fr',
    name: 'Homtone Amazon FR',
    externalId: 'HOMTONE_AMZ_FR',
    isActive: true,
  },
  {
    id: 'shop_homtone_amz_es',
    brandId: 'homtone',
    platformId: 'plt_amazon',
    marketId: 'mkt_homtone_es',
    name: 'Homtone Amazon ES',
    externalId: 'HOMTONE_AMZ_ES',
    isActive: true,
  },
  {
    id: 'shop_homtone_amz_it',
    brandId: 'homtone',
    platformId: 'plt_amazon',
    marketId: 'mkt_homtone_it',
    name: 'Homtone Amazon IT',
    externalId: 'HOMTONE_AMZ_IT',
    isActive: true,
  },
  {
    id: 'shop_homtone_amz_jp',
    brandId: 'homtone',
    platformId: 'plt_amazon',
    marketId: 'mkt_homtone_jp',
    name: 'Homtone Amazon JP',
    externalId: 'HOMTONE_AMZ_JP',
    isActive: true,
  },
  // Homtone × Walmart
  {
    id: 'shop_homtone_wmt_us',
    brandId: 'homtone',
    platformId: 'plt_walmart',
    marketId: 'mkt_homtone_us',
    name: 'Homtone Walmart US',
    externalId: 'HOMTONE_WMT_US',
    isActive: true,
  },
  {
    id: 'shop_homtone_wmt_ca',
    brandId: 'homtone',
    platformId: 'plt_walmart',
    marketId: 'mkt_homtone_ca',
    name: 'Homtone Walmart CA',
    externalId: 'HOMTONE_WMT_CA',
    isActive: true,
  },
  // Homtone × Wayfair
  {
    id: 'shop_homtone_way_us',
    brandId: 'homtone',
    platformId: 'plt_wayfair',
    marketId: 'mkt_homtone_us',
    name: 'Homtone Wayfair US',
    externalId: 'HOMTONE_WAY_US',
    isActive: true,
  },
  {
    id: 'shop_homtone_way_ca',
    brandId: 'homtone',
    platformId: 'plt_wayfair',
    marketId: 'mkt_homtone_ca',
    name: 'Homtone Wayfair CA',
    externalId: 'HOMTONE_WAY_CA',
    isActive: true,
  },
  // Spoonlemon × Amazon
  {
    id: 'shop_spoon_amz_us',
    brandId: 'spoonlemon',
    platformId: 'plt_amazon',
    marketId: 'mkt_spoon_us',
    name: 'Spoonlemon Amazon US',
    externalId: 'SPOON_AMZ_US',
    isActive: true,
  },
  {
    id: 'shop_spoon_amz_de',
    brandId: 'spoonlemon',
    platformId: 'plt_amazon',
    marketId: 'mkt_spoon_de',
    name: 'Spoonlemon Amazon DE',
    externalId: 'SPOON_AMZ_DE',
    isActive: true,
  },
  {
    id: 'shop_spoon_amz_uk',
    brandId: 'spoonlemon',
    platformId: 'plt_amazon',
    marketId: 'mkt_spoon_uk',
    name: 'Spoonlemon Amazon UK',
    externalId: 'SPOON_AMZ_UK',
    isActive: true,
  },
  // Spoonlemon × Walmart
  {
    id: 'shop_spoon_wmt_us',
    brandId: 'spoonlemon',
    platformId: 'plt_walmart',
    marketId: 'mkt_spoon_us',
    name: 'Spoonlemon Walmart US',
    externalId: 'SPOON_WMT_US',
    isActive: true,
  },
  // Davivy × Amazon
  {
    id: 'shop_davivy_amz_us',
    brandId: 'davivy',
    platformId: 'plt_amazon',
    marketId: 'mkt_davivy_us',
    name: 'Davivy Amazon US',
    externalId: 'DAVIVY_AMZ_US',
    isActive: true,
  },
  {
    id: 'shop_davivy_amz_de',
    brandId: 'davivy',
    platformId: 'plt_amazon',
    marketId: 'mkt_davivy_de',
    name: 'Davivy Amazon DE',
    externalId: 'DAVIVY_AMZ_DE',
    isActive: true,
  },
  // Tysun × Amazon
  {
    id: 'shop_tysun_amz_us',
    brandId: 'tysun',
    platformId: 'plt_amazon',
    marketId: 'mkt_tysun_us',
    name: 'Tysun Amazon US',
    externalId: 'TYSUN_AMZ_US',
    isActive: true,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Brands
  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { id: brand.id },
      create: brand,
      update: {
        name: brand.name,
        slug: brand.slug,
        themeColor: brand.themeColor,
        logoUrl: brand.logoUrl,
      },
    });
  }
  console.log('✓ 4 brands');

  // Platforms
  for (const p of platforms) {
    await prisma.platform.upsert({
      where: { code: p.code as any },
      create: { id: p.id, code: p.code as any, name: p.name },
      update: { name: p.name },
    });
  }
  console.log(`✓ ${platforms.length} platforms`);

  // Markets
  for (const m of markets) {
    await prisma.market.upsert({
      where: { brandId_code: { brandId: m.brandId, code: m.code } },
      create: m,
      update: { name: m.name, currency: m.currency, timezone: m.timezone },
    });
  }
  console.log(`✓ ${markets.length} markets`);

  // Locales — North America EN/ES/FR for Homtone + Spoonlemon (S3 首发品牌)
  // Each entry: { marketId, language, isPrimary }
  const locales = [
    // Homtone US
    { marketId: 'mkt_homtone_us', language: 'en' as const, isPrimary: true },
    { marketId: 'mkt_homtone_us', language: 'es' as const, isPrimary: false },
    { marketId: 'mkt_homtone_us', language: 'fr' as const, isPrimary: false },
    // Homtone CA
    { marketId: 'mkt_homtone_ca', language: 'en' as const, isPrimary: true },
    { marketId: 'mkt_homtone_ca', language: 'fr' as const, isPrimary: false },
    // Spoonlemon US
    { marketId: 'mkt_spoon_us', language: 'en' as const, isPrimary: true },
    { marketId: 'mkt_spoon_us', language: 'es' as const, isPrimary: false },
    { marketId: 'mkt_spoon_us', language: 'fr' as const, isPrimary: false },
    // Spoonlemon CA
    { marketId: 'mkt_spoon_ca', language: 'en' as const, isPrimary: true },
    { marketId: 'mkt_spoon_ca', language: 'fr' as const, isPrimary: false },
  ];
  for (const loc of locales) {
    await prisma.locale.upsert({
      where: { marketId_language: { marketId: loc.marketId, language: loc.language } },
      create: { marketId: loc.marketId, language: loc.language, isPrimary: loc.isPrimary },
      update: { isPrimary: loc.isPrimary },
    });
  }
  console.log(`✓ ${locales.length} locales`);

  // Shops (placeholder externalIds — update via /shops UI after binding to Lingxing)
  for (const s of shops) {
    await prisma.shop.upsert({
      where: { platformId_externalId: { platformId: s.platformId, externalId: s.externalId } },
      create: s,
      update: { name: s.name, isActive: s.isActive },
    });
  }
  console.log(`✓ ${shops.length} shops`);

  // Admin user — both env vars are required; fail fast rather than using weak defaults
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set. ' +
        'Example: SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=… pnpm seed',
    );
  }
  const passwordHash = await hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, passwordHash, role: 'admin', brandId: 'homtone' },
    update: { passwordHash, role: 'admin' },
  });
  console.log(`✓ admin user: ${adminEmail}`);

  // Feature flags — only seed non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const devFlags = [
      { key: 'feature_flag.LISTING_AI', value: 'true', label: 'AI Listing 生成' },
      {
        key: 'feature_flag.BATCH_LISTING_GENERATE',
        value: 'true',
        label: '批量多平台 Listing 生成',
      },
      { key: 'feature_flag.LISTING_MATRIX', value: 'true', label: '矩阵分析 Dashboard' },
      {
        key: 'feature_flag.MULTILINGUAL_LISTING_GENERATION',
        value: 'true',
        label: '多语言 Listing 批量生成（EN/ES/FR）',
      },
      // W36-W39: Customer Center V1 — manual, warranty, order lookup
      // Global fallback entries ensure FeatureFlagGuard works on public routes
      // where tenantId is not in CLS. Brand-scoped entries allow per-brand control.
      { key: 'feature_flag.MANUAL_DOWNLOAD', value: 'true', label: '手册下载 (全局)' },
      { key: 'feature_flag.MANUAL_DOWNLOAD.homtone', value: 'true', label: '手册下载 (Homtone)' },
      {
        key: 'feature_flag.MANUAL_DOWNLOAD.spoonlemon',
        value: 'true',
        label: '手册下载 (Spoonlemon)',
      },
      { key: 'feature_flag.WARRANTY_REGISTRATION', value: 'true', label: '保修注册 (全局)' },
      {
        key: 'feature_flag.WARRANTY_REGISTRATION.homtone',
        value: 'true',
        label: '保修注册 (Homtone)',
      },
      { key: 'feature_flag.ORDER_LOOKUP', value: 'true', label: '非登录订单查询 (全局)' },
      {
        key: 'feature_flag.ORDER_LOOKUP.homtone',
        value: 'true',
        label: '非登录订单查询 (Homtone)',
      },
      {
        key: 'feature_flag.ORDER_LOOKUP.spoonlemon',
        value: 'true',
        label: '非登录订单查询 (Spoonlemon)',
      },
      { key: 'feature_flag.AD_DASHBOARD', value: 'true', label: '广告数据 Dashboard (全局)' },
      {
        key: 'feature_flag.AD_DASHBOARD.homtone',
        value: 'true',
        label: '广告数据 Dashboard (Homtone)',
      },
      { key: 'feature_flag.AD_SUGGESTION', value: 'true', label: 'AI 广告优化建议 (全局)' },
      {
        key: 'feature_flag.AD_SUGGESTION.homtone',
        value: 'true',
        label: 'AI 广告优化建议 (Homtone)',
      },
      // ADR-011 Real-time Agent → UI sync (W46+ scope-cut plan).
      // Global toggle stays off everywhere; per-brand entries are flipped
      // on by exporting `YAEMART_SEED_REALTIME_UI_BRANDS=homtone` (comma
      // separated) before running `pnpm seed`. W47 staging plan: only
      // `homtone` is enabled; W48 evaluation decides the next brand;
      // production W52 mirrors the same env-var driven approach.
      ...buildRealtimeUiFlags(),
    ];
    for (const flag of devFlags) {
      await prisma.systemConfig.upsert({
        where: { key: flag.key },
        create: { category: 'feature_flag', key: flag.key, value: flag.value, label: flag.label },
        update: { value: flag.value, label: flag.label },
      });
    }
    console.log(`✓ ${devFlags.length} feature flags (dev)`);
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
