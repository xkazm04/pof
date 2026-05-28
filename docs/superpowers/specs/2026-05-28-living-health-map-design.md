# Living Health Map (first sprint)

**Date:** 2026-05-28
**Backlog item:** `idea-4bdfd50e-living-health-map-a-breathing`
**Status:** Design approved — ready for implementation plan

## Problem

Crash data lives in a flat text list (the Crash Analyzer's Crashes/Patterns tabs), which
hides the single most valuable signal: which modules are structurally fragile and getting
worse. The analyzer already computes `crashesByModule`, per-crash severity, and recurring
`patterns` — but nothing turns that into an at-a-glance map.

## Goal (first sprint step)

A "Health Map" tab in the Crash Analyzer rendering every crash-affected module as a node,
sized by crash count and colored by its worst severity, positioned as a hot-core risk map
(highest-risk module at the centre, others spiralling out), with a hover card listing that
module's top crash patterns. Reuses data the analyzer already produces.

Non-goals (the larger vision, deferred): a timeline scrubber / time-travel replay; fusing
`error_memory` + anti-pattern catalogs; real-time live updates; a force simulation.

## Decision (from brainstorming)

**Deterministic risk-map layout** (not an iterative force sim): a pure, unit-testable
phyllotaxis (golden-angle) spiral. Highest risk at centre. Matches the existing pure-layout
precedent (`src/lib/constellation/layout.ts`) and keeps the layout reproducible/testable.
No semantic edges (crash-by-module data has none).

## Architecture

### 1. Pure lib — `src/lib/crash-health/health-map.ts` (new, DOM-free)

Narrow inputs so the real store types satisfy them and tests need only minimal fixtures:

```ts
type HealthReport = Pick<CrashReport, 'id' | 'mappedModule' | 'severity'>;
type HealthPattern = Pick<CrashPattern, 'crashIds' | 'occurrences' | 'name' | 'isSystemic'>;

export interface ModulePattern { name: string; occurrences: number; isSystemic: boolean; }
export interface ModuleHealthNode {
  moduleId: string;
  crashCount: number;
  riskScore: number;
  maxSeverity: CrashSeverity | 'none';
  patternCount: number;
  systemicCount: number;
  topPatterns: ModulePattern[];   // by occurrences desc, top 3
}
export interface PositionedHealthNode { node: ModuleHealthNode; x: number; y: number; r: number; }

export function buildModuleHealth(input: { reports: HealthReport[]; patterns: HealthPattern[] }): ModuleHealthNode[];
export function layoutHealthMap(nodes: ModuleHealthNode[], opts: { width: number; height: number }): PositionedHealthNode[];
```

- **`buildModuleHealth`**: group reports by `mappedModule ?? 'unmapped'`. Per module:
  - `crashCount` = reports in the module.
  - severity weights: critical 4, high 3, medium 2, low 1.
  - `maxSeverity` = highest present, else `'none'`.
  - pattern→module mapping: build `Map<crashId, moduleId>` from reports; a pattern belongs
    to every module its `crashIds` land in. `topPatterns` = that module's patterns sorted
    by `occurrences` desc, top 3; `patternCount`/`systemicCount` from them.
  - `riskScore` = Σ severityWeight(reports) + 2 × `systemicCount`.
  - Result sorted by `riskScore` desc.
- **`layoutHealthMap`**: defensively re-sort by `riskScore` desc. Golden-angle spiral:
  `angle = i × 2.39996`, `radius = spread × √i`, centred at `(width/2, height/2)`, so the
  top-risk node sits at the centre. `spread` scales the last node inside the frame
  (margin + max node radius). Node display radius `r = minR + k × √crashCount`, clamped.
  Pure/deterministic, no colors.

### 2. View — `src/components/modules/evaluator/CrashHealthMap.tsx` (new)

Props `{ reports: CrashReport[]; patterns: CrashPattern[] }`. `useMemo`s `buildModuleHealth`
then `layoutHealthMap` over a fixed viewBox (e.g. 640×420, responsive `width="100%"`).
Renders `<circle data-testid="health-node">` per node, filled via `SEVERITY_TOKENS[maxSeverity]`
(`'none'` → a muted token), with the module short-label beneath. Systemic-or-critical nodes
get a gentle framer-motion scale "pulse" (breathing). Hovering/selecting a node shows a card:
module id, crash count, max severity, and `topPatterns` (name · occurrences · systemic badge).
All colors via chart-colors tokens (no hardcoded hex).

### 3. Wire into `CrashAnalyzerView.tsx`

- `type ViewTab = 'crashes' | 'patterns' | 'import' | 'health';`
- Add `<SubTab label="Health Map" active={viewTab === 'health'} onClick={() => setViewTab('health')} />`
  after the Patterns sub-tab (line ~188).
- Add a render block after the Import block:
  `{hasData && viewTab === 'health' && <CrashHealthMap reports={reports} patterns={patterns} />}`.
- Import `CrashHealthMap`.

## File-by-file impact

| File | Change |
|------|--------|
| `src/lib/crash-health/health-map.ts` | **new** — `buildModuleHealth` + `layoutHealthMap` (pure) |
| `src/components/modules/evaluator/CrashHealthMap.tsx` | **new** — SVG risk map + hover card |
| `src/components/modules/evaluator/CrashAnalyzerView.tsx` | **modify** — Health Map tab |
| `src/__tests__/lib/health-map.test.ts` | **new** — pure aggregation + layout |
| `src/__tests__/components/CrashHealthMap.test.tsx` | **new** — renders N nodes + a label |

## Test plan (TDD)

1. **`health-map.test.ts`** (pure, minimal `Pick` fixtures):
   - `buildModuleHealth`: crashCount per module; `maxSeverity` = worst present; a module with
     a critical crash outranks one with only low crashes (riskScore order); `topPatterns`
     sorted by occurrences desc and capped at 3; a pattern spanning a module is attributed.
   - `layoutHealthMap`: deterministic (two calls deep-equal); length preserved; index-0
     (highest risk) node is at/near the centre (min distance); a node with a larger
     `crashCount` gets a larger `r`.
2. **`CrashHealthMap.test.tsx`** (component, `afterEach(cleanup)` — setup has no auto-cleanup):
   render with a fixture of reports across 2–3 modules → exactly that many
   `health-node` elements, and a module label is present.

Run `npm run validate` before completion — expect pre-existing foreign failures in the shared
tree; my files must be type/lint/test-clean.

## Risks

- **Shared tree:** `CrashAnalyzerView.tsx`, `crashAnalyzerStore.ts`, `analysis-engine.ts`,
  `types/crash-analyzer.ts` are all currently clean (verified). The foreign-modified
  `PatternLibraryView`/`pattern-library-db` are NOT touched (this sprint is crash-centric).
- **No `Date.now`/`Math.random` in render** — layout is pure math; the only time-derived data
  (`recentCrashes`) already lives in the engine, not this view.
