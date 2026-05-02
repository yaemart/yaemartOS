---
template: image-brief
version: '1.0'
status: active
created: 2026-05-01
origin: docs/yaemartOS-implementation-plan.md §W11 / U2
type_schema: packages/shared-types/src/image-brief.ts
---

# 图片需求单模板 v1.0

> **使用说明**：运营创建 Brief → 发设计/外包 → 设计按规格交付 → 运营上传 Cloudinary → AI 侧可拉取 URL 组合 Listing。  
> 每个商品（Product）填写一份。同一商品不同品牌/市场，可复制此模板修改 `brand` 和 `market_locale` 字段。

---

## 基本信息

| 字段                  | 值                                                            |
| --------------------- | ------------------------------------------------------------- |
| **Brief 编号**        | `IMG-{BRAND}-{YYYYMMDD}-{SEQ}` _(示例：IMG-HMT-20260501-001)_ |
| **商品 SKU**          |                                                               |
| **商品名称**          |                                                               |
| **品牌**              | Homtone / Spoonlemon / Davivy / Tysun                         |
| **目标市场/语言**     | US-EN / DE-DE / ...                                           |
| **平台**              | Amazon / TikTok / Shopify                                     |
| **需求日期**          | YYYY-MM-DD                                                    |
| **截止日期**          | YYYY-MM-DD                                                    |
| **负责运营**          |                                                               |
| **Cloudinary 文件夹** | `/{brand}/{sku}/`                                             |

---

## A 类：主图（Main Image）

> Amazon 主图要求：纯白背景 RGB(255,255,255)；商品占画面 ≥ 85%；无文字/水印/多余道具。

| #   | 规格要求                               | 文件名约定    | 备注     |
| --- | -------------------------------------- | ------------- | -------- |
| 1   | **3000 × 3000 px**，JPG/TIFF，≥ 72 dpi | `main-01.jpg` | 正面拍摄 |
| 2   | 同上，侧面或 3/4 角度（可选加分）      | `main-02.jpg` |          |

**文案/摆放要求**（描述拍摄角度、道具、特殊要求）：

> _在此填写，例如：正面露出产品 Logo，底部留 5% 空间。_

---

## B 类：场景图（Lifestyle / In-use）

> 展示真实使用场景，可含人物/环境；推荐 16:9 横版（亦接受正方形）。

| #   | 尺寸                                     | 文件名约定     | 场景描述 |
| --- | ---------------------------------------- | -------------- | -------- |
| 1   | **2000 × 2000 px** 或 **3000 × 2000 px** | `scene-01.jpg` |          |
| 2   | 同上                                     | `scene-02.jpg` |          |
| 3   | 同上（可选）                             | `scene-03.jpg` |          |

**人物/道具要求**（年龄段、性别、肤色多样性、关键道具）：

> _在此填写。_

**情绪基调**（活力 / 温馨 / 专业 / 极简）：

> _在此填写。_

---

## C 类：A+ 内容图（Enhanced Brand Content）

> 用于 Amazon A+ / 品牌旗舰店。横幅比 970 × 600 px 或 970 × 300 px；模块型 600 × 600 px。

| #   | 模块类型           | 尺寸         | 文件名约定               | 内容摘要 |
| --- | ------------------ | ------------ | ------------------------ | -------- |
| 1   | Banner（顶部横幅） | 970 × 600 px | `aplus-banner.jpg`       |          |
| 2   | 功能对比图         | 600 × 600 px | `aplus-feature-01.jpg`   |          |
| 3   | 使用步骤图         | 600 × 600 px | `aplus-step-01.jpg`      |          |
| 4   | 卖点强调图         | 600 × 600 px | `aplus-highlight-01.jpg` |          |

**文案内容**（最终确认后填入设计文件）：

> _在此填写标题、副标题、卖点文案（不超过 3 条/图）。_

---

## D 类：Infographic（信息图）

> 用于详情页 or 差评对比；叠加文字说明产品规格/参数/优势。

| #   | 尺寸               | 文件名约定    | 标注内容                     |
| --- | ------------------ | ------------- | ---------------------------- |
| 1   | **2000 × 2000 px** | `info-01.jpg` | 核心规格（尺寸/重量/材质）   |
| 2   | 同上               | `info-02.jpg` | 使用注意事项 / 认证          |
| 3   | 同上（可选）       | `info-03.jpg` | 与竞品对比（需研发提供数据） |

**字体规范**（与品牌设计系统一致）：

> - Homtone：Inter / Noto Sans
> - Spoonlemon：Nunito / Poppins
> - Davivy：DM Sans / Lato
> - Tysun：Roboto / Open Sans

---

## 交付物清单

| 类型             | 数量              | 格式                  | 交付方式                                |
| ---------------- | ----------------- | --------------------- | --------------------------------------- |
| 主图             | ≥ 1 张，建议 2 张 | JPG（无损压缩）       | Cloudinary `/{brand}/{sku}/main-*.jpg`  |
| 场景图           | 2–3 张            | JPG                   | Cloudinary `/{brand}/{sku}/scene-*.jpg` |
| A+ 图            | 4–6 张            | JPG                   | Cloudinary `/{brand}/{sku}/aplus-*.jpg` |
| Infographic      | 2–3 张            | JPG                   | Cloudinary `/{brand}/{sku}/info-*.jpg`  |
| 原始文件（可选） | 与以上对应        | PSD / AI / Figma 链接 | Notion 页面或邮件附件                   |

---

## 审批流

1. 运营填写 Brief → 提交设计
2. 设计初稿 → 运营预审（1 个工作日内反馈）
3. 设计修改（最多 2 轮）→ 运营终审
4. 终稿上传 Cloudinary → 在 yaemartOS 商品页绑定 URL
5. 归档 Brief（Notion 数据库记录状态：`draft / review / approved / archived`）

---

## 参考资源

- ADR-007 Cloudinary 上传约束：`docs/adr/ADR-007-cloudinary.md`
- 品牌设计系统：`docs/ui/A-design-system.md`
- Amazon 主图政策（2025）：[Amazon Image Requirements](https://sellercentral.amazon.com/help/hub/reference/external/G1881)
- Shared Types：`packages/shared-types/src/image-brief.ts`
