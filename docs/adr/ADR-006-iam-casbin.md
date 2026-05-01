# ADR-006：IAM Casbin 策略文件结构

| 字段     | 取值                                              |
| -------- | ------------------------------------------------- |
| 状态     | Proposed（W3 实施时评审）                         |
| 提议日期 | 2026-04-30                                        |
| 决策日期 | _S1 W3 评审通过后填写_                            |
| 决策人   | tech lead + dev #2                                |
| 关联文档 | `yaemartOS-implementation-plan.md` §3 IAM / §6 W3 |
| 取代     | 无                                                |

---

## 1. 上下文

§3 已决策 **Casbin（RBAC + ABAC 混合）**，Policy 维度 7 个：
`userId` / `brand` / `market` / `platform` / `shop` / `category` / `field`

运营系统的权限边界极为复杂：

- 同一用户可能在 Homtone 是"listing 编辑"，在 Spoonlemon 是"只读"
- 广告操作需要 shop 级别授权（不是 brand 级）
- 供应链字段（成本、利润率）只有特定角色可见
- 客服跨品牌看板需要 brand=\* 特权
- 培训考试权限与通过状态动态联动

Casbin 的优势：模型（PERM）与策略（CSV/DB）分离；支持 RBAC 角色继承 + ABAC 属性条件复合。

---

## 2. 决策

### 2.1 Casbin 模型文件（PERM Meta-Model）

```ini
# packages/iam/casbin/model.conf

[request_definition]
r = sub, brand, market, platform, shop, category, field, act

[policy_definition]
p = sub, brand, market, platform, shop, category, field, act, eft

[role_definition]
g = _, _          # user → role 映射
g2 = _, _         # role → role 继承

[policy_effect]
e = some(where (p.eft == allow)) && !some(where (p.eft == deny))

[matchers]
m = g(r.sub, p.sub) \
  && keyMatch2(r.brand,    p.brand)    \
  && keyMatch2(r.market,   p.market)   \
  && keyMatch2(r.platform, p.platform) \
  && keyMatch2(r.shop,     p.shop)     \
  && keyMatch2(r.category, p.category) \
  && keyMatch2(r.field,    p.field)    \
  && r.act == p.act
```

**关键设计**：

- `keyMatch2` 支持 glob 通配（`*` = 任意，`homtone` = 精确匹配）
- `eft = deny` 显式拒绝优先于任意 allow（黑名单优先）
- 双层角色继承：`g` 绑定用户→角色；`g2` 实现角色继承树

### 2.2 角色体系

```
SuperAdmin                          # 全局超级管理员（仅 CEO / CTO）
│
├── BrandAdmin(brand)               # 品牌管理员，管理单品牌下所有资源
│   ├── ListingEditor(brand)        # Listing 编辑（可创建/编辑 listing）
│   ├── ListingReviewer(brand)      # Listing 审核（仅审核，不可编辑）
│   ├── AdManager(brand,shop)       # 广告操作（shop 级授权）
│   ├── SupplyChainViewer(brand)    # 供应链只读
│   ├── SupplyChainEditor(brand)    # 供应链编辑
│   └── CustomerSupportAgent(brand) # 客服（绑定到 tenant schema）
│
├── TrainerAdmin                    # 培训管理员（全局，不限品牌）
├── TrainingStudent(brand)          # 培训学员（品牌内）
│
└── ReportViewer(brand,market)      # 报表只读（指定品牌+市场）
```

> 角色名用 `PascalCase`；动态参数用括号标注（实际存库为 `ListingEditor:homtone`）。

### 2.3 Policy 文件（CSV 示例 + 注释）

```csv
# packages/iam/casbin/policy.csv
#
# 格式：p, <role>, <brand>, <market>, <platform>, <shop>, <category>, <field>, <act>
# 通配：* = 任意值
# act：create | read | update | delete | publish | approve | execute | admin
#
# ─────────────────────────────────────────────────
# SuperAdmin：全局一切
# ─────────────────────────────────────────────────
p, SuperAdmin, *, *, *, *, *, *, admin

# ─────────────────────────────────────────────────
# BrandAdmin：单品牌全权
# ─────────────────────────────────────────────────
p, BrandAdmin, homtone, *, *, *, *, *, admin
p, BrandAdmin, spoonlemon, *, *, *, *, *, admin
p, BrandAdmin, davivy, *, *, *, *, *, admin
p, BrandAdmin, tysun, *, *, *, *, *, admin

# ─────────────────────────────────────────────────
# ListingEditor：品牌内 listing 增删改，不可 approve
# ─────────────────────────────────────────────────
p, ListingEditor:homtone, homtone, *, amazon|walmart, *, *, *, create
p, ListingEditor:homtone, homtone, *, amazon|walmart, *, *, *, read
p, ListingEditor:homtone, homtone, *, amazon|walmart, *, *, *, update
p, ListingEditor:homtone, homtone, *, amazon|walmart, *, *, *, delete

# ─────────────────────────────────────────────────
# ListingReviewer：仅 read + approve
# ─────────────────────────────────────────────────
p, ListingReviewer:homtone, homtone, *, *, *, *, *, read
p, ListingReviewer:homtone, homtone, *, *, *, *, *, approve

# ─────────────────────────────────────────────────
# AdManager：shop 级广告操作 + human-in-loop execute
# ─────────────────────────────────────────────────
p, AdManager:homtone:us-main, homtone, us, amazon, us-main, *, *, read
p, AdManager:homtone:us-main, homtone, us, amazon, us-main, *, *, create
p, AdManager:homtone:us-main, homtone, us, amazon, us-main, *, *, update
p, AdManager:homtone:us-main, homtone, us, amazon, us-main, *, *, execute

# ─────────────────────────────────────────────────
# SupplyChainViewer：仅读，成本字段屏蔽
# ─────────────────────────────────────────────────
p, SupplyChainViewer:homtone, homtone, *, *, *, *, !cost_price|!profit_margin, read

# ─────────────────────────────────────────────────
# SupplyChainEditor：全字段读写（含成本）
# ─────────────────────────────────────────────────
p, SupplyChainEditor:homtone, homtone, *, *, *, *, *, read
p, SupplyChainEditor:homtone, homtone, *, *, *, *, *, update

# ─────────────────────────────────────────────────
# CustomerSupportAgent：客户域 tenant 内 read + ticket
# ─────────────────────────────────────────────────
p, CustomerSupportAgent:homtone, homtone, *, *, *, customer:*, *, read
p, CustomerSupportAgent:homtone, homtone, *, *, *, customer:ticket, *, update

# ─────────────────────────────────────────────────
# 跨品牌聚合看板（仅 SuperAdmin / BrandAdmin 聚合服务）
# ─────────────────────────────────────────────────
p, SuperAdmin, *, *, *, *, aggregated_dashboard:*, *, read

# ─────────────────────────────────────────────────
# 显式 Deny：任何角色不可读成本字段（除 SupplyChainEditor / BrandAdmin+）
# ─────────────────────────────────────────────────
p, ListingEditor:*, *, *, *, *, *, cost_price|profit_margin, read, deny
p, ListingReviewer:*, *, *, *, *, *, cost_price|profit_margin, read, deny
p, AdManager:*, *, *, *, *, *, cost_price|profit_margin, read, deny

# ─────────────────────────────────────────────────
# 角色继承（g）
# ─────────────────────────────────────────────────
g, SuperAdmin, BrandAdmin
g, BrandAdmin, ListingEditor:homtone
g, BrandAdmin, ListingReviewer:homtone
g, BrandAdmin, AdManager:homtone:*
g, BrandAdmin, SupplyChainEditor:homtone
g, BrandAdmin, CustomerSupportAgent:homtone
```

### 2.4 NestJS 集成

#### Module 注册

```typescript
// packages/iam/casbin.module.ts
@Module({
  imports: [
    CasbinModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        modelPath: path.join(__dirname, 'casbin/model.conf'),
        adapter: new TypeORMAdapter({
          // 生产用 DB adapter
          connection: configService.get('DB_URL'),
          tableName: 'casbin_rules',
        }),
        enableLog: configService.get('NODE_ENV') !== 'production',
      }),
    }),
  ],
  exports: [CasbinModule],
})
export class IamModule {}
```

#### 请求上下文注入

每个 HTTP 请求携带：`{ userId, brand, market, platform, shop }`（从 JWT 解析）。

```typescript
// middleware/iam-context.middleware.ts
export class IamContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const token = extractJwt(req);
    const claims = verifyJwt(token);
    req['iamCtx'] = {
      sub: claims.userId,
      brand: claims.brand ?? '*',
      market: claims.market ?? '*',
      platform: claims.platform ?? '*',
      shop: claims.shop ?? '*',
    };
    next();
  }
}
```

#### 资源 Guard

```typescript
// decorators/require-permission.decorator.ts
export const RequirePermission = (category: string, field: string, act: string) =>
  SetMetadata(PERMISSION_KEY, { category, field, act });

// guards/casbin.guard.ts
@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private enforcer: Enforcer,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const { category, field, act } = this.reflector.get(PERMISSION_KEY, ctx.getHandler());
    const req = ctx.switchToHttp().getRequest();
    const { sub, brand, market, platform, shop } = req['iamCtx'];

    const allowed = await this.enforcer.enforce(
      sub,
      brand,
      market,
      platform,
      shop,
      category,
      field,
      act,
    );

    if (!allowed) throw new ForbiddenException('IAM policy denied');
    return true;
  }
}
```

#### 使用示例

```typescript
@Controller('listings')
@UseGuards(JwtGuard, CasbinGuard)
export class ListingController {
  @Post()
  @RequirePermission('listing', '*', 'create')
  async create(@Body() dto: CreateListingDto) { ... }

  @Patch(':id/approve')
  @RequirePermission('listing', '*', 'approve')
  async approve(@Param('id') id: string) { ... }

  @Get(':id/cost')
  @RequirePermission('listing', 'cost_price', 'read')
  async getCost(@Param('id') id: string) { ... }
}
```

#### Field Mask（字段级隔离）

成本字段等敏感字段通过 response interceptor 自动 mask：

```typescript
// interceptors/field-mask.interceptor.ts
@Injectable()
export class FieldMaskInterceptor implements NestInterceptor {
  async intercept(ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      switchMap(async (data) => {
        const { sub, brand, market, platform, shop } = ctx.switchToHttp().getRequest()['iamCtx'];
        const canReadCost = await enforcer.enforce(
          sub,
          brand,
          market,
          platform,
          shop,
          '*',
          'cost_price',
          'read',
        );
        if (!canReadCost && data?.costPrice !== undefined) {
          data.costPrice = undefined;
          data.profitMargin = undefined;
        }
        return data;
      }),
    );
  }
}
```

### 2.5 DB 策略表结构（生产用 TypeORM Adapter）

```sql
CREATE TABLE casbin_rules (
  id         SERIAL PRIMARY KEY,
  ptype      VARCHAR(10)  NOT NULL,   -- 'p' | 'g' | 'g2'
  v0         VARCHAR(255) NOT NULL,   -- sub / user
  v1         VARCHAR(255) NOT NULL,   -- brand / role
  v2         VARCHAR(255),            -- market / (g: role parent)
  v3         VARCHAR(255),            -- platform
  v4         VARCHAR(255),            -- shop
  v5         VARCHAR(255),            -- category
  v6         VARCHAR(255),            -- field
  v7         VARCHAR(255),            -- act
  v8         VARCHAR(10),             -- eft (allow|deny)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by VARCHAR(255),
  comment    TEXT
);

CREATE INDEX casbin_rules_ptype_idx ON casbin_rules(ptype);
CREATE INDEX casbin_rules_v0_idx ON casbin_rules(v0);
```

> 策略变更走专用 Admin API（不直接操作 DB），每次变更写入审计日志（M-10）。

### 2.6 策略管理 Admin API

```
POST   /admin/iam/policies          # 新增策略行
DELETE /admin/iam/policies/:id      # 删除策略行
PUT    /admin/iam/policies/:id      # 修改策略行
GET    /admin/iam/policies          # 分页查询
POST   /admin/iam/roles             # 用户绑定角色
DELETE /admin/iam/roles             # 解绑角色
GET    /admin/iam/check             # 调试：检查特定用户是否有权限
POST   /admin/iam/reload            # 热重载策略（无需重启）
```

> 以上 API 仅 `SuperAdmin` 可访问；操作均入审计日志。

---

## 3. 典型策略场景测试矩阵

### 3.1 单元测试用例（必须全过）

```typescript
describe('CasbinPolicyMatrix', () => {
  // 正常 allow
  it('ListingEditor:homtone can create listing for homtone/amazon', () =>
    expect(
      enforce('alice', 'homtone', 'us', 'amazon', '*', 'listing', '*', 'create'),
    ).resolves.toBe(true));

  it('ListingReviewer:homtone can approve listing', () =>
    expect(enforce('bob', 'homtone', '*', '*', '*', 'listing', '*', 'approve')).resolves.toBe(
      true,
    ));

  // 跨品牌拒绝
  it('ListingEditor:homtone cannot create listing for spoonlemon', () =>
    expect(
      enforce('alice', 'spoonlemon', 'us', 'amazon', '*', 'listing', '*', 'create'),
    ).resolves.toBe(false));

  // 字段级拒绝
  it('ListingEditor:homtone cannot read cost_price', () =>
    expect(enforce('alice', 'homtone', '*', '*', '*', '*', 'cost_price', 'read')).resolves.toBe(
      false,
    ));

  it('SupplyChainEditor:homtone can read cost_price', () =>
    expect(enforce('charlie', 'homtone', '*', '*', '*', '*', 'cost_price', 'read')).resolves.toBe(
      true,
    ));

  // shop 级限制
  it('AdManager:homtone:us-main can execute ad for us-main shop', () =>
    expect(
      enforce('dave', 'homtone', 'us', 'amazon', 'us-main', '*', '*', 'execute'),
    ).resolves.toBe(true));

  it('AdManager:homtone:us-main cannot execute ad for us-backup shop', () =>
    expect(
      enforce('dave', 'homtone', 'us', 'amazon', 'us-backup', '*', '*', 'execute'),
    ).resolves.toBe(false));

  // 超级管理员
  it('SuperAdmin can do anything', () =>
    expect(enforce('ceo', '*', '*', '*', '*', '*', '*', 'admin')).resolves.toBe(true));

  // 客服跨品牌拒绝
  it('CustomerSupportAgent:homtone cannot read spoonlemon customer', () =>
    expect(enforce('eva', 'spoonlemon', '*', '*', '*', 'customer:*', '*', 'read')).resolves.toBe(
      false,
    ));

  // Deny 优先
  it('explicit deny overrides allow for cost fields', () =>
    expect(enforce('alice', 'homtone', '*', '*', '*', '*', 'profit_margin', 'read')).resolves.toBe(
      false,
    ));
});
```

### 3.2 边界场景

| 场景                       | 期望结果                                 |
| -------------------------- | ---------------------------------------- |
| 用户无任何角色             | deny all                                 |
| 品牌参数为空（未传）       | middleware 注入 `*`，策略按 `*` 评估     |
| 同一用户在两品牌有不同角色 | 各自品牌策略独立生效                     |
| 新增品牌（v2.x 第 5 个）   | 只需在 DB 加策略行，代码不变             |
| 培训未通过用户访问高级功能 | 动态策略更新（TrainingStudent 角色移除） |

---

## 4. 渐进引入节奏

| 切片       | 增量                                                                          |
| ---------- | ----------------------------------------------------------------------------- |
| **S1 W3**  | model.conf + CSV 基础策略 + NestJS Module + CasbinGuard + 单元测试矩阵        |
| **S1 W3**  | FieldMaskInterceptor（成本字段屏蔽）+ Admin `/check` 调试 API                 |
| **S2 W14** | 多品牌策略批量导入（Spoonlemon 角色配置）                                     |
| **S2 W24** | Listing 矩阵分析 dashboard 权限（ListingEditor 可读，运营 PM 以上可见全品牌） |
| **S3 W31** | CustomerSupportAgent 客服权限 + tenant schema 绑定验证                        |
| **S4 W43** | AdManager shop 级权限 + human-in-loop execute 权限闸门                        |
| **S4 W48** | SupplyChainEditor / Viewer 成本字段权限                                       |
| **S5 W53** | Davivy + Tysun 品牌策略批量导入                                               |
| **S6 W72** | TrainerAdmin / TrainingStudent 培训考试权限 + 动态解锁联动                    |

---

## 5. 安全约束（不可妥协）

1. **所有 Controller 必须有 `@RequirePermission` 装饰器**（CI lint 规则 `@yaemartos/require-iam-decorator`）
2. **跨品牌查询 API 禁止 `brand=*` 参数**（除非用户有 SuperAdmin 角色）
3. **策略变更必须走 Admin API，不直接操作 `casbin_rules` 表**（lint 规则）
4. **策略变更 100% 写入审计日志**（M-10）
5. **每次 Casbin Enforcer 热重载必须通知 Sentry**（trace `iam.policy.reload`）

---

## 6. 替代方案与拒绝理由

| 方案                        | 拒绝理由                                              |
| --------------------------- | ----------------------------------------------------- |
| 自建 RBAC 表（手写 SQL）    | 7 维 ABAC 手写复杂度极高；难维护；测试难              |
| OPA（Open Policy Agent）    | Rego 学习成本高；2 人团队难维护；Casbin TS 生态更成熟 |
| Zanzibar（Google）/ AuthZed | 过重，适合大型 SaaS；本项目内部系统不需要             |
| 仅 JWT claims（无 Casbin）  | 缺乏字段级（field mask）和动态 shop 维度支持          |

---

## 7. 验收

- [ ] `model.conf` 和基础 `policy.csv` 入仓
- [ ] `CasbinGuard` 接入所有 Controller（CI lint 规则通过）
- [ ] 单元测试矩阵（§3.1，约 20 条）全过
- [ ] `FieldMaskInterceptor` 屏蔽 cost_price / profit_margin 通过测试
- [ ] Admin `/admin/iam/check` API 可调试
- [ ] 策略变更入审计日志（M-10 验收）

---

## 8. 风险与未决项

| 风险                                    | 缓解                                                         |
| --------------------------------------- | ------------------------------------------------------------ |
| 7 维策略组合爆炸（规则数量太多）        | 合理角色继承树减少显式规则数；SuperAdmin/BrandAdmin 继承兜底 |
| `keyMatch2` glob 性能（规则 > 1000 条） | 启用 Casbin 内置缓存（EnforceCache）；规则数估算 < 500       |
| 策略热重载导致短暂不一致                | 重载前加 Redis 分布式锁；重载后 Sentry 追踪                  |
| 动态权限（培训通过→解锁）延迟           | BullMQ 事件推送 + 强制 token 刷新                            |
| 新品牌上线忘记配置策略                  | CI 检查：DB 中每个 brand 必须有对应 BrandAdmin 策略行        |

---

_版本：v0.1 提案 | 最后修订：2026-04-30 | 实施评审：S1 W3_
