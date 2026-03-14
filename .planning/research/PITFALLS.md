# Pitfalls Research

**Domain:** Headless panel composition framework (Dzin) integration into existing Next.js 16 + React 19 + Tailwind CSS 4 app
**Researched:** 2026-03-14
**Confidence:** HIGH (based on direct source code analysis of both Dzin and PoF codebases)

## Critical Pitfalls

### Pitfall 1: CSS Custom Property Collision Between Dzin Tokens and PoF Global Variables

**What goes wrong:**
Dzin's `default.css` declares `:root`-level custom properties (`--dzin-surface-1: #0f172a`, `--dzin-text-primary: #f1f5f9`, etc.) that are visually similar but semantically different from PoF's `:root` variables (`--background: #0a0a1a`, `--surface: #111128`, `--text: #e0e4f0`). Both systems define dark surfaces, borders, and text colors at slightly different values. When both CSS files load, the two design systems render panels with subtly mismatched colors -- Dzin panels look like they belong to a different app. Worse, if anyone maps Dzin tokens to PoF variables naively (e.g., `--dzin-surface-2: var(--surface)`), Dzin's light-mode media query overrides will break because PoF has no light mode and does not toggle those variables.

**Why it happens:**
Both systems independently define a full color palette at `:root`. Dzin includes `@media (prefers-color-scheme: light)` overrides and `.light`/`[data-theme="light"]` toggles that PoF never uses. Developers see "they're both dark themes" and assume they'll harmonize. They do not -- `#0f172a` (Dzin surface-1) vs `#0a0a1a` (PoF background) vs `#111128` (PoF surface) create visible seams.

**How to avoid:**
Do NOT import Dzin's `default.css` as-is. Create a `dzin-pof-bridge.css` that remaps all `--dzin-*` tokens to PoF's existing CSS variables. Specifically:
- `--dzin-surface-1: var(--background)`
- `--dzin-surface-2: var(--surface)`
- `--dzin-surface-3: var(--surface-hover)`
- `--dzin-border: var(--border)`
- `--dzin-text-primary: var(--text)`
- `--dzin-text-muted: var(--text-muted)`
- Remove or disable the `@media (prefers-color-scheme: light)` block entirely
- Remove `.light` / `[data-theme="light"]` overrides

Keep Dzin's structural CSS (the `[data-dzin-panel]` layout rules) intact. Only remap the color/spacing tokens.

**Warning signs:**
- Dzin panels have a noticeably different background shade than surrounding PoF UI
- Border colors don't match between Dzin panels and SurfaceCard components
- Text appears slightly brighter or duller inside Dzin panels

**Phase to address:**
Phase 1 (Dzin source copy + theme bridge). Must be done before any panel rendering work.

---

### Pitfall 2: Dual Animation Systems -- Dzin CSS Transitions vs PoF's framer-motion

**What goes wrong:**
Dzin's `state.css` applies CSS `transition: width 200ms ease, height 200ms ease` to ALL `[data-dzin-panel]` elements, plus CSS `@keyframes` for panel enter/exit. Meanwhile, PoF's AbilitySpellbook and all 28 unique-tab components use framer-motion's `<motion.div>`, `<AnimatePresence>`, and `animate` props extensively. When panel content rendered inside Dzin frames uses framer-motion animations, two animation systems fight over the same DOM elements:
1. CSS transitions fire on dimension changes (from density/layout switches)
2. framer-motion tries to animate the same elements with its own timing

This creates janky double-animations, layout thrashing, and visual glitches. Specifically, density transitions (full -> compact -> micro) trigger Dzin's CSS `width/height` transition on the panel frame while framer-motion's `AnimatePresence` tries to animate content mount/unmount inside.

**Why it happens:**
Dzin is headless and uses pure CSS for state animations (deliberate design choice for framework independence). PoF's existing components are deeply wired to framer-motion. These two approaches are philosophically compatible (one animates the frame, the other animates content) but practically conflict when both touch layout properties simultaneously.

**How to avoid:**
Establish a clear boundary: Dzin CSS handles FRAME-level animations (panel enter/exit, density transitions). framer-motion handles CONTENT-level animations (sub-tab switching, chart reveals, list item stagger). Concretely:
1. In `state.css`, change the density transition to only animate `padding` and `font-size`, NOT `width`/`height` (those are controlled by the CSS Grid, not the panel):
   ```css
   [data-dzin-panel] {
     transition: padding 200ms ease, font-size 200ms ease;
   }
   ```
2. Do NOT use `<AnimatePresence>` for density-change content swaps. Use CSS `display: none` / conditional rendering based on `useDensity()` return value.
3. framer-motion animations within panel content (radar charts, timeline strips, pipeline flows) are fine -- they operate inside `[data-dzin-panel-body]` and don't conflict with frame transitions.

**Warning signs:**
- Panels visibly "jump" or "stutter" during density transitions
- Content appears to animate twice (once in, then adjusts position)
- `ResizeObserver loop completed with undelivered notifications` console warnings

**Phase to address:**
Phase 1 (theme/animation bridge setup). Revisit in Phase 2 (panel content implementation) when verifying content animations.

---

### Pitfall 3: ResizeObserver Cascade Between Dzin useLayout and PoF's Existing Layout

**What goes wrong:**
Dzin's `useLayout` hook creates a `ResizeObserver` on either `containerRef.current` or `document.documentElement`, debounced at 100ms. When the container resizes, it triggers `resolveLayout` which changes `gridTemplateColumns`/`gridTemplateRows`, which changes slot dimensions, which triggers density recalculation, which changes panel content (micro hides headers, compact shrinks padding), which can change the content's intrinsic size, which triggers the ResizeObserver again. In a worst case, this creates a resize -> re-layout -> resize feedback loop that settles after 2-3 frames but causes visible jank on every window resize or layout template switch.

PoF already has 110+ `useEffect` calls in module components (per CONCERNS.md). Adding Dzin's ResizeObserver + density recalculation on top means resize events cascade through: ResizeObserver -> useState(viewport) -> useMemo(resolveLayout) -> DensityProvider re-render -> all child panels re-render -> content size changes -> ResizeObserver fires again.

**Why it happens:**
The ResizeObserver -> layout -> density -> content -> size change -> ResizeObserver loop is inherent to any responsive layout system. Dzin's 100ms debounce mitigates but does not eliminate it. The issue is amplified when panel content has data-driven heights (like AbilitySpellbook's variable-length feature lists and radar charts).

**How to avoid:**
1. ALWAYS pass `containerRef` to `useLayout` pointing to the prototype page's content container -- never let it observe `document.documentElement`. This scopes observation to the Dzin area only.
2. Set `overflow: hidden` on the Dzin grid container so content size changes inside panels cannot bubble up and change the container's dimensions.
3. Use fixed heights for panel content areas at each density level. Do not let panel body content determine the panel's height -- the grid should be the authority:
   ```css
   [data-dzin-panel-body] {
     overflow: auto;  /* Already in default.css -- verify it stays */
     min-height: 0;   /* Prevent grid blowout */
   }
   ```
4. Consider using `useSuspendableEffect` (from PoF's existing hooks) for the ResizeObserver if the prototype route is ever part of the module LRU cache system. This prevents the observer from running when the prototype tab is hidden.

**Warning signs:**
- Chrome DevTools Performance panel shows repeated "Recalculate Style" and "Layout" entries in rapid succession
- `ResizeObserver loop completed with undelivered notifications` errors in console
- Visible "breathing" effect where panels subtly grow/shrink repeatedly

**Phase to address:**
Phase 2 (layout integration). The containerRef scoping should be established in Phase 1, but the overflow/fixed-height patterns emerge during Phase 2 panel content work.

---

### Pitfall 4: TypeScript Path Alias Mismatch When Copying Dzin Source

**What goes wrong:**
Dzin's source uses relative imports between its own modules (e.g., `import { useDensity } from '../density/DensityContext'`, `import type { PanelDensity } from '../types/panel'`). When copied to `src/lib/dzin/`, these relative imports work but violate PoF's coding convention (CLAUDE.md: "Always use `@/` alias, never relative `../../`"). More critically, Dzin's internal `types/` directory conflicts with PoF's existing `src/types/` directory if anyone uses `@/types/panel` instead of `@/lib/dzin/types/panel`. Additionally, Dzin's `tsconfig.json` (in studio-story) may have different `strict` settings, `target`, or `moduleResolution` than PoF's tsconfig.

**Why it happens:**
Dzin was developed as a standalone package with its own tsconfig. Copying source files preserves internal relative imports but doesn't adapt them to the host project's conventions. The `types/` namespace collision is subtle and only surfaces when someone writes an import path from memory.

**How to avoid:**
1. Maintain Dzin's internal relative imports as-is within `src/lib/dzin/`. These are internal to the library and the `@/` convention applies to PoF application code importing Dzin, not Dzin's internal structure.
2. Create a barrel export at `src/lib/dzin/index.ts` that re-exports the public API. All PoF code imports Dzin via `@/lib/dzin` or `@/lib/dzin/layout`, never reaching into Dzin internals.
3. Explicitly name Dzin's types directory `src/lib/dzin/types/` (it already is) and NEVER add Dzin types to `src/types/`. If PoF needs to extend Dzin types, do it in a separate `src/types/dzin-extensions.ts` file.
4. Verify Dzin compiles cleanly under PoF's tsconfig before writing any integration code. Key settings to check: `"moduleResolution": "bundler"`, `"jsx": "preserve"`, `"strict": true`.

**Warning signs:**
- TypeScript errors about missing modules or incompatible types after copying
- Import autocomplete suggesting `@/types/panel` (PoF's types dir) when you want Dzin's panel types
- ESLint warnings about relative imports in files outside `src/lib/dzin/`

**Phase to address:**
Phase 1 (source copy). This is the very first task and must be validated with `npm run typecheck` immediately after copying.

---

### Pitfall 5: Density Rendering Multiplies Component Complexity 3x

**What goes wrong:**
Each Dzin panel needs three rendering paths: micro (minimal, no header), compact (reduced, header with title only), full (complete UI). For AbilitySpellbook's 10 sections, this means implementing 30 distinct visual states. Developers either: (a) implement `full` first and never get to micro/compact, leaving them as broken stubs; (b) try to make one component handle all three with increasingly complex conditional rendering; or (c) implement all three but with duplicated logic that drifts apart over time.

AbilitySpellbook's sections include complex visualizations (RadarChart, TimelineStrip, PipelineFlow) that cannot simply "shrink." A RadarChart at micro density needs to become a simple score badge. A PipelineFlow at compact needs to become a condensed status strip. These are fundamentally different components, not CSS-resized versions.

**Why it happens:**
"Density-aware" sounds like responsive design (just make it smaller). It is not. It is three distinct UIs sharing the same data model. The mental model of "one component, three sizes" is wrong -- it should be "three components, one data contract."

**How to avoid:**
1. Define a `DensityRenderer` pattern: each panel exports `{ MicroView, CompactView, FullView }` as separate components, plus a `PanelDataProvider` that handles data fetching once. The panel's render function switches on `useDensity()`:
   ```typescript
   function AbilityCorePanel() {
     const density = useDensity();
     const data = useCoreData();
     switch (density) {
       case 'micro': return <CoreMicro data={data} />;
       case 'compact': return <CoreCompact data={data} />;
       case 'full': return <CoreFull data={data} />;
     }
   }
   ```
2. Start with micro. It forces you to identify the single most important data point for each panel. Then build compact (adds context). Then full (adds interaction). This bottom-up approach prevents the common failure of "full works, micro is broken."
3. For visualization components (RadarChart, TimelineStrip), create density-aware wrappers that select entirely different rendering strategies, not just different sizes.

**Warning signs:**
- Panel components exceeding 300 lines (sign of cramming all densities into one function)
- `if (density === 'micro')` scattered throughout a component instead of clean switches at the top
- Micro/compact views showing broken layouts or overflowing content

**Phase to address:**
Phase 2 (panel content implementation). The pattern should be established in Phase 1 as a documented convention, then enforced during Phase 2 implementation.

---

### Pitfall 6: Layout Template Switching Causes Full React Tree Remount

**What goes wrong:**
When switching between layout templates (e.g., `split-2` to `grid-4`), Dzin's `DzinLayout` re-resolves the layout via `resolveLayout()`. This produces new `SlotAssignment` objects with different `slotIndex` values. Since React uses `key={assignment.slotIndex}` in the map, changing the template changes the keys, which causes React to unmount and remount ALL panel components. This destroys component state (selected sub-tabs, scroll positions, expanded sections, radar chart hover states) and triggers exit/enter animations for every panel simultaneously.

With AbilitySpellbook's 10 sections as panels, this means 10 simultaneous unmount animations + 10 mount animations + 10 component state resets. On PoF's already-heavy component tree (95,602 lines of module components, zero `React.memo` usage), this creates a noticeable freeze.

**Why it happens:**
CSS Grid template changes inherently reposition slots. Dzin's `DzinLayout` uses `slotIndex` as the React key because it corresponds to the grid slot. When template changes, slot indices are reassigned by the Hungarian algorithm, so the same panel may end up at a different slotIndex.

**How to avoid:**
1. Use `panelType` (the panel's stable identifier) as the React key instead of `slotIndex`. Apply the slot's grid positioning via inline styles rather than relying on DOM order:
   ```tsx
   {layout.assignments.map((assignment) => (
     <div key={assignment.panelType} style={getSlotProps(assignment.slotIndex).style}>
       <DensityProvider density={assignment.density}>
         {renderPanel(assignment)}
       </DensityProvider>
     </div>
   ))}
   ```
2. Use `React.memo` on each panel component (PoF has zero memo usage currently -- this is the forcing function to start).
3. Animate layout transitions with CSS Grid's `grid-template-*` transition rather than remounting. CSS Grid can smoothly interpolate between template values if the DOM elements stay mounted.

**Warning signs:**
- All panels flash/re-animate when switching templates
- Sub-tab selections reset to defaults after template switch
- React DevTools Profiler shows large commit sizes (many components mounting) on template change

**Phase to address:**
Phase 2 (layout template switching). The `panelType`-as-key pattern should be established when implementing `DzinLayout` integration.

---

### Pitfall 7: Dzin's `fast-json-patch` Dependency Version Conflict

**What goes wrong:**
Dzin depends on `fast-json-patch@^3.1.1` for its state engine (undo/redo, LLM patch application). If PoF later adds another library that depends on a different version of `fast-json-patch`, or if the prototype scope expands to include Dzin's state engine (not just layout/density), the dependency becomes load-bearing. Since Dzin source is copied (not npm-installed), the `import` of `fast-json-patch` in Dzin's state modules will resolve to whatever version PoF has installed. If PoF doesn't install it at all, those modules fail at runtime.

**Why it happens:**
Copying source means the consuming project must manually install peer dependencies. Dzin's state engine imports `fast-json-patch` in `state/patches.ts`, `state/engine.ts`, and `state/conflict.ts`. Even if the prototype doesn't use the state engine, tree-shaking may not eliminate these imports in development mode (Next.js dev server doesn't tree-shake).

**How to avoid:**
1. For the prototype phase (layout + density only), do NOT copy Dzin's `state/`, `chat/`, `llm/`, or `intent/` directories. Only copy: `density/`, `layout/`, `panel/`, `registry/`, `theme/`, `types/`, and the root `index.ts`.
2. Create a trimmed `index.ts` for the copied subset that only exports layout/density/panel/registry APIs.
3. If the full Dzin source must be copied for future use, install `fast-json-patch@^3.1.1` in PoF immediately and add a comment in `package.json` noting it's a Dzin dependency.

**Warning signs:**
- `Module not found: Can't resolve 'fast-json-patch'` errors during dev or build
- Runtime errors in state engine code that wasn't meant to be used yet
- Unexpected `node_modules` bloat from transitive dependencies

**Phase to address:**
Phase 1 (source copy). Decide the copy scope before copying.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Import Dzin's `default.css` unmodified | Fast visual result | Dual color system, light-mode bugs, visual inconsistency | Never -- always create bridge CSS |
| Cram all 3 densities into one component | Faster initial development | Unmaintainable 500+ line components (PoF already has this problem) | Never -- use separate view components |
| Skip micro density, implement only full+compact | Halves the rendering work | Micro is the highest-value density for dashboard layouts; skipping defeats the purpose | Only in first iteration if explicitly labeled as stub |
| Use `document.documentElement` for ResizeObserver | No need to wire containerRef | Observes entire page, fires on unrelated layout changes, performance waste | Never when containerRef is available |
| Copy ALL Dzin modules including state/chat/llm/intent | "Complete" source copy, no decisions needed | Unused code that imports `fast-json-patch`, increases bundle, confuses contributors | Only if future milestones are confirmed to need those modules |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Dzin CSS + Tailwind CSS 4 | Loading both `default.css` and Tailwind's reset, causing attribute selectors to have lower specificity than Tailwind utilities | Load Dzin bridge CSS AFTER Tailwind's `@import "tailwindcss"` so `[data-dzin-*]` selectors win. Or scope Dzin CSS under a `.dzin-root` parent selector. |
| `useDensity()` + existing component props | Passing density as a prop AND reading from context, causing mismatches | Choose one source of truth. Use context (`useDensity()`) as primary. Only allow prop override in `PanelFrame` (which already does this correctly). |
| Dzin's `useLayout` + Next.js SSR | `useLayout` reads `window.innerWidth` on init, which doesn't exist during SSR | Dzin already has an SSR guard (defaults to 1920x1080), but panel content that conditionally renders based on density will flash on hydration. Use `'use client'` on the prototype page and consider `suppressHydrationWarning` on the grid container. |
| Dzin panel registry + PoF module registry | Two parallel registries (Dzin's `createRegistry()` and PoF's `module-registry.ts`) creating confusion about which is the "source of truth" for panel metadata | Keep them separate with clear roles: PoF registry = module metadata + checklists + prompts. Dzin registry = layout metadata + density modes + IO schema. Bridge them via panel definitions that reference PoF moduleId. |
| `SurfaceCard` inside `PanelFrame` | Nesting PoF's `SurfaceCard` inside Dzin's `PanelFrame` double-applies borders, backgrounds, and border-radius | Do NOT nest them. Dzin panels replace `SurfaceCard` for prototype content. Map `SurfaceCard`'s level/interactive props to equivalent Dzin data attributes if needed. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-resolving layout on every render | `resolveLayout` runs the Hungarian algorithm (O(n^3)) on every viewport change | `useMemo` in `useLayout` already handles this, but ensure directive/registry arrays are referentially stable (not recreated every render) | With 10+ panels or on low-end hardware |
| All panels re-render on density change | `DensityProvider` re-renders all children when density changes | Wrap each panel in `React.memo`. Use `useDensity()` only in leaf components that actually need it. | With complex panel content (RadarChart, TimelineStrip) |
| AbilitySpellbook's 1827 lines as panel content | Porting the monolithic component into Dzin panels without decomposition | Split into 10 separate panel components FIRST, then wire into Dzin. Do not wrap the monolith. | Immediately -- the component is already at performance-concern size |
| CSS attribute selectors `[data-dzin-*]` slower than class selectors | Browser style recalculation takes measurably longer with attribute selectors at scale | Acceptable for prototype (10 panels). If expanding to 50+ panels across modules, consider adding CSS classes alongside data attributes. | At 50+ simultaneous Dzin panels on screen |
| Density transition causing 3 rapid re-renders | Density changes from full->compact trigger: (1) grid resize, (2) density context update, (3) content conditional render | Batch density changes. Use `startTransition` for non-urgent density updates. | With animated content inside panels |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Micro density shows nothing useful | Users see empty or meaningless panels at micro density | Micro must show THE single most important metric: a number, a status badge, a progress bar. Design micro first. |
| Layout template names are meaningless | "Split-2", "grid-4", "triptych" mean nothing to game developers | Rename templates for the PoF context: "Focus + Detail", "Quad Dashboard", "Editor Layout". Show visual previews. |
| No visual feedback during density transitions | Panels snap between densities with no indication of what happened | Add a brief opacity dip (150ms) during density changes so users perceive a smooth transition, not a jarring swap. |
| Density computed from slot size feels "wrong" | Auto-density assignment means users don't control it -- switching templates unexpectedly changes panel density | Show the current density level in the panel header (full/compact/micro badge). Allow manual density override per panel. |
| Comparing Dzin vs current AbilitySpellbook is confusing | Side-by-side comparison with different navigation patterns and data organization | Ensure both views show the same data. The prototype page should have an explicit "Original" / "Dzin" toggle, not a side-by-side. |

## "Looks Done But Isn't" Checklist

- [ ] **Theme bridge:** Dzin panels match PoF's exact color values -- compare with color picker, not just by eye
- [ ] **Micro density:** Every panel shows meaningful content at micro density, not just a title or empty box
- [ ] **Keyboard navigation:** Tab focus order works correctly across all panels in all templates (Dzin uses `role="region"` and `aria-label` but focus management is not built in)
- [ ] **Template switching:** User state (sub-tab selection, scroll position, expanded sections) survives template changes
- [ ] **Window resize:** Rapid window resizing does not cause layout oscillation or memory leaks from orphaned ResizeObservers
- [ ] **Data parity:** Dzin prototype panels show the exact same feature matrix data as the original AbilitySpellbook
- [ ] **Build passes:** `npm run build` succeeds -- dev mode may hide import errors that production build catches
- [ ] **No leaked CSS:** Dzin's CSS does not affect non-prototype pages. Verify by checking any other module view after loading the prototype.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| CSS color mismatch | LOW | Create bridge CSS file remapping all `--dzin-*` tokens. Single file change, no component modifications needed. |
| Dual animation jank | MEDIUM | Audit state.css transitions, remove width/height from transition list, verify framer-motion animations inside panels are scoped to content layer. |
| ResizeObserver cascade | MEDIUM | Add `overflow: hidden` to grid container, scope ResizeObserver to container ref, add `min-height: 0` to panel bodies. May require adjusting panel content that relies on auto-height. |
| TypeScript compilation errors | LOW | Run `npm run typecheck`, fix import paths, verify tsconfig compatibility. Usually resolved in under an hour. |
| Density rendering incomplete | HIGH | If only `full` was implemented and micro/compact are stubs, must design and implement 20 additional view components (10 panels x 2 missing densities). Prevention is far cheaper. |
| Layout template remount | MEDIUM | Change React key from `slotIndex` to `panelType`, add `React.memo` to panel components. Requires touching the DzinLayout integration code and each panel. |
| fast-json-patch missing | LOW | `npm install fast-json-patch@^3.1.1` or trim the copied source to exclude state engine modules. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CSS token collision | Phase 1: Source copy + theme bridge | Color-picker comparison between Dzin panel and SurfaceCard backgrounds |
| Dual animation systems | Phase 1: Theme/animation setup | Record screen during density transition, verify single animation per element |
| ResizeObserver cascade | Phase 2: Layout integration | Chrome Performance panel recording during rapid window resize shows no layout thrashing |
| TypeScript path aliases | Phase 1: Source copy | `npm run typecheck` passes with zero errors after copy |
| 3x density rendering complexity | Phase 2: Panel content | All 10 panels render meaningful content at all 3 density levels |
| Layout template remount | Phase 2: Template switching | Sub-tab selection persists across template switch (manual test) |
| fast-json-patch dependency | Phase 1: Source copy | `npm run build` passes; `import` statements in copied source resolve correctly |

## Sources

- Direct source analysis: `C:\Users\kazda\kiro\studio-story\packages\dzin\core\src\` (Dzin source)
- Direct source analysis: `C:\Users\kazda\kiro\pof\src\` (PoF source)
- `C:\Users\kazda\kiro\pof\.planning\codebase\CONCERNS.md` (existing tech debt documentation)
- Dzin `default.css` and `state.css` for CSS conflict surface analysis
- PoF `globals.css` for CSS variable namespace analysis
- Dzin `useLayout.ts` ResizeObserver implementation (100ms debounce, SSR guard)
- Dzin `resolver.ts` layout pipeline (Hungarian algorithm, 6-step resolution)
- AbilitySpellbook.tsx (1827 lines, 10 sections, framer-motion throughout)
- `_shared.tsx` (framer-motion animation patterns used across all unique-tabs)

---
*Pitfalls research for: Dzin panel framework integration into PoF*
*Researched: 2026-03-14*
