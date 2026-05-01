# yaemartOS 评测集（Eval Sets）

> 用途：定期评测 AI 输出质量，对应量化指标 M-03 / M-06 / M-08。  
> 关联文档：`yaemartOS-implementation-plan.md` §5 / §5.1 / ADR-005 §2.10。  
> 维护人：AI 工程师（dev #2）+ 客服负责人（M-03）+ 运营 PM（M-06）。

---

## 目录结构

```
docs/eval-sets/
├── README.md                      # 本文件
├── M-03-customer-support/         # AI 客服命中率 ≥ 65%
│   ├── questions.csv              # 100 题测试集
│   ├── run-eval.ts                # 评测脚本
│   └── results/                   # 每次跑分结果（gitignored 大文件）
├── M-06-listing-blind-review/     # Listing 盲审评分 ≥ 3.5 分
│   ├── samples.csv                # 盲审样本清单
│   ├── rubric.md                  # 评分标准
│   ├── score-sheet.xlsx.template  # 运营填分表模板
│   └── results/
└── M-08-es-recall/                # ES 语义搜索召回率 Top-3 ≥ 70%
    ├── queries.csv                # 测试 query 集
    ├── run-eval.ts                # 评测脚本
    └── results/
```

---

## 评测触发时机

| 评测集 | 触发时机                            | 责任人           |
| ------ | ----------------------------------- | ---------------- |
| M-03   | 每周（自动）+ 每次 prompt 变更 PR   | AI 工程师        |
| M-06   | 每切片末（人工）                    | 运营 PM 组织盲审 |
| M-08   | 每月（自动）+ 每次 ES analyzer 变更 | AI 工程师        |

---

## 评测结果处理

| 情形                                          | 动作                                                  |
| --------------------------------------------- | ----------------------------------------------------- |
| 得分 ≥ 基线（M-03≥65% / M-06≥3.5 / M-08≥70%） | 记录结果，无需行动                                    |
| 得分 < 基线                                   | 提 `issue` + 分析原因 + 14 天内提出改进 PR            |
| 连续 2 次 < 基线                              | 升级 P2，tech lead + 运营 PM 共同决策是否延迟切片上线 |
