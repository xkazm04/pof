# Project Research Summary

**Project:** Dzin Integration Prototype
**Domain:** Headless density-aware panel framework integration into existing Next.js game-dev tooling
**Researched:** 2026-03-14
**Confidence:** HIGH

## Executive Summary

This project integrates Dzin, a headless density-aware panel composition framework, into PoF's existing Next.js 16 / React 19 application. The goal is to prove that Dzin's automatic per-slot density adaptation can make PoF's dense game-dev UIs (starting with AbilitySpellbook's 10 sections) responsive and composable without manual layout management. The recommended approach is a vendored source copy of Dzin into `src/lib/dzin/`, bridging its CSS token system to PoF's existing Tailwind CSS 4 variables, and decomposing AbilitySpellbook into 10 standalone panel components with three density levels each (micro/compact/full).

The stack impact is minimal: one new runtime dependency (`fast-json-patch`), zero framework changes, and full compatibility with the existing React 19 + Zustand 5 + Tailwind CSS 4 setup. Dzin was built targeting this exact stack. The architecture is clean -- Dzin handles layout resolution and density computation; PoF handles data (via Zustand stores) and theming (via CSS variable bridge). The prototype lives on an isolated `/prototype` route with no impact on the existing SPA.

The primary risks are: (1) CSS token collision between Dzin's default theme and PoF's dark palette -- mitigated by creating a bridge CSS file instead of importing Dzin's defaults; (2) 3x component complexity from three density rendering paths per panel -- mitigated by a strict pattern of separate micro/compact/full view components built bottom-up starting from micro; and (3) ResizeObserver feedback loops from Dzin's layout engine interacting with content-driven panel heights -- mitigated by scoping observation to a container ref and enforcing `overflow: hidden` on the grid container.

## Key Findings

### Recommended Stack

No framework changes required. Dzin targets React 19 exactly and uses `'use client'` directives compatible with Next.js App Router. The only new dependency is `fast-json-patch@^3.1.1` (Dzin's sole runtime dep, a stable RFC 6902 implementation). Existing dependencies (framer-motion, lucide-react, zustand, react-window) are leveraged as-is. Integration strategy is direct source copy to `src/lib/dzin/` -- no npm workspaces, no git submodules, no monorepo tooling needed.

**Core technologies:**
- **Next.js 16 + React 19:** Already in use; Dzin peer-depends on React ^19.0.0
- **fast-json-patch 3.1.1:** Dzin's only new runtime dependency; pure JS, no React coupling
- **Tailwind CSS 4 + CSS custom properties bridge:** Override `--dzin-*` tokens to reference PoF's existing `--surface`, `--border`, `--text` variables
- **framer-motion 12:** Use for layout template transition animations (FLIP-based grid reflow); Dzin handles frame-level CSS animations separately

### Expected Features

**Must have (table stakes):**
- Tri-density rendering (micro/compact/full) for all 10 AbilitySpellbook panels
- Layout template switching (at least 4 templates: split-2, grid-4, primary-sidebar, studio)
- Automatic density assignment from slot pixel dimensions
- Panel registry with metadata (type, role, sizeClass, densityModes)
- Graceful content degradation per density (not just CSS shrinking -- fundamentally different UIs)
- Consistent theming via CSS token bridge
- Viewport-responsive template selection (filter complex templates on narrow viewports)
- Prototype route (`/prototype`) isolated from existing app

**Should have (differentiators -- add after core validation):**
- Animated density transitions (framer-motion content morphing)
- Animated layout transitions (framer-motion FLIP on grid reflow)
- Layout template picker UI (visual minimap-style selector)
- Side-by-side comparison mode (original AbilitySpellbook vs Dzin version)
- Composition presets (named panel + layout combos)
- Density override controls (manual per-panel override)

**Defer (v2+):**
- Panel-to-panel data wiring (cross-panel pub/sub)
- LLM intent routing (explicitly out of scope per PROJECT.md)
- Chat-driven composition (explicitly out of scope)
- Drag-and-drop panel rearrangement (conflicts with auto-density model)
- User-resizable dividers (conflicts with auto-density model)
- Undo/redo, layout persistence

### Architecture Approach

The architecture cleanly separates PoF and Dzin concerns. Dzin source is vendored at `src/lib/dzin/` (imported via `@/lib/dzin`). PoF-specific panel implementations live at `src/lib/dzin-panels/` with one component per AbilitySpellbook section. Data flows one-way from Zustand stores through props to panel components; Dzin's state engine is copied but not wired for this milestone. The theme bridge is a single CSS file mapping `--dzin-*` tokens to PoF's existing CSS variables, scoped to `[data-dzin-layout]` to avoid global conflicts.

**Major components:**
1. **`src/lib/dzin/`** -- Vendored Dzin core (density, layout, panel, registry, theme modules)
2. **`src/lib/dzin-panels/`** -- 10 PoF panel components + registry + definitions (the integration layer)
3. **`src/styles/dzin-pof-theme.css`** -- CSS token bridge mapping Dzin tokens to PoF variables
4. **`src/app/prototype/page.tsx`** -- Isolated demo route
5. **`src/components/prototype/`** -- PrototypeShell, LayoutSwitcher, DensityControls, ComparisonView

### Critical Pitfalls

1. **CSS token collision** -- Do NOT import Dzin's `default.css`. Create a bridge CSS file remapping all `--dzin-*` tokens to PoF variables. Remove light-mode overrides entirely. Verify with a color picker, not by eye.
2. **Dual animation systems** -- Dzin CSS handles frame-level animations (panel enter/exit, density transitions on padding/font-size). Framer-motion handles content-level animations (chart reveals, list stagger). Do NOT use `AnimatePresence` for density content swaps; use conditional rendering.
3. **ResizeObserver cascade** -- Always pass `containerRef` to `useLayout` (never observe `document.documentElement`). Set `overflow: hidden` on the grid container. Use fixed heights for panel content areas.
4. **3x density rendering complexity** -- Treat densities as three separate components sharing one data contract, not one component at three sizes. Build micro first (forces identification of the single most important metric), then compact, then full.
5. **Layout template switching causes full remount** -- Use `panelType` as React key (not `slotIndex`). Add `React.memo` to all panel components. This preserves component state (sub-tab selection, scroll position) across template switches.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Dzin Source + Theme Bridge)
**Rationale:** Everything depends on Dzin source being available and compiling cleanly. Theme bridge must exist before any visual work.
**Delivers:** Dzin vendored and importable; theme bridge CSS; `npm run typecheck` and `npm run build` pass; fast-json-patch installed.
**Addresses:** Panel registry setup, consistent theming foundation, TypeScript compilation
**Avoids:** CSS token collision (Pitfall 1), TypeScript path alias mismatch (Pitfall 4), fast-json-patch dependency issue (Pitfall 7)

### Phase 2: First Panel End-to-End
**Rationale:** Prove the full vertical slice before building all 10 panels. One panel (e.g., CorePanel) at all 3 densities, rendered inside DzinLayout on `/prototype` route.
**Delivers:** Working prototype route with one panel demonstrating micro/compact/full density switching across at least 2 layout templates.
**Addresses:** Tri-density rendering, automatic density assignment, layout template switching, graceful content degradation (for 1 panel)
**Avoids:** Density rendering complexity (Pitfall 5) by establishing the MicroView/CompactView/FullView pattern before scaling

### Phase 3: All Panels + Layout Engine
**Rationale:** With the pattern established, build remaining 9 panels and wire up the full layout engine with Hungarian algorithm assignment.
**Delivers:** 10 panels rendering at all 3 densities; layout template switching across 4+ templates; viewport-responsive template selection.
**Addresses:** Full panel registry, all table-stakes features
**Avoids:** Layout template remount (Pitfall 6) by using panelType keys and React.memo from the start; ResizeObserver cascade (Pitfall 3) by enforcing container scoping

### Phase 4: Polish + Evaluation
**Rationale:** With functional panels, add the differentiators that make the prototype impressive and build the comparison artifact for go/no-go decision.
**Delivers:** Animated transitions, layout picker UI, side-by-side comparison mode, composition presets, density override controls.
**Addresses:** All P2 differentiator features
**Avoids:** Dual animation jank (Pitfall 2) by establishing clear CSS-vs-framer-motion boundaries

### Phase Ordering Rationale

- **Phase 1 before 2:** Cannot render panels without Dzin source and theme bridge. Compilation must pass first.
- **Phase 2 before 3:** The first panel is a pattern-setting exercise. Getting micro/compact/full right for one panel prevents 9x rework later. The "build micro first" approach from Pitfall 5 must be validated here.
- **Phase 3 before 4:** Polish and animations are meaningless without working panels. The comparison mode requires all 10 panels to be meaningful.
- **Dependency chain:** Panel Registry -> Tri-density rendering -> Layout template switching -> Automatic density assignment. This matches the feature dependency graph from FEATURES.md.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** The density rendering pattern (separate view components vs conditional rendering) needs validation with one real panel before committing to it for all 10. The interaction between Dzin's `useDensity()` and PoF's existing shared visualization components (RadarChart, TimelineStrip, PipelineFlow) needs hands-on testing.
- **Phase 4:** Animated layout transitions (framer-motion FLIP on CSS Grid reflow) are conceptually sound but the exact integration with DzinLayout's slot rendering needs prototyping. CSS Grid `grid-template-*` transition support varies.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Straight copy + install + bridge CSS. Well-documented in STACK.md and ARCHITECTURE.md.
- **Phase 3:** Once Phase 2 establishes the pattern, remaining panels are repetitive application of the same approach.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Dzin source directly inspected; only 1 new dep; exact React 19 match confirmed |
| Features | HIGH | Feature landscape derived from direct Dzin API inspection + competitor analysis |
| Architecture | HIGH | Both codebases analyzed; clear separation of concerns; build order validated against dependency chain |
| Pitfalls | HIGH | Pitfalls identified from source-level analysis of CSS specificity, ResizeObserver patterns, and React reconciliation behavior |

**Overall confidence:** HIGH

### Gaps to Address

- **Tailwind 4 `@custom-variant` for density attributes:** The descendant selector syntax (`*`) in `@custom-variant density-micro (&[data-dzin-density="micro"] *)` needs hands-on validation. Confidence MEDIUM -- may need alternative approach if cascading does not work as expected.
- **Dzin hard-coded colors:** The theme bridge approach assumes Dzin components only reference `--dzin-*` tokens. If any Dzin component has inline hex values, those will not be bridged. Needs visual audit during Phase 1.
- **AbilitySpellbook data extraction:** The 10 sections share interleaved state and computed values. Extracting clean data props for standalone panel components may require refactoring data hooks. Complexity unclear until Phase 2.
- **React.memo adoption:** PoF currently has zero `React.memo` usage. Introducing it for Dzin panels may surface issues with unstable object references from Zustand selectors or prop drilling patterns.

## Sources

### Primary (HIGH confidence)
- Dzin source code: `C:\Users\kazda\kiro\studio-story\packages\dzin\core\src\` -- full module inspection
- PoF source code: `C:\Users\kazda\kiro\pof\src\` -- globals.css, chart-colors.ts, AbilitySpellbook.tsx, _shared.tsx
- Dzin `package.json` -- dependency and peer-dep verification
- PoF `package.json` -- existing dependency verification

### Secondary (MEDIUM confidence)
- [Tailwind CSS 4 Custom Variants](https://tailwindcss.com/docs/adding-custom-styles) -- `@custom-variant` for data attribute selectors
- [Motion Layout Animations](https://motion.dev/docs/react-layout-animations) -- framer-motion FLIP for grid reflow
- [Cloudscape Content Density](https://cloudscape.design/foundation/visual-foundation/content-density/) -- competitor density patterns
- [SAP Fiori Content Density](https://www.sap.com/design-system/fiori-design-web/v1-96/foundations/visual/cozy-compact) -- competitor density patterns

### Tertiary (LOW confidence)
- CSS Grid `grid-template-*` transition behavior -- limited cross-browser documentation; needs prototype validation

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
