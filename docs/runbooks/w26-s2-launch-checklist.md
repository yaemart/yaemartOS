# W26 S2 上线 Checklist

**目标**：Homtone + Spoonlemon × Amazon + Walmart × 12 名运营 beta 可用  
**责任人**：工程 Lead + PM  
**预计时间**：上线日前 1 天执行步骤 1–5，上线日执行步骤 6–9

---

## 步骤 1：环境变量核验

```bash
pnpm --filter @yaemartos/api run check:env:s2
```

确认所有行显示 `✓ OK`，特别注意：

- `GEMINI_EMBED_MODEL` 值必须为 `text-embedding-004`
- `LINGXING_APP_ID` / `LINGXING_APP_SECRET` 为生产 Lingxing 凭证（非开发测试账号）
- `DATABASE_URL` 指向生产 PostgreSQL 实例

---

## 步骤 2：数据库迁移确认

```bash
# 确认所有 migration 已应用
pnpm --filter @yaemartos/api run db:migrate:all-tenants
```

确认以下 migration 已在生产环境执行：

- [ ] `20260502020000_add_wayfair_platform`（Wayfair 平台 enum）
- [ ] `20260502030000_add_system_config`（SystemConfig 表，支持 feature flag 存储）

---

## 步骤 3：Feature Flag 配置

在 Settings → Feature Flags 页面（需 `settings:write` 权限）逐一开启：

| Flag Key                              | 品牌                 | 说明               |
| ------------------------------------- | -------------------- | ------------------ |
| `feature_flag.LISTING_AI`             | Homtone + Spoonlemon | AI Listing 生成    |
| `feature_flag.BATCH_LISTING_GENERATE` | Homtone + Spoonlemon | 批量多平台生成     |
| `feature_flag.LISTING_MATRIX`         | Homtone + Spoonlemon | 矩阵分析 Dashboard |

如需品牌级独立控制，使用 brand-scoped key：`feature_flag.LISTING_MATRIX.homtone`

---

## 步骤 4：Redis Embedding 缓存验证

在开发/staging 环境跑一次矩阵分析（触发 embedding 写入），确认 Redis 可正常写入：

```bash
# staging 环境验证
redis-cli -u $REDIS_URL KEYS "listing:embed:*" | head -5
```

如果返回结果则 embedding 缓存工作正常。

---

## 步骤 5：Lingxing 店铺绑定确认

在 `/shops` 页面确认以下店铺已绑定且同步正常：

- [ ] Homtone × Amazon US
- [ ] Homtone × Walmart US
- [ ] Spoonlemon × Amazon US
- [ ] Spoonlemon × Walmart US

---

## 步骤 6：邀请 12 名 Beta 用户

分配步骤：

1. 在 IAM 管理页面（`/settings/iam`）创建 12 个用户账号
2. 角色分配：`listing_editor`（双品牌各 6 人）
3. 确认每个账号可正常登录并进入 Listing 列表

---

## 步骤 7：功能验收走查

由工程 Lead 完成以下走查（录屏留存）：

### Homtone 品牌

- [ ] 批量生成：选择 Amazon + Walmart 两个目标，触发生成，确认各生成 1 条 draft Listing
- [ ] 矩阵分析：在某产品的 Listing 详情页切换到"矩阵分析"Tab，确认相似度矩阵和策略分布可见
- [ ] 审计日志：在 Settings → Audit 中确认 `listing.update` 条目包含 `before` 和 `after` 字段

### Spoonlemon 品牌

- [ ] 重复上述批量生成走查
- [ ] 确认品牌切换后主题色正确切换

---

## 步骤 8：反馈收集准备

- [ ] 创建反馈表（Google Forms / 飞书问卷），包含以下问题：
  - 批量生成功能是否符合预期？
  - 矩阵分析视图是否有帮助？
  - 发现哪些问题或建议？
- [ ] 在 `AdminShell` 通知条中配置反馈链接（由 PM 在 Banner 组件中激活）

---

## 步骤 9：上线后监控

上线后 48 小时内重点关注：

| 指标              | 阈值  | 观察点                                              |
| ----------------- | ----- | --------------------------------------------------- |
| Gemini API 错误率 | < 5%  | embedding 调用失败会导致矩阵分析返回空矩阵          |
| 批量生成成功率    | > 90% | `POST /listings/batch-generate` 各 target 状态      |
| Redis 内存使用    | < 80% | `listing:embed:*` 键 24h TTL，正常不会堆积          |
| 审计日志写入      | 100%  | `AuditLog` 中 `listing.*` 事件应含 `before`/`after` |

---

## 回滚步骤

如需紧急回滚：

```bash
# 关闭所有矩阵分析功能（不影响已生成的 Listing）
# 在 Settings → Feature Flags 设置：
# feature_flag.LISTING_MATRIX = false
# feature_flag.BATCH_LISTING_GENERATE = false
```

数据层：无破坏性变更，`AuditLog.metadata` 结构变更向后兼容，回滚前端代码即可。

---

## 相关链接

- 实施方案 §7 S2 W26：S2 上线
- 计划文档：`docs/plans/2026-05-03-003-feat-w24-u4-w26-matrix-dashboard-s2-launch-plan.md`
- embedding 缓存清理命令：`redis-cli -u $REDIS_URL KEYS "listing:embed:*" | xargs redis-cli -u $REDIS_URL DEL`
