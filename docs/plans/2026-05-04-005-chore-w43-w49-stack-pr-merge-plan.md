---
title: 'chore(w49-d2): W43-W49 stack PR 合入调度（4 PR 串行合并 + cron 解锁）'
type: chore
status: active
date: 2026-05-04
---

# W49 D2：W43-W49 Stack PR 合入调度

## Overview

W49 D1 把累积的 W43-W49 工作整理成 4 个 stack PR push 上去（避免单一巨型 super-PR）。本 plan 描述 W49 D2 的执行节奏：4 个 PR 按 stack 顺序合入 `origin/main`，期间处理 base re-target、CI gate、merge conflict，最终解锁 W49 P1-B-mod-v2 staging cron 并清理本地/远端分支。

这是单日（W49 D2）执行 plan，Lightweight depth。不涉及代码改动，纯 git/GitHub workflow + 文档同步。

---

## Problem Frame

W49 D1 push 完成后状态：

| Branch                                     | Files     | Stack base   | GitHub PR |
| ------------------------------------------ | --------- | ------------ | --------- |
| `feat/w43-w45-ad-suggestion-gate`          | 3 commits | main         | 待开      |
| `feat/w46-w47-realtime-sse-tanstack-query` | 59 files  | feat/w43-w45 | 待开      |
| `feat/w48-customer-chat-tool-calling`      | 12 files  | feat/w46-w47 | 待开      |
| `feat/w49-kpi-smoke-fixes-and-audit`       | 11 files  | feat/w48     | 待开      |

约束：

1. **CI 触发条件**：`.github/workflows/ci.yml` 仅在 `pull_request: branches: [main]` 触发 → stack PR 的 PR-2/3/4 在 base 不是 main 时不跑 CI，必须串行合并
2. **Merge 模式**：仓库历史（PR #6/#8/#9/#10/#11/#12/#13）全部用 merge commit（非 squash）→ stack 关系可保留，base re-target 后 GitHub diff 计算正确
3. **W49 P1-B-mod-v2 cron 阻塞**：`.github/workflows/staging-smoke.yml` 在 PR-4 commit 中，必须 PR-4 merge 到 main 后 GitHub Actions 才识别该 workflow，cron 才开始 schedule
4. **无 CODEOWNERS / PR template**：reviewer 手动指定，PR 描述用 commit body 内容（已写好）

---

## Requirements Trace

- **R1**：4 PR 按 W43-W45 → W46-W47 → W48 → W49 顺序合入 main，每个 PR 通过 CI gates（lint / typecheck / unit / e2e / prisma generate）
- **R2**：每个 PR merge 后正确 re-target 下一 PR 的 base 到 main，避免 stack 链断裂导致 GitHub diff 显示意外文件
- **R3**：4 PR 全部 merge 后，本地 + 远端的 4 个 feature branch 全部删除；本地 main fast-forward 跟上 origin/main
- **R4**：PR-4 merge 后立即在 GitHub Actions UI 手动触发一次 `staging-smoke.yml` workflow_dispatch，验证 secret 配置 + Slack 通知 + smoke 8 tools 全绿；只有此验证通过才算 cron 真正解锁
- **R5**：合入完成后同步 `docs/W46-W52-checklist.md`（4 PR 状态打钩 + cron 状态从 BLOCKED → unblocked）+ `docs/briefs/2026-05-W49-leadership-sync.md`（W49 D2 ops 段落）

---

## Scope Boundaries

- 不在 scope：staging single-brand 灰度（W49 D3，homtone）
- 不在 scope：cron 解锁后的 7 天 24h 连续观测门禁（W49 D5 验证）
- 不在 scope：W50 P2-D（F-4 metric 白名单 / F-5 limiter / F-9 cookie 轮换）+ §0 P0 sidebar 假链接修复
- 不在 scope：解决跨 PR 的 schema breaking change conflict（如 prisma schema 在 W43-W45 vs W46-W47 互相覆盖）—— rebase 中如遇此类冲突，停下重新评估而不是在本 plan 框架内强行解决

### Deferred to Follow-Up Work

- **staging cron 7 天观测**：解锁后纳入 W49 D2-D5 daily check-in，但不在本 plan 的 4 unit 内
- **PR 描述富文本化**：commit body 已含完整 description，本次直接复用；后续可加 PR template，由卫生周（W51 末/W52）处理

---

## Context & Research

### Relevant Code and Patterns

- `.github/workflows/ci.yml`：lint-typecheck（pnpm lint + typecheck web/api + prisma generate）+ test（postgres + redis + unit）+ e2e
- `.github/workflows/staging-smoke.yml`（PR-4 中）：cron `0 */6 * * *` + workflow_dispatch + Slack jq payload
- 仓库过往 merge commit pattern：`Merge pull request #N from yaemart/feat/...`
- `docs/W46-W52-checklist.md`：W49 D2 行已预留位置（"D2 解锁动作"段落）

### Institutional Learnings

- W49 D1 stack PR push 时遇到的 3 个坑（写在 `docs/solutions/` 候选）：
  1. `origin/main` 的 ref 在 fetch 前可能严重过期，盲目 push 会 reject
  2. `git rebase` 自动识别 squash-merged commit 并 drop（feat/w43-w45 上的 4 个 W34-W42 commit 自动消失）
  3. commitlint body line ≤100 字符是硬约束
- 本 plan 的 cleanup 步骤要把这 3 条沉淀到 `docs/solutions/git-workflow/2026-05-04-stack-pr-orchestration.md`（U4 包含此动作）

---

## Key Technical Decisions

- **Merge commit 而非 squash**：保留 stack PR commit hash，让 base re-target 后 GitHub diff 仅显示该 PR 自己的增量；squash 会让 PR-N base ref 消失，需要本地 force-push 重建 stack
- **串行合并而非并行**：CI 仅在 base=main 时触发，stack PR 必须前一个 merge 后才能让后一个跑 CI；这天然形成 PR-1 → PR-2 → PR-3 → PR-4 单线
- **base re-target 走 GitHub UI 而不是本地 force-push**：UI 操作触发 CI 重跑且不需要改 commit hash，比 `git rebase main && git push -f` 安全；仅在 GitHub diff 显示意外 conflict 时才本地 rebase
- **branch 删除时机**：4 PR 全部 merge 完之后再删，不在每个 PR 之后立即删 —— 避免 PR-N+1 base ref 消失（虽然 GitHub 会让你强制改 base，但徒增风险）
- **不 squash 已有的 D1 commit**：4 个 PR 各自的 commit body 已经包含完整 description，作为 PR 描述使用；不在 GitHub UI 重写 PR description

---

## Open Questions

### Resolved During Planning

- **如何 re-target stack base？** GitHub UI dropdown（settings → base branch），不本地 force-push
- **删除 branch 时机？** 全部 merge 完之后批量删
- **CI flake 怎么办？** 重跑 workflow run；3 次失败仍未过则停下分析（不在本 plan 范围内修 CI）

### Deferred to Implementation

- **rebase conflict 概率**：如果 W49 D2 期间有其他 PR 并行进 main（影响 PR-2/3/4 的 base re-target），需要本地 rebase；当前估计概率低（团队该日聚焦本 4 PR），但运行时确认
- **`SLACK_WEBHOOK_STAGING_ALERT` secret 是否已配**：staging-smoke.yml 使用此 secret 发 jq Slack payload；首次 manual trigger 才能验证（U4 verification 步骤）
- **e2e CI 含 W47 实时 SSE test 是否在 CI 环境稳定**：本地 6 个 API test ✅，CI 含 redis service container 应该 ok，但首次 PR-2 CI 才能确认
- **reviewer 选择**：无 CODEOWNERS，由用户判断哪些同事看哪些 PR；本 plan 不规定具体人选

---

## Implementation Units

- [ ] **U1. PR-1 (W43-W45 ad suggestion gate) 合入 main**

**Goal**：把 W43-W45 ad-suggestion 数据模型 + 执行闸门 + 前端三件套合入 origin/main，作为后续 stack PR 的解锁前置

**Requirements**：R1（CI 通过）、R2（merge 模式保留 stack 关系）

**Dependencies**：无（PR 已 push）

**Files**：不改文件，仅 GitHub UI + git 操作

**Approach**：

1. 浏览器打开 https://github.com/yaemart/yaemartOS/pull/new/feat/w43-w45-ad-suggestion-gate
2. PR title 取 commit body 第一行（feat(ads-web): U5 ...）；description 留空或粘贴 commit body
3. 选择 reviewer（用户决定）
4. 等 CI（lint-typecheck + test + e2e）全绿 —— 预计 8-12 分钟
5. **Merge commit** 模式合入（不 squash）
6. merge 后验证 origin/main HEAD 是 PR-1 merge commit；本地 `git pull --ff-only origin main` 跟上

**Patterns to follow**：仓库过往 PR #6/#8-#13 的 merge commit message 格式（`Merge pull request #N from yaemart/...`）

**Test scenarios**：

- Happy path：CI 全绿 + reviewer approve + merge commit 入 main，origin/main HEAD = "Merge pull request #14 from yaemart/feat/w43-w45-ad-suggestion-gate"
- Edge case：CI 失败（typecheck/test/e2e）→ 修 + push 到 feat/w43-w45 branch；rebase 后的 commit hash 在 CI 第一次运行可能未触发，必要时 close-reopen PR
- Error path：reviewer 要求 changes → 在 feat/w43-w45 branch 上 commit 新 fix，push（不 force push，保留 stack 完整性）

**Verification**：

- origin/main 的 latest merge commit 是 PR-1
- GitHub UI 中 PR-2 显示 "base feat/w43-w45-ad-suggestion-gate" 仍然引用（merge 后这个 branch 还在 remote），但实质上 PR-2 的 commit 已经叠加在已 merged 的 W43-W45 之上 —— 进入 U2 立即 re-target

---

- [ ] **U2. PR-2 (W46-W47 SSE realtime) base re-target 到 main + 合入**

**Goal**：把 W46-W47 SSE realtime + cookie JWT + TanStack Query 合入 main

**Requirements**：R1、R2

**Dependencies**：U1（PR-1 必须先 merge，否则 PR-2 base 改到 main 会显示 W43-W45 文件作为意外 diff）

**Files**：不改文件

**Approach**：

1. PR-1 merge 完成后，GitHub UI 中打开 PR-2，点 "Edit" 改 base branch dropdown 从 `feat/w43-w45-ad-suggestion-gate` 改到 `main`
2. GitHub 重新计算 diff（应该仅显示 PR-2 自己的 59 file）—— 关键验证点
3. 如果 diff 显示意外文件（说明 stack 链有漂移），停下并本地 rebase：
   ```
   git checkout feat/w46-w47-realtime-sse-tanstack-query
   git fetch origin && git rebase origin/main
   git push --force-with-lease origin feat/w46-w47-realtime-sse-tanstack-query
   ```
   `--force-with-lease` 而非 `--force` —— 防止 race condition 误覆盖
4. base 改成 main 后 CI 自动重跑（这是 PR-2 真正第一次跑 CI，因为之前 base 不是 main）
5. CI 通过 + reviewer approve + merge commit
6. merge 后本地 `git checkout main && git pull --ff-only`

**Test scenarios**：

- Happy path：base 改成 main 后 GitHub diff 仅显示 59 个 W46-W47 文件（无 W43-W45 残留）；CI 全绿
- Edge case：GitHub diff 包含 W43-W45 文件 → 本地 rebase + force-with-lease push；rebase 自动 drop W43-W45 commit（已被 PR-1 的 merge commit 包含）
- Error path：CI 在 e2e 阶段失败（W47 SSE test redis 配置）→ 检查 ci.yml 的 redis service container；不在本 plan 内修 CI

**Verification**：

- origin/main 的 latest merge commit 是 PR-2，前一个是 PR-1
- PR-3 在 GitHub 上 base 仍指向 `feat/w46-w47-realtime-sse-tanstack-query`，进入 U3 立即 re-target

---

- [ ] **U3. PR-3 (W48 customer chat tool calling) base re-target + 合入**

**Goal**：把 W48 chat tool calling + 8 条 customer chat tool + ADR-012 合入 main

**Requirements**：R1、R2

**Dependencies**：U2

**Files**：不改文件

**Approach**：与 U2 完全同模式 —— GitHub UI 改 base 到 main、CI 重跑、merge commit、本地 ff-pull

**Test scenarios**：

- Happy path：base re-target 后 diff 仅显示 12 个 W48 文件；CI 全绿（含 chat.service.spec.ts 21 个 unit test，customer-chat-tools.spec.ts 14 个）
- Edge case：CI 在 chat.service.spec 失败 —— 检查 fake timers `{ toFake: ['setTimeout'] }` 配置是否在 CI 环境表现一致；W49 D1 已验证本地 ✅
- Error path：base re-target 后 diff 包含 W46-W47 文件 → 本地 rebase 步骤同 U2

**Verification**：

- origin/main 的 latest merge commit 是 PR-3；CI test job 输出 21 + 14 = 35 个 chat 相关 unit test 全绿

---

- [ ] **U4. PR-4 (W49 KPI/smoke/audit) 合入 + 全局 cleanup + cron 解锁**

**Goal**：合入最后一个 PR，清理 4 个 feature branch，验证 staging-smoke.yml workflow 在 main 上生效，手动触发一次 smoke 验证 cron 真正解锁

**Requirements**：R1、R2、R3、R4、R5

**Dependencies**：U3

**Files**：

- 修改：`docs/W46-W52-checklist.md`（4 PR 打钩 + cron 状态 BLOCKED→unblocked + W49 D2 完工注脚）
- 修改：`docs/briefs/2026-05-W49-leadership-sync.md`（W49 D2 ops update 段落）
- 创建：`docs/solutions/git-workflow/2026-05-04-stack-pr-orchestration.md`（institutional learning：3 个 W49 D1 push 时遇到的坑）

**Approach**：

1. **合入 PR-4**：与 U2/U3 同模式（GitHub UI base 改成 main → CI → merge commit）
2. **本地 main 同步**：`git checkout main && git pull --ff-only`
3. **删除本地 + 远端 branch**（4 个）：
   ```
   for b in feat/w43-w45-ad-suggestion-gate \
            feat/w46-w47-realtime-sse-tanstack-query \
            feat/w48-customer-chat-tool-calling \
            feat/w49-kpi-smoke-fixes-and-audit; do
     git branch -d "$b"
     git push origin --delete "$b"
   done
   ```
4. **验证 staging-smoke workflow 上线**：GitHub Actions UI → workflows 列表 → 应见 "Staging Smoke - Chat Tools"（来自 PR-4 的 .github/workflows/staging-smoke.yml）
5. **手动 trigger 验证**（关键 R4 验证点）：Actions UI → workflow_dispatch → 输入 staging URL + 等待运行
   - 验证 8 tools E2E 全绿 + Slack jq payload 发送成功 + KPI metric 增量
   - 这是真正解锁 cron 的判定（之前所有 cron 自动 trigger 之前必须先 manual 验证 secret 链路）
6. **同步文档**：
   - `docs/W46-W52-checklist.md`：勾掉 4 PR 行 + cron 状态从 🔴 BLOCKED 改 🟢 unblocked + 新增 "W49 D2 完工" 注脚
   - `docs/briefs/2026-05-W49-leadership-sync.md`：W49 D2 ops 段落（4 PR merge 时间戳 + cron 验证结果）
7. **沉淀 institutional learning**：`docs/solutions/git-workflow/2026-05-04-stack-pr-orchestration.md`，YAML frontmatter `module: git-workflow` `tags: [stack-pr, rebase, ci-gate]` `problem_type: ops-pattern`，正文记录 3 个坑：
   - 过期 origin/main ref 导致 push reject 的 fetch-first 流程
   - rebase 自动 drop squash-merged commit 的机制
   - commitlint body 100 字符硬约束

**Test scenarios**：

- Happy path：4 PR 全 merge → 4 branch 删除 → staging-smoke manual trigger 全绿（8 tools / Slack 通知 / KPI 增量），W46-W52-checklist.md / leadership-sync.md / solutions doc 同步
- Edge case：staging-smoke manual trigger 失败（secret 缺失 / staging URL 不可达）→ 不算 cron 解锁，本 plan U4 退出 partial complete 状态；secret 修复后再重试（属 R4 deferred 范畴）
- Error path：删除 branch 时本地有 unmerged 改动（不应该有）→ 用 `-D` 强制不安全；停下确认是否有遗漏 commit

**Verification**：

- `git branch | grep feat/w4` 无输出（本地 4 branch 已删）
- `git ls-remote origin | grep feat/w4` 无输出（远端 4 branch 已删）
- GitHub Actions UI 中 "Staging Smoke" workflow 最近一次 manual run 状态 = success
- `docs/W46-W52-checklist.md` D2 段落 "解锁动作" 全部勾选
- `docs/solutions/git-workflow/2026-05-04-stack-pr-orchestration.md` 创建并含 YAML frontmatter

---

## System-Wide Impact

- **Interaction graph**：PR 顺序解锁 W43-W45 ad-suggestion → W46-W47 SSE infra → W48 chat tools → W49 KPI/smoke；任何一环 merge 失败都会 block 后续 dependency
- **Error propagation**：CI 失败仅影响该 PR；rebase conflict 仅影响该 stack 节点；staging-smoke manual trigger 失败仅影响 cron 解锁判定（不阻塞 W49 D3 灰度本身，但会推迟 D5 7天观测门禁起算时间）
- **State lifecycle risks**：
  - 4 PR 之间若有 schema breaking change 互相覆盖（如 prisma migration 顺序错位），CI 的 prisma generate 会捕获；但 production schema 漂移不在 CI 覆盖内 —— 本 plan 不处理
  - merge 顺序错乱（PR-2 先于 PR-1 merge）会导致 PR-2 引入的 SSE 改动指向不存在的 W43-W45 ad-suggestion 字段 —— 本 plan U1-U4 严格串行依赖避免此情况
- **Unchanged invariants**：
  - origin/main 历史保持 merge commit 风格（不引入 squash）
  - feat/w4\* 分支命名约定
  - 仓库无 CODEOWNERS / PR template 的现状（本 plan 不修改）

---

## Risks & Dependencies

| Risk                                                                                    | Mitigation                                                                                     |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Stack base re-target 时 GitHub diff 显示意外文件（stack 链漂移）                        | 本地 rebase + `git push --force-with-lease`；rebase 中遇 conflict 停下评估，不在本 plan 内强解 |
| CI flake（e2e SSE / chat tool unit）阻塞合入                                            | retry workflow run；3 次失败停下分析（出 plan 范围）                                           |
| `SLACK_WEBHOOK_STAGING_ALERT` secret 未配 → cron 解锁判定失败                           | U4 R4 manual trigger 是验证点；secret 缺失走 W49 D3 separate ops fix                           |
| 团队其他人在 W49 D2 期间向 main 推 PR 导致 stack rebase 反复                            | W49 D2 当天与团队同步 PR merge window，window 内 PR-1～4 优先                                  |
| reviewer 不可达 → 合入超时                                                              | 项目无 CODEOWNERS，自审 + 关键模块（W48 chat / W47 SSE）邀约同事补 review                      |
| W49 D1 commit 在 CI 上首次运行可能因 hash 变化导致历史 CI 缓存 miss、首次跑久（<15min） | 接受首次较慢；后续 retry 走 cache                                                              |

---

## Documentation / Operational Notes

- 本 plan 完成后由 ce-compound skill 把"4 PR stack 合入流程"沉淀到 `docs/solutions/git-workflow/`（U4 已包含）
- W49 D2 完工后立即开 W49 D3 staging single-brand 灰度（homtone）—— 不在本 plan，但 D2 完工是 D3 前置
- W49 D5（cron 解锁后 + 7 天）做最终 cron 健康度判定 —— 见 `docs/briefs/2026-05-W49-leadership-sync.md` "v2.0 launch readiness 门禁"

---

## Sources & References

- W49 D1 push 4 PR 的会话记录（前序 chat）
- 4 个 PR URL：
  - https://github.com/yaemart/yaemartOS/pull/new/feat/w43-w45-ad-suggestion-gate
  - https://github.com/yaemart/yaemartOS/pull/new/feat/w46-w47-realtime-sse-tanstack-query
  - https://github.com/yaemart/yaemartOS/pull/new/feat/w48-customer-chat-tool-calling
  - https://github.com/yaemart/yaemartOS/pull/new/feat/w49-kpi-smoke-fixes-and-audit
- 相关文档：
  - `docs/W46-W52-checklist.md` — 周排期 + W49 D2 段落
  - `docs/briefs/2026-05-W49-leadership-sync.md` — leadership status
  - `docs/audits/2026-05-W49-sprint-harness-alignment.md` — harness audit baseline
  - `docs/code-hygiene-backlog.md` — §0 P0 sidebar 漏勾 + 后续 backlog
- 相关 workflow：`.github/workflows/ci.yml` / `.github/workflows/staging-smoke.yml`
