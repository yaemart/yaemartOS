---
title: 'feat: W36–W39 客户中心 V1 — 手册 + 保修 + 首页 + 非登录订单查询 + S3 上线'
type: feat
status: active
date: 2026-05-03
origin: docs/yaemartOS-implementation-plan.md §8 W36–W39
---

# feat: W36–W39 客户中心 V1 收尾 + S3 上线

## Overview

W31–W35 已完成客户中心核心基础设施：Tenant 隔离架构、Auth 多品牌实例化、AI Chat（SSE）、工单 CRUD + AI Fallback。W36–W39 是 S3 最后冲刺，交付剩余 4 个模块并完成 20 人 beta 上线。

**目标**

- **W36–W37**：多语言手册下载 + 保修注册全链路（Cloudinary PDF + 邮件 + 30 天提醒）
- **W38**：客户中心首页（4 区块）+ 非登录订单状态查询（速率限制 + CAPTCHA）
- **W39**：Feature flag 三维灰度 + Homtone + Spoonlemon beta 上线 + 20 人试用

**关键约束（来自流程分析 + 代码研究）**
| ID | 约束 / 决策点 | 默认假设 / 推荐 |
|----|--------------|----------------|
| C-1 | 保修注册是否需要登录 | **需要登录**（customerId 作 schema FK 主键，逻辑最简） |
| C-2 | 手册 PDF 访问控制 | **公开直链**（Cloudinary public URL，无需 signed URL 签名），登录用户和匿名均可下载 |
| C-3 | CAPTCHA 供应商 | **Cloudflare Turnstile**（GDPR 合规、无跨站追踪、4 品牌隐私政策均无需修改） |
| C-4 | 订单查询"失败"定义 | 领星 API 返回空结果 → 提示"未找到订单"；不计入失败限流计数器；仅非法格式/服务器错误计入 |

---

## W36–W37：手册下载 + 保修注册（预计 2 周）

### 前置工作（W36 第 1-2 天）

#### T-0：CloudinaryService 扩展（阻塞项）

> **当前状态**：`uploadBuffer()` 仅支持 image MIME（jpeg/png/webp/gif）；PDF 上传会直接返回 `400`。

**修改文件**：`apps/api/src/cloudinary/cloudinary.service.ts`、`apps/api/src/upload/upload.controller.ts`

```
新增方法：
  uploadRaw(buffer, brand, assetType, identifier): Promise<{ publicId, secureUrl }>
    resource_type: 'raw'
    folder: {env}/{brand}/{assetType}/{identifier}
    access_mode: 'public' | 'authenticated'

  uploadPrivate(buffer, brand, assetType, identifier): Promise<{ publicId, secureUrl }>
    resource_type: 'raw', access_mode: 'authenticated'（保修发票）

  signUrl(publicId, ttlSec?): string（保修发票有效期 URL）
```

ALLOWED MIME 白名单扩展：`application/pdf`（手册）、`image/jpeg|png|webp`（发票）

**验收**：单元测试覆盖 uploadRaw + uploadPrivate；CI 绿；MIME 白名单 reject `.exe` 仍有效。

---

#### T-1：WarrantyRegistration schema 迁移

**修改文件**：`apps/api/prisma/tenant.schema.prisma`

```prisma
model WarrantyRegistration {
  id               String    @id @default(cuid())
  customerId       String
  customer         Customer  @relation(fields: [customerId], references: [id])
  productSku       String
  serialNumber     String
  purchaseDate     DateTime
  platform         String?              // Amazon / Walmart / Other
  shopOrderId      String?              // 平台订单号（选填）
  invoiceImageUrl  String?              // Cloudinary authenticated URL（选填）
  invoicePublicId  String?              // 用于 signUrl()
  warrantyExpiresAt DateTime?           // 购买日期 + 保修期（从 Product 元数据读取，默认 1 年）
  reminderSentAt   DateTime?            // 30 天提醒发送时间戳
  status           String    @default("active")   // active / expired / cancelled
  registeredAt     DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}
```

生成 Prisma 迁移文件，格式：`add_warranty_registration_fields_YYYYMMDDHHMMSS`。

**验收**：`pnpm prisma migrate dev --schema=... --name=add_warranty_fields` 成功；Prisma client 类型更新。

---

### W36：手册下载（3–4 天）

#### 架构设计

```
[Portal] GET /manual?brand=homtone&sku=HT-001&locale=es
       → [API] ManualController (public, no auth)
       → ManualService.getManualUrl(brand, sku, locale)
           → DB: Article.manualUrl (已有字段) 或 ProductManual 新表
           → 返回 Cloudinary public URL（直接跳转）
```

**假设**：手册 PDF 已由运营通过后台上传到 Cloudinary（`POST /upload` 复用现有接口 + 新增 PDF MIME 支持），URL 存入 `Article` 表 `manualUrl` 字段（按 locale 分字段，如 `manualUrlEn/manualUrlEs/manualUrlFr`）或独立 `ProductManual` 表。

**推荐**：独立 `ProductManual` 表，字段 `(productId, locale, cloudinaryPublicId, secureUrl)`，支持每语言独立管理。

#### 后端实现

**新建文件**：`apps/api/src/customer-portal/manual/manual.controller.ts`、`manual.service.ts`、`manual.module.ts`

```typescript
// GET /customer/manuals?sku=HT-001&locale=es
// No auth required，公开访问
// @RequireFeatureFlag('manual_download')
// @Throttle({ default: { limit: 20, ttl: 60000 } })
```

schema 迁移（`tenant.schema.prisma`）：

```prisma
model ProductManual {
  id          String   @id @default(cuid())
  productSku  String
  locale      String   // en / es / fr
  filename    String
  publicId    String   // Cloudinary public_id
  secureUrl   String   // Cloudinary secure_url
  uploadedAt  DateTime @default(now())

  @@unique([productSku, locale])
}
```

#### 前端实现

**新建文件**：`apps/portal/app/[locale]/(public)/manuals/page.tsx`

- SKU 选择器（来自 products 列表）+ 语言 Tabs（EN/ES/FR，根据 market locale 预选）
- 下载按钮 → `window.open(manualUrl, '_blank')`（浏览器直接打开 / 下载 PDF）
- 无需登录，`BrandHeader` + `BrandFooter` 包裹

**验收**：5 款产品 × 3 语言抽测，手册可下载；404 时返回友好提示；限流 20 次/分钟生效。

---

### W36–W37：保修注册（6–7 天）

#### 架构设计

```
[Portal] /(protected)/warranty/new
       → 表单提交 multipart/form-data
       → [API] POST /customer/warranties
               @UseGuards(CustomerGuard)
               @RequireFeatureFlag('warranty_registration')
       → WarrantyService.register(customerId, dto, invoiceFile?)
           → CloudinaryService.uploadPrivate(invoiceFile, brand, 'warranty', warrantyId)
           → DB: prisma.warrantyRegistration.create()
           → MailService.sendWarrantyConfirmation(customer.email, locale, warranty)
           → 异步：BullMQ enqueue warranty-reminder job (delay = warrantyExpiresAt - 30d)
       → 返回 { id, warrantyExpiresAt }
```

#### 后端实现

**新建文件**：

- `apps/api/src/customer-portal/warranty/warranty.controller.ts`
- `apps/api/src/customer-portal/warranty/warranty.service.ts`
- `apps/api/src/customer-portal/warranty/dto/create-warranty.dto.ts`
- `apps/api/src/customer-portal/warranty/warranty-reminder.processor.ts`

**DTO**：

```typescript
class CreateWarrantyDto {
  @IsString() productSku: string;
  @IsString() serialNumber: string;
  @IsISO8601() purchaseDate: string;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() shopOrderId?: string;
  // invoiceFile 通过 @UploadedFile() 注入
}
```

**BullMQ 队列**（复用 MigrationModule 中已有的 BullMQ 基础设施）：

```typescript
// warranty-reminder.processor.ts
@Processor('warranty-reminder')
export class WarrantyReminderProcessor extends WorkerHost {
  async process(job: Job<{ warrantyId: string; locale: string }>) {
    const warranty = await this.prisma.warrantyRegistration.findUnique(...)
    if (warranty && !warranty.reminderSentAt) {
      await this.mail.sendWarrantyExpiryReminder(...)
      await this.prisma.warrantyRegistration.update({ reminderSentAt: new Date() })
    }
  }
}
```

延迟计算：`delay = warrantyExpiresAt.getTime() - Date.now() - 30 * 24 * 3600 * 1000`；若 `delay <= 0`（购买日期接近到期）则立即入队。

#### 邮件模板

**修改文件**：`apps/api/src/mail/mail.service.ts`

```typescript
async sendWarrantyConfirmation(to: string, locale: string, brandId: string, data: {
  productSku: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyExpiresAt: string;
}): Promise<void>

async sendWarrantyExpiryReminder(to: string, locale: string, brandId: string, data: {
  productSku: string;
  warrantyExpiresAt: string;
  renewUrl: string;
}): Promise<void>
```

i18n 邮件模板（inline HTML，按 locale 切换）：

- `en`：默认英文模板
- `es`：西班牙语模板
- `fr`：法语模板

**品牌动态字段**（复用已有模式）：

- from 地址：`SystemConfig.key = "mail.from.{brandId}"`
- logo URL：`SystemConfig.key = "brand.logo_url.{brandId}"`

#### 前端实现

**新建文件**：`apps/portal/app/[locale]/(protected)/warranty/new/page.tsx`

表单字段：

1. 产品型号（select，从 products API 拉取）
2. 序列号（text，必填）
3. 购买日期（date picker，必填）
4. 购买平台（select：Amazon / Walmart / 其他）
5. 平台订单号（text，选填）
6. 发票/购买凭证（file upload，选填，JPEG/PNG/PDF ≤ 5MB）
7. 勾选同意保修条款（checkbox，必填）

**验收**：

- 提交成功 → 跳转 `/warranty/success` + 显示到期日
- 确认邮件在 30 秒内到达
- 发票图片通过 authenticated URL 访问（非登录状态下无法直接访问 Cloudinary 链接）
- 30 天提醒邮件：可通过时间偏移本地测试（将 `warrantyExpiresAt` 设为 30 天后触发）

---

## W38：客户中心首页 + 非登录订单查询（预计 1 周）

### 客户中心首页（2–3 天）

#### 架构设计

```
/(protected)/account/page.tsx
  ├── 我的产品（My Products）→ /products（产品列表，登录后含保修状态）
  ├── 我的咨询（My Tickets） → /tickets
  ├── 找资料（Resources）    → /manuals（手册下载入口）
  └── 找订单（Order Status） → /order-status（非登录订单查询，此处作快捷入口）
```

当前 `/(public)/page.tsx` redirect 到 `/products`，需改为：

- **登录用户**：redirect 到 `/(protected)/account`
- **匿名用户**：保留 redirect 到 `/products` 或展示品牌 landing

**新建文件**：`apps/portal/app/[locale]/(protected)/account/page.tsx`

UI 设计（4 区块卡片 grid）：

```tsx
<div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
  <AccountBlock
    icon={<Package />}
    title={t('account.my_products')}
    description={t('account.my_products_desc')}
    href="/products"
    badge={warrantyCount > 0 ? `${warrantyCount} 个保修中` : undefined}
  />
  {/* 类似的 3 个 Block */}
</div>
```

数据预取（并行 fetch，SSR + Suspense）：

- `GET /customer/tickets?limit=1` → badge 数字（待回复工单数）
- `GET /customer/warranties` → badge 数字（活跃保修数）

**验收**：4 区块加载 < 2s；badge 数字准确；移动端 2 列布局正常。

---

### 非登录订单状态查询（3–4 天）

#### 架构设计

```
[Portal] /(public)/order-status
  → 表单：平台订单号 + 邮箱 + Turnstile token
  → POST /customer/order-lookup
      @Throttle({ default: { limit: 5, ttl: 60000 } })  ← 1 分钟 5 次（覆盖全局 15min/5次）
      无需 CustomerGuard（公开接口）
  → OrderLookupService.lookup(orderNumber, email, brand)
      → IP 限流检查（独立 Redis key，滑动窗口）
      → Cloudflare Turnstile server-side verify
      → LingxingClient.orders.queryByNumber(orderNumber)
      → 结果脱敏（只返回：状态/物流号/预计到达 — 不返回完整地址）
      → DB: OrderLookup.create({ orderNumber, ip: hash(ip), resultStatus })
  → 返回 { status, trackingNumber, estimatedDelivery } | { notFound: true }
```

#### 后端实现

**① LingxingClient 扩展**

**新建文件**：`packages/lingxing-client/src/operations/orders.ts`

```typescript
export class OrdersOperations {
  constructor(private readonly client: LingxingHttpClient) {}

  async queryByNumber(params: {
    orderNumber: string;
    startDate?: string;
    endDate?: string;
  }): Promise<LingxingOrder | null>;
}
```

在 `LingxingClient` 主类中注入 `public readonly orders: OrdersOperations`。

> **注意**：领星 ERP API 路径需查阅领星开放平台文档确认，建议路径：`GET /erp/sc/orders` with `?order_id={orderNumber}`。如领星无此接口，则降级为在 yaemartOS DB 中查询已同步的订单镜像数据。

**② Turnstile 服务端验证**

**新建文件**：`apps/api/src/common/captcha/turnstile.service.ts`

```typescript
@Injectable()
export class TurnstileService {
  async verify(token: string, ip: string): Promise<boolean> {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: this.config.get('TURNSTILE_SECRET_KEY'),
        response: token,
        remoteip: ip,
      }),
    });
    const data = await res.json();
    return data.success === true;
  }
}
```

环境变量：`TURNSTILE_SITE_KEY`（前端用）、`TURNSTILE_SECRET_KEY`（后端用）

**③ OrderLookupController + Service**

**新建文件**：

- `apps/api/src/customer-portal/order-lookup/order-lookup.controller.ts`
- `apps/api/src/customer-portal/order-lookup/order-lookup.service.ts`

```
POST /customer/order-lookup
Body: { orderNumber: string, email: string, turnstileToken: string }
Headers: CF-Connecting-IP（Cloudflare 代理 IP）
```

脱敏规则：

- ✅ 返回：`orderStatus`（Pending/Shipped/Delivered）、`trackingNumber`、`estimatedDelivery`
- ❌ 不返回：收件人姓名、完整收件地址、支付金额、支付方式

OrderLookup DB log 字段：

- `ip`：`sha256(rawIp + LOOKUP_IP_SALT)` 匿名化
- `resultStatus`：`found` | `not_found` | `rate_limited` | `captcha_failed`

#### 前端实现

**新建文件**：`apps/portal/app/[locale]/(public)/order-status/page.tsx`

```tsx
// Turnstile widget
import { Turnstile } from '@marsidev/react-turnstile'; // 推荐库

<form onSubmit={handleSubmit}>
  <Input name="orderNumber" placeholder={t('order.number_placeholder')} />
  <Input name="email" type="email" placeholder={t('order.email_placeholder')} />
  <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
  <Button type="submit">{t('order.lookup_btn')}</Button>
</form>;
```

结果展示：

- 找到 → 状态卡片（带物流信息）
- 未找到 → 提示联系客服（附工单入口链接）
- 限流 → 提示稍后再试

**验收（M-12 防爆破通过）**：

- 1 分钟内超过 5 次请求 → `429 Too Many Requests`
- Turnstile token 无效 → `403 Forbidden`（不消耗限流次数）
- 5 平台真实订单号抽样查询成功
- 查询结果不含完整收件地址（安全测试）

---

## W39：Feature Flag 三维灰度 + S3 上线

### Feature Flag 扩展（1 天）

**当前状态**：`FeatureFlagService.isEnabled(flag, brand)` 仅支持 brand 一维。

**W39 要求**：`brand × market × language` 三维精准灰度（例如：只对 Homtone 美国英文用户开放）。

**修改文件**：`apps/api/src/common/feature-flag/feature-flag.service.ts`

```typescript
async isEnabled(
  flag: string,
  context: { brand?: string; market?: string; language?: string }
): Promise<boolean>
```

优先级查找链（高 → 低）：

```
feature_flag.{FLAG}.{brand}.{market}.{language}  ← 新增（最精确）
feature_flag.{FLAG}.{brand}.{market}             ← 新增
feature_flag.{FLAG}.{brand}                      ← 已有
feature_flag.{FLAG}                              ← 已有
FEATURE_{FLAG}_{BRAND}_{MARKET}                  ← 新增 env 变量
FEATURE_{FLAG}_{BRAND}                           ← 已有 env 变量
FEATURE_{FLAG}                                   ← 已有 env 变量
false                                            ← 默认关闭
```

**验收**：三维 key 覆盖单元测试；现有二维 key 行为不变（向后兼容）。

### S3 上线清单

**Feature flag 初始值（DB SystemConfig，Homtone + Spoonlemon 先行）**：

```sql
-- 手册下载：两品牌开放
INSERT INTO system_config (key, value) VALUES
  ('feature_flag.MANUAL_DOWNLOAD.homtone', 'true'),
  ('feature_flag.MANUAL_DOWNLOAD.spoonlemon', 'true');

-- 保修注册：仅 Homtone 先行
INSERT INTO system_config (key, value) VALUES
  ('feature_flag.WARRANTY_REGISTRATION.homtone', 'true');

-- 订单查询：两品牌开放（公开功能）
INSERT INTO system_config (key, value) VALUES
  ('feature_flag.ORDER_LOOKUP.homtone', 'true'),
  ('feature_flag.ORDER_LOOKUP.spoonlemon', 'true');
```

**上线 checklist**：

```
[ ] 所有 5 模块 feature flag 已按品牌配置
[ ] Cloudinary PDF 上传实测（至少 1 款手册）
[ ] 保修注册全链路实测（提交 → 确认邮件到达）
[ ] 非登录订单查询限流测试（第 6 次请求被拒）
[ ] Turnstile 在两品牌门户均正常显示
[ ] 20 名 beta 用户邀请邮件发出
[ ] Homtone + Spoonlemon 门户 SSL 验证
[ ] S3 上线录屏（用于 PM 汇报）
[ ] 反馈收集表单（Google Forms）链接嵌入首页
```

**验收（切片末 S3 交付标准）**：

- 20 人 beta 试用，2 品牌 × 2 平台 × 美国（EN/ES/FR）
- 手册下载率 ≥ M-11 相关指标
- 保修注册成功率 ≥ 95%
- 非登录订单查询 M-12 防爆破通过

---

## 风险与缓解

| 风险                                       | 严重度 | 缓解方案                                                                                                            |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| 领星 API 无订单查询接口                    | 高     | 降级方案：查 yaemartOS 本地已同步的 `OrderMirror` 表；如无则 W38 订单查询改为"提交邮件通知"方式                     |
| Cloudflare Turnstile 在某些网络不可用      | 中     | 降级：纯 `ThrottlerGuard` IP 限速（不做 CAPTCHA 验证），W39 后补                                                    |
| BullMQ 延迟 job 精度（Redis 节点重启）     | 中     | 补偿：cron job 每天凌晨扫描 `warrantyExpiresAt BETWEEN NOW()+30d AND NOW()+31d AND reminderSentAt IS NULL` 兜底发送 |
| 保修发票 Cloudinary authenticated URL 过期 | 低     | signUrl TTL 设 7 天，按需 re-sign；管理后台视图由后端实时 re-sign 后下发                                            |
| 30 天提醒 BullMQ job 丢失（重启）          | 低     | 每天 cron 补偿扫描（见上），确保最终送达                                                                            |

---

## 技术债 / 预留

- **ADR-007 Cloudinary folder 规范**：当前 `uploadBuffer()` 使用 `yaemartos/{brand}/`，与 ADR 要求的 `{env}/{brand}/{asset_type}/{identifier}` 不符。W36 新增的 `uploadRaw/uploadPrivate` 按 ADR 规范实现，旧 `uploadBuffer()` 遗留路径在 S4 Sprint 中统一迁移。
- **MailService 多语言系统**：当前 `sendVerification()` hardcode `locale: 'zh'`。W36 新增的保修邮件方法实现真正的 locale 切换，旧邮件方法留 TODO comment 标记技术债。
- **20 用户维度 Feature Flag**：`FeatureFlagService` 扩展至三维后仍不支持 userId 级别灰度。W39 20 人 beta 采用邀请制（后台手动拉白名单 customerId），userId 级灰度在 S4 补充。

---

## 任务排期参考

| 天次      | 任务                                                                    | 负责人建议 |
| --------- | ----------------------------------------------------------------------- | ---------- |
| W36 D1–D2 | T-0: CloudinaryService.uploadRaw/uploadPrivate + PDF MIME               | 后端       |
| W36 D1–D2 | T-1: WarrantyRegistration schema 迁移 + ProductManual 表                | 后端       |
| W36 D3–D5 | 手册下载后端（ManualController + ManualService）+ 前端页面              | 全栈       |
| W37 D1–D3 | 保修注册后端（WarrantyController + Service + BullMQ）+ MailService 模板 | 后端       |
| W37 D3–D5 | 保修注册前端页面 + 发票上传 + 成功页                                    | 前端       |
| W38 D1    | LingxingClient.orders 扩展 + TurnstileService                           | 后端       |
| W38 D2–D3 | OrderLookupController + Service + OrderLookup DB log                    | 后端       |
| W38 D2–D4 | 客户中心首页（4 区块）+ order-status 页面 + Turnstile widget            | 前端       |
| W39 D1    | FeatureFlagService 三维扩展 + 单元测试                                  | 后端       |
| W39 D2–D3 | SystemConfig feature flag 初始值写入 + 上线 checklist 逐项验收          | 全栈       |
| W39 D4–D5 | 20 用户 beta 上线 + 录屏 + 反馈收集                                     | 全员       |
