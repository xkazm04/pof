# ECW Overview Surface — Design

**Date:** 2026-05-25 · **Branch:** `feature/entity-centric-workspace` · **Status:** Approved (design).

Sub-project B of the ECW Shell UX upgrade (A = visual theme, done; C = rich per-catalog Logic, next).

## Goal

Opening a catalog entity lands on an **Overview** that wraps its metadata, assets, and cross-links — switchable from the same pipeline tab strip as the production tracks (confirmed: Overview is the default tab; the always-visible Lifecycle + Cross-links panels move into it).

## Architecture

- **`TrackTabStrip`** gains an **Overview pseudo-tab** as the first tab, selected by default. Selected-state type widens from `PipelineTrackId | null` to `'overview' | PipelineTrackId`. The Overview tab uses a neutral icon (`LayoutGrid`) + neutral styling (it is not a status-colored production track); the track tabs are unchanged. When `active === 'overview'` it renders `<OverviewWorkspace entity={entity} />`; otherwise the resolved track workspace (current behavior).
- **`OverviewWorkspace`** (new, `src/components/ecw/inspector/OverviewWorkspace.tsx`) composes, top to bottom:
  - **Tags** — chips from `entity.tags` (skip if none).
  - **Summary grid** — headline `data` fields via a pure helper `summarizeEntityData(data)` that picks top-level primitive fields (string/number/boolean), skipping noise keys (`id`, `color`, `icon`, `tag`) and non-primitives (arrays/objects). Generic across catalogs — e.g. spellbook shows `category · element · tier · damage · manaCost · cooldown`.
  - **Assets / lifecycle** — `EntityLifecyclePanel` (reused: UE assets + lifecycle + last test result).
  - **Cross-links** — `EntityCrossLinksPanel` (reused).
  - **Raw spec** — `EntitySpecPanel` (reused, collapsed) as the full-data fallback.
- **`EntityInspector`** simplifies to `EntityHeader` + `TrackTabStrip`. The standalone `EntityLifecyclePanel` + `EntityCrossLinksPanel` (currently always-visible under the header) are removed from the inspector body — they now live in the Overview tab. `EntityHeader` already shows name + breadcrumb + lifecycle badge + (Re)generate, so Overview does not repeat those.

## Data flow

Pure composition. No new stores/APIs. `summarizeEntityData` is a pure function (testable). Selection state stays local to `TrackTabStrip`; the entity-change reset already exists.

## New pure helper

`src/lib/ecw/entity-summary.ts`:
```ts
export interface SummaryField { label: string; value: string; }
export function summarizeEntityData(data: unknown, max?: number): SummaryField[];
```
Picks top-level string/number/boolean fields (in declaration order), excludes `id`/`color`/`icon`/`tag`, formats booleans as yes/no, caps at `max` (default 8). Returns `[]` for non-objects.

## Testing

- `summarizeEntityData` unit tests: picks primitives, skips noise + non-primitives, respects cap, `[]` for non-object.
- `OverviewWorkspace` test: renders tags + summary fields + the cross-links/lifecycle panels for a sample entity.
- `TrackTabStrip` test additions: Overview tab present + selected by default + renders OverviewWorkspace; clicking a track tab switches away; clicking Overview returns.
- `EntityInspector` test update: Overview content (e.g. cross-links) shows by default; the standalone panels are no longer rendered outside the tab.

## Out of scope

Generated-asset gallery persistence (2D concepts are not yet stored); per-catalog bespoke Overview layouts; rich Logic editors (C).

## Invariants

Branch-local commits; `@/` imports; no hardcoded hex (chart-colors/CSS vars); co-author tag; each task ends ECW vitest green + eslint clean on touched files.
