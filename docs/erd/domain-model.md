# yaemartOS 领域模型 ERD

> 版本：v1.0（对应实施方案 W2）  
> 最后更新：2026-04-30  
> 关联：`docs/adr/ADR-001-tech-stack.md` §2.3、实施方案 §6 W2

---

## Schema 边界

```
PostgreSQL (Neon)
├── public              ← 运营域（内部系统数据，38 名运营人员）
└── homtone             ← 客户域 tenant schema（Homtone 品牌客户数据）
    spoonlemon          ← 客户域 tenant schema
    davivy              ← 客户域 tenant schema
    tysun               ← 客户域 tenant schema
```

**关键隔离原则**：运营域与客户域 schema 之间无外键关联。客户域查询必须强制带 schema 前缀过滤，禁止跨 tenant 访问。

---

## 运营域（public schema）

```mermaid
erDiagram
    Brand {
        uuid id PK
        string name
        string slug "homtone | spoonlemon | davivy | tysun"
        string primary_color
        string logo_cloudinary_id
        timestamp created_at
    }

    Market {
        uuid id PK
        string code "US | UK | DE | FR | ES | IT"
        string region "NA | EU"
        string[] supported_locales
    }

    Platform {
        uuid id PK
        string name "amazon | walmart"
        json field_rules "字符上限、禁用词等平台规则"
    }

    Shop {
        uuid id PK
        uuid brand_id FK
        uuid platform_id FK
        string name
        string external_shop_id "领星店铺 ID"
    }

    ShopBinding {
        uuid id PK
        uuid shop_id FK
        boolean sync_enabled
        timestamp last_synced_at
    }

    Category {
        uuid id PK
        uuid brand_id FK
        string name
        boolean requires_recipe
        json spec_params "规格参数字段定义"
        json feature_words "功能词库"
        json selling_points "卖点库"
        timestamp created_at
        timestamp updated_at
    }

    CategoryContentTemplate {
        uuid id PK
        uuid category_id FK
        string field_name "faq | recipe | bullets_template"
        text default_content
    }

    Product {
        uuid id PK
        uuid brand_id FK
        uuid category_id FK
        string name
        string model_number
        json spec_values "实际规格值（继承自 Category spec_params）"
        string status "active | discontinued"
        timestamp created_at
    }

    Article {
        uuid id PK
        uuid product_id FK
        string sku
        string asin "Amazon ASIN（可为空）"
        string upc
    }

    Listing {
        uuid id PK
        uuid product_id FK
        uuid brand_id FK
        uuid market_id FK
        uuid platform_id FK
        uuid shop_id FK
        string language "en | es | fr | de | it"
        string platform_listing_id "ASIN / Walmart Item ID"
        boolean is_primary "每组合唯一 WHERE is_primary=true"
        string traffic_strategy "primary|variant|bundle|keyword_grab|seasonal|cohort_test"
        string status "draft|review|approved|published|paused|archived"
        timestamp created_at
        timestamp updated_at
    }

    ListingVersion {
        uuid id PK
        uuid listing_id FK
        int version_number
        json content_snapshot "Title/Bullets/Desc/A+/BackendKeywords"
        string status "draft | active | archived"
        string source "manual | ai_generated | category_inherit"
        uuid created_by FK
        timestamp created_at
        timestamp published_at
    }

    User {
        uuid id PK
        string email
        string name
        string avatar_url
        string status "active | invited | disabled"
        timestamp created_at
    }

    AuditLog {
        uuid id PK
        uuid user_id FK
        string resource_type
        uuid resource_id
        string action "create | update | delete | status_change"
        json before_value
        json after_value
        timestamp created_at
    }

    AiCallLog {
        uuid id PK
        string model "gemini-2.5-pro | gemini-2.5-flash | glm-5 | ..."
        string task_type "listing_gen | faq_gen | chat_reply | ..."
        uuid brand_id FK
        uuid market_id FK
        int input_tokens
        int output_tokens
        decimal cost_usd
        int latency_ms
        timestamp created_at
    }

    Brand ||--o{ Shop : "has"
    Platform ||--o{ Shop : "hosts"
    Shop ||--o{ ShopBinding : "has"
    Brand ||--o{ Category : "owns"
    Category ||--o{ CategoryContentTemplate : "has"
    Category ||--o{ Product : "classifies"
    Brand ||--o{ Product : "owns"
    Product ||--o{ Article : "has"
    Product ||--o{ Listing : "has"
    Brand ||--o{ Listing : "belongs to"
    Market ||--o{ Listing : "targets"
    Platform ||--o{ Listing : "sold on"
    Shop ||--o{ Listing : "listed in"
    Listing ||--o{ ListingVersion : "has versions"
    User ||--o{ ListingVersion : "creates"
    User ||--o{ AuditLog : "generates"
```

---

## 双重唯一约束（Listing 表）

```sql
-- 约束 1：平台 listing ID 全局唯一（同一店铺内 ASIN 不重复）
UNIQUE (platform_id, shop_id, platform_listing_id)

-- 约束 2：每个【产品×品牌×市场×平台×店铺×语言】组合只能有一条 primary listing
CREATE UNIQUE INDEX uq_listing_primary
  ON listing (product_id, brand_id, market_id, platform_id, shop_id, language)
  WHERE is_primary = true;
```

同一产品在同一组合下可以有多条 listing（不同 ASIN/变体），但只有一条可以是 primary。

---

## 客户域（各 tenant schema，结构相同）

```mermaid
erDiagram
    Customer {
        uuid id PK
        string email "品牌内唯一（同邮箱可在 4 品牌各注册一个账户）"
        string name
        string password_hash
        string status "active | unverified | banned"
        timestamp created_at
    }

    WarrantyRegistration {
        uuid id PK
        uuid customer_id FK
        string product_model "对应运营域 Article.model_number"
        string purchase_date
        string purchase_channel
        string order_id
        string status "pending | approved | rejected"
        timestamp created_at
    }

    OrderLookup {
        uuid id PK
        string order_id "非登录用户查询，不关联 customer"
        string email
        string ip_address
        int attempt_count "防爆破，超 10 次/h 触发限流"
        timestamp queried_at
    }

    Ticket {
        uuid id PK
        uuid customer_id FK "可为空（非登录工单）"
        string subject
        string status "open | in_progress | resolved | closed"
        string category "product_issue | shipping | warranty | other"
        string locale "en | es | fr | de | it"
        timestamp created_at
        timestamp resolved_at
    }

    TicketMessage {
        uuid id PK
        uuid ticket_id FK
        string role "customer | ai | agent"
        text content
        string source "manual | ai_generated"
        timestamp created_at
    }

    ChatSession {
        uuid id PK
        uuid customer_id FK "可为空（非登录聊天）"
        string locale
        string status "active | ended"
        timestamp started_at
        timestamp ended_at
    }

    ChatMessage {
        uuid id PK
        uuid session_id FK
        string role "user | assistant"
        text content
        boolean escalated_to_human
        timestamp created_at
    }

    Customer ||--o{ WarrantyRegistration : "registers"
    Customer ||--o{ Ticket : "creates"
    Ticket ||--o{ TicketMessage : "has"
    Customer ||--o{ ChatSession : "starts"
    ChatSession ||--o{ ChatMessage : "contains"
```

---

## product_content.source 枚举与状态机

| source 值          | 含义                    | 何时出现              |
| ------------------ | ----------------------- | --------------------- |
| `manual`           | 运营人工填写            | 直接在编辑器输入      |
| `ai_generated`     | AI 生成（Gemini/GLM-5） | 点击"AI 生成"并确认后 |
| `category_inherit` | 继承品类模板默认值      | 新建产品时自动继承    |

**AI 写入规则**（审计 P0-5）：AI 只能写入 `ListingVersion.status = 'draft'`，用户手动点击"激活"后才变为 `active`。`active` 版本不可被 AI 直接覆盖。

---

## 关键设计决策说明

| 决策                | 内容                                   | 理由                                                       |
| ------------------- | -------------------------------------- | ---------------------------------------------------------- |
| 4 tenant schema     | 客户域用 4 个独立 PostgreSQL schema    | M-13 要求跨品牌 0 数据泄漏；同邮箱可在 4 品牌各独立注册    |
| ListingVersion 子表 | 每次内容修改新建 version 行，不 UPDATE | 支持版本对比、回退、审计，符合 AI 协作的 draft/active 隔离 |
| Listing 双重约束    | 两个 UNIQUE 约束而非一个               | 允许同产品多 ASIN（变体），同时保证组合内主 listing 唯一   |
| AuditLog 独立表     | 所有写操作记录 before/after            | M-10 审计覆盖率 100%；不影响业务表查询性能                 |
| AiCallLog 独立表    | S2 起记录每次 AI 调用成本              | 按品牌/任务维度做月度成本报表                              |
