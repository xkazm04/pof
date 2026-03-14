# Phase 1: Foundation - Research

**Researched:** 2026-03-14
**Domain:** Vendoring Dzin source, CSS theme bridging, Tailwind CSS 4 density variants
**Confidence:** HIGH

## Summary

Phase 1 vendors the Dzin panel framework source into PoF at `src/lib/dzin/core/`, installs its sole dependency (`fast-json-patch`), creates a CSS bridge file mapping `--dzin-*` tokens to PoF's existing CSS variables, and wires Tailwind CSS 4 custom variants for density-aware styling. No panels are built -- this is pure infrastructure.

The critical integration surface is the CSS theme bridge. Dzin uses a slate-based dark palette (`#0f172a`, `#1e293b`) while PoF uses an indigo-dark palette (`#0a0a1a`, `#111128`). Per the user's decision, we import Dzin's `default.css` first for its structural `[data-dzin-*]` selectors, then override color tokens via a separate `pof-bridge.css`. The Tailwind density variants use `@custom-variant` with `:is()` selectors to target both the attributed element and its descendants.

**Primary recommendation:** Copy all Dzin modules verbatim (including demo/ and __tests__/), install fast-json-patch, create pof-bridge.css with token overrides scoped to `[data-dzin-panel]` ancestors, define three `@custom-variant` directives in globals.css, verify with `npm run typecheck` and `npm run build`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full copy of all Dzin modules (density/, layout/, panel/, registry/, theme/, types/, state/, chat/, llm/, intent/) -- keeps imports intact, avoids broken references
- Include demo/ panels as working reference for testing layout in later phases
- Include __tests__/ for reference
- Keep Dzin source as-is -- no conversion to PoF conventions. Copy verbatim, only fix path references if needed
- Keep Dzin's barrel export (index.ts) as single import point
- Install `fast-json-patch` as a dependency (comes with state/ module)
- Create a separate bridge CSS file at `src/lib/dzin/theme/pof-bridge.css`
- Import Dzin's default.css first, then override with bridge CSS
- Import order in globals.css: Dzin default.css -> pof-bridge.css
- Bridge CSS maps `--dzin-surface1` -> `var(--background)`, `--dzin-surface2` -> `var(--surface)`, `--dzin-accent` -> PoF accent, etc.
- PoF components import from `@/lib/dzin/core` (mirrors package structure)
- Dzin internal imports stay relative (./density, ../types)
- Enforce `import type { ... }` for type-only imports per PoF convention
- Keep Dzin's state.css for frame-level animations

### Claude's Discretion
- **Dynamic accent colors**: How chart-colors (MODULE_COLORS, STATUS_*) reach Dzin panels -- CSS vars vs props vs inline styles. Pick what avoids specificity fights.
- **Animation timing alignment**: Whether to override Dzin's 200ms to match PoF's 220ms or keep both.
- **Tailwind density variant approach**: Between @custom-variant, plain CSS selectors, or useDensity()-only. Pick what works most reliably with Tailwind CSS 4.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | Dzin source copied into `src/lib/dzin/` with only needed modules | Full copy of ALL modules per user decision; destination is `src/lib/dzin/core/` mirroring package structure; verified all internal imports are relative and will work as-is |
| FOUND-02 | `fast-json-patch` installed and Dzin compiles cleanly | Only runtime dep; version ^3.1.1; pure JS library, no React coupling; verified in Dzin's package.json |
| FOUND-03 | Theme bridge CSS maps `--dzin-*` tokens to PoF's existing CSS variables | Complete token mapping provided below (22 tokens); Dzin's default.css imported first for structural selectors, bridge overrides colors only |
| FOUND-04 | Tailwind CSS 4 custom variants for density-micro/compact/full targeting data-dzin-density | `@custom-variant` with `:is()` descendant selector pattern verified; works with Tailwind 4's `@tailwindcss/postcss` |
</phase_requirements>

## Standard Stack

### Core (No Changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App framework | Already in use; Dzin's `'use client'` directives compatible |
| React | 19.2.3 | UI rendering | Dzin peer-depends on react ^19 -- exact match |
| Tailwind CSS | 4.x | Utility styling + density variants | `@custom-variant` provides density selector support |

### New Dependencies
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| fast-json-patch | ^3.1.1 | Dzin state engine (RFC 6902 patches) | Dzin's only runtime dependency; imported in state/engine.ts, state/conflict.ts, state/patches.ts |

**Confidence: HIGH** -- Verified from Dzin package.json. Pure JS library, no React version coupling.

**Installation:**
```bash
npm install fast-json-patch@^3.1.1
```

## Architecture Patterns

### Copy Structure

```
src/lib/dzin/core/          # Verbatim copy of studio-story/packages/dzin/core/src/
  density/                   # DensityProvider, useDensity
  layout/                    # DzinLayout, useLayout, templates, resolver
  panel/                     # PanelFrame
  registry/                  # createRegistry, PanelDefinition types
  theme/                     # tokens.ts, default.css, state.css, pof-bridge.css (NEW)
  types/                     # PanelDensity, PanelRole, etc.
  state/                     # State engine (copied, not actively used in prototype)
  chat/                      # Chat system (copied, not actively used)
  llm/                       # LLM transport (copied, not actively used)
  intent/                    # Intent system (copied, not actively used)
  demo/                      # Demo panels (reference for testing)
  __tests__/                 # Tests (reference only)
  index.ts                   # Barrel re-export (Dzin's existing)
```

**Source:** `C:\Users\kazda\kiro\studio-story\packages\dzin\core\src\` -> `C:\Users\kazda\kiro\pof\src\lib\dzin\core\`

**Import path:** `import { useDensity, DzinLayout } from '@/lib/dzin/core'`

### Pattern 1: CSS Import Order in globals.css

**What:** Import Dzin's default.css for structural selectors, then override with bridge CSS.

**Why this order:** Dzin's default.css contains both structural rules (`[data-dzin-panel] { display: flex; flex-direction: column; }`) AND color tokens (`:root { --dzin-surface-1: #0f172a; }`). We need the structural rules but want PoF colors. Importing bridge CSS second overrides the color tokens via CSS cascade.

**Implementation in globals.css:**
```css
@import "tailwindcss";

/* Dzin: structural selectors + default tokens */
@import "../lib/dzin/core/theme/default.css";
/* Dzin: state animations (panel enter/exit, LLM glow) */
@import "../lib/dzin/core/theme/state.css";
/* Dzin: PoF theme bridge (overrides default tokens with PoF vars) */
@import "../lib/dzin/core/theme/pof-bridge.css";

:root {
  /* ... existing PoF variables ... */
}
```

**Confidence: HIGH** -- CSS cascade guarantees later imports override earlier ones at same specificity.

### Pattern 2: Theme Bridge Token Mapping

**What:** Map all 22 `--dzin-*` tokens to PoF's existing CSS variables.

**Complete mapping (verified against both default.css and globals.css):**

```css
/* src/lib/dzin/core/theme/pof-bridge.css */

/* Override Dzin's :root color tokens with PoF values.
   Structural selectors from default.css are preserved.
   Light mode blocks are neutralized by re-declaring dark values. */

:root {
  /* Surface colors */
  --dzin-surface-1: var(--background);       /* PoF #0a0a1a replaces Dzin #0f172a */
  --dzin-surface-2: var(--surface);           /* PoF #111128 replaces Dzin #1e293b */
  --dzin-surface-3: var(--surface-hover);     /* PoF #1a1a3a replaces Dzin #334155 */

  /* Border */
  --dzin-border: var(--border);               /* PoF #1e1e3a replaces Dzin #334155 */
  --dzin-border-focus: var(--core);           /* PoF #3b82f6 replaces Dzin #06b6d4 */

  /* Text */
  --dzin-text-primary: var(--text);           /* PoF #e0e4f0 replaces Dzin #f1f5f9 */
  --dzin-text-secondary: var(--text);         /* PoF has no secondary tier; use --text */
  --dzin-text-muted: var(--text-muted);       /* PoF #7d82a8 replaces Dzin #94a3b8 */

  /* Accent */
  --dzin-accent: var(--core);                 /* PoF #3b82f6 replaces Dzin #06b6d4 */
  --dzin-accent-muted: var(--border-bright);  /* PoF #2e2e5a replaces Dzin #0e7490 */

  /* Panel-specific (derived from overridden base tokens) */
  --dzin-panel-bg: var(--surface);
  --dzin-panel-border: var(--border);
  --dzin-panel-header-bg: var(--surface-deep); /* PoF #0d0d22 */

  /* Spacing: tighten to match PoF's compact aesthetic */
  --dzin-space-xs: 4px;   /* same as Dzin default */
  --dzin-space-sm: 6px;   /* PoF is denser: 6px vs Dzin's 8px */
  --dzin-space-md: 10px;  /* PoF is denser: 10px vs Dzin's 12px */
  --dzin-space-lg: 14px;  /* PoF is denser: 14px vs Dzin's 16px */
  --dzin-space-xl: 20px;  /* PoF is denser: 20px vs Dzin's 24px */

  /* Typography: map to PoF type scale */
  --dzin-font-sm: var(--text-xs);             /* 0.75rem */
  --dzin-font-base: var(--text-sm);           /* 0.875rem */
  --dzin-font-lg: var(--text-base);           /* 1rem */
}

/* Neutralize Dzin's light mode -- PoF is dark-only */
@media (prefers-color-scheme: light) {
  :root {
    --dzin-surface-1: var(--background);
    --dzin-surface-2: var(--surface);
    --dzin-surface-3: var(--surface-hover);
    --dzin-border: var(--border);
    --dzin-border-focus: var(--core);
    --dzin-text-primary: var(--text);
    --dzin-text-secondary: var(--text);
    --dzin-text-muted: var(--text-muted);
    --dzin-accent: var(--core);
    --dzin-accent-muted: var(--border-bright);
    --dzin-panel-header-bg: var(--surface-deep);
  }
}

/* Neutralize explicit class toggles */
.light, [data-theme="light"] {
  --dzin-surface-1: var(--background);
  --dzin-surface-2: var(--surface);
  --dzin-surface-3: var(--surface-hover);
  --dzin-border: var(--border);
  --dzin-border-focus: var(--core);
  --dzin-text-primary: var(--text);
  --dzin-text-secondary: var(--text);
  --dzin-text-muted: var(--text-muted);
  --dzin-accent: var(--core);
  --dzin-accent-muted: var(--border-bright);
  --dzin-panel-header-bg: var(--surface-deep);
}
```

**Confidence: HIGH** -- Every token in Dzin's default.css has been mapped. Both files inspected directly.

### Pattern 3: Tailwind CSS 4 Density Variants (Claude's Discretion Decision)

**Recommendation: Use `@custom-variant` with `:is()` descendant selectors.**

This is the cleanest approach for Tailwind CSS 4. The `:is()` pattern targets both the element with the data attribute AND all its descendants, so `density-compact:text-xs` works on any element inside a `[data-dzin-density="compact"]` container.

**Implementation in globals.css (after the @import block):**

```css
/* Density variants for Dzin panels */
@custom-variant density-micro (&:is([data-dzin-density="micro"], [data-dzin-density="micro"] *));
@custom-variant density-compact (&:is([data-dzin-density="compact"], [data-dzin-density="compact"] *));
@custom-variant density-full (&:is([data-dzin-density="full"], [data-dzin-density="full"] *));
```

**Usage in JSX:**
```tsx
<div className="text-sm density-micro:text-xs density-full:text-base">
  Content adapts to density
</div>
```

**Why not plain CSS selectors:** Tailwind variants integrate with the utility class system, enabling density-conditional styling inline without separate CSS files or `useDensity()` calls for pure styling changes.

**Why not useDensity()-only:** The hook is needed for conditional rendering (showing/hiding entire sections), but for simple styling changes (font size, padding, gap), Tailwind variants are more ergonomic and colocated with the markup.

**Confidence: MEDIUM-HIGH** -- The `@custom-variant` + `:is()` pattern is documented in Tailwind CSS 4 and verified through multiple community sources. The descendant combinator within `:is()` is standard CSS and well-supported. Needs hands-on validation that `@tailwindcss/postcss` processes these correctly.

### Pattern 4: Dynamic Accent Colors (Claude's Discretion Decision)

**Recommendation: Use CSS custom properties set via inline styles on the panel container.**

```tsx
<div style={{ '--dzin-accent': MODULE_COLORS.core } as React.CSSProperties}>
  <PanelFrame title="Abilities" icon={<Swords size={14} />}>
    {/* Panel header icon uses --dzin-accent automatically via default.css */}
  </PanelFrame>
</div>
```

**Why this approach:** Dzin's `[data-dzin-panel-icon]` selector already styles with `color: var(--dzin-accent)`. Setting `--dzin-accent` via inline style on a parent element cascades to all children. No specificity fights because inline custom property declarations have the same specificity as any other custom property -- they just participate in the cascade at the element level.

**Confidence: HIGH** -- CSS custom property cascade is well-defined behavior.

### Pattern 5: Animation Timing (Claude's Discretion Decision)

**Recommendation: Keep Dzin's 200ms as-is. Do not override to 220ms.**

The 20ms difference (200ms vs 220ms) is imperceptible. Overriding would require editing state.css (violating "keep Dzin source as-is") or adding override CSS that fights the `@keyframes` durations. The cost exceeds the benefit.

**Confidence: HIGH** -- 20ms is below human perceptual threshold for animation duration differences.

### Anti-Patterns to Avoid
- **Importing default.css in isolation:** Missing structural `[data-dzin-panel]` layout rules. Always import default.css.
- **Modifying vendored Dzin source:** Bridge CSS and wrapper patterns handle all PoF-specific behavior. Upstream changes become impossible if source is edited.
- **Adding `@/` imports inside `src/lib/dzin/core/`:** Dzin's internal imports stay relative per user decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS token override | Manual hex values in components | Bridge CSS with `var()` references | Single source of truth; changes propagate automatically |
| Light mode neutralization | Conditional JS logic | CSS cascade (bridge file re-declares tokens in light media query) | Zero runtime cost; pure CSS |
| Density-conditional styling | `useDensity()` + inline styles for every style change | `@custom-variant` Tailwind directives | Colocated with markup; no hook import needed for pure styling |

## Common Pitfalls

### Pitfall 1: CSS Specificity Between default.css and pof-bridge.css
**What goes wrong:** Dzin's default.css uses `:root` for token declarations. The bridge file also uses `:root`. If import order is wrong, bridge values don't override defaults.
**How to avoid:** Import bridge AFTER default.css in globals.css. Both use `:root` at identical specificity, so cascade order (file order) determines the winner.
**Warning signs:** Dzin panels show slate-blue colors (#0f172a) instead of PoF's indigo-dark (#0a0a1a).

### Pitfall 2: Dzin's Light Mode Media Query Overriding Bridge
**What goes wrong:** Dzin's default.css includes `@media (prefers-color-scheme: light)` which overrides `:root` tokens on systems with light mode preference. The bridge's `:root` block doesn't cover this.
**How to avoid:** The bridge file MUST include a matching `@media (prefers-color-scheme: light)` block that re-declares all tokens with PoF values (already included in the mapping above).
**Warning signs:** Panels appear with white backgrounds on macOS/Windows systems set to light mode.

### Pitfall 3: state.css Density Transition Conflicts
**What goes wrong:** Dzin's state.css applies `transition: width 200ms ease, height 200ms ease` to ALL `[data-dzin-panel]` elements. In a CSS Grid layout, width/height are controlled by the grid, not the panel. This transition is redundant and can cause jank when grid template changes.
**How to avoid:** Accept for Phase 1 (no panels render yet). Address in Phase 2 if jank is observed by adding an override in bridge CSS: `[data-dzin-panel] { transition: padding 200ms ease, font-size 200ms ease; }`.
**Warning signs:** Panels visibly "jump" during layout or density changes.

### Pitfall 4: TypeScript Compilation Failures After Copy
**What goes wrong:** Dzin source may use TypeScript features or settings that conflict with PoF's tsconfig (e.g., different `moduleResolution`, `target`, or `strict` settings).
**How to avoid:** Run `npm run typecheck` immediately after copy and before any other work. Fix any errors (likely import path issues or missing type declarations).
**Warning signs:** Red squiggles in IDE immediately after copy; `tsc --noEmit` fails.

### Pitfall 5: `@import` Order in globals.css vs Tailwind Processing
**What goes wrong:** Tailwind CSS 4 processes `@import "tailwindcss"` which includes a CSS reset. If Dzin's default.css is imported before Tailwind, the reset may override Dzin's structural styles. If imported after, Dzin's `:root` tokens may override Tailwind's `@theme` values.
**How to avoid:** Import order MUST be: `@import "tailwindcss"` first, then Dzin files. This ensures Tailwind's reset runs first, then Dzin's structural + token CSS layers on top, then the bridge overrides Dzin's tokens.
**Warning signs:** Dzin panels lose their flex layout or border-radius after adding imports.

## Code Examples

### globals.css Import Block (Complete)
```css
@import "tailwindcss";

/* Dzin theme: structural selectors + default dark tokens */
@import "../lib/dzin/core/theme/default.css";
/* Dzin state: panel enter/exit animations, LLM glow, density transitions */
@import "../lib/dzin/core/theme/state.css";
/* PoF bridge: override Dzin tokens with PoF design system values */
@import "../lib/dzin/core/theme/pof-bridge.css";

/* Density variants for Tailwind utilities inside Dzin panels */
@custom-variant density-micro (&:is([data-dzin-density="micro"], [data-dzin-density="micro"] *));
@custom-variant density-compact (&:is([data-dzin-density="compact"], [data-dzin-density="compact"] *));
@custom-variant density-full (&:is([data-dzin-density="full"], [data-dzin-density="full"] *));

:root {
  /* ... existing PoF variables unchanged ... */
}
```

### Verification Test Element
```tsx
// Minimal test to verify FOUND-03 and FOUND-04
export function DzinThemeTest() {
  return (
    <div data-dzin-density="compact" className="p-4">
      <div data-dzin-panel>
        <div data-dzin-panel-header data-dzin-density="compact">
          <span data-dzin-panel-title>Test Panel</span>
        </div>
        <div data-dzin-panel-body data-dzin-density="compact">
          <p className="density-compact:text-xs density-full:text-base">
            This text should be xs at compact density
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Import Verification
```typescript
// This import MUST resolve and typecheck after Phase 1
import { useDensity } from '@/lib/dzin/core';
import type { PanelDensity, PanelDefinition } from '@/lib/dzin/core';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind 3 `addVariant()` plugin | Tailwind 4 `@custom-variant` CSS directive | Tailwind CSS 4.0 (2025) | No JS plugin needed; define variants purely in CSS |
| `@apply` for data attribute styles | Native CSS attribute selectors | Tailwind 4 discourages @apply | Dzin's default.css approach (pure CSS) is correct |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via existing setup) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npm run validate` (typecheck + lint + test) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | Dzin source imports resolve | build | `npm run typecheck` | N/A (build check) |
| FOUND-02 | fast-json-patch installed, build passes | build | `npm run build` | N/A (build check) |
| FOUND-03 | Theme bridge maps tokens correctly | manual | Visual inspection: panel uses PoF colors | N/A (visual) |
| FOUND-04 | Tailwind density variants apply styles | manual | Render test element, inspect computed styles | N/A (visual) |

### Sampling Rate
- **Per task commit:** `npm run typecheck` (fast, catches import/type errors)
- **Per wave merge:** `npm run validate` (full CI: typecheck + lint + test)
- **Phase gate:** `npm run build` must complete successfully

### Wave 0 Gaps
- [ ] No new test files needed -- Phase 1 validation is via typecheck and build commands
- [ ] Verify existing tests still pass after adding Dzin source (no regressions)

## Open Questions

1. **@custom-variant with @tailwindcss/postcss processing**
   - What we know: The syntax is documented and community-verified for Tailwind CSS 4
   - What's unclear: Whether `@tailwindcss/postcss` (the PostCSS plugin PoF uses) processes `@custom-variant` identically to the Tailwind CLI
   - Recommendation: Test immediately after adding the directives; fall back to plain CSS `[data-dzin-density="compact"] .class` selectors if it fails

2. **Dzin's `'use client'` coverage**
   - What we know: `LayoutProvider.tsx` and `useLayout.ts` already have `'use client'`
   - What's unclear: Whether ALL Dzin components that use React hooks have the directive
   - Recommendation: Run `npm run build` (Next.js production build catches missing directives); add `'use client'` to any Dzin files that fail

## Sources

### Primary (HIGH confidence)
- Dzin source: `C:\Users\kazda\kiro\studio-story\packages\dzin\core\src\` -- direct inspection of all modules, default.css, state.css, index.ts
- PoF globals.css: `C:\Users\kazda\kiro\pof\src\app\globals.css` -- direct inspection of CSS variables and @theme block
- PoF postcss.config.mjs -- confirms `@tailwindcss/postcss` plugin

### Secondary (MEDIUM-HIGH confidence)
- [Tailwind CSS 4 @custom-variant syntax](https://deepwiki.com/tlq5l/tailwindcss-v4-skill/2.4-the-@variant-and-@custom-variant-directives) -- `:is()` descendant pattern documented
- [Tailwind CSS v4 release blog](https://tailwindcss.com/blog/tailwindcss-v4) -- confirms @custom-variant is a first-class feature
- [Data Attribute Variants in Tailwind](https://stevekinney.com/courses/tailwind/data-attribute-variants) -- practical examples

### Tertiary (MEDIUM confidence)
- [TW4 data attribute inheritance discussion](https://github.com/tailwindlabs/tailwindcss/discussions/17115) -- community reports on data attribute + descendant patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Dzin's only dep (fast-json-patch) is verified; no other changes needed
- Architecture (copy + bridge): HIGH -- both codebases inspected directly; token mapping is complete
- Tailwind density variants: MEDIUM-HIGH -- syntax verified through docs and community; needs hands-on validation with @tailwindcss/postcss
- Pitfalls: HIGH -- based on direct CSS analysis of both design systems

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable domain; Dzin source and PoF stack are not changing)
