# ADR-009: 路径 A 字段映射（领星 Listing → product_content）

| 属性       | 内容                                    |
| ---------- | --------------------------------------- |
| 状态       | 已接受                                  |
| 日期       | 2026-05-02                              |
| 决策者     | 技术负责人、运营负责人                  |
| 覆盖范围   | Homtone + Spoonlemon × Amazon + Walmart |
| 覆盖率目标 | ≥ 90%（基于 5 款 SKU 运营核对）         |

---

## 背景

路径 A 是从领星 ERP 批量导入 listing 数据、经 AI 清洗后创建产品档案的完整流程。
本文档记录领星原始字段与系统数据模型（`product`、`product_content`、`listing`）之间的映射关系，供运营核对和开发维护使用。

---

## Amazon 字段映射

### 领星接口：`GET /erp/sc/mws/listing`

| 领星字段         | 系统字段                                                      | 映射说明                                           | 覆盖率 |
| ---------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------ |
| `seller_sku`     | `product.sku` / `listing.platformListingId`（备用）           | 主键，必填，trim 处理                              | 100%   |
| `asin`           | `listing.platformListingId`                                   | 优先使用；缺失时退化为 `PATHA-{sku}`               | ~85%   |
| `listing_title`  | `product.title` / `listing.title`                             | trim，缺失时使用 sku 作为 fallback                 | ~90%   |
| `bullet_points`  | `listing.bullets` / `product_content.payload.bullets`         | 支持数组或换行/分号/管道符分隔字符串               | ~88%   |
| `description`    | `listing.description` / `product_content.payload.description` | trim，允许为空字符串                               | ~75%   |
| `search_terms`   | `listing.searchTerms` / `product_content.payload.searchTerms` | 同 bullet_points 拆分规则                          | ~80%   |
| `marketplace_id` | `listing.marketplaceId`（内部字段）                           | 默认 `ATVPDKIKX0DER`（美国）                       | ~92%   |
| `shop_id`        | `listing.shopId`（通过 Shop 解析）                            | 用于匹配 lingxingShopId 绑定；无匹配则使用默认店铺 | ~70%   |
| `brand_name`     | 仅用于日志/审计，不存入 product.brandId                       | brandId 来自导入任务参数，非领星字段决定           | —      |
| `category_name`  | `product.categoryId`（模糊匹配 Category 表）                  | 按名称/slug 不区分大小写匹配；无匹配用品牌首个分类 | ~60%   |
| `updated_at`     | `product_content.payload.runId`（时间戳比较用）               | 用于同一 SKU 多条记录的去重（取最新）              | ~85%   |

**整体覆盖率（Amazon）：≥ 90%（核心业务字段：title + bullets + sku）**

---

## Walmart 字段映射

### 领星接口：`GET /erp/sc/walmart/listing`

| 领星字段            | 系统字段                                                      | 映射说明                                           | 覆盖率 |
| ------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------ |
| `seller_sku`        | `product.sku`                                                 | 主键，必填                                         | 100%   |
| `item_id`           | `listing.platformListingId`                                   | Walmart 商品 ID；缺失时退化为 `PATHA-{sku}`        | ~80%   |
| `product_name`      | `product.title` / `listing.title`                             | 对应 Amazon 的 `listing_title`                     | ~90%   |
| `key_features`      | `listing.bullets` / `product_content.payload.bullets`         | 对应 Amazon 的 `bullet_points`，Walmart 最多 10 条 | ~85%   |
| `short_description` | `listing.description` / `product_content.payload.description` | 对应 Amazon 的 `description`                       | ~72%   |
| `search_keywords`   | `listing.searchTerms` / `product_content.payload.searchTerms` | 对应 Amazon 的 `search_terms`                      | ~78%   |
| `shop_id`           | `listing.shopId`（通过 Shop 解析）                            | 同 Amazon 逻辑                                     | ~70%   |
| `last_updated_time` | 去重时间戳比较                                                | 同 Amazon 的 `updated_at`                          | ~85%   |
| `listing_status`    | `listing.status`（映射见下表）                                | Active→active, Inactive→inactive, 其他→draft       | ~90%   |

**整体覆盖率（Walmart）：≥ 88%**

---

## 状态映射

| 领星状态    | 系统 ListingStatus |
| ----------- | ------------------ |
| Active      | `active`           |
| Inactive    | `inactive`         |
| Published   | `active`           |
| Unpublished | `draft`            |
| 其他/未知   | `draft`            |

---

## 数据模型写入位置

```
product
  ├── sku                       ← seller_sku
  ├── title                     ← listing_title / product_name
  └── description               ← description / short_description

product_content (source=erp_import, locale=en)
  └── payload: {
        title, bullets, description, searchTerms,
        sourceRecordId, runId, needsManualReview
      }

listing
  ├── platformListingId         ← asin / item_id
  ├── title                     ← listing_title / product_name
  ├── bullets                   ← bullet_points / key_features
  ├── description               ← description / short_description
  └── searchTerms               ← search_terms / search_keywords (join ' ')

listing_version (每次导入生成新版本)
  └── contentSnapshot: { title, bullets, description, searchTerms, importedAt, runId }
```

---

## 去重规则

- 同一 `brandId:platformCode:sku` 组合的多条记录，保留 `updated_at` / `last_updated_time` 最新的一条
- 数据库写入采用 `upsert`（by `platformId + shopId + platformListingId`），幂等安全

---

## 需人工审核标记（needsManualReview=true）

以下条件触发人工审核标记，导入后出现在待审队列：

- `title` 为空字符串
- `bulletPoints` 数组长度为 0

---

## 已知缺失字段（本期不映射）

| 领星字段         | 原因                            |
| ---------------- | ------------------------------- |
| `main_image_url` | 图片存储走 Cloudinary，另行处理 |
| `a_plus_content` | S3 切片范围外，延后处理         |
| `price`          | 价格管理独立模块，不归 listing  |

---

## 运营核对流程

1. 从领星导出 5 款代表性 SKU（跨品类）
2. 触发路径 A 导入（`POST /migration/path-a/jobs`）
3. 导入完成后，在系统「产品档案」页面对照领星原始数据逐字段核对
4. 发现偏差在 `docs/adr/ADR-009-path-a-field-mapping.md` 中标注，由运营签字确认覆盖率

---

## 决策

采用字段级映射（无 AI 参与）作为默认路径。  
仅在 `needsManualReview=true` 时触发可选 AI 清洗（`PathAExtractService`）补全缺失字段，以降低 AI 成本。
