# Dzin Integration Prototype

## What This Is

A feasibility prototype integrating the Dzin layout/panel framework into PoF's core-engine module system. A new `/prototype` route will showcase the arpg-combat AbilitySpellbook component rebuilt as Dzin density-aware panels — rendering at micro, compact, and full densities within composable grid layouts. The goal is to validate whether Dzin can elevate PoF's complex game-dev UIs to adaptive, polished, next-generation experiences.

## Core Value

Panels adapt gracefully across density levels (micro/compact/full) while maintaining composable layouts and smooth transitions — proving Dzin is viable for all of PoF's visual modules.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Dzin source copied into `src/lib/dzin/` for local iteration
- [ ] AbilitySpellbook sections reimagined as individual Dzin panels with density-aware rendering (micro/compact/full)
- [ ] Panel registry with definitions for each combat panel (inputs, outputs, density modes, size classes)
- [ ] Multiple layout templates work (split-2, grid-4, primary-sidebar, studio) — user can switch between them
- [ ] Density transitions are smooth (animated, no layout jank)
- [ ] Layout transitions between templates are polished
- [ ] New `/prototype` route hosts the demo page
- [ ] Dzin theming integrates with PoF's existing dark theme and chart-colors system
- [ ] Side-by-side or toggle comparison possible between Dzin and current AbilitySpellbook

### Out of Scope

- Replacing any existing PoF module views — this is additive prototype only
- LLM/Claude intent routing integration — future milestone if prototype succeeds
- Chat system or AI-driven panel composition — not needed for density/layout validation
- Undo/redo state engine — nice-to-have but not required for prototype
- Other submodules beyond arpg-combat — one module proves the concept

## Context

- **Dzin source**: `C:\Users\kazda\kiro\studio-story\packages\dzin` — headless React 19 panel framework with density-aware rendering, intent system, and LLM serialization
- **Dzin dependencies**: `fast-json-patch` (RFC 6902), React 19 peer dep — minimal footprint
- **AbilitySpellbook**: ~700-line component with 10 sections (Core, Attributes, Tags, Abilities, Effects, Tag Deps, Effect Timeline, Damage Calc, Tag Audit, Loadout), sub-tab navigation, radar charts, timeline strips, pipeline flows
- **PoF styling**: Tailwind CSS 4, `chart-colors` system for consistent theming, `SurfaceCard` primitives, framer-motion for animations
- **Dzin styling**: Headless via `data-dzin-*` attributes + CSS custom properties — needs bridging to PoF's Tailwind/chart-colors system

## Constraints

- **Tech stack**: Must use existing PoF stack (Next.js 16, React 19, Tailwind CSS 4) — Dzin's headless approach fits naturally
- **No new heavy deps**: Dzin only needs `fast-json-patch` — acceptable
- **Prototype isolation**: New `/prototype` route only — no changes to existing module views
- **Styling bridge**: Dzin CSS tokens must map to PoF's existing color/spacing system, not introduce a parallel theme

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Copy Dzin source into repo | Enables fast iteration without cross-repo linking complexities | — Pending |
| AbilitySpellbook as test subject | 10 sections with diverse visualization types (grids, charts, flows, timelines) stress-test density adaptation | — Pending |
| Single page demo route | Isolates prototype from production code, easy to evaluate and discard if needed | — Pending |
| Start with density + layout, skip intent/LLM | Validates core visual value proposition before committing to full architecture adoption | — Pending |

---
*Last updated: 2026-03-14 after initialization*
