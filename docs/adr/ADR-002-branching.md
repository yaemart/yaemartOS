# ADR-002：分支策略与发布流程

| 字段     | 取值                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 状态     | Accepted                                                                       |
| 提议日期 | 2026-04-30                                                                     |
| 决策日期 | _W1 D1 评审通过后填写_                                                         |
| 决策人   | tech lead + dev #2                                                             |
| 关联文档 | `docs/yaemartOS-implementation-plan.md` §2.1 Harness Engineering / M-09 / M-14 |
| 取代     | 无                                                                             |

---

## 1. 上下文

2 人团队 18 个月内交付。需要一个分支策略满足：

- 快速合并主干（避免长期分支带来的合并地狱）
- 可灰度（feature flag）
- 24h 内单次操作可回滚（M-09 验收基线）
- 切片末必须有可上线增量（M-14）
- CI 强制 + Code Review 不可绕过

## 2. 决策：Trunk-based + Feature Flag

### 2.1 主干

- **唯一长期分支：`main`**（即 trunk）
- `main` 任何时刻都是可部署状态（绿色）
- staging 自动追随 `main`（每次合入触发部署）
- production 通过 release tag 触发部署（`v0.X.Y`）

### 2.2 分支命名约定

```
feature/<scope>-<short-desc>     # 新功能
fix/<scope>-<short-desc>          # bug fix
chore/<scope>-<short-desc>        # 依赖升级、CI 调整等
docs/<scope>-<short-desc>         # 文档
hotfix/<short-desc>               # 紧急修复（直接基于 production tag）
```

`<scope>` 取值：`web` / `api` / `db` / `ai` / `iam` / `lingxing` / `customer` / `infra`。

例：

- `feature/listing-multi-version`
- `fix/api-cors-credentials`
- `chore/web-tailwind-3.4`

### 2.3 分支生命周期

| 类型       | 最长存活                  | 合并方式                           |
| ---------- | ------------------------- | ---------------------------------- |
| feature/\* | **5 天**，超过强制 review | Squash merge                       |
| fix/\*     | 2 天                      | Squash merge                       |
| chore/\*   | 1 天                      | Squash merge                       |
| docs/\*    | 1 天                      | Squash merge                       |
| hotfix/\*  | 当天                      | Squash merge + cherry-pick 回 main |

> 超期分支自动打 `stale` 标签；7 天无活动自动关闭 PR。

### 2.4 PR 要求

每个 PR 必须满足：

- [ ] 分支命名符合上述约定
- [ ] commit 消息符合 commitlint（约定式提交）
- [ ] 关联 issue 或切片任务编号（如 `S1-W1-D2`）
- [ ] PR 描述包含：变更说明 / 影响范围 / 验证方式 / feature flag 状态（如适用）
- [ ] CI 三 job 全绿（lint / typecheck / test / build）
- [ ] 至少 1 名 reviewer approval（2 人团队 = 另一人）
- [ ] 不允许 self-merge
- [ ] 不允许 force push 到已有 review 的 PR

### 2.5 Code Review 标准（轻量但严格）

reviewer 必查：

- [ ] 是否引入新的 SaaS / 依赖库（需另开 ADR 或在 ADR-001 修订）
- [ ] 是否有审计日志（关键写操作必须有，对应 M-10）
- [ ] 是否有 feature flag 包裹（user-facing 变更建议有）
- [ ] tenant schema 过滤是否齐全（客户域代码）
- [ ] 是否触及 LingxingClient（必须保持单点）
- [ ] 是否触及 AI Services 层（不可绕过 Vercel AI SDK）

## 3. Feature Flag

### 3.1 选型

- **S1 阶段**：DB 表 `feature_flags(key, enabled, brand_id?, created_at, updated_at)` + `useFlag(key)` hook（前端）/ `flagService.isEnabled(key, ctx)`（后端）
- **S2+ 阶段**：视情况引入 Unleash 或 PostHog Feature Flags（已有 PostHog）
- **绝不直接 commit 半成品代码到 main 不带 flag**

### 3.2 Flag 命名

```
<scope>.<feature>.<variant>

例：
listing.multi_version.enabled
customer_portal.warranty.enabled
ai.gemini_pro_router.enabled
```

### 3.3 Flag 生命周期

- 新 flag 默认 `enabled=false`
- 灰度阶段按 `brand_id` 维度逐步开启
- 全量后保留 30 天，确认稳定后**删除 flag 与 dead code**
- 超过 60 天的 flag 触发清理告警

## 4. 回滚（M-09 24h 窗口）

### 4.1 自动回滚能力

- 每次部署生成 release tag
- production 部署后保留前 3 个版本镜像，可一键切回
- DB 迁移分两阶段：
  - **expand**（向后兼容的字段添加）→ 部署应用代码
  - **contract**（删除旧字段）→ 至少 24h 后另一次部署
- 永远不在同一次部署里 expand + contract

### 4.2 紧急回滚操作

```
1. 评估：是否影响生产 → P0/P1
2. 决策：tech lead + dev #2 至少 1 人在线
3. 执行：
   - 应用代码：production 切回前 1 版本镜像
   - DB：仅当 contract 步骤已执行才需要 down 迁移；否则数据不动
4. 通信：在 Slack / 飞书 #incidents 发事件简报
5. 复盘：24h 内提交事件分析，加入 docs/postmortems/
```

## 5. 发布节奏

| 切片末    | 发布动作                            |
| --------- | ----------------------------------- |
| S1 W13    | `v0.1.0` Homtone alpha 5 人         |
| S2 W26    | `v0.2.0` 双品牌 beta 12 人          |
| S3 W39    | `v0.3.0` 客户中心 V1 + 多语言 20 人 |
| S4 W52    | `v0.4.0` 广告 + 供应链 30 人        |
| S5 W65    | `v0.5.0` 4 品牌 + 欧洲 38 人        |
| S6 W77-78 | `v1.0.0 GA` 全量上线                |

> 切片末 release 非硬性日期，允许延期 ≤ 1 周；> 1 周触发 review（M-14）。

## 6. 例外条款

以下情况允许暂时违反 ADR-002，但必须在 PR 描述显式声明：

- **生产 P0 事故**：可直接 hotfix 到 main 无需等 review；事后补 review
- **依赖升级安全补丁**：CI 自动升级（dependabot）+ tech lead 单人 approve

## 7. 验收

- [ ] 团队 2 人评审通过
- [ ] GitHub 分支保护规则配置完成（main 保护、CI 必过、1 review）
- [ ] commitlint 配置入仓
- [ ] feature_flags 表 DDL 入 Prisma schema
- [ ] CONTRIBUTING.md 引用本 ADR
