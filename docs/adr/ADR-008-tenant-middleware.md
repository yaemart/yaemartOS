# ADR-008：Customer Portal Tenant 中间件

| 字段     | 取值                                                             |
| -------- | ---------------------------------------------------------------- |
| 状态     | Proposed（S3 W31 实施时评审）                                    |
| 提议日期 | 2026-04-30                                                       |
| 决策日期 | _S3 W31 评审通过后填写_                                          |
| 决策人   | tech lead + dev #2                                               |
| 关联文档 | `yaemartOS-implementation-plan.md` §3 ERD / §8 W31-W33 / ADR-001 |
| 取代     | 无                                                               |

---

## 1. 上下文

ADR-001 §2.7 已决策客户账号体系 **A 完全独立 + Tenant 模板架构**：

- 单一代码库 + PostgreSQL 4 个 schema（`homtone` / `spoonlemon` / `davivy` / `tysun`）
- 域名识别中间件（tenant-resolver 通过 Host header → `SET search_path`）
- 业务代码不感知品牌；测试用 fixture 参数化

客户域涉及的所有表均存于 tenant schema：

```
Customer / WarrantyRegistration / OrderLookup / Ticket / ChatSession / ManualDownloadLog
```

**核心问题**：如何让 NestJS（后端）和 Next.js（前端）自动识别当前品牌 tenant，并强制所有数据库操作在正确的 schema 内执行，同时**让业务代码完全不关心品牌切换**。

---

## 2. 决策

### 2.1 Tenant 识别规则

| 优先级 | 识别方式                                 | 适用场景                         |
| ------ | ---------------------------------------- | -------------------------------- |
| 1      | **Host header**（`support.homtone.com`） | 生产环境                         |
| 2      | **`X-Tenant` header**（`homtone`）       | 开发 / E2E 测试（允许绕过 Host） |
| 3      | **`?tenant=homtone` query param**        | 本地调试（仅 dev 环境生效）      |

```typescript
// 识别优先级逻辑
function extractTenant(req: Request, env: string): Tenant {
  const host = req.headers['host'] ?? '';
  const xTenant = req.headers['x-tenant'] as string;
  const queryTenant = req.query['tenant'] as string;

  // 生产：仅信任 Host
  if (env === 'production') {
    return parseTenantFromHost(host);
  }
  // 非生产：X-Tenant > Host > query
  return xTenant ?? parseTenantFromHost(host) ?? (env !== 'production' ? queryTenant : null);
}

function parseTenantFromHost(host: string): Tenant | null {
  const map: Record<string, Tenant> = {
    'support.homtone.com': 'homtone',
    'support.spoonlemon.com': 'spoonlemon',
    'support.davivy.com': 'davivy',
    'support.tysun.com': 'tysun',
    'portal.homtone.com': 'homtone', // 备用域名
    'localhost:3000': 'homtone', // 本地开发默认
  };
  return map[host] ?? null;
}
```

### 2.2 后端：NestJS Tenant 中间件

#### TenantContext（AsyncLocalStorage）

```typescript
// packages/tenant/src/tenant-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export type Tenant = 'homtone' | 'spoonlemon' | 'davivy' | 'tysun';

export interface TenantContext {
  tenant: Tenant;
  schema: string; // = tenant（同名）
  brandConfig: BrandConfig;
}

const storage = new AsyncLocalStorage<TenantContext>();

export const TenantStore = {
  run: <T>(ctx: TenantContext, fn: () => T): T => storage.run(ctx, fn),
  get: (): TenantContext => {
    const ctx = storage.getStore();
    if (!ctx) throw new Error('TenantContext not initialized — missing middleware?');
    return ctx;
  },
};
```

> **AsyncLocalStorage** 是 Node.js 原生 API，无第三方依赖，request 级隔离，不需要显式传参。

#### TenantMiddleware

```typescript
// packages/tenant/src/tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const env = this.configService.get<string>('NODE_ENV', 'development');
    const tenant = extractTenant(req, env);

    if (!tenant) {
      throw new BadRequestException(`Unknown tenant for host: ${req.headers['host']}`);
    }

    const brandConfig = BRAND_CONFIGS[tenant];

    TenantStore.run({ tenant, schema: tenant, brandConfig }, () => {
      // 将 tenant 注入 req 对象，方便 Controller 直接读取
      (req as any).tenant = tenant;
      next();
    });
  }
}
```

#### 注册中间件（仅客户域路由）

```typescript
// apps/api/src/app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes(
      'customer/*', // 客户域所有路由
      'auth/customer/*', // 客户 auth 路由
      'warranty/*',
      'tickets/*',
    );
    // 注意：运营域路由（/listings、/products 等）不走 TenantMiddleware
  }
}
```

### 2.3 Prisma Schema 切换（`SET search_path`）

#### TenantPrismaService

```typescript
// packages/tenant/src/tenant-prisma.service.ts
@Injectable()
export class TenantPrismaService {
  private clients: Map<Tenant, PrismaClient> = new Map();

  constructor() {
    // 为每个 tenant 创建独立 PrismaClient（含 schema middleware）
    for (const tenant of TENANTS) {
      const client = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL } },
      });

      // Prisma middleware：每次查询前注入 search_path
      client.$use(async (params, next) => {
        await client.$executeRawUnsafe(`SET search_path TO "${tenant}", public`);
        return next(params);
      });

      this.clients.set(tenant, client);
    }
  }

  /**
   * 取当前请求 tenant 对应的 PrismaClient
   */
  get db(): PrismaClient {
    const { tenant } = TenantStore.get();
    const client = this.clients.get(tenant);
    if (!client) throw new Error(`No PrismaClient for tenant: ${tenant}`);
    return client;
  }

  /**
   * 管理员：跨 tenant 聚合查询（仅 SuperAdmin 聚合服务可调）
   */
  getClientFor(tenant: Tenant): PrismaClient {
    return this.clients.get(tenant)!;
  }
}
```

#### 业务 Service 使用示例

```typescript
// apps/api/src/customer/customer.service.ts
@Injectable()
export class CustomerService {
  constructor(private prisma: TenantPrismaService) {}

  async findByEmail(email: string): Promise<Customer | null> {
    // 完全不感知品牌 — TenantPrismaService 自动切到正确 schema
    return this.prisma.db.customer.findUnique({ where: { email } });
  }

  async register(dto: RegisterDto): Promise<Customer> {
    return this.prisma.db.customer.create({ data: { ...dto } });
  }
}
```

### 2.4 Prisma Schema 定义（tenant schema 镜像）

每个 tenant schema 拥有**完全相同**的表结构，仅 schema 名不同。通过 Prisma migration 同步：

```prisma
// packages/db/prisma/schema-customer.prisma
// 此 schema 会被 deploy 到 4 个 tenant schema

model Customer {
  id                String    @id @default(uuid())
  email             String    @unique
  passwordHash      String?
  name              String?
  phone             String?
  locale            String    @default("en")
  emailVerified     Boolean   @default(false)
  emailVerifiedAt   DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  warranties        WarrantyRegistration[]
  tickets           Ticket[]
  chatSessions      ChatSession[]
}

model WarrantyRegistration {
  id              String    @id @default(uuid())
  customerId      String
  productId       String    // 关联运营域 product.id
  serialNumber    String?
  purchasedAt     DateTime?
  platform        String?   // amazon / walmart / other
  receiptPublicId String?   // Cloudinary public_id
  status          String    @default("active")  // active / expired / void
  expiresAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  customer        Customer  @relation(fields: [customerId], references: [id])

  @@index([customerId])
  @@index([serialNumber])
}

model Ticket {
  id          String    @id @default(uuid())
  customerId  String?   // null = 匿名访客
  number      String    @unique  // T-HOMTONE-00001
  status      String    @default("open")  // open / pending / resolved / closed
  priority    String    @default("p2")    // p0 / p1 / p2 / p3
  assigneeId  String?   // 运营域 user.id
  subject     String
  tags        String[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  customer    Customer? @relation(fields: [customerId], references: [id])
  messages    TicketMessage[]
}

model TicketMessage {
  id        String   @id @default(uuid())
  ticketId  String
  from      String   // customer / agent / ai_bot
  body      String
  createdAt DateTime @default(now())

  ticket    Ticket   @relation(fields: [ticketId], references: [id])
}

model ChatSession {
  id           String   @id @default(uuid())
  customerId   String?
  messages     Json     // [{role, content, createdAt}]
  resolvedBy   String?  // human / ai
  hitFaq       Boolean  @default(false)
  escalated    Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  customer     Customer? @relation(fields: [customerId], references: [id])
}

model ManualDownloadLog {
  id         String   @id @default(uuid())
  customerId String?
  productId  String
  locale     String
  publicId   String   // Cloudinary public_id
  ip         String?
  createdAt  DateTime @default(now())
}
```

#### Migration 部署脚本

```bash
#!/bin/bash
# scripts/migrate-customer-schemas.sh
# 把同一套 migration 应用到 4 个 tenant schema

TENANTS=("homtone" "spoonlemon" "davivy" "tysun")

for tenant in "${TENANTS[@]}"; do
  echo "Migrating schema: $tenant"
  DATABASE_SCHEMA=$tenant \
  prisma migrate deploy \
    --schema=packages/db/prisma/schema-customer.prisma
done

echo "All tenant schemas migrated."
```

> 脚本加入 CI/CD pipeline，每次 deploy 自动执行。

### 2.5 前端：Next.js Tenant 感知

#### Tenant 注入（`middleware.ts`）

```typescript
// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const HOST_TENANT_MAP: Record<string, string> = {
  'support.homtone.com': 'homtone',
  'support.spoonlemon.com': 'spoonlemon',
  'support.davivy.com': 'davivy',
  'support.tysun.com': 'tysun',
};

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const tenant =
    HOST_TENANT_MAP[host] ??
    (process.env.NODE_ENV !== 'production'
      ? (req.headers.get('x-tenant') ?? 'homtone') // 开发默认 homtone
      : null);

  if (!tenant) {
    return NextResponse.redirect(new URL('https://yaemartos.com/404', req.url));
  }

  const res = NextResponse.next();
  res.headers.set('x-tenant', tenant); // 传给 Server Components
  res.cookies.set('tenant', tenant, { httpOnly: true, sameSite: 'strict' });
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

#### `useTenant()` hook（Client Components）

```typescript
// packages/shared-types/src/tenant.ts
export type Tenant = 'homtone' | 'spoonlemon' | 'davivy' | 'tysun';

export const BRAND_CONFIGS: Record<Tenant, BrandConfig> = {
  homtone: {
    name: 'Homtone',
    domain: 'support.homtone.com',
    primaryColor: '#E85D26',
    logoPublicId: 'prod/homtone/logo/primary',
    supportEmail: 'support@homtone.com',
    locale: 'en',
    privacyUrl: 'https://support.homtone.com/privacy',
  },
  spoonlemon: {
    name: 'Spoonlemon',
    domain: 'support.spoonlemon.com',
    primaryColor: '#F5A623',
    logoPublicId: 'prod/spoonlemon/logo/primary',
    supportEmail: 'support@spoonlemon.com',
    locale: 'en',
    privacyUrl: 'https://support.spoonlemon.com/privacy',
  },
  davivy: {
    /* ... */
  },
  tysun: {
    /* ... */
  },
};

// apps/web/src/hooks/useTenant.ts
('use client');
import { useContext } from 'react';
import { TenantContext } from '@/providers/TenantProvider';

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider');
  return ctx;
}
```

#### TenantProvider（Root Layout）

```typescript
// apps/web/src/app/layout.tsx
import { cookies, headers } from 'next/headers';
import { TenantProvider } from '@/providers/TenantProvider';
import { BRAND_CONFIGS } from '@yaemartos/shared-types';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = headers().get('x-tenant') as Tenant ?? 'homtone';
  const brandConfig = BRAND_CONFIGS[tenant];

  return (
    <html lang={brandConfig.locale}>
      <body style={{ '--brand-primary': brandConfig.primaryColor } as React.CSSProperties}>
        <TenantProvider value={{ tenant, brandConfig }}>
          {children}
        </TenantProvider>
      </body>
    </html>
  );
}
```

### 2.6 隔离验证（测试策略）

#### 跨 tenant 泄漏测试（必须全过）

```typescript
describe('TenantIsolation', () => {
  it('Customer registered in homtone is invisible in spoonlemon', async () => {
    // 在 homtone schema 注册
    const homtoneRes = await request(app)
      .post('/customer/register')
      .set('x-tenant', 'homtone')
      .send({ email: 'test@example.com', password: 'P@ssword1' });
    expect(homtoneRes.status).toBe(201);

    // 在 spoonlemon schema 查询同一 email
    const spoonlemonRes = await request(app)
      .post('/auth/customer/login')
      .set('x-tenant', 'spoonlemon')
      .send({ email: 'test@example.com', password: 'P@ssword1' });
    expect(spoonlemonRes.status).toBe(401);  // 不存在

    // 直接查 spoonlemon schema 验证
    const spoonlemonCustomer = await prisma.getClientFor('spoonlemon')
      .customer.findUnique({ where: { email: 'test@example.com' } });
    expect(spoonlemonCustomer).toBeNull();
  });

  it('Ticket created in homtone is not accessible from spoonlemon API', async () => { ... });

  it('WarrantyRegistration in homtone schema is isolated from davivy schema', async () => { ... });

  it('Cross-tenant aggregation only works with SuperAdmin role', async () => { ... });
});
```

#### DB 直查验证（CI 自动）

```typescript
it('No customer rows bleed across schemas', async () => {
  for (const [sourceSchema, targetSchema] of [
    ['homtone', 'spoonlemon'],
    ['davivy', 'tysun'],
  ]) {
    const sourceEmails = await prisma.$queryRawUnsafe<{ email: string }[]>(
      `SELECT email FROM "${sourceSchema}".customer`,
    );
    for (const { email } of sourceEmails) {
      const found = await prisma.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*) as count FROM "${targetSchema}".customer WHERE email = $1`,
        email,
      );
      expect(Number(found[0].count)).toBe(0);
    }
  }
});
```

### 2.7 Lint 规则

| 规则                                             | 禁止行为                                                  |
| ------------------------------------------------ | --------------------------------------------------------- |
| `@yaemartos/no-direct-prisma-in-customer-routes` | 客户域 Controller 直接 `new PrismaClient()`               |
| `@yaemartos/require-tenant-context`              | 客户域 Service 使用 `prisma.db` 而非 `new PrismaClient()` |
| `@yaemartos/no-cross-tenant-query`               | 非管理员聚合服务调用 `getClientFor(tenant)`               |

---

## 3. Brand Config 完整定义

```typescript
export interface BrandConfig {
  name: string;
  domain: string; // 生产域名
  primaryColor: string; // CSS hex
  logoPublicId: string; // Cloudinary public_id
  supportEmail: string; // 客服邮件发件人
  locale: string; // 默认语言
  privacyUrl: string; // 独立隐私政策 URL
  termsUrl: string; // 服务条款 URL
  smtp: {
    from: string; // 邮件 From
    replyTo: string; // Reply-To
  };
  warrantyYears: number; // 默认保修年限
  supportPhone?: string; // 客服电话（可选）
}
```

4 个品牌的具体配置在 `packages/shared-types/src/brand-configs.ts`，W1 D1 建文件、S3 W31 逐品牌填充。

---

## 4. 落地切片节奏

| 切片       | 增量                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| **S1 W2**  | `TenantStore`（AsyncLocalStorage）骨架入仓；Prisma schema-customer.prisma 草稿                                   |
| **S3 W31** | `TenantMiddleware` + `TenantPrismaService` 完整实现；4 tenant schema migrate；Next.js middleware + `useTenant()` |
| **S3 W31** | 跨 tenant 泄漏测试套件全过；lint 规则 CI 通过                                                                    |
| **S3 W33** | 4 品牌 BrandConfig 完整填充（域名/颜色/邮件/保修年限）                                                           |
| **S5 W53** | Davivy + Tysun tenant schema 正式激活（之前 schema 存在但无数据）                                                |

---

## 5. 替代方案与拒绝理由

| 方案                                 | 拒绝理由                                           |
| ------------------------------------ | -------------------------------------------------- |
| 单表 + `brand_id` 字段过滤（方案 B） | 合规风险；代码层 bug 可能跨品牌泄漏；法务不接受    |
| 4 个独立 PostgreSQL 实例             | 运维成本 4x；连接池管理复杂；备份 4 套             |
| Row-Level Security（RLS）            | 与 Prisma 集成复杂；RLS 策略难测试；性能有额外开销 |
| 请求层 `brand_id` 参数（无中间件）   | 业务代码必须手动传参；极易遗漏；没有系统性隔离保证 |

---

## 6. 验收

- [ ] `TenantMiddleware` 识别 4 个品牌域名 + dev `X-Tenant` header
- [ ] `TenantPrismaService.db` 自动切 schema，无 `search_path` 错误
- [ ] 4 个 tenant schema 通过 `migrate-customer-schemas.sh` 正确创建
- [ ] 跨 tenant 泄漏测试套件（§2.6）全过
- [ ] DB 直查验证无跨 schema 数据泄漏
- [ ] Next.js `useTenant()` 在 4 个域名返回正确品牌配置
- [ ] Lint 规则 CI 通过

---

## 7. 风险与未决项

| 风险                                 | 缓解                                                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| `SET search_path` 在连接池复用时污染 | Prisma middleware 每次查询前重置；连接池隔离测试                 |
| 4 schema 同步 migration 部分失败     | 脚本加事务 + 回滚；失败后发 P1 告警                              |
| 本地开发 Host header 不一致          | `X-Tenant` header 优先级高；docker-compose 注入默认值            |
| 4 schema 磁盘占用增加                | 数据量小（非运营域）；PostgreSQL schema 共享存储，无显著额外开销 |
| 第 5 个品牌上线（v2.x）              | 只需新增 `BRAND_CONFIGS` 条目 + 运行迁移脚本；代码零改动         |

---

_版本：v0.1 提案 | 最后修订：2026-04-30 | 实施评审：S3 W31_
