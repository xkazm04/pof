# Phase 2: First Panel Vertical Slice - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

One AbilitySpellbook section (Core) renders at all 3 density levels (micro, compact, full) inside a Dzin layout on the `/prototype` route, proving the full integration pattern. Panel is registered with full PanelDefinition metadata, consumes live data from PoF's existing hooks via props, and density is controllable via both direct override and slot resizing.

</domain>

<decisions>
## Implementation Decisions

### Micro Density Content
- Icon (Cpu) + pipeline progress indicator (e.g., "3/6" with mini progress bar)
- Shows GAS pipeline completion at a glance
- Smallest possible footprint — one icon, one metric

### Compact Density Content
- Key stats list: ASC feature status with colored dot, 4 connection items (AttributeSet, Tag Container, Abilities, Active Effects) with status indicators, pipeline step count at bottom
- Vertical list format — quick reference without visualizations
- Header shows "Core — AbilitySystem"

### Full Density Content
- Existing CoreSection content (description card, feature card, connections grid, GAS pipeline, GAS architecture explorer)
- Refactored to accept data via props instead of calling hooks internally — visual output identical, cleaner component boundary
- No visual changes from current AbilitySpellbook Core section

### Density Transitions
- Instant swap when density changes — no animation between density levels
- DENS-13 (animated density transitions) is Phase 4 scope — keep it simple now
- Dzin's CSS transitions handle the container, content just mounts/unmounts per density

### Panel Registration
- Fully descriptive PanelDefinition — fill ALL fields (type, label, icon, defaultRole, sizeClass, complexity, domains, description, capabilities, useCases, suggestedCompanions, inputs, outputs, densityModes, dataSliceExamples)
- Sets the gold standard template for Phase 3 when all 10 panels get registered
- Central registry file (e.g., `src/lib/dzin/panel-definitions.ts`) — all PoF panel definitions in one place, panel components imported from their own files
- Domain string: `"arpg-combat"` — matches PoF's module ID convention
- IO schema: Claude's discretion — pick what makes the registration most useful for future LLM intent routing

### Prototype Page
- DzinLayout grid with single Core panel in a slot
- Minimal header: title ("Dzin Prototype") + density controls, nothing else
- Single control bar at top with mode toggle: [Override | Resize]
  - Override mode: density buttons (micro / compact / full) that force-set density directly
  - Resize mode: preset size buttons (Small / Medium / Large) that snap container to predefined pixel widths, triggering Dzin's natural auto-density assignment
- No debug info overlay — density is evident from content rendered
- Direct URL only (`/prototype`) — no navigation link, keeps existing app untouched

### Data Wiring
- Props from parent — prototype page fetches data via useFeatureMatrix, passes featureMap and defs as props to panel
- Real hooks from start — calls useFeatureMatrix('arpg-combat') with live data, proves INTG-02 immediately
- Core-specific prop interface (CorePanelProps) — each panel defines its own typed props, no generic base
- Panel-internal constants (ASC connections, GAS pipeline steps): Claude decides whether to derive from feature matrix or keep as static reference data

### Claude's Discretion
- IO schema design for PanelDefinition inputs/outputs — pick what's most useful for LLM wiring
- Whether ASC connections and GAS pipeline data is derived from feature matrix or kept as panel-internal constants
- Exact preset size pixel values for resize mode buttons
- Control bar styling and layout details

</decisions>

<specifics>
## Specific Ideas

- Micro view mockup: Cpu icon centered with "3/6 ██░" progress indicator below
- Compact view: vertical list with status dots, similar to a sidebar panel in an IDE
- The density override + resize modes let you test both the "force density" path and the "real auto-density" path in one page
- Mode toggle in control bar switches between Override (direct density selection) and Resize (slot size presets that trigger auto-density)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/modules/core-engine/unique-tabs/AbilitySpellbook.tsx`: CoreSection function (lines 519-569) — full density content source, needs refactoring to accept props
- `src/components/modules/core-engine/unique-tabs/_shared.tsx`: TabHeader, PipelineFlow, SectionLabel, SharedFeatureCard, RadarChart, TimelineStrip — reusable in full density view
- `src/lib/dzin/core/density/DensityContext.tsx`: DensityProvider + useDensity() hook — panels read density from context
- `src/lib/dzin/core/layout/LayoutProvider.tsx`: DzinLayout component — wraps useLayout, renders CSS Grid, auto-wraps slots in DensityProvider
- `src/lib/dzin/core/registry/registry.ts`: createRegistry() — PanelRegistry with register/get/getByDomain/getAll/has
- `src/lib/dzin/core/registry/types.ts`: PanelDefinition interface — type, label, icon, defaultRole, sizeClass, complexity, domains, description, capabilities, useCases, suggestedCompanions, inputs, outputs, densityModes, component
- `src/hooks/useFeatureMatrix.ts`: Hook for feature matrix data — provides featureMap and defs for the Core panel

### Established Patterns
- `@/` imports: all new files use `@/lib/dzin/core` for Dzin imports
- `'use client'` directive: required on all client components (Dzin components already have this)
- `SurfaceCard` from `@/components/ui/SurfaceCard`: used for card containers in AbilitySpellbook
- `MODULE_COLORS` from `@/lib/chart-colors`: color system for module accents
- `framer-motion` for content animations — but density transitions are instant (Phase 4 scope)

### Integration Points
- `src/app/prototype/page.tsx`: new Next.js App Router page (direct URL only)
- `src/lib/dzin/panel-definitions.ts`: new central registry file for PoF panel definitions
- Panel component: new file in `src/components/modules/core-engine/dzin-panels/CorePanel.tsx` (or similar)
- DzinLayout wraps panels with DensityProvider automatically — panel reads density via useDensity()

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-first-panel-vertical-slice*
*Context gathered: 2026-03-14*
