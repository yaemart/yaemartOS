# 领星 OpenAPI 字段映射表

> 版本：v1.0 | 关联：ADR-004 §2.7 / `packages/lingxing-client`  
> 用途：定义领星 ERP OpenAPI 响应字段 → `product_content` / `listing` / `product` 数据库列的完整映射关系。  
> 维护人：dev #2（后端）+ 运营 PM（字段语义确认）  
> 更新时机：领星 API 版本升级、或新增业务字段时同步更新。

---

## 目录

1. [领星 API 端点总览](#1-领星-api-端点总览)
2. [产品基础信息映射（`/erp/sc/product`）](#2-产品基础信息映射)
3. [Listing 内容映射（`/erp/sc/mws/listing`）](#3-listing-内容映射)
4. [订单数据映射（`/erp/sc/sale/order`）](#4-订单数据映射)
5. [库存数据映射（`/erp/sc/fba/inventory`）](#5-库存数据映射)
6. [广告数据映射（`/erp/sc/ad/sp/campaigns`）](#6-广告数据映射)
7. [字段同步策略与冲突处理](#7-字段同步策略与冲突处理)
8. [未映射字段 & 领星独有字段](#8-未映射字段--领星独有字段)
9. [数据类型转换规则](#9-数据类型转换规则)

---

## 1. 领星 API 端点总览

| 端点路径                          | 说明                | 同步方向                     | 同步频率            |
| --------------------------------- | ------------------- | ---------------------------- | ------------------- |
| `GET /erp/sc/product`             | 产品基础信息        | 领星 → yaemartOS             | 每日全量 / 实时增量 |
| `GET /erp/sc/mws/listing`         | Amazon Listing 内容 | 领星 → yaemartOS（只读参考） | 每日全量            |
| `GET /erp/sc/sale/order`          | 订单数据            | 领星 → yaemartOS（只读缓存） | 每小时增量          |
| `GET /erp/sc/fba/inventory`       | FBA 库存快照        | 领星 → yaemartOS（只读缓存） | 每 15 分钟          |
| `GET /erp/sc/ad/sp/campaigns`     | SP 广告活动         | 领星 → yaemartOS（只读参考） | 每日全量            |
| `POST /erp/sc/mws/listing/submit` | 提交 Listing 到平台 | yaemartOS → 领星 → Amazon    | 按需触发            |

> **只读缓存**：yaemartOS 不修改该数据，仅做展示和分析。  
> **按需触发**：由运营手动或 AI Agent 发起，经人工确认门控。

---

## 2. 产品基础信息映射

**领星端点**：`GET /erp/sc/product?page={n}&limit=200`

### 2.1 `product` 表映射

| 领星字段（API 响应） | 领星字段说明         | yaemartOS 列（`product`）    | 类型转换           | 备注                              |
| -------------------- | -------------------- | ---------------------------- | ------------------ | --------------------------------- |
| `product_id`         | 领星产品 ID          | `lingxing_product_id`        | string             | 外部 ID，唯一索引                 |
| `seller_sku`         | 卖家 SKU             | `sku`                        | string             | 主要产品标识                      |
| `asin`               | Amazon ASIN          | `asin`                       | string             | 可空（新品上架前无）              |
| `product_name`       | 产品名称（运营内部） | `internal_name`              | string             | 非 listing title                  |
| `brand_name`         | 品牌名               | 关联 `brand.name`            | string → FK        | 映射到 brand 表                   |
| `category_id`        | 领星品类 ID          | `lingxing_category_id`       | string             | 用于品类模板匹配                  |
| `category_name`      | 品类名称             | `category_path`              | string             | 如 `Kitchen > Slow Cookers`       |
| `image_url`          | 主图 URL             | `cover_image_url`            | string             | 仅存引用，不镜像图片到 Cloudinary |
| `status`             | 产品状态             | `sync_status`                | enum 映射 ↓        |                                   |
| `weight_g`           | 重量（克）           | `weight_grams`               | int                |                                   |
| `length_cm`          | 长度（厘米）         | `length_cm`                  | decimal(8,2)       |                                   |
| `width_cm`           | 宽度                 | `width_cm`                   | decimal(8,2)       |                                   |
| `height_cm`          | 高度                 | `height_cm`                  | decimal(8,2)       |                                   |
| `cost_price`         | 成本价               | `cost_price`                 | decimal(10,4)      | **IAM 敏感字段**，仅 ADMIN 可见   |
| `created_at`         | 创建时间（领星）     | `lingxing_created_at`        | ISO8601 → DateTime |                                   |
| `updated_at`         | 更新时间（领星）     | `lingxing_updated_at`        | ISO8601 → DateTime | 用于增量同步判断                  |
| `marketplace_id`     | 市场 ID              | 关联 `market.marketplace_id` | string → FK        |                                   |

**`status` 枚举映射**：

| 领星 `status` 值 | yaemartOS `sync_status` |
| ---------------- | ----------------------- |
| `1` 在售         | `active`                |
| `2` 下架         | `inactive`              |
| `3` 清货         | `clearance`             |
| `4` 停售         | `discontinued`          |
| 其他 / 未知      | `unknown`               |

### 2.2 `product_content` 表映射（产品内容）

> `product_content` 存储 AI 生成或运营填写的 listing 内容草稿，与领星 listing 内容分层管理。

| 领星字段                               | 领星字段说明 | yaemartOS 列（`product_content`） | 类型转换         | 备注                                 |
| -------------------------------------- | ------------ | --------------------------------- | ---------------- | ------------------------------------ |
| `product_name`                         | 内部名称     | `source_internal_name`            | string           | 作为 AI 生成 title 的基础输入        |
| `category_name`                        | 品类         | `source_category`                 | string           | 用于选择品类模板                     |
| `image_url`                            | 主图         | `source_image_url`                | string           | AI 多模态输入参考                    |
| `brand_name`                           | 品牌         | `source_brand`                    | string           |                                      |
| `weight_g`                             | 重量         | `spec_weight`                     | string（格式化） | 如 `"3.5 lbs"`                       |
| `length_cm` / `width_cm` / `height_cm` | 尺寸         | `spec_dimensions`                 | JSON             | `{"l":30,"w":20,"h":25,"unit":"cm"}` |
| `cost_price`                           | 成本         | **不同步到 product_content**      | —                | 成本不进入内容层                     |

---

## 3. Listing 内容映射

**领星端点**：`GET /erp/sc/mws/listing?seller_sku={sku}&marketplace_id={id}`

> **重要**：领星 listing 内容是从 Amazon MWS 同步来的**现有线上版本**，用作参考基准（`source: lingxing`），不直接覆盖 yaemartOS 运营团队编辑的内容。

### 3.1 `listing` 表映射

| 领星字段              | 领星字段说明    | yaemartOS 列（`listing`）    | 类型转换           | 备注                                 |
| --------------------- | --------------- | ---------------------------- | ------------------ | ------------------------------------ |
| `asin`                | ASIN            | `platform_listing_id`        | string             |                                      |
| `seller_sku`          | 卖家 SKU        | 关联 `product.sku`           | string → FK        |                                      |
| `marketplace_id`      | 市场 ID         | 关联 `market.marketplace_id` | string → FK        |                                      |
| `shop_id`             | 领星店铺 ID     | `lingxing_shop_id`           | string             | 用于 IAM shop 维度                   |
| `title`               | Listing 标题    | `content.title`              | string             | 存入 `listing_version.content` JSONB |
| `bullet_points`       | 五点描述        | `content.bullet_points`      | string[] → JSONB   | 领星返回 array                       |
| `description`         | 产品描述        | `content.description`        | string             |                                      |
| `search_terms`        | 后台关键词      | `content.search_terms`       | string[] → JSONB   |                                      |
| `main_image_url`      | 主图 URL        | `content.main_image_url`     | string             |                                      |
| `other_images`        | 辅图 URL 列表   | `content.other_images`       | string[] → JSONB   |                                      |
| `a_plus_content`      | A+ 内容（如有） | `content.a_plus_content`     | JSONB              | 结构依模板而定                       |
| `listing_status`      | 上架状态        | `status`                     | enum 映射 ↓        |                                      |
| `price`               | 售价            | `price`                      | decimal(10,4)      |                                      |
| `fulfillment_channel` | 配送方式        | `fulfillment_channel`        | string             | `FBA` / `FBM`                        |
| `open_date`           | 上架时间        | `platform_created_at`        | ISO8601 → DateTime |                                      |
| `last_updated_time`   | 最后更新时间    | `lingxing_synced_at`         | ISO8601 → DateTime |                                      |

**`listing_status` 枚举映射**：

| 领星 `listing_status` | yaemartOS `listing.status` |
| --------------------- | -------------------------- |
| `Active`              | `active`                   |
| `Inactive`            | `inactive`                 |
| `Incomplete`          | `draft`                    |
| `Suppressed`          | `suppressed`               |
| `Deleted`             | `archived`                 |
| 其他                  | `unknown`                  |

### 3.2 `listing_version` 表（历史版本）

领星同步的内容作为 `source = 'lingxing_sync'` 的初始版本存入：

```typescript
// packages/lingxing-client/src/sync/listing-sync.ts
await prisma.listingVersion.upsert({
  where: { listingId_versionNumber: { listingId, versionNumber: 1 } },
  update: { content: mappedContent, syncedAt: new Date() },
  create: {
    listingId,
    versionNumber: 1,
    source: 'lingxing_sync',
    content: mappedContent,
    createdBy: 'system:lingxing-sync',
  },
});
```

---

## 4. 订单数据映射

**领星端点**：`GET /erp/sc/sale/order?start_date={}&end_date={}&marketplace_id={}`

> 订单数据仅缓存到 yaemartOS Redis（TTL 1h），不持久化到 PostgreSQL。  
> Customer Portal 的 `OrderLookup` 功能通过 `LingxingClient` 实时查询。

| 领星字段                  | 说明             | yaemartOS 缓存字段   | 备注                   |
| ------------------------- | ---------------- | -------------------- | ---------------------- |
| `order_id`                | Amazon 订单号    | `orderId`            | 缓存 key               |
| `buyer_email`             | 买家邮箱（脱敏） | `buyerEmailHash`     | MD5 哈希，用于匿名匹配 |
| `purchase_date`           | 下单时间         | `purchaseDate`       | ISO8601                |
| `order_status`            | 订单状态         | `status`             | 见下表                 |
| `fulfillment_channel`     | 配送方式         | `fulfillmentChannel` | `FBA` / `FBM`          |
| `tracking_number`         | 物流单号         | `trackingNumber`     |                        |
| `carrier_code`            | 快递公司         | `carrierCode`        |                        |
| `estimated_delivery_date` | 预计送达         | `estimatedDelivery`  |                        |
| `items[].asin`            | 商品 ASIN        | `items[].asin`       |                        |
| `items[].quantity`        | 数量             | `items[].quantity`   | int                    |
| `items[].item_price`      | 单价（USD）      | `items[].price`      | decimal                |
| `marketplace_id`          | 市场             | `marketplaceId`      |                        |

**`order_status` 枚举映射（对外展示用）**：

| 领星 `order_status` | Customer Portal 展示文案 |
| ------------------- | ------------------------ |
| `Pending`           | Order Received           |
| `Unshipped`         | Processing               |
| `Shipped`           | Shipped                  |
| `Delivered`         | Delivered                |
| `Canceled`          | Cancelled                |
| `Refunded`          | Refunded                 |

---

## 5. 库存数据映射

**领星端点**：`GET /erp/sc/fba/inventory?marketplace_id={}`

> 库存快照缓存到 Redis（TTL 15min），同时写入 PostgreSQL `inventory_snapshot` 表（保留 90 天历史）。

| 领星字段                 | 说明     | yaemartOS 列 / 缓存字段 | 类型     | 备注             |
| ------------------------ | -------- | ----------------------- | -------- | ---------------- |
| `seller_sku`             | 卖家 SKU | `sku`                   | string   | 关联 `product`   |
| `asin`                   | ASIN     | `asin`                  | string   |                  |
| `marketplace_id`         | 市场     | `marketplace_id`        | string   |                  |
| `fulfillable_quantity`   | 可售库存 | `fba_available`         | int      | FBA 可售量       |
| `inbound_quantity`       | 在途库存 | `fba_inbound`           | int      | 发往 FBA 途中    |
| `reserved_quantity`      | 预留库存 | `fba_reserved`          | int      | 已预留（待发货） |
| `unfulfillable_quantity` | 不可售   | `fba_unfulfillable`     | int      | 损坏/过期等      |
| `total_quantity`         | 总库存   | `fba_total`             | int      | 自动计算字段     |
| `days_of_supply`         | 可售天数 | `days_of_supply`        | int      | 领星计算值       |
| `snapshot_time`          | 快照时间 | `snapshot_at`           | DateTime | 写入时打时间戳   |

**库存预警阈值**（由运营在 yaemartOS 配置，非领星字段）：

```sql
-- product_inventory_config 表（yaemartOS 自有）
low_stock_threshold   INT DEFAULT 50    -- 低库存告警线（天）
reorder_point         INT DEFAULT 30    -- 补货触发点（天）
```

---

## 6. 广告数据映射

**领星端点**：`GET /erp/sc/ad/sp/campaigns?marketplace_id={}&date_range={}`

> 广告数据仅读取展示（Dashboard），不在 yaemartOS 修改广告设置（广告操作仍在领星进行）。

| 领星字段         | 说明           | yaemartOS Dashboard 字段 | 备注                              |
| ---------------- | -------------- | ------------------------ | --------------------------------- |
| `campaign_id`    | 广告活动 ID    | `campaignId`             |                                   |
| `campaign_name`  | 活动名称       | `name`                   |                                   |
| `campaign_type`  | 类型           | `type`                   | `SP` / `SB` / `SD`                |
| `targeting_type` | 投放方式       | `targetingType`          | `AUTO` / `MANUAL`                 |
| `state`          | 状态           | `status`                 | `enabled` / `paused` / `archived` |
| `daily_budget`   | 日预算（USD）  | `dailyBudget`            | decimal                           |
| `spend`          | 花费（期间）   | `spend`                  | decimal                           |
| `sales`          | 销售额（期间） | `sales`                  | decimal                           |
| `acos`           | ACOS           | `acos`                   | `spend/sales * 100`，百分比       |
| `roas`           | ROAS           | `roas`                   | `sales/spend`                     |
| `impressions`    | 曝光量         | `impressions`            | int                               |
| `clicks`         | 点击量         | `clicks`                 | int                               |
| `ctr`            | 点击率         | `ctr`                    | `clicks/impressions * 100`        |
| `orders`         | 广告订单数     | `orders`                 | int                               |
| `cvr`            | 转化率         | `cvr`                    | `orders/clicks * 100`             |
| `date`           | 数据日期       | `reportDate`             | ISO8601 date                      |
| `marketplace_id` | 市场           | `marketplaceId`          |                                   |
| `shop_id`        | 店铺           | `shopId`                 |                                   |

---

## 7. 字段同步策略与冲突处理

### 7.1 同步优先级规则

```
yaemartOS 编辑 > 领星同步
```

| 场景                                | 处理规则                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------- |
| yaemartOS 用户已编辑某字段          | 保留 yaemartOS 值，忽略领星同步值                                         |
| yaemartOS 字段为空 / 初始状态       | 以领星同步值填充                                                          |
| 领星侧字段更新（`updated_at` 更新） | 若 yaemartOS `is_manually_edited = false`，则更新；否则跳过并记录冲突日志 |
| 双方均有值且不一致                  | 记录 `sync_conflict` 事件，发送 Slack 通知，人工确认                      |

### 7.2 字段锁定标记

`product_content` 表中，每个可编辑字段对应一个锁定标记：

```sql
-- 示例：title 字段锁定
title              TEXT,
title_locked       BOOLEAN NOT NULL DEFAULT false,  -- true = 运营手动锁定，不被同步覆盖
title_last_edited  TIMESTAMPTZ,
title_edited_by    UUID REFERENCES users(id),
```

### 7.3 冲突日志

```sql
-- sync_conflict_log 表
CREATE TABLE sync_conflict_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL,                    -- 'product' | 'listing'
  entity_id     UUID NOT NULL,
  field_name    TEXT NOT NULL,
  lingxing_value   TEXT,
  local_value      TEXT,
  resolved_by      TEXT,                          -- 'system:keep_local' | user_id
  resolved_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 8. 未映射字段 & 领星独有字段

以下领星字段当前**不映射**到 yaemartOS，原因标注：

| 领星字段            | 原因                                   |
| ------------------- | -------------------------------------- |
| `erp_internal_note` | 领星内部备注，运营在领星维护           |
| `purchase_order_id` | 采购单 ID，属于供应链层，当前 scope 外 |
| `supplier_id`       | 供应商 ID，v2.x 供应链模块再议         |
| `label_template_id` | 标签模板，领星内部功能                 |
| `shipment_id`       | 入库计划 ID，FBA 发货流程，领星负责    |
| `review_count`      | 评论数（需 Amazon SP-API 直连）        |
| `review_rating`     | 评分（同上）                           |
| `competitor_asin_*` | 竞品数据，领星付费插件，按需开启       |

> 如需扩展映射，在 `LingxingFieldMapper` 中添加对应 `transform` 方法，并在此文档新增行。

---

## 9. 数据类型转换规则

| 领星数据类型                                  | yaemartOS 类型  | 转换规则                            |
| --------------------------------------------- | --------------- | ----------------------------------- |
| 领星时间戳（秒级 Unix）                       | `DateTime`      | `new Date(ts * 1000)`               |
| 领星时间字符串（`2024-01-15T08:00:00+08:00`） | `DateTime`      | `parseISO()` → UTC 存储             |
| 领星金额（分，整数）                          | `Decimal(10,4)` | `amount / 100`                      |
| 领星金额（浮点字符串，如 `"19.99"`）          | `Decimal(10,4)` | `parseFloat()` → `Prisma.Decimal`   |
| `null` / 空字符串 `""`                        | `null`          | 统一转 `null`                       |
| 领星布尔 `0` / `1`                            | `boolean`       | `Boolean(n)`                        |
| 领星数组（逗号分隔字符串）                    | `string[]`      | `str.split(',').map(s => s.trim())` |
| 领星图片尺寸（如 `"500*500"`）                | `{w,h}`         | 按 `*` 分割                         |

### 转换实现参考

```typescript
// packages/lingxing-client/src/mappers/field-transformer.ts

export const LingxingTransformers = {
  /** 秒级时间戳 → Date */
  timestampToDate: (ts: number | null) => (ts ? new Date(ts * 1000) : null),

  /** 分 → 元（Decimal 字符串，避免浮点精度丢失） */
  centsToDecimal: (cents: number | null) => (cents != null ? (cents / 100).toFixed(4) : null),

  /** 浮点字符串 → Prisma Decimal 安全字符串 */
  priceString: (s: string | null) => (s ? parseFloat(s).toFixed(4) : null),

  /** 0/1 → boolean */
  boolInt: (n: number | null) => (n != null ? Boolean(n) : null),

  /** 逗号分隔 → string[] */
  csvToArray: (s: string | null) =>
    s
      ? s
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],

  /** 领星 status int → yaemartOS status string */
  productStatus: (n: number): string => {
    const map: Record<number, string> = {
      1: 'active',
      2: 'inactive',
      3: 'clearance',
      4: 'discontinued',
    };
    return map[n] ?? 'unknown';
  },

  /** 领星 listing_status string → yaemartOS status */
  listingStatus: (s: string | null): string => {
    const map: Record<string, string> = {
      Active: 'active',
      Inactive: 'inactive',
      Incomplete: 'draft',
      Suppressed: 'suppressed',
      Deleted: 'archived',
    };
    return s ? (map[s] ?? 'unknown') : 'unknown';
  },
};
```
