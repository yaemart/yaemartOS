# yaemartOS 客服门户完整 UI 设计

> 落地切片：S3 W27-W36（客户中心 V1）  
> AI 聊天界面见 `docs/ui/E-customer-chat.md`（本文不重复）  
> 对标：Dyson Support（门户首页）+ Breville（工单系统）+ iRobot（保修注册）  
> 关联 ERD：`docs/erd/domain-model.md` — 客户域 tenant schema（各品牌独立）  
> 关联指标：M-03（AI 命中率）/ M-11（保修注册成功率）/ M-12（手册下载量）/ M-13（0 跨品牌泄漏）

---

## 0. 门户架构概览

4 品牌各拥有独立域名，共享相同页面结构，通过 CSS 品牌变量实现视觉差异。

| 品牌       | 域名（示例）           | 主色        | 风格                                |
| ---------- | ---------------------- | ----------- | ----------------------------------- |
| Homtone    | support.homtone.com    | amber-600   | 温暖家庭感，圆角大，衬线字体点缀    |
| Spoonlemon | support.spoonlemon.com | emerald-600 | 活力清新，卡片有绿色边框高亮        |
| Davivy     | support.davivy.com     | zinc-900    | 极简黑白，线条感，无装饰图标        |
| Tysun      | support.tysun.com      | blue-700    | 专业稳重，蓝色渐变 hero，表格密度高 |

**所有品牌共用的技术结构**：Next.js App Router + `[brand]` segment（内部多租户路由）或独立域名映射。

---

## 1. 门户 Shell（所有页面共用）

### 1.1 Header

```
┌──────────────────────────────────────────────────────────────────┐
│ [● HOMTONE LOGO]            [Home] [Manuals] [Warranty] [Orders] │
│                                              [EN ▾] [Sign In]    │
└──────────────────────────────────────────────────────────────────┘
```

| 元素      | 规格                                                            |
| --------- | --------------------------------------------------------------- |
| Logo 区域 | 品牌 logo（Cloudinary CDN）+ 品牌名，`h-10`                     |
| 导航链接  | `text-sm font-medium`，hover 底部下划线（`--brand-primary` 色） |
| 语言切换  | 下拉菜单，支持 5 语言（EN/ES/FR/DE/IT）                         |
| 未登录    | `[Sign In]` 按钮（`outlined` 风格，`border-[--brand-primary]`） |
| 已登录    | 用户头像 + 名称缩写下拉（含 My Account / Sign Out）             |
| 移动端    | Hamburger 菜单，展开 drawer                                     |

**品牌差异化 Header**：

| 品牌       | Header 特殊处理                                           |
| ---------- | --------------------------------------------------------- |
| Homtone    | header 背景 `bg-amber-50`，logo 左侧有暖色竖条            |
| Spoonlemon | header 背景 `bg-white`，logo 下方有 emerald 细线          |
| Davivy     | header 背景 `bg-zinc-950`（深色），文字全白               |
| Tysun      | header 背景蓝色渐变 `from-blue-900 to-blue-700`，文字全白 |

### 1.2 Footer

```
┌──────────────────────────────────────────────────────────────────┐
│ © 2026 Homtone. All rights reserved.                            │
│ [Privacy Policy] [Terms] [Contact Us] [Sitemap]                 │
│                                                      [FB][IG][X] │
└──────────────────────────────────────────────────────────────────┘
```

Footer 背景：`bg-zinc-900 text-zinc-400`（所有品牌统一深色底部）。

---

## 2. 门户首页（/）

### 2.1 Hero 区域

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│         Hi, how can we help you today?                          │
│                                                                  │
│    ┌──────────────────────────────────────────────────────┐     │
│    │ 🔍  Search for help...                               │     │
│    └──────────────────────────────────────────────────────┘     │
│                                                                  │
│    Popular: [Warranty Registration] [Track Order] [User Manual] │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

| 元素         | Homtone                                 | Spoonlemon                 | Davivy                      | Tysun                         |
| ------------ | --------------------------------------- | -------------------------- | --------------------------- | ----------------------------- |
| Hero 背景    | `bg-amber-50` + 暖色插画                | `bg-emerald-50` + 果蔬插画 | `bg-zinc-50` + 无插画纯文字 | `bg-blue-700` 渐变 + 白色文字 |
| 标题字体     | 衬线点缀（`font-serif`）                | 无衬线粗体                 | 无衬线超细体（`font-thin`） | 无衬线蓝白                    |
| 搜索框边框   | `border-amber-300 focus:ring-amber-300` | `border-emerald-300`       | `border-zinc-300`           | `border-blue-300`             |
| Popular 标签 | amber 背景丸                            | emerald 背景丸             | zinc 背景丸                 | blue 背景丸                   |

搜索框功能：输入时实时搜索 FAQ + 手册标题（ES 全文检索 S2+；S3 上线时接入）。

### 2.2 快捷操作卡片区

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ 📦               │  │ 🛡️               │  │ 📖               │  │
│  │ Track My Order  │  │ Register        │  │ User Manual     │  │
│  │                 │  │ Warranty        │  │                 │  │
│  │ Check your      │  │ Protect your    │  │ Download PDF    │  │
│  │ order status    │  │ product         │  │ in any language │  │
│  │ with order ID   │  │                 │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                        │
│  │ 💬               │  │ 🎫               │                        │
│  │ Chat with AI    │  │ My Tickets      │  ← 登录用户才展示        │
│  │                 │  │                 │                        │
│  │ Get instant     │  │ View your open  │                        │
│  │ support         │  │ support tickets │                        │
│  └─────────────────┘  └─────────────────┘                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

- 卡片样式：`bg-white rounded-2xl border border-zinc-200 hover:border-[--brand-primary] hover:shadow-md transition p-6`
- 悬停效果：边框变品牌色 + 轻微 shadow，`transition-all duration-150`
- `My Tickets` 卡片：未登录时不显示；已登录且有未解决工单时在卡片右上角显示数字 badge

### 2.3 热门 FAQ 区域

展示该品牌前 6 条点击量最高的 FAQ（来自产品 FAQ 库，ES 统计）。

```
┌──────────────────────────────────────────────────────────────────┐
│  Popular Questions                               [View All FAQ →]│
│                                                                  │
│  Q: How do I register my product warranty?          >           │
│  Q: My device won't turn on — what should I do?     >           │
│  Q: Can the cooking pot go in the dishwasher?       >           │
│  Q: Where can I find the user manual?               >           │
│  Q: How do I contact a human agent?                 >           │
│  Q: What's covered under the warranty?              >           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

点击 FAQ 条目展开 inline 答案（accordion 展开，不跳转新页面）。

---

## 3. 非登录订单查询页（/orders/lookup）

### 3.1 查询表单

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│              Track Your Order                                  │
│                                                                │
│   Order ID *                                                   │
│   ┌──────────────────────────────────────────────────────┐    │
│   │ e.g. 113-1234567-8901234                             │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                                │
│   Email Address *                                              │
│   ┌──────────────────────────────────────────────────────┐    │
│   │ The email you used to place the order                │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                                │
│                                  [Track Order →]              │
│                                                                │
│   ─────────────────────────────────────────────────────────   │
│   Have an account? [Sign in] for full order history           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 查询结果展示

```
┌────────────────────────────────────────────────────────────────┐
│ ✓  Order Found                                                 │
│                                                                │
│ Order #113-1234567-8901234                                     │
│ Placed on March 15, 2026                                       │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │  ●══════════════════════════════○               ○        │  │
│ │  Ordered      Processing    Shipped     Delivered        │  │
│ │  Mar 15                     Mar 17                       │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ Status: Shipped  ·  Tracking: 1Z123ABC (UPS) [Track ↗]       │
│                                                                │
│ Items ordered:                                                 │
│  · Homtone 6QT Slow Cooker (×1)  —  $89.99                   │
│                                                                │
│ Estimated delivery: March 19–21, 2026                         │
│                                                                │
│ [Need Help with This Order? Chat with AI →]                  │
└────────────────────────────────────────────────────────────────┘
```

**防爆破**：同一 IP 每小时查询超 10 次，返回 429 并显示冷却倒计时（`OrderLookup.attempt_count`）。

**数据来源**：S3 阶段通过领星 API 查询订单状态（只读）；S1-S2 展示 mock 或"请通过 Amazon 官网查询"提示。

### 3.3 未找到订单状态

```
┌────────────────────────────────────────────────────────────────┐
│  ⚠️  Order Not Found                                            │
│                                                                │
│  We couldn't find an order with that ID and email.            │
│  Please double-check and try again.                           │
│                                                                │
│  Tips:                                                         │
│  · Make sure you're entering the order ID from the           │
│    Amazon confirmation email                                  │
│  · Try the email you used when placing the order             │
│                                                                │
│  [Try Again]        [Chat with Support →]                     │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. 保修注册流（/warranty/register）

### 4.1 步骤指示器

```
Step 1 of 3      ●─────○─────○
                找到产品  填写信息  完成
```

`stepper` 组件：`text-xs text-zinc-500`；当前步骤圆点 `bg-[--brand-primary]`；已完成步骤 `bg-[--brand-primary]/40`。

### 4.2 Step 1：找到产品

```
┌──────────────────────────────────────────────────────────────┐
│  Find Your Product                                           │
│                                                              │
│  Model Number *                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ e.g. SL-6QT-001 (found on the bottom of product)   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  [OR Search by Product Name]                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🔍 Search...                                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [Product Image]  6QT Programmable Slow Cooker   [✓]  │ │
│  │                   Model: SL-6QT-001                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│                                         [Next: Purchase Info →]│
└──────────────────────────────────────────────────────────────┘
```

搜索来源：`Article.model_number`（精确匹配）或 `Product.name`（模糊搜索）。

### 4.3 Step 2：填写购买信息

```
┌──────────────────────────────────────────────────────────────┐
│  Purchase Information                                        │
│                                                              │
│  Purchase Date *                                             │
│  ┌──────────────────────┐                                    │
│  │ MM/DD/YYYY          │  ← 日期选择器                       │
│  └──────────────────────┘                                    │
│                                                              │
│  Where did you buy it? *                                     │
│  ○ Amazon      ○ Walmart      ○ Brand Website      ○ Other  │
│                                                              │
│  Order ID / Receipt Number                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Optional — helps verify your warranty                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Your Email *  （或自动填入登录用户邮箱）                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ your@email.com                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Your Name *                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [← Back]                         [Register Warranty →]    │
└──────────────────────────────────────────────────────────────┘
```

已登录用户：Email + Name 自动预填，可修改。

### 4.4 Step 3：注册成功

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│         ✅  Warranty Registered!                             │
│                                                              │
│  Your product is now protected.                             │
│                                                              │
│  Product:   6QT Programmable Slow Cooker                    │
│  Registered: April 30, 2026                                  │
│  Warranty expires: April 30, 2027  (12 months)             │
│                                                              │
│  A confirmation has been sent to your@email.com             │
│                                                              │
│  ──────────────────────────────────────────────────────     │
│  What's next?                                               │
│                                                              │
│  [📖 View User Manual]   [💬 Chat with Support]             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**保修有效期**：由后端根据 `Category` 配置的 warranty_months 字段自动计算（S3 实现；S1 mock 显示 12 个月）。

---

## 5. 手册下载页（/manuals）

### 5.1 列表视图

```
┌────────────────────────────────────────────────────────────────┐
│  User Manuals & Guides                                         │
│                                                                │
│  [🔍 Search manuals...] [Category ▾] [Language ▾]             │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ [📄]  6QT Programmable Slow Cooker User Manual         │   │
│  │       Homtone · Slow Cookers · Updated Mar 2026        │   │
│  │       🌐 EN  ES  FR  DE  IT  (5 languages)            │   │
│  │       [↓ English PDF]  [Choose Language ▾]            │   │
│  ├────────────────────────────────────────────────────────┤   │
│  │ [📄]  Professional Blender 2000W Manual                │   │
│  │       Homtone · Kitchen Appliances · Updated Jan 2026  │   │
│  │       🌐 EN  ES  FR  (3 languages)                    │   │
│  │       [↓ English PDF]  [Choose Language ▾]            │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  [Load more]                                                   │
└────────────────────────────────────────────────────────────────┘
```

| 元素     | 规格                                                                                 |
| -------- | ------------------------------------------------------------------------------------ |
| 每行容器 | `flex gap-4 p-4 rounded-xl border border-zinc-200 hover:border-[--brand-primary]/40` |
| 文件图标 | `w-10 h-10 text-[--brand-primary]`（Lucide `FileText`）                              |
| 手册标题 | `text-base font-medium text-zinc-900`                                                |
| 元数据   | `text-xs text-zinc-400 mt-0.5`                                                       |
| 语言标签 | `text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded`（每种语言一个）            |
| 下载按钮 | `bg-[--brand-primary] text-white text-sm px-3 py-1.5 rounded-lg`                     |
| 语言下拉 | shadcn/ui `DropdownMenu`，选中后自动触发下载                                         |

### 5.2 下载行为

- 文件存储在 Cloudinary（`/manuals/brand/product-model/lang.pdf`）
- 点击下载：`window.open(cloudinaryUrl, '_blank')`（不经后端代理，直接 CDN 链接）
- 下载记录写入 `AiCallLog` 的扩展表（S3+，用于 M-12 下载量统计）
- 页面 URL 支持语言参数：`/manuals?lang=de`（打开页面时预选语言过滤）

---

## 6. 工单列表（/tickets） — 需登录

### 6.1 工单列表

```
┌────────────────────────────────────────────────────────────────┐
│  My Support Tickets                         [+ New Ticket]     │
│                                                                │
│  [All] [Open] [In Progress] [Resolved] [Closed]               │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔴  #TKT-001  My slow cooker won't turn on             │  │
│  │     Product Issue · Opened 3 days ago                   │  │
│  │     Last reply: Support Agent — 2 hours ago             │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 🟡  #TKT-002  Question about warranty coverage          │  │
│  │     Warranty · Opened 1 week ago                        │  │
│  │     Last reply: You — 5 days ago                        │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 🟢  #TKT-003  Wrong item received — Resolved            │  │
│  │     Shipping Issue · Resolved Apr 20                    │  │
│  │     Rating: ★★★★★                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**工单状态图标**：

| 状态        | 颜色                    | 文案        |
| ----------- | ----------------------- | ----------- |
| open        | `text-red-500` 红点     | Open        |
| in_progress | `text-amber-500` 黄点   | In Progress |
| resolved    | `text-emerald-500` 绿点 | Resolved    |
| closed      | `text-zinc-300` 灰点    | Closed      |

### 6.2 工单详情（/tickets/[id]）

```
┌────────────────────────────────────────────────────────────────┐
│ [← My Tickets]  #TKT-001  My slow cooker won't turn on  🔴 Open│
│ Product Issue · Homtone · Created April 27, 2026               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  CONVERSATION TIMELINE                                         │
│  ─────────────────────────────────────────────────────────    │
│                                                                │
│  [👤] You  · Apr 27, 10:30 AM                                 │
│  My 6QT slow cooker won't turn on at all. I've tried          │
│  different outlets. Bought 2 months ago.                      │
│                                                                │
│  [🤖] AI Support · Apr 27, 10:30 AM (auto-reply)             │
│  I'm sorry to hear that! Here are some troubleshooting        │
│  steps to try: 1) Check the power cord... [Read more]         │
│                                                                │
│  [👨‍💼] Support Agent (Sarah) · Apr 28, 9:00 AM               │
│  Hi! I've reviewed your case. Since the issue persists        │
│  after troubleshooting, we'll send a replacement within 3     │
│  business days. Can you confirm your shipping address?        │
│                                                                │
│  ─────────────────────────────────────────────────────────    │
│  REPLY                                                         │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ Type your reply...                                   │     │
│  │                                                      │     │
│  └──────────────────────────────────────────────────────┘     │
│  [📎 Attach File]                          [Send Reply →]     │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ TICKET INFO (sidebar / collapsed on mobile)                    │
│ Status: Open → [Mark Resolved]                                 │
│ Category: Product Issue                                        │
│ Product: 6QT Slow Cooker (SL-6QT-BK)                         │
│ Warranty: Valid until Apr 30, 2027                            │
└────────────────────────────────────────────────────────────────┘
```

**消息气泡区分**：

| 角色         | 气泡样式                                                                    |
| ------------ | --------------------------------------------------------------------------- |
| 客户（自己） | `bg-[--brand-primary] text-white rounded-2xl rounded-br-sm`（右对齐）       |
| AI 自动回复  | `bg-violet-50 text-zinc-800 rounded-2xl rounded-tl-sm`（左对齐，含 ✦ 图标） |
| 人工客服     | `bg-zinc-100 text-zinc-900 rounded-2xl rounded-tl-sm`（左对齐，含头像）     |

### 6.3 新建工单（/tickets/new）

```
┌────────────────────────────────────────────────────────────────┐
│  New Support Ticket                                            │
│                                                                │
│  Subject *                                                     │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ Brief description of your issue                      │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                │
│  Category *                                                    │
│  ○ Product Issue  ○ Shipping  ○ Warranty  ○ Returns  ○ Other │
│                                                                │
│  Related Product (optional)                                    │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ Search your registered products...               ▾  │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                │
│  Details *                                                     │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ Please describe the issue in detail               │     │
│  │                                                      │     │
│  │                                                      │     │
│  └──────────────────────────────────────────────────────┘     │
│  [📎 Attach Photos / Files]                                    │
│                                                                │
│  ─────────────────────────────────────────────────────────    │
│  💡 Before submitting, you might find your answer in:         │
│     [Related FAQ: "My device won't turn on" →]               │
│     [AI Chat can answer product questions instantly →]        │
│                                                                │
│                            [Cancel]  [Submit Ticket →]       │
└────────────────────────────────────────────────────────────────┘
```

提交前 FAQ 提示：根据 Subject 关键词匹配（客户端简单字符串匹配，S3 接入 ES 后改用语义搜索）。

**工单提交后行为**：

1. 后端创建 `Ticket` + 初始 `TicketMessage`（role = 'customer'）
2. 触发 AI 自动回复（role = 'ai'）：S3 接入 Gemini 2.5 Flash，生成首条建议回复
3. 页面跳转到 `/tickets/[id]`，展示对话时间线

---

## 7. 客户账户中心（/account） — 需登录

```
┌────────────────────────────────────────────────────────────────┐
│  My Account                                                    │
│                                                                │
│  ┌──────────────────┐  ┌─────────────────────────────────────┐ │
│  │ SIDEBAR          │  │ CONTENT                             │ │
│  │ ─────────────    │  │                                     │ │
│  │ 👤 Profile       │  │  [对应 tab 内容]                     │ │
│  │ 🛡️  My Warranties │  │                                     │ │
│  │ 🎫 My Tickets    │  │                                     │ │
│  │ ─────────────    │  │                                     │ │
│  │ 🔒 Password      │  │                                     │ │
│  │ 🌐 Language      │  │                                     │ │
│  └──────────────────┘  └─────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**My Warranties Tab**：列出该客户名下所有保修注册（`WarrantyRegistration`），显示产品名、注册日期、到期日期、状态（有效/已过期）。

---

## 8. 4 品牌视觉差异汇总

### 8.1 门户首页风格

| 维度      | Homtone                            | Spoonlemon                         | Davivy                 | Tysun                                |
| --------- | ---------------------------------- | ---------------------------------- | ---------------------- | ------------------------------------ |
| Hero 背景 | 暖米色 + 家庭场景插画              | 浅绿色 + 果蔬轮廓插画              | 纯白 / 极浅灰，无插画  | 深蓝色渐变 hero                      |
| 标题语气  | 友好暖心（"Hi, how can we help?"） | 活力轻松（"Let's sort that out!"） | 简洁直接（"Support."） | 专业正式（"How can we assist you?"） |
| CTA 按钮  | amber 圆角大                       | emerald 圆角适中                   | zinc/black 无圆角      | blue 正方圆角                        |
| 卡片边框  | 圆角 `rounded-2xl`                 | 圆角 `rounded-xl`                  | 圆角 `rounded-lg`      | 圆角 `rounded-md`                    |
| 字体配对  | Serif accent + Sans body           | Sans bold                          | Sans thin/light        | Sans regular                         |

### 8.2 品牌特有内容差异

| 页面         | 差异内容                                                           |
| ------------ | ------------------------------------------------------------------ |
| 手册下载     | 每品牌只展示自己品牌的产品手册（tenant schema 隔离，绝对不跨品牌） |
| FAQ 热门问题 | 根据该品牌的 FAQ 点击统计动态排序，不同品牌内容不同                |
| 保修注册     | 产品搜索范围限定在该品牌的 `Article` 表                            |
| 工单         | 工单在该品牌客服系统内独立处理，客户看不到其他品牌工单             |
| 登录 / 注册  | 同一用户在 4 品牌各有独立账户（相同邮箱可注册 4 个）               |

---

## 9. 响应式规则

| 断点                   | 变化                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| < 640px（mobile）      | Header 折叠为 hamburger；快捷卡片 1×N 列；账户侧边栏改为顶部 tab |
| 640px–1024px（tablet） | 快捷卡片 2×2 网格；账户侧边栏保留                                |
| ≥ 1024px（desktop）    | 完整布局；快捷卡片最多 3×2                                       |
| ≥ 1280px（wide）       | 门户内容区 `max-w-6xl mx-auto` 居中                              |

---

## 10. 切片落地计划

| 页面 / 功能                 | 切片 | 周次 | 依赖                 |
| --------------------------- | ---- | ---- | -------------------- |
| 门户 Shell（Header/Footer） | S3   | W27  | —                    |
| 门户首页（Hero + 快捷卡片） | S3   | W27  | —                    |
| 非登录订单查询（UI + mock） | S3   | W28  | 领星 API mock        |
| 手册下载页                  | S3   | W28  | Cloudinary 手册上传  |
| 保修注册流（3 步）          | S3   | W29  | Product/Article 数据 |
| 新建工单 + 提交             | S3   | W34  | 后端工单 API         |
| 工单列表 + 详情             | S3   | W35  | 同上                 |
| AI 自动回复工单             | S3   | W35  | Gemini 2.5 Flash     |
| 客户账户中心                | S3   | W36  | 登录 / 保修数据      |
| 真实订单查询接入领星        | S4   | W45  | 领星 API 订单模块    |
