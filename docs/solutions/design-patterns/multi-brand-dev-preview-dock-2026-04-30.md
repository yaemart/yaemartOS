---
title: Multi-Brand Dev Preview Dock — Admin and Portal Switching
date: 2026-04-30
category: docs/solutions/design-patterns
module: DevTools / BrandTheming
problem_type: design_pattern
component: development_workflow
severity: medium
applies_when:
  - 'Project has multiple brand-specific UIs that share a codebase'
  - 'Development requires frequent switching between an admin panel and N brand portals'
  - 'Brand theming uses CSS Custom Properties with data-brand attribute injection'
  - 'Next.js App Router project with React context-based state management'
tags:
  - multi-brand
  - dev-preview
  - brand-switching
  - css-variables
  - next-js
  - framer-motion
  - dev-tooling
  - portal
---

# Multi-Brand Dev Preview Dock — Admin and Portal Switching

## Context

yaemartOS serves 4 brands (Homtone, Spoonlemon, Davivy, Tysun), each with an independent customer-facing portal (separate domain, color palette, locale defaults) and a shared internal admin panel. During development, engineers need to verify UI changes across **5 distinct views** (1 admin + 4 portals) without opening multiple browser tabs, changing environment variables, or switching Next.js routes manually.

The naive approach — separate `localhost` ports per brand — creates cognitive overhead and makes cross-brand visual regression obvious only after manual toggling. A Storybook-style isolated preview doesn't reflect real routing, provider nesting, or brand token inheritance. What was needed was an in-app mechanism that:

1. Switches the rendered content between admin and portal UIs **instantly and in-place**
2. Carries brand, locale, and viewport state as a unified tuple
3. Is keyboard-driven for speed
4. Disappears cleanly in production

## Guidance

### Architecture: Three-Layer Provider Stack

```
<BrandProvider>          ← Controls CSS variable injection (data-brand attribute)
  <DevPreviewProvider>   ← Dev-only: tracks mode/brand/locale/viewport tuple
    <DevViewportFrame>   ← Wraps content; applies viewport-constrained width in tablet/mobile mode
      <DevPreviewShell>  ← AnimatePresence wrapper; renders adminContent or portalContent by mode
        {page content}
      </DevPreviewShell>
    </DevViewportFrame>
  </DevPreviewProvider>
</BrandProvider>
```

`DevPreviewProvider` and `DevPreviewDock` live only under the `/dev` route. Production routes use `BrandProvider` alone.

### Key Implementation Decisions

#### 1. Single entry point: `/dev` page

All five views are accessible from one URL. The `DevPreviewShell` decides whether to render `<AdminShell />` or `<PortalShell />` based on `state.mode`. This preserves Next.js routing semantics and React context nesting — providers initialize once, theme changes happen without unmounting.

```tsx
// app/dev/page.tsx
export default function DevPreviewPage() {
  return (
    <DevPreviewProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <DevViewportFrame>
          <DevPreviewShell adminContent={<AdminShell />} portalContent={<PortalShell />} />
        </DevViewportFrame>
      </div>
      <DevPreviewDock />
    </DevPreviewProvider>
  );
}
```

#### 2. State as a tuple, not independent slices

The preview state is a single `DevPreviewState` object `{ mode, brand, locale, viewport }`. The `switchTo()` action sets all four at once. This prevents impossible intermediate states (e.g., admin mode with `locale: 'de'`).

```ts
// providers/dev-preview-provider.tsx
export interface DevPreviewState {
  mode: ViewMode; // 'admin' | 'portal'
  brand: Brand; // 'homtone' | 'spoonlemon' | 'davivy' | 'tysun'
  locale: Locale; // 'en' | 'es' | 'fr' | 'de' | 'it' | 'zh'
  viewport: Viewport; // 'desktop' | 'tablet' | 'mobile'
}
```

`switchTo()` also enforces a default-locale rule: switching to admin auto-selects `zh`; switching to any portal auto-selects `en` (unless the user had already picked a non-Chinese locale).

#### 3. Brand token sync via `useEffect`

`DevPreviewShell` syncs `state.brand` into `BrandProvider` via `setBrand()` on every state change. This triggers the `data-brand` attribute change on the root `<div>`, which re-applies all CSS Custom Properties without a page reload:

```tsx
// components/dev/dev-preview-shell.tsx
export function DevPreviewShell({ adminContent, portalContent }) {
  const { state } = useDevPreview();
  const { setBrand } = useBrand();

  useEffect(() => {
    setBrand(state.brand);
  }, [state.brand, setBrand]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${state.mode}-${state.brand}-${state.locale}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {state.mode === 'admin' ? adminContent : portalContent}
      </motion.div>
    </AnimatePresence>
  );
}
```

The `key` combines mode + brand + locale so `AnimatePresence` triggers a crossfade on any meaningful dimension change.

#### 4. Keyboard shortcuts via `window` listener

`DevPreviewDock` registers a global `keydown` handler for `⌘1`–`⌘5` (macOS) / `Ctrl+1`–`Ctrl+5` (Windows/Linux). `⌘\`` toggles dock visibility without switching views.

```ts
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (!e.metaKey && !e.ctrlKey) return;
    const num = parseInt(e.key);
    if (num >= 1 && num <= 5) {
      e.preventDefault();
      const preset = VIEW_PRESETS[num - 1];
      switchTo({ mode: preset.mode, brand: preset.brand, ... });
    }
    if (e.key === '`') { e.preventDefault(); setVisible(v => !v); }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [state.viewport, switchTo]);
```

#### 5. Viewport simulation via constrained `<div>`, not iframe

Tablet (768px) and mobile (375px) viewports are simulated by constraining the content wrapper `<div>` width with `style={{ width: '768px' }}` — not with an `<iframe>`. This preserves the React context tree and avoids cross-origin issues with hot-reload. Framer Motion's `layout` prop animates the width change.

```tsx
// components/dev/dev-viewport-frame.tsx
<motion.div
  layout
  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
  style={{
    width: VIEWPORT_WIDTHS[state.viewport], // '100%' | '768px' | '375px'
    minHeight: isConstrained ? '667px' : '100%',
  }}
  className={cn(isConstrained && 'rounded-xl border shadow-xl overflow-hidden bg-white')}
>
  {children}
</motion.div>
```

#### 6. Dock visual design

The dock is a fixed, bottom-center-anchored bar with:

- Dark frosted glass (`bg-zinc-900/85 backdrop-blur-xl`) so it never competes with any brand's color system
- 80% opacity at rest, 100% on hover — present but unobtrusive
- A status line showing the current tuple: `Spoonlemon 客服门户 · EN · 375px`
- A "hide" button (×) plus `⌘\`` to toggle — engineers can focus on the preview without the dock visible

## Why This Matters

**Without this pattern**, multi-brand verification requires:

- 5 separate browser tabs or windows
- Manual URL switching and waiting for page loads
- Losing scroll position and interaction state between checks
- Forgetting to verify one brand and shipping a visual regression

**With this pattern**, a developer can cycle through all five views in under 5 seconds (`⌘1` → `⌘2` → ... `⌘5`), immediately see CSS variable differences, and verify responsive behavior in the same session.

The pattern is also safe: the `DevPreviewProvider` and `DevPreviewDock` are scoped to the `/dev` route. The underlying `BrandProvider` used by production routes is unchanged. No dev tooling leaks into production builds if the `/dev` route is guarded (e.g., `if (process.env.NODE_ENV !== 'development') redirect('/')`).

## When to Apply

- Any Next.js project where two or more distinct UI "skins" share a single codebase
- CSS variable-based theming systems (e.g., `data-brand` attribute pattern) where switching is instantaneous
- Projects with ≥ 3 views that must be verified together during development
- Teams where context-switching cost between views slows design iteration

**Does not apply** when:

- Each brand is a separate deployed Next.js app (different repos/deployments) — use environment variable switching per deployment instead
- Brands differ at the routing/API level, not just visually — a single `/dev` page can't represent divergent data models
- The project uses SSR that depends on brand-specific cookies or headers — client-side context switching won't replicate server-rendered differences

## Examples

### Before: Manual tab switching (problem)

```
Browser tab 1: localhost:3000/homtone-portal/home
Browser tab 2: localhost:3000/spoonlemon-portal/home
Browser tab 3: localhost:3001  (admin)
```

→ Each tab has its own React state, hot-reload context, and scroll position. Switching takes 2–5 seconds. Brand tokens are applied at the route level, requiring navigation.

### After: Dev Preview Dock (solution)

```
Browser: localhost:3000/dev
⌘1 → Admin (Chinese UI, zinc sidebar)
⌘2 → Homtone portal (amber #D97706, EN)
⌘3 → Spoonlemon portal (emerald #059669, EN)
⌘4 → Davivy portal (zinc minimal, EN)
⌘5 → Tysun portal (blue #1D4ED8, EN)
```

Each switch is a 150ms crossfade. The entire CSS variable set re-applies via `data-brand` attribute change. No navigation, no reload.

### Preset definition structure

```ts
// In DevPreviewDock
const VIEW_PRESETS = [
  {
    key: 'admin',
    label: 'Admin',
    shortcut: '1',
    mode: 'admin',
    brand: 'homtone',
    dot: 'bg-zinc-700',
  },
  {
    key: 'homtone',
    label: 'Homtone',
    shortcut: '2',
    mode: 'portal',
    brand: 'homtone',
    dot: 'bg-amber-500',
  },
  {
    key: 'spoonlemon',
    label: 'Spoonlemon',
    shortcut: '3',
    mode: 'portal',
    brand: 'spoonlemon',
    dot: 'bg-emerald-500',
  },
  {
    key: 'davivy',
    label: 'Davivy',
    shortcut: '4',
    mode: 'portal',
    brand: 'davivy',
    dot: 'bg-zinc-800',
  },
  {
    key: 'tysun',
    label: 'Tysun',
    shortcut: '5',
    mode: 'portal',
    brand: 'tysun',
    dot: 'bg-blue-600',
  },
];
```

Adding a 5th brand requires: one new entry in `VIEW_PRESETS`, one `data-brand` block in `globals.css`, and one new `Brand` enum value in `brand-provider.tsx`. The dock layout adjusts automatically.

## Related

- `docs/ui/A-design-system.md` — Brand color palette definitions and CSS variable naming conventions
- `apps/web/providers/brand-provider.tsx` — `BrandProvider` and `useBrand()` hook
- `apps/web/providers/dev-preview-provider.tsx` — `DevPreviewProvider` and state tuple
- `apps/web/components/dev/dev-preview-dock.tsx` — Floating dock with keyboard shortcuts
- `apps/web/components/dev/dev-preview-shell.tsx` — AnimatePresence crossfade switcher
- `apps/web/components/dev/dev-viewport-frame.tsx` — Viewport simulation wrapper
