# Phase 3: All Panels - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the remaining 9 AbilitySpellbook section panels (Attributes, Tags, Abilities, Effects, Tag Deps, Effect Timeline, Damage Calc, Tag Audit, Loadout) with tri-density rendering following the CorePanel pattern. Register all in pofRegistry. Ensure panel chrome matches PoF's dark theme (INTG-04). Prototype page is NOT updated — stays single-panel until Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Density Content Per Section
- REQUIREMENTS.md definitions (DENS-03 through DENS-11) are sufficient as-is — no refinements needed
- Full density views reuse existing AbilitySpellbook visualizations (SVG, canvas, charts) — extract and wrap, don't simplify
- Each panel receives featureMap for status info PLUS section-specific static data (tag trees, effect types, pipeline steps, etc.)
- Micro views allow variation — most use icon + metric, but richer micro views permitted where the section naturally has a visual summary (e.g., tiny bar for timeline, colored dot matrix for audit)

### Panel Chrome and Theming
- Minimal panel header: label text only, no icon, no accent bar — let content speak
- Subtle chrome always visible at all densities: thin border at micro/compact/full, header only at compact+full
- Panel chrome must match PoF's dark theme (INTG-04) via the existing pof-bridge.css token mapping

### Batching Strategy
- 3 plans of 3 panels each, grouped by complexity:
  - Plan 1: Attributes + Tags + Abilities (data-driven sections with feature matrix mapping)
  - Plan 2: Effects + Tag Deps + Effect Timeline (visualization-heavy sections)
  - Plan 3: Damage Calc + Tag Audit + Loadout (mixed content sections)
- All 3 plans run in parallel (wave 1) — CorePanel pattern is proven, no need for sequential validation
- Each plan creates 3 panel component files, registers them in pofRegistry, and adds tests

### Prototype Page
- No changes to /prototype page in Phase 3 — stays showing single CorePanel
- Phase 4 (Layout Engine) will add multi-panel layouts and panel selection
- New panels tested individually via their test files

### Claude's Discretion
- Exact grouping of panels into the 3 batches (suggested grouping above, but Claude can adjust if dependencies warrant)
- Per-panel prop interface design (each panel defines its own typed props, following CorePanelProps pattern)
- How to extract complex visualizations from AbilitySpellbook (may need refactoring tightly-coupled components)
- Whether each batch gets one combined test file or one test file per panel

</decisions>

<specifics>
## Specific Ideas

- Follow CorePanel pattern exactly: useDensity() → switch on density → 3 distinct views
- Panel files in `src/components/modules/core-engine/dzin-panels/` (same directory as CorePanel)
- All 9 panels registered in the existing `src/lib/dzin/panel-definitions.ts` with full PanelDefinition metadata (gold standard, matching CorePanel)
- Domain string: "arpg-combat" for all panels

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/modules/core-engine/dzin-panels/CorePanel.tsx`: Reference implementation — useDensity(), density switch, 3 views
- `src/lib/dzin/panel-definitions.ts`: pofRegistry with CorePanel registered — add 9 more panels here
- `src/components/modules/core-engine/unique-tabs/AbilitySpellbook.tsx`: All 10 section rendering functions — extract full-density content from here
- `src/components/modules/core-engine/unique-tabs/_shared.tsx`: SharedFeatureCard, PipelineFlow, SectionLabel, RadarChart, TimelineStrip — reusable in full views
- `src/__tests__/dzin/core-panel-density.test.tsx`: Test pattern reference — density rendering tests
- `src/__tests__/dzin/panel-registration.test.ts`: Registration test pattern reference

### Established Patterns
- Each panel: `useDensity()` hook → switch statement → micro/compact/full components
- Props from parent (no internal hooks) — per-panel typed props interface
- Instant density swap (no animation — Phase 4)
- PanelDefinition with all fields filled (gold standard)
- `@/` imports, `'use client'` directive, SurfaceCard for containers

### Integration Points
- `src/lib/dzin/panel-definitions.ts`: Add 9 new panel registrations
- `src/components/modules/core-engine/dzin-panels/`: Add 9 new panel component files
- `src/__tests__/dzin/`: Add density + registration tests for new panels

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-all-panels*
*Context gathered: 2026-03-14*
