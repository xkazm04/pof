# Phase 4: Layout Engine & Polish - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can switch between layout templates and composition presets on the `/prototype` page with animated transitions. Panels interact with each other via cross-panel entity selection (abilities and tags). Density transitions are animated. This is the final phase — polishing the Dzin integration into a complete, interactive workspace experience.

</domain>

<decisions>
## Implementation Decisions

### Layout Template Picker
- 4 templates exposed: split-2, grid-4, primary-sidebar, studio
- Picker lives in the existing control bar alongside mode toggle and density/resize controls
- Minimap thumbnails: ~24x24px SVG icons showing grid structure as colored rectangles
- Active template highlighted with accent border + slight glow; hover shows border highlight
- Panels auto-fill slots by role matching via Dzin's resolver (no manual slot assignment)

### Composition Presets
- 3 presets defined:
  - "Ability Overview" (split-2): Core + Abilities
  - "Combat Debug" (grid-4): Core + Effects + DamageCalc + EffectTimeline
  - "Full Spellbook" (studio): Tags + Core + Attributes + Abilities (filling 4 of 5 studio slots)
- Preset switcher: dropdown button in the control bar ("Preset: Ability Overview ▾")
- Selecting a preset changes BOTH the layout template AND which panels are shown (one-click workspace change)
- Layout picker updates to reflect the preset's template as active
- Presets do NOT lock density — auto-density via assignSlotDensity() based on slot pixel dimensions

### Transition Animations
- Layout template switches: framer-motion `layout` prop on panel slot wrappers, coordinated via LayoutGroup
- Density level changes: crossfade content using AnimatePresence mode="wait" (~200ms total: 100ms fade out + 100ms fade in)
- Preset changes (layout + panels simultaneously): unified transition — panels that persist animate to new positions, entering panels fade in, exiting panels fade out, all in one ~300ms LayoutGroup animation
- Dzin-specific timing constants (separate from PoF's UI_TIMEOUTS):
  - Layout transitions: 300ms
  - Density crossfade: 200ms
  - Cross-panel highlight: 150ms

### Cross-Panel Interaction
- Entity types that trigger cross-panel highlighting: abilities AND tags
- Communication via React context (DzinSelectionContext) wrapping the layout
- Selection state: `{ type: 'ability' | 'tag', id: string } | null`
- Clicking an entity sets selection; clicking same entity again clears it
- Visual highlighting: non-related items dimmed to 0.4 opacity, related items stay full brightness with subtle accent border
- Relation lookup via static relation map data — centralized map keyed by `type:id`, values are arrays of related `type:id` strings
- Panels check if their items appear in the related set for the current selection

### Claude's Discretion
- Exact SVG icon design for template thumbnails
- Control bar layout details (spacing, grouping, responsive behavior)
- How to structure the relation map data (inline object vs separate file)
- LayoutGroup configuration and animation easing curves
- Per-panel prop interface updates for selection callbacks and highlight state
- Whether the 5th studio slot in "Full Spellbook" gets a panel or stays empty

</decisions>

<specifics>
## Specific Ideas

- Control bar layout: [Override|Resize] [m|c|f] | [thumbnail icons] | Preset: [dropdown]
- Template thumbnails should be tiny SVG grid representations showing slot proportions
- Preset dropdown shows checkmark next to active preset
- Cross-panel dimming should feel like "focus mode" — non-related items recede but don't disappear
- Animation timing: spatial animations (layout moves) feel better at 300ms; state changes (density swap) at 200ms; feedback (highlight) at 150ms

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/dzin/core/layout/templates.ts`: All 8 layout templates with CSS Grid definitions and slot specs — use directly
- `src/lib/dzin/core/layout/LayoutProvider.tsx`: DzinLayout component with useLayout, renderPanel callback, DensityProvider wrapping
- `src/lib/dzin/core/layout/types.ts`: LayoutTemplateId, PanelDirective, SlotAssignment, ResolvedLayout types
- `src/lib/dzin/core/layout/resolver.ts`: Layout resolver that assigns panels to slots by role matching
- `src/app/prototype/page.tsx`: Current single-panel prototype page — extend with template picker, preset dropdown, and multi-panel support
- `src/lib/dzin/panel-definitions.ts`: pofRegistry with all 10 panels registered — query for panel lists
- framer-motion already used in 15+ component files (panels, unique-tabs) — no new dependency needed

### Established Patterns
- `useDensity()` hook + density switch in every panel — animation wraps the density switch output
- `PanelDirective[]` drives DzinLayout — presets define directive arrays
- `containerRef` passed to DzinLayout options for ResizeObserver-based density
- ModeButton/ControlButton components in prototype page — extend for layout/preset controls
- `@/` imports, `'use client'` directive, SurfaceCard for containers

### Integration Points
- `src/app/prototype/page.tsx`: Major update — multi-panel, template picker, preset dropdown, selection context
- `src/lib/dzin/panel-definitions.ts`: Add composition preset definitions
- New file for DzinSelectionContext (selection provider + hook)
- New file for Dzin animation constants
- Panel files need selection prop additions for cross-panel highlighting

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-layout-engine-polish*
*Context gathered: 2026-03-15*
