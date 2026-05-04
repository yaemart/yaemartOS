---
date: 2026-05-04
category: git_workflow_pattern
tags: [stack-pr, rebase, ci-gate, fetch-prune, commitlint, github-flow, force-with-lease]
applies_to: [all-multi-sprint-batches, all-stack-pr-flows]
status: authoritative
related_plan: docs/plans/2026-05-04-005-chore-w43-w49-stack-pr-merge-plan.md
related_brief: docs/briefs/2026-05-W49-leadership-sync.md
problem_type: ops-pattern
module: git-workflow
---

# Stack PR Orchestration — 多 sprint 累积工作的拆分与合入

> 经验日期：2026-05-04 (W49 D1-D2)
> 触发场景：W43-W49 七周累积 70+ 文件未 commit + 4 个 sprint 跨度，需要拆成多个可 review 的 PR 而非单一巨型 super-PR
> 适用：任何"working tree 累积多 sprint 工作 + 远端 main 已被 squash-merge 推进 + 必须串行合并"的批次清理场景

---

## TL;DR — 4 PR 串行合并时间线

| 阶段                          | 动作                                                              | 耗时      | 出错风险                                         |
| ----------------------------- | ----------------------------------------------------------------- | --------- | ------------------------------------------------ |
| 0. Diagnostic                 | `git fetch origin --prune` 看清 origin/main 真实 HEAD             | 2 min     | 最高（不做这步是 60% 后续翻车原因）              |
| 1. Working tree 保护          | `git stash push -u -m '...'` 把 70 个未 commit 文件暂存           | 30 sec    | 低                                               |
| 2. 本地 main 同步             | `git pull --ff-only origin main` 让本地跟上远端                   | 30 sec    | 中（如果本地 main 有 simulated merge 会 reject） |
| 3. Rebase 现有 feature branch | 期望 git 自动 drop 已被 squash-merge 的老 commit                  | 1 min     | 中（conflict 时停下评估）                        |
| 4. 拆分 commit                | 从 stash pop + 选择性 `git add` + commit + push（每 sprint 一组） | 30-45 min | 高（zsh glob、commitlint、文件归属判定）         |
| 5. GitHub UI 串行 merge       | 4 个 PR 按 stack 依赖逐个 merge commit + base re-target           | 30-60 min | 中（CI flake、reviewer 调度）                    |
| 6. Cleanup                    | 本地 ff-pull + 删 branch + 删 remote stale branch                 | 5 min     | 低                                               |

总计约 1.5-2.5 小时（含 CI 等待）。

---

## 关键结论摘要

| 问题                                                       | 现象                                                                                                              | 解决                                                                                                                   | 严重度        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------- |
| 过期 `origin/main` ref 导致 push reject                    | `git status` 显示本地 ahead 35 commits，但 `git push` 报 `non-fast-forward`                                       | 永远先 `git fetch origin --prune` 再判断 ahead/behind                                                                  | 🔴 P0         |
| `git rebase` 自动 drop squash-merged commit                | feat branch 上 4 个 W34-W42 commit 在 rebase 到新 main 时"消失"——其实 git 检测 patch 已存在于 squash merge 中     | 这是 feature 不是 bug；rebase 后用 `git log main..HEAD` 验证只剩本 sprint 真实独有 commit                              | 🟢 OK         |
| commitlint body line 长度 100 字符硬约束                   | husky `commit-msg` 拒绝 commit，错误 `body's lines must not be longer than 100 characters`                        | commit body 全部手动控制行宽 ≤100；HEREDOC 写多行时每行硬换                                                            | 🟡 重做       |
| stack PR 的 CI 不触发（base != main）                      | PR-2/3/4 base 设为前一 PR 时，`.github/workflows/ci.yml` 的 `pull_request: branches: [main]` 不匹配，CI 不跑      | 必须串行合并；前一个 merge 后改后一个 base 到 main 才能跑 CI                                                           | 🟡 设计约束   |
| GitHub auto-delete branch 仅勾选时生效                     | PR-1 (#14) 的 remote branch merge 后未自动删除（最早开 PR 时未勾"Delete after merge"），PR #15/#16/#17 都自动删了 | 在 GitHub UI 手动 `git push origin --delete <branch>`，或全局打开 repo Settings → "Automatically delete head branches" | 🟢 一次性     |
| 70 个未 commit 文件按 sprint 分类需要外部知识              | 仅看 git status 无法判断文件属于哪个 sprint（W46-W47 SSE / W48 chat / W49 KPI）                                   | 用 sprint audit 文档（如 `docs/audits/2026-05-W49-sprint-harness-alignment.md` §1）作 ground truth                     | 🟡 需文档先行 |
| stash 的 base 在 feat branch 上，pop 到 main 可能 conflict | 如果切到 main 再 pop，stash 内容引用的 feat-only 文件状态会冲突                                                   | 建议从原 feat branch 切 stack branch（不切 main）后 pop                                                                | 🟡 需注意     |

---

## 详细问题分析

### 问题 1：过期 `origin/main` 引用导致误判 push 状态

**现象**：

W49 D1 push 4 PR 之前，`git status` / `git branch -vv` 都显示本地 main `ahead 35 commits`：

```
main ... [origin/main: ahead 35] Merge pull request #10 from yaemart/feat/w36-w39-...
```

按字面理解，本地有 35 个 commit 没推到 origin。但 `git push origin main` 报：

```
! [rejected]  main -> main (non-fast-forward)
```

**根因**：

`git status` 的 ahead/behind 是基于 `origin/main` 的本地 tracking ref，这个 ref 仅在 `git fetch` 时更新。如果上次 fetch 在某次 squash merge 之前，本地看到的 origin/main HEAD 就是过期的。

实际状态：

- 上次 fetch 时 origin/main = `9b5f579`（W27-W30 时期）
- 实际远端 origin/main = `7b42943` Merge PR #13（W40-W42 时期）
- 本地 main 仅是 `fd68bb9` Merge PR #10（W36-W39 时期）

即**远端反而领先**本地 main 9 个 commit，但本地 ref 过期让 git 误以为本地领先 35 个。

**解决**：

在做任何 push / rebase / 分支决策前，**永远先 fetch**：

```bash
git fetch origin --prune
```

`--prune` 顺手清掉 remote 已删除的本地 tracking ref，让 `git branch -vv` 能正确显示 `[origin/...: gone]`。

**验证检查清单**：

- `git log origin/main --oneline -1` 是真实远端 HEAD
- `git merge-base --is-ancestor main origin/main && echo YES` 看本地是否在远端祖先链上
- `git push --dry-run origin main` 在真正 push 前看是否能 fast-forward

---

### 问题 2：`git rebase` 自动 drop squash-merged commit

**现象**：

W49 D1 rebase `feat/w43-w45-ad-suggestion-gate`（其上 7 个独有 commit）到新 main（已含 PR #11/#12/#13 squash merge），rebase 命令输出 "Successfully rebased and updated"，但 `git log main..HEAD` 只剩 3 个 commit：

```
3066df3 feat(ads-web): U5 ad suggestion frontend
e432332 feat(ads): U4 execution gate API
f4aeb57 feat(ads): U1-U3 AdSuggestion data model
```

原本应该在的另外 4 个 commit（cb2d388 P1 对齐 / 9d61e71 ad dashboard / 36647ff AdSyncModule / ba06663 AdDailyStat）"消失"了。

**根因**（这是 feature 不是 bug）：

GitHub 上的 PR #11/#12/#13 用 squash merge 模式合入 main，每个 squash commit 包含本 sprint 全部改动。本地 feat/w43-w45 上的 4 个老 commit 是 squash 之前的版本，patch 内容跟 squash commit 实质一致。

`git rebase` 在 cherry-pick 每个 commit 时会检查：如果当前 commit 的 patch 已经在 base 上存在（即使 commit hash 不同），rebase 会自动 skip。这是 git 的 [`patch-id` matching](https://git-scm.com/docs/git-patch-id)。

**验证**：

rebase 后用以下命令确认只剩本 sprint 真实独有 commit：

```bash
git log main..HEAD --oneline
# 应该只显示本 sprint 实际新增的 commit
```

如果发现"消失"的 commit，去 origin/main 上找对应 squash commit：

```bash
git log origin/main --oneline | grep -i "<feature keyword>"
```

**反模式**：

不要用 `git rebase --skip` 强制跳过——这是用在 conflict 时手动决策跳过当前 commit。git 自动 drop 是基于 patch-id 自动判断的，不需要人工干预。

---

### 问题 3：commitlint body line 长度 100 字符硬约束

**现象**：

W49 D1 PR-2 commit message 含较长描述行（如 "5 admin write pages 接入 SSE (W46 P0-B/C + W47 P0-D): listing-editor + version-timeline + ..."），husky commit-msg hook 拒绝：

```
✖   body's lines must not be longer than 100 characters [body-max-line-length]
```

**根因**：

仓库的 `commitlint.config.js`（或继承 conventional preset）默认开启 `body-max-line-length: 100`。HEREDOC 多行 commit message 不会自动 wrap，必须每行手动控制宽度。

**解决模式**：

```bash
git commit -m "$(cat <<'EOF'
feat(scope): 标题 ≤72 字符

第一段 body，每行手动换行
保持 ≤100 字符。中文字符按 1 字符算，
所以中文行可以塞更多内容。

- 列表项也要遵守
  延续行缩进
EOF
)"
```

**预防**：

- 写 commit message 前先估行宽，长描述拆成多行
- 编辑器开 ruler/guide 在 100 字符
- CI 失败时直接看 hook 报错的行号修

---

### 问题 4：Stack PR 的 CI 触发条件 + base re-target 时机

**现象**：

W49 D2 push 4 PR 后，PR-2/3/4 的 GitHub Actions 页面 "CI" workflow 没有 run。这是预期行为。

**根因**：

`.github/workflows/ci.yml` 触发条件：

```yaml
on:
  pull_request:
    branches: [main]
```

只有当 PR 的 **base branch = main** 时才触发 CI。stack PR 的 PR-2 base = feat/w43-w45-ad-suggestion-gate（不是 main），所以 CI 不跑。

**这是设计而非 bug**：避免对未合并的 stack 链做无意义的 CI 浪费。

**正确合并节奏**：

```
1. PR-1 base=main → CI 跑 → 绿 → merge commit 入 main
2. PR-2 base 在 GitHub UI 改成 main → 触发 CI → 绿 → merge commit 入 main
3. PR-3 base 改 main → CI → merge
4. PR-4 base 改 main → CI → merge
```

**关键**：base re-target 用 GitHub UI dropdown，**不要本地 force-push**。原因：

- UI 改 base 不需要改 commit hash，stack 链和 review history 完整保留
- 本地 `git push --force` 会重写 commit hash，丢失 reviewer 的旧 review comments
- 如果 base 改后 GitHub diff 显示意外文件（说明 stack 链漂移），才本地 rebase + `git push --force-with-lease`（注意是 `--force-with-lease` 不是 `--force`，防止 race condition 误覆盖他人 push）

**仓库 Merge 模式选择**：

W49 D2 验证：仓库设置使用 **merge commit** 模式（非 squash），保留 PR 内的多个 commit history。这对 stack PR 友好——base re-target 时 GitHub diff 计算正确。

如果仓库改用 squash merge，stack 链合并时第二个 PR 的 base ref 会消失（因为前一个 PR 的 commit hash 不再存在），需要本地 rebase + force-with-lease 重建 stack。

---

### 额外坑 5：GitHub auto-delete branch 行为不一致

**现象**：

W49 D2 4 PR 全 merge 后，`git fetch --prune` 显示：

```
- [deleted]  origin/feat/w46-w47-realtime-sse-tanstack-query
- [deleted]  origin/feat/w48-customer-chat-tool-calling
- [deleted]  origin/feat/w49-kpi-smoke-fixes-and-audit
```

但 PR-1 的 `feat/w43-w45-ad-suggestion-gate` 没被自动删，仍在 remote。

**根因**：

GitHub 的 "Automatically delete head branches" 是 **repo-level setting**（Settings → General → Pull Requests），W49 D2 时已开启，所以 PR #15/#16/#17 merge 时 head branch 自动删除。但 PR #14 (W43-W45) 是 W49 D2 的第一个被 merge 的 PR，可能在 merge 时 reviewer 临时取消了 "Delete branch after merge" 勾选，或 PR-1 是更早创建的（W43 时期）所以使用 PR 内部的旧设置。

**解决**：

手动删除剩余 remote branch：

```bash
git push origin --delete feat/w43-w45-ad-suggestion-gate
```

**预防**：

repo Settings 全局开 "Automatically delete head branches"。每个 PR merge 前 reviewer 不要手动取消勾选。

---

### 额外坑 6：zsh 在 paren/bracket 路径上的 glob 解析

**现象**：

执行 `git add apps/web/app/[locale]/(admin)/ads/dashboard/ad-dashboard-client.tsx` 报：

```
zsh: no matches found: apps/web/app/[locale]/(admin)/ads/dashboard/ad-dashboard-client.tsx
```

**根因**：

zsh 把 `[locale]` 当 glob bracket 解析，把 `(admin)` 当 extended glob group。即使用 `\(admin\)` escape 仍 fail。

**解决**：

整个路径用单引号包：

```bash
git add 'apps/web/app/[locale]/(admin)/ads/dashboard/ad-dashboard-client.tsx'
```

或临时 disable glob：

```bash
setopt no_nomatch  # 一次性，之后 setopt nomatch 恢复
```

---

## 推荐工作流 — 多 sprint 批次清理 end-to-end checklist

### 阶段 1：Diagnostic（始终先做）

```bash
git fetch origin --prune                              # 永远先 fetch
git log origin/main --oneline -5                      # 看真实远端 HEAD
git status --short | wc -l                            # 总文件数
git stash list                                        # 检查现有 stash
```

### 阶段 2：保护 working tree

```bash
git stash push -u -m "WIP: <sprint-range> <work-summary>"
git status --short                                    # 应该 clean
```

### 阶段 3：本地 main 同步

```bash
git checkout main
git pull --ff-only origin main                        # 不能 ff 时停下评估
```

### 阶段 4：现有 feature branch rebase

```bash
git checkout <existing-feat-branch>
git rebase main                                       # 自动 drop squash-merged commits
git log main..HEAD --oneline                          # 验证只剩本 sprint 真实 commit
```

### 阶段 5：按 sprint 拆分 stack branch

```bash
# 每个 sprint 一组：
git checkout -b feat/<sprint>-<descriptive-name>
git stash pop                                         # 第一次 pop，70 个文件回来
git add <sprint-relevant-files>                       # 选择性 stage
git status --short | grep -v '^[AM]'                  # 验证剩余文件归下一 sprint
git commit -m "feat(<sprint>): ..."                   # 注意 body line ≤100
git push -u origin HEAD
# 下一 sprint 从当前 branch 切（stack）：
git checkout -b feat/<next-sprint>-...
# stash 已空，剩余文件已在 working tree，继续 add
```

### 阶段 6：GitHub UI 串行 merge

```
1. PR-1 base=main → 等 CI → reviewer → Merge commit
2. PR-2 base 改 main（GitHub UI dropdown）→ CI → merge
3. PR-3 base 改 main → CI → merge
4. PR-4 base 改 main → CI → merge
```

### 阶段 7：Cleanup

```bash
git checkout main
git pull --ff-only origin main                        # 拉下 N 个 merge commit
git fetch origin --prune                              # 清 remote 删除的 ref
for b in feat/<sprint1> feat/<sprint2> ...; do
  git branch -D "$b"                                  # 本地删
  git push origin --delete "$b" 2>/dev/null || true   # 远端 (auto-delete 漏的)
done
git stash list                                        # 应该 empty
```

### 阶段 8：文档同步 + institutional learning

- 更新 sprint checklist 的 D2/D3 解锁动作行
- 更新 leadership brief 的 ops wrap-up 段落
- （本文档）沉淀至 `docs/solutions/<category>/`
- 引用至相关 ADR / runbook

---

## 反模式（不要这么做）

- ❌ **不 fetch 直接 push**：60% 概率因过期 ref 翻车
- ❌ **本地 force-push 改 stack base**：丢失 review comments + 重写 commit hash
- ❌ **用 `git push --force`（不带 `--with-lease`）**：race condition 时误覆盖他人 push
- ❌ **`git checkout main` 后 stash pop**：stash base 是 feat branch，pop 到 main 可能 conflict
- ❌ **squash merge 用于 stack PR**：第二个 PR base ref 会消失，需要本地 rebase 重建链
- ❌ **跨 sprint 一次性巨型 PR**：reviewer 不可消化、bisect 无意义、回滚粒度太粗
- ❌ **rebase 中遇 conflict 强行 `--skip`**：可能丢失真正需要的 commit；conflict 时停下评估

---

## 相关文件

- 执行 plan：[`docs/plans/2026-05-04-005-chore-w43-w49-stack-pr-merge-plan.md`](../../plans/2026-05-04-005-chore-w43-w49-stack-pr-merge-plan.md)
- W49 leadership brief（含 D2 ops wrap-up）：[`docs/briefs/2026-05-W49-leadership-sync.md`](../../briefs/2026-05-W49-leadership-sync.md)
- W46-W52 sprint checklist：[`docs/W46-W52-checklist.md`](../../W46-W52-checklist.md)
- 相关 4 PR：[#14](https://github.com/yaemart/yaemartOS/pull/14) · [#15](https://github.com/yaemart/yaemartOS/pull/15) · [#16](https://github.com/yaemart/yaemartOS/pull/16) · [#17](https://github.com/yaemart/yaemartOS/pull/17)

---

## 进一步阅读

- Git patch-id 自动 drop 机制：[git-patch-id docs](https://git-scm.com/docs/git-patch-id)
- `--force-with-lease` vs `--force`：[Atlassian git tutorial](https://www.atlassian.com/git/tutorials/git-forcing-changes)
- conventional-changelog/commitlint body-max-line-length 配置：[commitlint rules](https://commitlint.js.org/reference/rules.html#body-max-line-length)
- Stack PR 工具生态参考：Graphite / Sapling / git-branchless（W49 团队未采用，本流程纯 git + GitHub UI 完成）
