# W21-W23 存量数据迁移验收脚本

**日期：** 待填写（计划 2026 年 5 月中旬执行）  
**执行人：** 开发 + 运营各一名  
**目标：** Spoonlemon × Amazon + Walmart 全量在售 SKU 入库，准确率 ≥ M-07（85%）

---

## 前置条件

- [ ] Spoonlemon × Amazon US 所有在售店铺已在 `/shops` 页面完成领星 shopId 绑定
- [ ] Spoonlemon × Walmart US 所有在售店铺已在 `/shops` 页面完成领星 shopId 绑定
- [ ] Homtone × Amazon US 已有绑定数据（用于基准回归）
- [ ] Homtone × Walmart US 至少 1 个已绑定店铺
- [ ] 后端环境变量：`GEMINI_API_KEY`、`LINGXING_APP_KEY`、`LINGXING_APP_SECRET`、`REDIS_URL` 均已配置
- [ ] 功能开关 `feature_flag.PATH_A_MIGRATION` = `"true"`（在 `/settings` → Feature Flags 确认）

---

## 运行顺序

### Run 1：Homtone × Amazon US（基准回归）

**触发方式：** 进入 `/migration` 页面 → 选择品牌=Homtone、平台=Amazon → 选择所有店铺 → "开始导入"

| 项目       | 期望值                        | 实际值（填写） |
| ---------- | ----------------------------- | -------------- |
| 任务状态   | completed                     |                |
| 导入成功数 | > 0                           |                |
| 导入失败数 | —                             |                |
| 成功率     | ≥ 85%（M-07 达标）            |                |
| 是否去重   | 二次运行应有 deduplicated > 0 |                |

**截图位置：** _（请粘贴任务完成截图）_

---

### Run 2：Homtone × Walmart US

**触发方式：** 选择品牌=Homtone、平台=Walmart → 选择所有店铺 → "开始导入"

| 项目         | 期望值                 | 实际值（填写） |
| ------------ | ---------------------- | -------------- |
| 任务状态     | completed              |                |
| 导入成功数   | > 0                    |                |
| 成功率       | ≥ 85%（M-07 达标）     |                |
| Walmart 字段 | `keyFeatures` 字段非空 |                |

**截图位置：** _（请粘贴任务完成截图）_

---

### Run 3：Spoonlemon × Amazon US（核心验收）

**触发方式：** 选择品牌=Spoonlemon、平台=Amazon → 选择所有店铺 → "开始导入"

| 项目       | 期望值                           | 实际值（填写） |
| ---------- | -------------------------------- | -------------- |
| 任务状态   | completed                        |                |
| 导入成功数 | ≥ Spoonlemon 在售 SKU 总数 × 85% |                |
| 成功率     | ≥ 85%（M-07 达标）               |                |
| 失败 SKU   | 导出失败列表，与运营核对原因     |                |

**运营核对（逐条）：**

| SKU | AI 提取标题 | 领星原始标题 | 是否一致 | 备注 |
| --- | ----------- | ------------ | -------- | ---- |
|     |             |              |          |      |
|     |             |              |          |      |
|     |             |              |          |      |

**截图位置：** _（请粘贴任务完成截图）_

---

### Run 4：Spoonlemon × Walmart US（核心验收）

**触发方式：** 选择品牌=Spoonlemon、平台=Walmart → 选择所有店铺 → "开始导入"

| 项目       | 期望值             | 实际值（填写） |
| ---------- | ------------------ | -------------- |
| 任务状态   | completed          |                |
| 导入成功数 | > 0                |                |
| 成功率     | ≥ 85%（M-07 达标） |                |

**截图位置：** _（请粘贴任务完成截图）_

---

## 跨平台查询测试（W21-W23 验收要求）

在 `/products` 页面执行以下查询：

- [ ] 按品牌=Spoonlemon 过滤 → 列表返回 Amazon + Walmart 双平台数据
- [ ] 选择任意一个 SKU → 详情页显示 Amazon 和 Walmart 两个版本的 listing

---

## 汇总

| 运行批次                | 成功率 | M-07 达标  | 执行人 |
| ----------------------- | ------ | ---------- | ------ |
| Homtone × Amazon US     |        | ☐ Yes ☐ No |        |
| Homtone × Walmart US    |        | ☐ Yes ☐ No |        |
| Spoonlemon × Amazon US  |        | ☐ Yes ☐ No |        |
| Spoonlemon × Walmart US |        | ☐ Yes ☐ No |        |

**最终结论：**

- [ ] 全部 4 次运行达标 → W21-W23 验收通过，可推进 W24-W25
- [ ] 有运行未达标 → 创建 defect 任务，修复后重跑

---

## 若 Walmart API 端点有变更

当前代码路径：`packages/lingxing-client/src/operations/listings.ts`，`getWalmartListingsForShop()` 使用端点 `/erp/sc/walmart/listing`。

若 APISIX 迁移后该端点返回 404 或签名错误，请：

1. 查阅最新领星 OpenAPI 文档，确认正确端点
2. 修改 `packages/lingxing-client/src/operations/listings.ts` 第 ~96 行的路径字符串
3. 重跑受影响的测试：`pnpm --filter @yaemartos/lingxing-client test`

---

_文档版本：2026-05-03，依据 `docs/plans/2026-05-03-001-feat-w21-23-migration-shop-picker-validation-plan.md`_
