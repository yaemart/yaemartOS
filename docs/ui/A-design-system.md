# yaemartOS Design System — 4 品牌 Token + 主题切换

> 落地切片：S1 W3（Design Token）+ S1 W4（前端 shell + 品牌切换）  
> 技术栈：Tailwind CSS 3.4 + shadcn/ui + CSS Custom Properties + next-intl  
> 对标：Stripe Dashboard（密度与层次）+ Linear（侧边栏布局）

---

## 1. 品牌色板

### 1.1 Homtone — "温暖家庭"

| 角色           | HEX       | Tailwind     | CSS Variable             |
| -------------- | --------- | ------------ | ------------------------ |
| Primary        | `#D97706` | `amber-600`  | `--brand-primary`        |
| Primary Light  | `#FDE68A` | `amber-200`  | `--brand-primary-light`  |
| Primary Dark   | `#92400E` | `amber-800`  | `--brand-primary-dark`   |
| Accent         | `#7C3AED` | `violet-600` | `--brand-accent`         |
| Background     | `#FFFBEB` | `amber-50`   | `--brand-bg`             |
| Surface        | `#FFFFFF` | `white`      | `--brand-surface`        |
| Text Primary   | `#1C1917` | `stone-900`  | `--brand-text`           |
| Text Secondary | `#78716C` | `stone-500`  | `--brand-text-secondary` |

### 1.2 Spoonlemon — "活力清新"

| 角色           | HEX       | Tailwind      | CSS Variable             |
| -------------- | --------- | ------------- | ------------------------ |
| Primary        | `#059669` | `emerald-600` | `--brand-primary`        |
| Primary Light  | `#A7F3D0` | `emerald-200` | `--brand-primary-light`  |
| Primary Dark   | `#065F46` | `emerald-800` | `--brand-primary-dark`   |
| Accent         | `#0284C7` | `sky-600`     | `--brand-accent`         |
| Background     | `#ECFDF5` | `emerald-50`  | `--brand-bg`             |
| Surface        | `#FFFFFF` | `white`       | `--brand-surface`        |
| Text Primary   | `#1C1917` | `stone-900`   | `--brand-text`           |
| Text Secondary | `#78716C` | `stone-500`   | `--brand-text-secondary` |

### 1.3 Davivy — "现代极简"

| 角色           | HEX       | Tailwind   | CSS Variable             |
| -------------- | --------- | ---------- | ------------------------ |
| Primary        | `#18181B` | `zinc-900` | `--brand-primary`        |
| Primary Light  | `#E4E4E7` | `zinc-200` | `--brand-primary-light`  |
| Primary Dark   | `#09090B` | `zinc-950` | `--brand-primary-dark`   |
| Accent         | `#2563EB` | `blue-600` | `--brand-accent`         |
| Background     | `#FAFAFA` | `zinc-50`  | `--brand-bg`             |
| Surface        | `#FFFFFF` | `white`    | `--brand-surface`        |
| Text Primary   | `#09090B` | `zinc-950` | `--brand-text`           |
| Text Secondary | `#71717A` | `zinc-500` | `--brand-text-secondary` |

### 1.4 Tysun — "专业可信"

| 角色           | HEX       | Tailwind    | CSS Variable             |
| -------------- | --------- | ----------- | ------------------------ |
| Primary        | `#1D4ED8` | `blue-700`  | `--brand-primary`        |
| Primary Light  | `#BFDBFE` | `blue-200`  | `--brand-primary-light`  |
| Primary Dark   | `#1E3A5F` | `blue-900`  | `--brand-primary-dark`   |
| Accent         | `#DC2626` | `red-600`   | `--brand-accent`         |
| Background     | `#EFF6FF` | `blue-50`   | `--brand-bg`             |
| Surface        | `#FFFFFF` | `white`     | `--brand-surface`        |
| Text Primary   | `#1E293B` | `slate-800` | `--brand-text`           |
| Text Secondary | `#64748B` | `slate-500` | `--brand-text-secondary` |

### 1.5 语义色（全品牌共享）

| 角色    | HEX       | 用途             |
| ------- | --------- | ---------------- |
| Success | `#16A34A` | 成功状态、已上线 |
| Warning | `#CA8A04` | 待审核、接近限额 |
| Error   | `#DC2626` | 错误、超限       |
| Info    | `#2563EB` | 信息提示         |

---

## 2. 字体系统

### 2.1 运营后台（中文为主）

```css
--font-sans: 'Inter', 'Noto Sans SC', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### 2.2 客户门户（多语言）

```css
--font-sans: 'Inter', 'Noto Sans', system-ui, -apple-system, sans-serif;
--font-display: 'Inter', sans-serif;
```

### 2.3 字号阶梯

| Token       | 像素 | rem      | 行高 | 用途             |
| ----------- | ---- | -------- | ---- | ---------------- |
| `text-xs`   | 12px | 0.75rem  | 1.5  | 辅助标签、时间戳 |
| `text-sm`   | 14px | 0.875rem | 1.5  | 表格正文、侧边栏 |
| `text-base` | 16px | 1rem     | 1.5  | 默认正文         |
| `text-lg`   | 18px | 1.125rem | 1.75 | 卡片标题         |
| `text-xl`   | 20px | 1.25rem  | 1.75 | 页面副标题       |
| `text-2xl`  | 24px | 1.5rem   | 1.33 | 页面主标题       |
| `text-3xl`  | 30px | 1.875rem | 1.33 | Dashboard 数字   |

---

## 3. Spacing / Radius / Shadow / Z-index

### 3.1 间距

```
--space-1: 4px    → gap-1, p-1
--space-2: 8px    → gap-2, p-2
--space-3: 12px   → gap-3, p-3
--space-4: 16px   → gap-4, p-4
--space-6: 24px   → gap-6, p-6
--space-8: 32px   → gap-8, p-8
--space-12: 48px  → section separator
--space-16: 64px  → page level margin
```

### 3.2 圆角

| Token          | 值     | 用途           |
| -------------- | ------ | -------------- |
| `rounded-sm`   | 4px    | Badge / Tag    |
| `rounded-md`   | 6px    | Button / Input |
| `rounded-lg`   | 8px    | Card / Dialog  |
| `rounded-xl`   | 12px   | 大卡片         |
| `rounded-full` | 9999px | Avatar / Pill  |

### 3.3 阴影

| Token       | 值                            | 用途           |
| ----------- | ----------------------------- | -------------- |
| `shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)`  | 内嵌卡片       |
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.1)`   | Card 默认      |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.1)`   | 弹出面板       |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Dialog / Modal |
| `shadow-xl` | `0 20px 25px rgba(0,0,0,0.1)` | Toast / 浮层   |

### 3.4 Z-index 规范

| 层       | Z-index | 元素              |
| -------- | ------- | ----------------- |
| Base     | 0       | 正文流            |
| Sticky   | 10      | 顶部导航 / 侧边栏 |
| Dropdown | 20      | 下拉菜单          |
| Overlay  | 30      | 遮罩层            |
| Modal    | 40      | Dialog            |
| Toast    | 50      | 全局 Toast        |
| Tooltip  | 60      | AI 提示气泡       |

---

## 4. 主题包结构

### 4.1 `globals.css` 示例

```css
@layer base {
  :root {
    /* Homtone (default) */
    --brand-primary: 217 119 6; /* amber-600 */
    --brand-primary-light: 253 230 138;
    --brand-primary-dark: 146 64 14;
    --brand-accent: 124 58 237;
    --brand-bg: 255 251 235;
    --brand-surface: 255 255 255;
    --brand-text: 28 25 23;
    --brand-text-secondary: 120 113 108;
    --brand-radius: 0.5rem;
  }

  [data-brand='spoonlemon'] {
    --brand-primary: 5 150 105; /* emerald-600 */
    --brand-primary-light: 167 243 208;
    --brand-primary-dark: 6 95 70;
    --brand-accent: 2 132 199;
    --brand-bg: 236 253 245;
  }

  [data-brand='davivy'] {
    --brand-primary: 24 24 27; /* zinc-900 */
    --brand-primary-light: 228 228 231;
    --brand-primary-dark: 9 9 11;
    --brand-accent: 37 99 235;
    --brand-bg: 250 250 250;
  }

  [data-brand='tysun'] {
    --brand-primary: 29 78 216; /* blue-700 */
    --brand-primary-light: 191 219 254;
    --brand-primary-dark: 30 58 95;
    --brand-accent: 220 38 38;
    --brand-bg: 239 246 255;
  }
}
```

### 4.2 `theme-provider.tsx` 骨架

```tsx
'use client';

import { createContext, useContext } from 'react';

type Brand = 'homtone' | 'spoonlemon' | 'davivy' | 'tysun';

const BrandContext = createContext<{
  brand: Brand;
  setBrand: (b: Brand) => void;
}>({ brand: 'homtone', setBrand: () => {} });

export function BrandProvider({
  children,
  initialBrand,
}: {
  children: React.ReactNode;
  initialBrand: Brand;
}) {
  const [brand, setBrand] = useState<Brand>(initialBrand);

  return (
    <BrandContext.Provider value={{ brand, setBrand }}>
      <div data-brand={brand} className="min-h-screen bg-[rgb(var(--brand-bg))]">
        {children}
      </div>
    </BrandContext.Provider>
  );
}

export const useBrand = () => useContext(BrandContext);
```

### 4.3 品牌切换流程

```
┌─────────────────────────────────────────────┐
│  TopNav                                      │
│  ┌─────────┐  ┌───────────────────────────┐ │
│  │ [Logo]  │  │ Homtone ▾  [品牌切换器]  │ │
│  └─────────┘  └───────────────────────────┘ │
└─────────────────────────────────────────────┘
         │
         ▼ 点击下拉
┌───────────────────┐
│  ● Homtone        │  ← amber 圆点
│  ○ Spoonlemon     │  ← emerald 圆点
│  ○ Davivy         │  ← zinc 圆点
│  ○ Tysun          │  ← blue 圆点
└───────────────────┘
         │
         ▼ 选择 → setBrand() → data-brand 属性变 → CSS variables 立即换色 → 无闪烁
```

---

## 5. 图标体系（Lucide React）

### 5.1 运营后台导航

| 图标              | 场景           |
| ----------------- | -------------- |
| `LayoutDashboard` | 首页 Dashboard |
| `Package`         | 产品中心       |
| `FileText`        | Listing 管理   |
| `ShoppingCart`    | 订单（只读）   |
| `Warehouse`       | 库存           |
| `Megaphone`       | 广告           |
| `Users`           | 客服/工单      |
| `GraduationCap`   | 培训           |
| `Settings`        | 系统设置       |
| `Shield`          | IAM 策略       |

### 5.2 客户中心导航

| 图标            | 场景     |
| --------------- | -------- |
| `Home`          | 首页     |
| `Package`       | 我的产品 |
| `MessageCircle` | 聊天     |
| `TicketCheck`   | 工单     |
| `BookOpen`      | 手册     |
| `ShieldCheck`   | 保修     |
| `Search`        | 订单查询 |

### 5.3 AI 工具图标

| 图标        | 场景         |
| ----------- | ------------ |
| `Sparkles`  | AI 生成/优化 |
| `Wand2`     | AI 建议      |
| `Bot`       | AI 客服头像  |
| `RefreshCw` | AI 重新生成  |
| `Brain`     | 智能分析     |
| `Zap`       | 快捷操作     |

---

## 6. shadcn/ui 组件清单

| 组件         | 运营后台 | 客户门户 | 备注                   |
| ------------ | -------- | -------- | ---------------------- |
| Button       | ✅       | ✅       | 主操作用 brand-primary |
| Card         | ✅       | ✅       |                        |
| Dialog       | ✅       | ✅       | 确认弹窗               |
| Tabs         | ✅       | —        | Listing 编辑器多 Tab   |
| Badge        | ✅       | ✅       | 状态标签               |
| Avatar       | ✅       | ✅       |                        |
| Toast        | ✅       | ✅       |                        |
| Sheet        | ✅       | ✅       | 移动端侧滑             |
| ScrollArea   | ✅       | ✅       |                        |
| Select       | ✅       | —        |                        |
| Input        | ✅       | ✅       |                        |
| Textarea     | ✅       | ✅       |                        |
| DropdownMenu | ✅       | —        | 品牌切换器             |
| Tooltip      | ✅       | —        | AI 提示                |
| Progress     | ✅       | ✅       | AI 生成进度            |
| Separator    | ✅       | ✅       |                        |
| Command      | ✅       | —        | 全局搜索               |

---

## 7. Don'ts（反面例子）

| ❌ 不要做                  | ✅ 替代做法                                 | 原因                                    |
| -------------------------- | ------------------------------------------- | --------------------------------------- |
| 用渐变色 banner 做品牌区分 | 用纯色 `bg-brand-primary` + 白字            | 渐变印刷困难；4 品牌变 8 种渐变更难维护 |
| 品牌切换用整页 reload      | `data-brand` 属性 + CSS variable 零闪烁切换 | 38 人频繁切品牌，reload 体验差          |
| 每个品牌单独写组件         | 统一组件 + CSS variable 注入差异            | 维护 4 份 Button 是噩梦                 |
