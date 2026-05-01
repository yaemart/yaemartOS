# ADR-003：Elasticsearch Schema 与 索引策略

| 字段     | 取值                                                                |
| -------- | ------------------------------------------------------------------- |
| 状态     | Proposed（W4 实施时评审）                                           |
| 提议日期 | 2026-04-30                                                          |
| 决策日期 | _S1 W4 评审通过后填写_                                              |
| 决策人   | tech lead + dev #2                                                  |
| 关联文档 | `yaemartOS-implementation-plan.md` §3 / §6 W4 / §6 W11 / §8 W34-W35 |
| 取代     | 无                                                                  |

---

## 1. 上下文

ES 在 yaemartOS 承担三类语义/全文搜索场景：

1. **运营场景**（运营域 `public`）：产品知识库（FAQ、菜谱、规格）、Article 内容、Listing 草稿全文搜索 / 关键词推荐
2. **客户场景**（客户域 4 tenant schema）：AI 客服 Chat 命中检索、保修文档查找、订单/工单关键词搜索
3. **AI 检索增强**（RAG）：Listing 生成时拉竞品/品类/卖点 context；客服 AI 回答时拉品牌/产品 FAQ

矛盾在于：**单一 ES 集群成本最低，但 4 品牌客户域的物理隔离要求与之冲突**。需要一个折中方案。

---

## 2. 决策

### 2.1 集群部署

| 阶段            | 部署                                             |
| --------------- | ------------------------------------------------ |
| dev             | 单节点 ES 8.x（Docker compose）                  |
| staging / S1-S3 | 3 节点 ES 8.x（自托管 / Bonsai 50GB 套餐）       |
| S4+             | 视数据量决定升级到 Bonsai 200GB 或自托管专用集群 |

> 分片策略：每 index 默认 3 primary + 1 replica；后续视数据量调整。

### 2.2 索引命名约定

```
<domain>-<entity>-<env>[-<tenant>][-<locale>]

例：
ops-product_knowledge-prod
ops-listing_draft-prod
ops-article-prod
customer-faq-prod-homtone
customer-faq-prod-spoonlemon
customer-ticket-prod-homtone
customer-warranty_doc-prod-homtone
```

**关键决策：客户域索引按 tenant 物理隔离**（每品牌独立 index），与 PostgreSQL schema 隔离呼应。运营域共享 index（无 tenant 维度）。

### 2.3 索引列表（v2.0 范围）

| Index 名                               | 域   | 数据来源                                        | 引入切片   |
| -------------------------------------- | ---- | ----------------------------------------------- | ---------- |
| `ops-product_knowledge-{env}`          | 运营 | Category 模板 + Product 自填 + 路径 A 解析      | S1 W4      |
| `ops-listing_draft-{env}`              | 运营 | Listing 与 ListingVersion 内容快照              | S1 W11     |
| `ops-article-{env}`                    | 运营 | Article 商品介绍内容（多语言）                  | S2         |
| `ops-keyword_corpus-{env}`             | 运营 | 领星 + 平台 + 卖家精灵关键词词库                | S1 W11     |
| `customer-faq-{env}-{tenant}`          | 客户 | 各品牌 FAQ + 菜谱多语言版                       | S3 W34-W35 |
| `customer-ticket-{env}-{tenant}`       | 客户 | 工单全文（标题 + 描述 + 回复）                  | S3 W34-W35 |
| `customer-warranty_doc-{env}-{tenant}` | 客户 | 各品牌手册全文（multi-language extracted text） | S3 W36-W37 |
| `customer-chat_session-{env}-{tenant}` | 客户 | AI Chat 会话记录（脱敏）                        | S3 W34-W35 |

> v2.x 候选：`ops-ad_creative-{env}`、`ops-supply_purchase_history-{env}` 等。

### 2.4 通用字段约定（所有 index）

```json
{
  "id": "uuid (with @timestamp)",
  "created_at": "date",
  "updated_at": "date",
  "synced_at": "date",
  "source_table": "keyword (审计追溯，如 product_content / faq / ticket)",
  "source_id": "keyword (PostgreSQL 主键)",
  "version": "long (乐观锁/审计)",
  "deleted_at": "date (软删除标记)"
}
```

> 软删除：所有 index 用 `deleted_at` 字段标记，搜索 query 默认追加 `must_not.exists.deleted_at`。物理删除由后台 ILM 任务处理。

### 2.5 多语言字段策略

每个语言相关字段使用 **per-locale fields** 模式，避免单一 multilingual analyzer 跨语言污染：

```json
{
  "title": {
    "type": "object",
    "properties": {
      "en": { "type": "text", "analyzer": "english" },
      "es": { "type": "text", "analyzer": "spanish" },
      "fr": { "type": "text", "analyzer": "french" },
      "de": { "type": "text", "analyzer": "german" },
      "ja": { "type": "text", "analyzer": "kuromoji" },
      "zh": { "type": "text", "analyzer": "smartcn" }
    }
  }
}
```

> S1 仅启用 `en`；S3 加 `es` `fr`；S5 加 `de`；v2.x 加 `ja` / `zh`。

### 2.6 向量字段（语义搜索）

每个语言版本配套一个 dense_vector：

```json
{
  "embedding_en": {
    "type": "dense_vector",
    "dims": 768,
    "index": true,
    "similarity": "cosine"
  }
}
```

- **维度 768**：Gemini `text-embedding-004` 输出
- **similarity cosine**：标准化后向量余弦更稳定
- **index: true**：启用 HNSW 近似最近邻
- 命名：`embedding_<locale>` 与 text 字段对应

### 2.7 关键 index：`ops-product_knowledge`

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "english_basic": {
          "tokenizer": "standard",
          "filter": ["lowercase", "english_stop", "english_stemmer"]
        }
      }
    }
  },
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "id": { "type": "keyword" },
      "product_id": { "type": "keyword" },
      "brand": { "type": "keyword" },
      "category_id": { "type": "keyword" },
      "category_path": { "type": "keyword" },
      "content_type": { "type": "keyword" }, // faq | recipe | spec | feature | warning
      "source": { "type": "keyword" }, // category_inherit | manual | path_a_lingxing
      "title": {
        "type": "object",
        "properties": {
          "en": { "type": "text", "analyzer": "english_basic" }
        }
      },
      "body": {
        "type": "object",
        "properties": {
          "en": { "type": "text", "analyzer": "english_basic" }
        }
      },
      "embedding_en": {
        "type": "dense_vector",
        "dims": 768,
        "index": true,
        "similarity": "cosine"
      },
      "tags": { "type": "keyword" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "synced_at": { "type": "date" },
      "source_table": { "type": "keyword" },
      "source_id": { "type": "keyword" },
      "version": { "type": "long" },
      "deleted_at": { "type": "date" }
    }
  }
}
```

> `dynamic: strict` 防止字段污染；新字段必须显式声明。

### 2.8 关键 index：`customer-faq-{env}-{tenant}`

```json
{
  "settings": { "number_of_shards": 1, "number_of_replicas": 1 },
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "id": { "type": "keyword" },
      "tenant": { "type": "keyword" }, // 冗余字段，便于跨 index 查询时审计
      "brand": { "type": "keyword" }, // 与 tenant 一致，运营域查询用
      "product_id": { "type": "keyword" },
      "category_id": { "type": "keyword" },
      "question": {
        "type": "object",
        "properties": {
          "en": { "type": "text", "analyzer": "english" }
        }
      },
      "answer": {
        "type": "object",
        "properties": {
          "en": { "type": "text", "analyzer": "english" }
        }
      },
      "embedding_en": {
        "type": "dense_vector",
        "dims": 768,
        "index": true,
        "similarity": "cosine"
      },
      "tags": { "type": "keyword" },
      "popularity_score": { "type": "float" }, // M-08 调优用
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "version": { "type": "long" },
      "deleted_at": { "type": "date" }
    }
  }
}
```

### 2.9 关键 index：`customer-ticket-{env}-{tenant}`

```json
{
  "settings": { "number_of_shards": 1, "number_of_replicas": 1 },
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "id": { "type": "keyword" },
      "tenant": { "type": "keyword" },
      "ticket_number": { "type": "keyword" },
      "customer_id": { "type": "keyword" },
      "status": { "type": "keyword" }, // open / pending / resolved / closed
      "priority": { "type": "keyword" }, // p0 / p1 / p2 / p3
      "assignee_id": { "type": "keyword" },
      "subject": { "type": "text", "analyzer": "english" },
      "messages": {
        "type": "nested",
        "properties": {
          "id": { "type": "keyword" },
          "from": { "type": "keyword" }, // customer / agent / ai_bot
          "body": { "type": "text", "analyzer": "english" },
          "created_at": { "type": "date" }
        }
      },
      "tags": { "type": "keyword" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "version": { "type": "long" },
      "deleted_at": { "type": "date" }
    }
  }
}
```

---

## 3. 索引同步策略

### 3.1 数据流

```
PostgreSQL (事务源)
    │
    │  trigger / outbox pattern
    ▼
BullMQ "es-sync" 队列
    │
    │  worker（NestJS 微服务）
    │  1. 拉 row + 关联数据
    │  2. 调 Gemini text-embedding-004 生成 embedding
    │  3. PUT to ES
    ▼
Elasticsearch
```

### 3.2 同步模式

- **正常更新**：Outbox pattern。PostgreSQL 写入同时记录到 `es_outbox` 表；BullMQ 定时消费（500ms 一批）；写入 ES 后标记 outbox 已处理
- **批量回填**：Reindex 任务（`/admin/reindex/:index` 内部 API），扫源表全量推送；用于初始化、字段升级、analyzer 调整
- **增量补救**：若 BullMQ 消费失败 N 次进死信队列，每天 03:00 cron job 扫死信 + 重试

### 3.3 一致性保证

- ES 不是事务源，**不保证强一致**
- 业务代码读 ES 仅用于"搜索 / 排序 / 推荐"，**不用于业务决策**
- 业务决策（如限购、库存）必须读 PostgreSQL
- ES 数据滞后 ≤ 5s（正常态）；超过 60s 触发监控告警

### 3.4 Embedding 生成

- 触发：text 字段变更时重新生成
- 策略：
  - 短文本（< 500 char）每次写入即时生成
  - 长文本（≥ 500 char）异步生成（BullMQ 单独队列 `embedding-gen`）
  - 失败 fallback：仅文本搜索可用，向量字段缺失，UI 标注"语义搜索暂不可用"
- 成本控制（指标采集 §5.1 M-XX）：
  - 月 token 预算告警（按 §3.1 §5.1 §17 财务签字预算）
  - 重复文本去重（hash + cache 24h）

---

## 4. 查询模式

### 4.1 Hybrid Search（关键词 + 语义）

```typescript
// 标准检索模板：BM25 + KNN 加权融合
{
  size: 10,
  query: {
    bool: {
      must_not: [{ exists: { field: "deleted_at" } }],
      should: [
        // BM25 文本匹配
        { match: { "title.en": { query, boost: 2 } } },
        { match: { "body.en": { query } } }
      ]
    }
  },
  knn: {
    field: "embedding_en",
    query_vector: <gemini_embedding(query)>,
    k: 50,
    num_candidates: 200,
    boost: 1.5
  }
}
```

### 4.2 Tenant 过滤强制

客户域查询通过 NestJS 中间层 `EsClient`，强制注入 tenant index 名，代码不可绕过。

```typescript
// 错误示范（会触发 lint 警告）
esClient.search({ index: "customer-faq-prod-*", ... })

// 正确示范
esClient.searchInTenant("customer-faq", tenantContext, query)
// 内部展开为 index: "customer-faq-prod-homtone" 等
```

### 4.3 监控指标

- M-08 ES 召回率 Top-3 ≥ 70%（测试问题集 / 每月 evals）
- 查询延迟 P95 < 200ms
- ES 集群健康（绿 / 黄 / 红）实时监控
- 索引大小 / shard 不均告警

---

## 5. ILM（索引生命周期管理）

| 索引                      | hot                  | warm         | delete                   |
| ------------------------- | -------------------- | ------------ | ------------------------ |
| `ops-*`                   | 永远 hot（数据量小） | —            | —                        |
| `customer-faq-*`          | 永远 hot             | —            | —                        |
| `customer-ticket-*`       | 6 个月 hot           | 18 个月 warm | 永久保留（合规要求）     |
| `customer-chat_session-*` | 30 天 hot            | 90 天 warm   | 365 天后删除（隐私要求） |

> ILM 策略 W4 启用时配套生效；删除前 30 天发清理通告给法务。

---

## 6. 备份与灾备

- 每日全量 snapshot 到 S3（`yaemartos-es-backup` bucket）
- 保留 30 天滚动备份
- 季度演练：从 snapshot 恢复全集群 + 业务回归测试
- 关键事故 RTO（恢复时间）目标 4h，RPO（数据丢失）目标 24h

---

## 7. 替代方案与拒绝理由

| 方案                                        | 拒绝理由                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 仅用 PostgreSQL `pgvector`                  | 简单但全文搜索能力弱（特别是 multi-language analyzer）；Hybrid 难做；S2+ 量上来后扩展性差 |
| 单一 multilingual index（不分 locale 字段） | 跨语言 analyzer 污染；比如英文 query 命中西语词干                                         |
| 客户域共享 single index + tenant filter     | 与 PostgreSQL 4 schema 隔离冲突；合规风险；查询易出错                                     |
| Algolia / Typesense / Meilisearch           | Typesense / Meili dense vector 支持有限；Algolia 商业 SaaS 月成本高                       |

---

## 8. 验收

- [ ] S1 W4 dev 集群部署成功
- [ ] `ops-product_knowledge-dev` / `ops-listing_draft-dev` / `ops-keyword_corpus-dev` 创建，写入 100 条测试数据
- [ ] BullMQ `es-sync` worker 跑通；outbox 模式延迟 < 5s
- [ ] Gemini `text-embedding-004` 集成；生成 768 维 embedding 入 ES
- [ ] Hybrid Search 模板返回结果排序合理（人工 5 题抽测）
- [ ] `EsClient` 中间层接口定义；tenant 强制注入测试通过
- [ ] M-08 测试问题集（100 题）准备就绪（与客服+AI 工程师协同）
- [ ] S3 W34-W35 客户域 index 创建 + 与 W31 tenant schema 联动测试

---

## 9. 风险与未决项

| 风险                                                        | 缓解                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Gemini embedding 模型升级（768 → 其他维度）                 | 重新申请 index；reindex 全量；至少 3 个月预告期                         |
| ES 集群成本超预算                                           | 设月成本上限告警；优先压缩 chat_session ILM；考虑替换为 Bonsai 包月套餐 |
| 多语言 analyzer 配置错误导致召回率低                        | M-08 月度评测；CJK 语言（v2.x）需要特殊配置审计                         |
| Tenant index 过多（4 品牌 × 4 entity = 16 index）shard 浪费 | 每 tenant index 仅 1 shard；监控 shard 数量上限                         |
| Embedding 成本随客户量线性扩张                              | hash 去重 + cache；批量打包请求；考虑 v2.x 切换更便宜 embedding         |

---

_版本：v0.1 提案 | 最后修订：2026-04-30 | 实施评审：S1 W4_
