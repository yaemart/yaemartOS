# AI 成本月度报表查询

`AiCallLog` 表（`public` schema）记录每次 AI 模型调用的 token 消耗与估算费用。

> `estimatedCostUsd` 基于 `apps/api/src/ai/cost-tracking.service.ts` 中的常量定价，仅供趋势分析，非实际账单。

---

## 月度成本汇总（按品牌 × 任务类型）

```sql
SELECT
  brand_id    AS "品牌",
  task_type   AS "任务类型",
  COUNT(*)    AS "调用次数",
  SUM(prompt_tokens)      AS "提示 Token 总计",
  SUM(completion_tokens)  AS "输出 Token 总计",
  ROUND(SUM(estimated_cost_usd)::numeric, 4) AS "估算费用 (USD)"
FROM "AiCallLog"
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
  AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY brand_id, task_type
ORDER BY "估算费用 (USD)" DESC;
```

## 指定月份查询

```sql
-- 例：2026 年 5 月
SELECT
  brand_id, task_type, model,
  COUNT(*)    AS calls,
  SUM(prompt_tokens + completion_tokens) AS total_tokens,
  ROUND(SUM(estimated_cost_usd)::numeric, 6) AS cost_usd
FROM "AiCallLog"
WHERE created_at >= '2026-05-01'
  AND created_at < '2026-06-01'
GROUP BY brand_id, task_type, model
ORDER BY cost_usd DESC;
```

## 按模型汇总

```sql
SELECT
  model,
  COUNT(*) AS calls,
  AVG(duration_ms) AS avg_ms,
  ROUND(SUM(estimated_cost_usd)::numeric, 4) AS total_cost_usd
FROM "AiCallLog"
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY model
ORDER BY total_cost_usd DESC;
```

## P95 响应时间

```sql
SELECT
  task_type,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms
FROM "AiCallLog"
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY task_type;
```

---

## 注意事项

- 定价常量位于：`apps/api/src/ai/cost-tracking.service.ts` → `PRICING` 对象
- 每季度与[智谱定价页](https://open.bigmodel.cn/pricing)和 [Gemini 定价页](https://cloud.google.com/vertex-ai/pricing)核对后更新
- `estimatedCostUsd = 0` 表示调用时未产生 token（如 mock fallback 模式）
- 实际账单以各平台控制台为准
