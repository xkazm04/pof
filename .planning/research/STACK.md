# Technology Stack

**Project:** Dzin Integration Prototype
**Researched:** 2026-03-14

## Recommended Stack

### Core Framework (Existing -- No Changes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.1.6 | App Router, SSR, API routes | Already in use; Dzin's `'use client'` directives are compatible |
| React | 19.2.3 | UI rendering | Dzin peer-depends on `react ^19.0.0` -- exact match |
| TypeScript | 5.x | Type safety | Dzin is fully typed TypeScript; strict mode compatible |
| Tailwind CSS | 4.x | Utility styling + design tokens | Bridge layer needed (see Theming Bridge below) |

**Confidence: HIGH** -- Dzin was built targeting this exact stack.

### New Dependencies

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| fast-json-patch | 3.1.1 | RFC 6902 JSON Patch for Dzin state engine | Dzin's only runtime dependency. Used in `state/engine.ts` for `applyPatch` and `compare`. Last published 4 years ago but stable RFC implementation -- no active maintenance concern for a spec-compliant library. |

**Confidence: HIGH** -- Inspected Dzin's `package.json` directly. Only one new dep needed.

### Existing Dependencies Leveraged (No New Install)

| Library | Version | Dzin Integration Use | Notes |
|---------|---------|----------------------|-------|
| framer-motion | 12.34.0 | Layout transitions between templates, density change animations | Dzin ships CSS-only animations via `state.css` (200ms fade/scale). Framer-motion adds orchestrated layout animations on top -- use for template switching, not panel enter/exit. |
| lucide-react | 0.563.0 | Panel icons in `PanelFrame` header | Dzin's `icon` prop accepts `ReactNode`; pass `<Swords />` etc. directly |
| zustand | 5.0.11 | Panel state persistence, layout preference store | Dzin's own state engine is internal; use Zustand for PoF-level state (selected template, panel visibility) |

**Confidence: HIGH** -- Verified from PoF's `package.json` and Dzin's component signatures.

### Supporting Libraries (No New Installs Needed)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| react-window 2.2.6 | Virtualized lists inside panels | If a Dzin panel renders 100+ rows (e.g., ability list at full density) |
| sonner 2.0.7 | Toast notifications | Layout/density switch confirmations |

## Theming Bridge: Dzin CSS Custom Properties + Tailwind CSS 4

This is the critical integration surface. Dzin uses `--dzin-*` CSS custom properties targeted by `data-dzin-*` attribute selectors. PoF uses Tailwind CSS 4 with `@theme inline` and its own `--background`, `--surface`, `--border` variables.

### Strategy: Override Dzin tokens in `globals.css`, do NOT import Dzin's `default.css`

**Rationale:** Dzin's default theme uses Slate color palette (`#0f172a`, `#1e293b`). PoF uses a deeper indigo-dark palette (`#0a0a1a`, `#111128`). Importing both creates visual inconsistency. Instead, map Dzin tokens to PoF's existing variables.

**Confidence: MEDIUM** -- Approach is sound based on CSS specificity rules and Tailwind 4's architecture, but needs hands-on validation that no Dzin component hard-codes colors outside the token system.

### Implementation

Add this block to `src/app/globals.css` (after the `:root` block):

```css
/* Dzin token bridge -- map Dzin's design tokens to PoF's theme */
:root {
  --dzin-surface-1: var(--background);       /* #0a0a1a */
  --dzin-surface-2: var(--surface);          /* #111128 */
  --dzin-surface-3: var(--surface-hover);    /* #1a1a3a */

  --dzin-border: var(--border);              /* #1e1e3a */
  --dzin-border-focus: var(--core);          /* #3b82f6 - PoF's core accent */

  --dzin-text-primary: var(--text);          /* #e0e4f0 */
  --dzin-text-secondary: var(--text);        /* same, PoF has less text tiers */
  --dzin-text-muted: var(--text-muted);      /* #7d82a8 */

  --dzin-accent: var(--core);               /* #3b82f6 - blue, matches arpg-combat */
  --dzin-accent-muted: #2563eb;             /* darker blue, derived */

  --dzin-panel-bg: var(--surface);
  --dzin-panel-border: var(--border);
  --dzin-panel-radius: 6px;
  --dzin-panel-header-bg: var(--surface-deep);
  --dzin-panel-header-height: 36px;

  /* Spacing -- match PoF's compact aesthetic */
  --dzin-space-xs: 4px;
  --dzin-space-sm: 6px;
  --dzin-space-md: 10px;
  --dzin-space-lg: 14px;
  --dzin-space-xl: 20px;

  /* Typography -- match PoF's type scale */
  --dzin-font-sm: var(--text-xs);           /* 0.75rem */
  --dzin-font-base: var(--text-sm);         /* 0.875rem */
  --dzin-font-lg: var(--text-base);         /* 1rem */

  --dzin-radius-sm: 4px;
  --dzin-radius-md: 6px;
  --dzin-radius-lg: 8px;
}
```

### Using Tailwind Utilities Inside Dzin Panels

Dzin's `PanelFrame` is headless -- it renders `data-dzin-*` attributes for chrome styling, but **panel body content is entirely user-controlled**. Panel content (the `children` prop) can freely use Tailwind classes:

```tsx
<PanelFrame title="Abilities" icon={<Swords className="w-4 h-4" />}>
  <div className="grid grid-cols-3 gap-2">  {/* Tailwind inside Dzin */}
    {abilities.map(a => (
      <div key={a.id} className="bg-surface p-2 rounded border border-border">
        {a.name}
      </div>
    ))}
  </div>
</PanelFrame>
```

**Confidence: HIGH** -- Verified that `PanelFrame` passes `children` through without wrapper constraints. The `data-dzin-panel-body` div only sets `flex: 1; overflow: auto;` -- no style conflicts with Tailwind children.

### Tailwind 4 Data Attribute Variants for Dzin State

Tailwind CSS 4 supports `data-*` attribute variants natively. Use them to style elements conditionally based on Dzin density:

```css
/* In globals.css or a component module */
@custom-variant density-micro (&[data-dzin-density="micro"] *);
@custom-variant density-compact (&[data-dzin-density="compact"] *);
@custom-variant density-full (&[data-dzin-density="full"] *);
```

Then in JSX: `className="text-sm density-micro:text-xs density-full:text-base"`

**Confidence: MEDIUM** -- Tailwind 4's `@custom-variant` is documented and works for data attribute selectors. The exact descendant selector syntax (`*`) needs testing to ensure it cascades into nested Tailwind-styled children within Dzin panel bodies.

## Copying Dzin into the Repo

### Strategy: Direct source copy to `src/lib/dzin/`

**Why not npm link / workspace:** PoF is a single-package repo (no monorepo tooling). npm link causes phantom dependency issues with React 19 (duplicate React instances). Workspace protocols (`file:` or `workspace:`) require `package.json` restructuring. For a prototype, direct copy is fastest and eliminates all resolution issues.

**What to copy:**

```
C:\Users\kazda\kiro\studio-story\packages\dzin\core\src\
  -->  C:\Users\kazda\kiro\pof\src\lib\dzin\
```

Copy the `src/` contents only (not `package.json`, `tsconfig.json`, `vitest.config.ts`). The source files use relative imports internally and no build step.

**Post-copy adjustments:**

1. **Install fast-json-patch:** `npm install fast-json-patch@^3.1.1`
2. **Import paths:** Dzin's internal imports are all relative (`./types`, `../density`), so they work as-is inside `src/lib/dzin/`.
3. **CSS files:** Import `src/lib/dzin/theme/default.css` from `globals.css` ONLY if not using the token bridge approach. With the token bridge, import only `src/lib/dzin/theme/state.css` for animations.
4. **`'use client'` directives:** Already present on `LayoutProvider.tsx` and `useLayout.ts`. Other modules are pure logic -- no changes needed.
5. **Path alias:** Access via `@/lib/dzin` -- consistent with PoF's import convention.

**Files to exclude from copy (not needed for prototype):**
- `__tests__/` directories (run tests from original repo if needed)
- `demo/` directory (PoF will build its own demo panels from AbilitySpellbook sections)

**Confidence: HIGH** -- Inspected all Dzin source files. No external imports besides `fast-json-patch` and `react`/`react-dom`. No build artifacts or generated files.

## Animation Strategy

### Layer 1: Dzin's Built-in CSS Animations (state.css)

Dzin ships these CSS-only animations via data attributes:

| Animation | Trigger | Duration | Mechanism |
|-----------|---------|----------|-----------|
| Panel enter | `data-dzin-entering` | 200ms | scale(0.95) + fade-in |
| Panel exit | `data-dzin-exiting` | 200ms | scale(0.95) + fade-out |
| LLM highlight | `data-dzin-highlight="llm"` | 1s | cyan box-shadow glow |
| Density transition | automatic | 200ms | width/height CSS transition |
| Streaming cursor | `data-dzin-streaming-cursor` | 1s blink | blinking cursor pseudo-element |

**Import `state.css` as-is.** These are pure CSS targeting data attributes -- no conflict with Tailwind or framer-motion.

### Layer 2: Framer-motion for Layout Template Transitions

When switching between templates (e.g., `split-2` to `grid-4`), CSS Grid changes cause layout shifts. Use framer-motion's `layout` prop on the `DzinLayout` slot wrapper divs to animate the grid reflow smoothly:

```tsx
import { motion, AnimatePresence } from 'framer-motion';

// Wrap each slot div in DzinLayout with motion.div
<motion.div
  key={assignment.slotIndex}
  layout
  layoutId={`dzin-slot-${assignment.panelId}`}
  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
  {...slotProps}
>
  <DensityProvider density={assignment.density}>
    {renderPanel(assignment)}
  </DensityProvider>
</motion.div>
```

**Why framer-motion here:** CSS Grid `transition` on `grid-template-*` properties is poorly supported cross-browser. Framer-motion's FLIP-based layout animation handles this reliably.

**Timing:** Use PoF's `--duration-base: 220ms` and `--ease-out` curve to match the existing motion language.

**Confidence: HIGH** -- Framer-motion 12's `layout` prop is well-documented for grid reflow. PoF already uses it in 10+ components.

### Layer 3: Density Change Micro-animations (Optional, Phase 2)

For smoother density transitions (e.g., panel content adapting from `full` to `compact`), consider wrapping density-dependent content in `AnimatePresence`:

```tsx
<AnimatePresence mode="wait">
  {density === 'full' && <motion.div key="full" initial={{opacity:0}} animate={{opacity:1}}>...</motion.div>}
  {density === 'compact' && <motion.div key="compact" initial={{opacity:0}} animate={{opacity:1}}>...</motion.div>}
</AnimatePresence>
```

**Defer to Phase 2** -- Dzin's built-in 200ms CSS transitions handle basic density changes. Add framer-motion only if content switching feels jarring.

## fast-json-patch Considerations for React 19

### What Dzin Uses It For

Dzin's state engine (`state/engine.ts`) uses fast-json-patch for:
- `applyPatch(document, operations)` -- apply RFC 6902 ops to workspace state
- `compare(oldDoc, newDoc)` -- generate patches from state diffs (for undo/redo)

### React 19 Compatibility

fast-json-patch 3.1.1 is a pure JavaScript library with no React dependency. It operates on plain objects, not React state. No compatibility issues with React 19.

**However, for the prototype scope:** The state engine (`state/`, `conflict.ts`, `undo.ts`, `streaming.ts`) is primarily for LLM-driven state manipulation, which is out of scope. The prototype only needs:
- `density/` -- DensityContext, useDensity
- `panel/` -- PanelFrame
- `registry/` -- createRegistry, PanelDefinition
- `layout/` -- useLayout, DzinLayout, templates
- `theme/` -- tokens, state.css

**Recommendation:** Copy all Dzin source for completeness (it is small), install fast-json-patch to avoid import errors, but do not actively use the state engine in the prototype. This keeps the door open for future milestones without partial-copy headaches.

**Confidence: HIGH** -- fast-json-patch is a pure JS library; no React version coupling.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Panel framework | Dzin (local copy) | react-mosaic, react-grid-layout | Dzin is purpose-built for density-aware panels with LLM integration. Others are drag-and-drop grid libraries without density concepts. |
| Theming bridge | CSS custom property override | Tailwind plugin wrapping Dzin tokens | Over-engineering for a prototype. Direct CSS variable override in `:root` is simpler and more debuggable. |
| Layout animation | framer-motion (existing) | CSS `@starting-style` + View Transitions API | View Transitions API requires Chrome 111+ and is document-level, not component-level. Framer-motion already in the bundle. |
| State patches | fast-json-patch | immer, structuredClone + manual diff | Dzin is built around RFC 6902 patches. Swapping would require rewriting the state engine. |
| Local integration | Source copy to src/lib/dzin | npm workspace, git submodule | Single-package repo. Submodules add git complexity. Workspaces need package.json restructure. Source copy is zero-config. |

## Installation

```bash
# Only new dependency needed
npm install fast-json-patch@^3.1.1
```

Then copy Dzin source:
```bash
# Copy source files (excluding tests and demo)
cp -r /path/to/studio-story/packages/dzin/core/src/* src/lib/dzin/
# Remove test directories
find src/lib/dzin -name "__tests__" -type d -exec rm -rf {} +
# Optionally remove demo/ if building custom panels
rm -rf src/lib/dzin/demo/
```

## Sources

- [Dzin package.json](file:///C:/Users/kazda/kiro/studio-story/packages/dzin/core/package.json) -- inspected directly, confidence HIGH
- [Dzin source tree](file:///C:/Users/kazda/kiro/studio-story/packages/dzin/core/src/) -- full source inspection, confidence HIGH
- [PoF globals.css](file:///C:/Users/kazda/kiro/pof/src/app/globals.css) -- inspected directly, confidence HIGH
- [PoF chart-colors.ts](file:///C:/Users/kazda/kiro/pof/src/lib/chart-colors.ts) -- inspected directly, confidence HIGH
- [fast-json-patch on npm](https://www.npmjs.com/package/fast-json-patch) -- version 3.1.1, stable RFC 6902 implementation
- [Tailwind CSS 4 Theme Variables](https://tailwindcss.com/docs/theme) -- `@theme inline` and CSS custom properties
- [Tailwind CSS 4 Custom Styles](https://tailwindcss.com/docs/adding-custom-styles) -- arbitrary values with `var()`
- [Tailwind CSS 4 Data Attribute Variants](https://stevekinney.com/courses/tailwind/data-attribute-variants) -- `@custom-variant` for data selectors
- [Motion Layout Animations](https://motion.dev/docs/react-layout-animations) -- framer-motion `layout` prop for grid reflow

---

*Stack analysis: 2026-03-14*
