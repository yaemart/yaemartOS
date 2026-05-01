---
date: 2026-04-30
category: backend_pattern
tags: [nestjs, prisma, neon, multi-tenant, postgresql, cls, audit-log]
applies_to: [S1-W2, S3-W27, all-backend]
status: authoritative
related_adr: docs/adr/ADR-001-tech-stack.md
related_erd: docs/erd/domain-model.md
---

# NestJS + Prisma + Neon 多租户 Schema 最佳实践

> 研究日期：2026-04-30 | 适用版本：Prisma 7.x、NestJS 10.x、Neon Serverless  
> 背景：yaemartOS 使用 schema-per-brand 多租户方案（public + homtone/spoonlemon/davivy/tysun）

---

## 关键结论摘要

| 问题        | 推荐方案                                                | 备注                                                |
| ----------- | ------------------------------------------------------- | --------------------------------------------------- |
| Schema 切换 | `PrismaClientManager` + `PrismaNeon({ schema })`        | Prisma `.schema()` PR#28249 仍为 open，不可用于生产 |
| 租户上下文  | `nestjs-cls` (Papooch/nestjs-cls)                       | 官方推荐，避免 REQUEST scope 性能损耗               |
| 审计日志    | Prisma Client Extensions + PostgreSQL 触发器            | 原子性最强，无法被绕过                              |
| 连接池      | Neon PgBouncer (transaction mode) + `PrismaNeon` 适配器 | 两条连接串：pooled + direct                         |
| CI/CD 分支  | Neon branching + `create-branch-action@v6`              | 每 PR 自动隔离数据库分支                            |

---

## 1. Prisma 多 Schema 配置

### 1.1 设计原则

yaemartOS 的 4 个租户 schema 结构**完全相同**（同表不同数据）。`@@schema` 是为**不同模型分布在不同 schema** 设计的（静态），不适用"相同结构重复 N 份"的多租户模式。

**正确做法**：`public` schema 用 `@@schema` 静态声明（运营域），4 个品牌 tenant schema 用动态连接管理。

### 1.2 schema.prisma

```prisma
// prisma/schema.prisma（运营域 public schema）
generator client {
  provider        = "prisma-client-js"
  output          = "../src/generated/prisma"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  schemas  = ["public"]
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  brandId   String
  role      String
  createdAt DateTime @default(now())
  @@schema("public")
}

model AuditLog {
  id         String   @id @default(cuid())
  tableName  String
  operation  String   // CREATE | UPDATE | DELETE
  recordId   String
  before     Json?
  after      Json?
  userId     String
  brandId    String
  schema     String
  ipAddress  String?
  createdAt  DateTime @default(now())
  @@index([tableName, recordId])
  @@index([userId, createdAt])
  @@schema("public")
}
```

```prisma
// prisma/tenant.schema.prisma（4 个品牌 schema 共用结构模板）
// 用于生成 migration SQL，不直接用于 PrismaClient 生成
datasource db {
  provider = "postgresql"
  schemas  = ["homtone", "spoonlemon", "davivy", "tysun"]
}

model Customer {
  id        String   @id @default(cuid())
  email     String
  phone     String?
  createdAt DateTime @default(now())
  warranties WarrantyRegistration[]
  tickets    SupportTicket[]
  @@schema("homtone") // migration 时通过 URL override 替换
}
```

### 1.3 prisma.config.ts（Prisma 7+ 必须）

```typescript
// prisma.config.ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: env('DIRECT_URL'), // CLI 使用直连，不走 PgBouncer
  },
});
```

---

## 2. NestJS 动态 Schema 切换

### 2.1 为什么不用 Prisma `.schema()` 方法

Prisma PR #28249（动态 `.schema()` 方法）截至 2026-04-30 **仍为 open 状态**，未合并进任何稳定版本（v7.7.0 未包含）。已知问题：

- 每次查询前执行 `SET search_path TO` 影响 PostgreSQL 查询计划缓存
- 无法访问 `public` schema 中的函数/触发器

**当前生产可用方案**：`PrismaClientManager` + `PrismaNeon` adapter 的 `{ schema }` 选项。

### 2.2 PrismaClientManager

```typescript
// src/database/prisma-client.manager.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';
import { PrismaNeon } from '@prisma/adapter-neon';
import { BrandId } from '../common/types';

export type TenantPrismaClient = PrismaClient;

@Injectable()
export class PrismaClientManager implements OnModuleDestroy {
  // 单例缓存，process 生命周期内复用
  private readonly clients = new Map<BrandId, TenantPrismaClient>();
  private readonly _publicClient: TenantPrismaClient;

  constructor() {
    this._publicClient = this.createClient('public');
  }

  get publicClient(): TenantPrismaClient {
    return this._publicClient;
  }

  getTenantClient(brandId: BrandId): TenantPrismaClient {
    const existing = this.clients.get(brandId);
    if (existing) return existing;
    const client = this.createClient(brandId);
    this.clients.set(brandId, client);
    return client;
  }

  private createClient(schema: string): TenantPrismaClient {
    const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! }, { schema });
    return new PrismaClient({ adapter });
  }

  async onModuleDestroy() {
    const allClients = [this._publicClient, ...Array.from(this.clients.values())];
    await Promise.all(allClients.map((c) => c.$disconnect()));
  }
}
```

```typescript
// src/database/database.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaClientManager } from './prisma-client.manager';
import { PrismaPublicProvider, PrismaTenantProvider } from './prisma.providers';

@Global()
@Module({
  providers: [PrismaClientManager, PrismaPublicProvider, PrismaTenantProvider],
  exports: [PrismaClientManager, 'PRISMA_PUBLIC', 'PRISMA_TENANT'],
})
export class DatabaseModule {}
```

---

## 3. 请求级租户上下文（nestjs-cls）

### 3.1 为什么选 nestjs-cls

| 方案                             | 性能                           | 适用范围           | 推荐        |
| -------------------------------- | ------------------------------ | ------------------ | ----------- |
| REQUEST scope                    | 每请求新建 DI 实例，scope 传染 | 仅 HTTP            | ❌          |
| 手动参数传递                     | 好                             | 通用               | ❌ 侵入性强 |
| `nestjs-cls` (AsyncLocalStorage) | 极好，singleton 不变           | HTTP/WS/Queue/Cron | ✅          |

官方 NestJS 文档（2026）明确推荐 `nestjs-cls` 作为 REQUEST scope 的替代方案。

### 3.2 安装

```bash
pnpm add nestjs-cls @nestjs-cls/transactional @nestjs-cls/transactional-adapter-prisma
```

### 3.3 CLS Store 类型定义

```typescript
// src/common/cls/tenant-cls.store.ts
export interface TenantClsStore {
  tenantId: BrandId; // 'homtone' | 'spoonlemon' | 'davivy' | 'tysun'
  userId: string;
  requestId: string;
  ipAddress?: string;
}
```

### 3.4 AppModule 集成

```typescript
// src/app.module.ts
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

@Module({
  imports: [
    ClsModule.forRoot<TenantClsStore>({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req: Request) => {
          cls.set('requestId', crypto.randomUUID());
          cls.set('ipAddress', req.ip);
        },
      },
      plugins: [
        new ClsPluginTransactional({
          imports: [DatabaseModule],
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: 'PRISMA_TENANT',
          }),
        }),
      ],
    }),
    DatabaseModule,
  ],
})
export class AppModule {}
```

### 3.5 TenantGuard

```typescript
// src/auth/tenant.guard.ts
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly cls: ClsService<TenantClsStore>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    const payload = this.jwt.verify(token);

    // 写入 CLS store — 下游所有 Service 可直接读取
    this.cls.set('tenantId', payload.brandId);
    this.cls.set('userId', payload.sub);
    return true;
  }

  private extractToken(request: any): string {
    const subdomain = request.hostname?.split('.')[0];
    if (VALID_BRANDS.includes(subdomain)) {
      return request.cookies?.['brand_token'];
    }
    return request.headers?.authorization?.split(' ')[1];
  }
}
```

### 3.6 Providers 与 Service 用法

```typescript
// src/database/prisma.providers.ts
export const PrismaTenantProvider: FactoryProvider = {
  provide: 'PRISMA_TENANT',
  scope: Scope.REQUEST,
  inject: [ClsService, PrismaClientManager],
  useFactory: (cls: ClsService, manager: PrismaClientManager) => {
    const brandId = cls.get('tenantId');
    if (!brandId) throw new Error('Tenant context not set. TenantGuard must run first.');
    return manager.getTenantClient(brandId);
  },
};

export const PrismaPublicProvider: FactoryProvider = {
  provide: 'PRISMA_PUBLIC',
  inject: [PrismaClientManager],
  useFactory: (manager: PrismaClientManager) => manager.publicClient,
};
```

```typescript
// 在 Service 中使用
@Injectable()
export class CustomerService {
  constructor(
    @Inject('PRISMA_TENANT') private readonly prisma: TenantPrismaClient,
    private readonly cls: ClsService<TenantClsStore>,
  ) {}

  async findCustomers() {
    // 自动路由到正确品牌 schema，无需手动传 brandId
    return this.prisma.customer.findMany();
  }

  @Transactional()
  async createWithTicket(data: CreateCustomerDto) {
    const customer = await this.prisma.customer.create({ data });
    await this.prisma.supportTicket.create({
      data: { customerId: customer.id, ...data.ticket },
    });
    return customer;
  }
}
```

---

## 4. 审计日志（100% 写操作覆盖，M-10）

### 4.1 方案选择

| 方案                   | 优点                                   | 缺点                                                              |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Prisma Extension only  | 纯应用层，易调试                       | `updateMany/deleteMany` 无法高效获取 before 值；直接 SQL 操作绕过 |
| PostgreSQL 触发器 only | 原子性最强，不可绕过                   | 无应用层用户上下文（userId/requestId）                            |
| **两者结合（推荐）**   | 触发器保证覆盖率，Extension 注入上下文 | —                                                                 |

### 4.2 Prisma Extension（注入用户上下文）

```typescript
// src/database/audit.extension.ts
const AUDITED_MODELS = ['Listing', 'Product', 'Shop', 'Category', 'User'] as const;

export function createAuditExtension(cls: ClsService) {
  return Prisma.defineExtension({
    name: 'audit-extension',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const isWrite = ['create', 'update', 'delete', 'upsert'].includes(operation);
          const isAudited = AUDITED_MODELS.includes(model as any);
          if (!isWrite || !isAudited) return query(args);

          const userId = cls.get('userId') ?? 'system';
          const brandId = cls.get('tenantId') ?? 'public';
          const requestId = cls.get('requestId') ?? '';
          const context = JSON.stringify({ userId, brandId, requestId });

          // SET LOCAL 确保只在当前事务内有效（PgBouncer transaction mode 安全）
          return prisma
            .$transaction([
              prisma.$executeRaw`SELECT set_config('audit.context', ${context}, TRUE)`,
              query(args) as any,
            ])
            .then(([, result]) => result);
        },
      },
    },
  });
}
```

### 4.3 PostgreSQL 审计触发器

```sql
-- prisma/migrations/xxx_audit_trigger/migration.sql
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  context_json JSONB;
  user_id TEXT;
  brand_id TEXT;
  request_id TEXT;
BEGIN
  BEGIN
    context_json := current_setting('audit.context', true)::JSONB;
    user_id    := context_json->>'userId';
    brand_id   := context_json->>'brandId';
    request_id := context_json->>'requestId';
  EXCEPTION WHEN OTHERS THEN
    user_id := 'system'; brand_id := 'unknown'; request_id := '';
  END;

  INSERT INTO public.audit_log (
    table_name, schema_name, operation,
    record_id, before_data, after_data,
    user_id, brand_id, request_id, created_at
  ) VALUES (
    TG_TABLE_NAME, TG_TABLE_SCHEMA, TG_OP,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    user_id, brand_id, request_id, NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为每个需要审计的表添加触发器
CREATE TRIGGER audit_listing
  AFTER INSERT OR UPDATE OR DELETE ON public.listing
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
-- 重复用于: product, shop, category, user ...
```

---

## 5. Neon 连接池配置

### 5.1 两条连接串

```ini
# .env
# Pooled：应用运行时（-pooler 后缀）
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"

# Direct：prisma migrate / prisma db push（无 -pooler）
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 5.2 PgBouncer Transaction Mode 陷阱

| 操作                     | 状态               | 替代方案                                            |
| ------------------------ | ------------------ | --------------------------------------------------- |
| `SET` 持久化会话变量     | ❌ 每事务后重置    | `SET LOCAL` 或 `set_config(..., TRUE)` 在事务内使用 |
| Advisory Locks           | ❌                 | Redis 分布式锁                                      |
| `LISTEN/NOTIFY`          | ❌                 | 需要直连                                            |
| Prepared Statements      | ✅ PgBouncer 1.22+ | Neon 已支持                                         |
| Interactive Transactions | ✅                 | 推荐使用 `$transaction`                             |

> **关键**：审计日志中 `set_config('audit.context', ..., TRUE)` 第三参数 `TRUE` = `is_local`，事务结束自动清除，与 PgBouncer transaction mode 完全兼容。

---

## 6. Neon 分支 + Prisma Migration 工作流

### 6.1 多 Schema Migration 脚本

```typescript
// scripts/migrate-all-schemas.ts
import { execSync } from 'child_process';

const TENANT_SCHEMAS = ['homtone', 'spoonlemon', 'davivy', 'tysun'];

async function migrateAllSchemas() {
  console.log('Migrating public schema...');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DIRECT_URL: process.env.DIRECT_URL! },
  });

  for (const schema of TENANT_SCHEMAS) {
    console.log(`Migrating ${schema} schema...`);
    const tenantUrl = process.env.DIRECT_URL!.replace('/neondb', `/neondb?schema=${schema}`);
    execSync('npx prisma migrate deploy --schema prisma/tenant.schema.prisma', {
      env: { ...process.env, DIRECT_URL: tenantUrl },
    });
  }
  console.log('All schemas migrated.');
}

migrateAllSchemas().catch(console.error);
```

### 6.2 GitHub Actions PR 分支 CI

```yaml
# .github/workflows/preview.yml
name: Preview Deploy

on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

jobs:
  create_preview:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create Neon Branch
        id: neon
        uses: neondatabase/create-branch-action@v6
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          branch_name: preview/pr-${{ github.event.number }}
          parent_branch: main
          api_key: ${{ secrets.NEON_API_KEY }}

      - uses: actions/setup-node@v4
        with: { node-version: '20' }

      - run: pnpm install

      - name: Run All Schema Migrations
        run: pnpm tsx scripts/migrate-all-schemas.ts
        env:
          DIRECT_URL: ${{ steps.neon.outputs.db_url }}

      - name: Post Schema Diff Comment
        uses: neondatabase/schema-diff-action@v1
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          compare_branch: preview/pr-${{ github.event.number }}
          api_key: ${{ secrets.NEON_API_KEY }}

  cleanup:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - name: Delete Neon Branch
        uses: neondatabase/delete-branch-action@v3
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          branch: preview/pr-${{ github.event.number }}
          api_key: ${{ secrets.NEON_API_KEY }}
```

---

## 7. 测试模式

### 7.1 单元测试（`cls.runWith()` 隔离）

```typescript
// src/customer/customer.service.spec.ts
it('queries correct tenant schema', async () => {
  await cls.runWith({ tenantId: 'homtone', userId: 'user-1', requestId: 'req-1' }, async () => {
    await service.findCustomers();
    expect(mockPrisma.customer.findMany).toHaveBeenCalled();
  });
});

it('throws when no tenant context', async () => {
  await expect(service.findCustomers()).rejects.toThrow('Tenant context not set');
});
```

---

## 8. 完整请求流

```
请求进入
  → CLS Middleware（挂载 requestId）
  → TenantGuard（JWT/subdomain → CLS: tenantId, userId）
  → Controller
  → Service（inject 'PRISMA_TENANT'）
  → PrismaTenantProvider（CLS.get('tenantId') → PrismaClientManager.getTenantClient）
  → PrismaClientManager（Map<BrandId, PrismaClient> 内存缓存）
  → PrismaNeon({ schema: 'homtone' }) ←→ Neon PgBouncer
  → PostgreSQL schema: homtone（完全隔离）
  → 触发器自动写 public.audit_log（含 userId、brandId、before/after）
```

---

## 9. W2 实施优先级

| Day | 任务                                                          |
| --- | ------------------------------------------------------------- |
| 1   | Neon 双连接串配置 + `PrismaService` 连通验证                  |
| 2   | `PrismaClientManager` + 5 个 client 缓存（public + 4 tenant） |
| 3   | `nestjs-cls` + `TenantGuard` + 跨品牌隔离验证                 |
| 4   | PostgreSQL 审计触发器（public schema 所有写操作）             |
| 5   | GitHub Actions Neon 分支 CI/CD                                |

---

## 参考资源

- [Prisma 多 Schema 文档](https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema)
- [Neon + Prisma 连接指南](https://neon.com/docs/guides/prisma)
- [nestjs-cls 文档](https://papooch.github.io/nestjs-cls/)
- [@nestjs-cls/transactional-adapter-prisma](https://www.npmjs.com/package/@nestjs-cls/transactional-adapter-prisma)
- [Neon GitHub Actions 自动化分支](https://www.neon.tech/guides/neon-github-actions-authomated-branching)
- [Prisma PR #28249（持续关注合并状态）](https://github.com/prisma/prisma/pull/28249)
