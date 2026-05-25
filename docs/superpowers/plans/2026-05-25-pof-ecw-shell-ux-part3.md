# ECW Shell UX Pass — Part 3 (track-tab inspector) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Turn the entity inspector into a status-colored Production-Pipeline track-tab switcher; each track tab hosts that stage's tooling. Per-catalog facets are absorbed into the matching track.

**Architecture:** A `trackWorkspaceRegistry` (mirrors `facetRegistry`) maps `(catalogId|'*', trackId) → Component`. `TrackTabStrip` renders one tab per `pipelineForCatalog(catalogId)` track (status-colored via `trackVisuals`) and shows the active track's workspace inside a `FacetErrorBoundary`. Default workspace = the existing `PipelineTrackDetail` (state setters + Evaluate-CLI) + an honest "generation pending" note.

**Tech Stack:** React 19, Zustand v5, existing `pipelineStore`/`/api/pipeline`, `useEntityTrackHelp`, `useModuleCLI`, `/api/leonardo`.

**Spec:** `docs/superpowers/specs/2026-05-25-pof-ecw-shell-ux-pass-design.md`. **Invariants:** branch-local commits; `@/` imports; no hex (chart-colors); `console.error` only; co-author tag; each task tsc 0 + eslint 0 (excluding the 3 pre-existing AssetInspector errors) + targeted vitest.

Track IDs: `logic · ai · art-2d · art-3d · animation · audio · vfx · test` (catalog shows only its `PIPELINE_BY_CATALOG` tracks).

---

## Batch 3a — framework: registry + TrackTabStrip + DefaultTrackWorkspace

### Task 1: `trackWorkspaceRegistry`
**Files:** Create `src/components/ecw/inspector/trackWorkspaceRegistry.ts`; Test `src/__tests__/components/ecw/inspector/trackWorkspaceRegistry.test.tsx`.

- [ ] Write failing test: register a `('bestiary','logic')` + a `('*','test')` component; `getTrackWorkspace('bestiary','logic')` returns the exact; `getTrackWorkspace('loot-tables','test')` returns the wildcard; `getTrackWorkspace('x','art-3d')` returns `DefaultTrackWorkspace`.
- [ ] Run → fail. Implement:
```ts
import type { ComponentType } from 'react';
import type { PipelineTrackId } from '@/lib/pipeline/tracks';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { DefaultTrackWorkspace } from '@/components/ecw/pipeline/workspaces/DefaultTrackWorkspace';

export interface TrackWorkspaceProps { entity: StoredCatalogEntity; trackId: PipelineTrackId; }
export type TrackWorkspace = ComponentType<TrackWorkspaceProps>;

const registry = new Map<string, TrackWorkspace>(); // key: `${catalogId}::${trackId}`
const k = (c: string, t: string) => `${c}::${t}`;

export function registerTrackWorkspace(catalogId: string, trackId: PipelineTrackId, Component: TrackWorkspace) {
  registry.set(k(catalogId, trackId), Component);
}
export function getTrackWorkspace(catalogId: string, trackId: PipelineTrackId): TrackWorkspace {
  return registry.get(k(catalogId, trackId)) ?? registry.get(k('*', trackId)) ?? DefaultTrackWorkspace;
}
```
- [ ] Run → pass. Commit `feat(ecw): trackWorkspaceRegistry (Part 3a)`.

### Task 2: `DefaultTrackWorkspace`
**Files:** Create `src/components/ecw/pipeline/workspaces/DefaultTrackWorkspace.tsx`; Test alongside.

- [ ] Failing test: renders the track label + state setters (reuses `PipelineTrackDetail`); for a track in a "no ready tooling" set (`art-3d`,`vfx`) also shows a "generation pipeline pending" note.
- [ ] Implement: render `<PipelineTrackDetail entity trackId />` + a `PENDING_TOOLING = new Set(['art-3d','vfx'])` note line. (PipelineTrackDetail already has status + 4 setters + Evaluate-CLI.)
- [ ] Run → pass. Commit `feat(ecw): DefaultTrackWorkspace (Part 3a)`.

### Task 3: `TrackTabStrip` + inspector swap
**Files:** Create `src/components/ecw/pipeline/TrackTabStrip.tsx`; Modify `src/components/ecw/inspector/EntityInspector.tsx`; Test `src/__tests__/components/ecw/pipeline/TrackTabStrip.test.tsx`.

- [ ] Failing test: tabs == `pipelineForCatalog('bestiary')`; each tab status-colored from `useEntityTracks`; default selected = first track; clicking a tab renders that track's workspace; tab strip has `role="tablist"`.
- [ ] Implement `TrackTabStrip`: `tracks = pipelineForCatalog(entity.catalogId)`; `useState` selected (reset on entity change via prevKey pattern); tab row (`role=tablist`, each `role=tab` colored by `STATE_CLASSES[state].dot/ring`, `TRACK_ICON`, `trackLabel`); body = `const W = getTrackWorkspace(entity.catalogId, active)` wrapped in `<FacetErrorBoundary key={active} facetLabel={trackLabel(active)}><W entity trackId={active} /></FacetErrorBoundary>`.
- [ ] Modify `EntityInspector`: replace `<EntityPipelinePanel/>` with `<TrackTabStrip entity={entity} />`; **keep** Spec/Lifecycle/CrossLinks/FunctionalTest/FacetsTabStrip below for now (3b rehomes them). Add side-effect import of the workspace registration barrel (added in 3b); none yet in 3a.
- [ ] Run TrackTabStrip + EntityInspector tests → pass; tsc/eslint clean. Commit `feat(ecw): TrackTabStrip replaces pipeline overview+detail (Part 3a)`.

---

## Batch 3b — Logic + Test workspaces; retire facet strip

### Task 4: `LogicWorkspace`
**Files:** Create `src/components/ecw/pipeline/workspaces/LogicWorkspace.tsx` (+ a registration barrel `workspaces/register.ts`); Test alongside.

- [ ] Failing test: for a spellbook/bestiary entity renders the Spec data + the catalog's registered facets (reuse `getFacetsForCatalog`) + the `PipelineTrackDetail` state row.
- [ ] Implement: compose `<PipelineTrackDetail entity trackId="logic" />` + `<EntitySpecPanel data={entity.data} />` + map `getFacetsForCatalog(entity.catalogId)` → render each facet's `Component` (the facet components stay; only the tab strip goes). Register `registerTrackWorkspace('*','logic', LogicWorkspace)` in `register.ts`.
- [ ] Run → pass. Commit `feat(ecw): LogicWorkspace — spec + facets under the Logic track (Part 3b)`.

### Task 5: `TestWorkspace` + retire `EntityFacetsTabStrip`
**Files:** Create `src/components/ecw/pipeline/workspaces/TestWorkspace.tsx`; Modify `EntityInspector.tsx`, `register.ts`; Delete `EntityFacetsTabStrip` usage.

- [ ] Failing test: TestWorkspace renders the functional-test panel for the entity.
- [ ] Implement: `TestWorkspace` = `<PipelineTrackDetail entity trackId="test" />` + `<EntityFunctionalTestPanel entity />`. Register `('*','test', TestWorkspace)`.
- [ ] Modify `EntityInspector`: remove standalone `<EntitySpecPanel/>`, `<EntityFunctionalTestPanel/>`, `<EntityFacetsTabStrip/>` (now inside Logic/Test workspaces); keep `<EntityLifecyclePanel/>` + `<EntityCrossLinksPanel/>` directly under the header (cross-entity nav + lifecycle stay always-visible). Import `./pipeline/workspaces/register` for side-effect registration. Update `EntityInspector` test if it asserted the old panels.
- [ ] Run inspector + workspace tests → pass; tsc/eslint clean. Commit `feat(ecw): TestWorkspace + retire facet tab strip; inspector reorg (Part 3b)`.

---

## Batch 3c — 2D Leonardo workspace
**Files:** Create `src/components/ecw/pipeline/workspaces/Leonardo2DWorkspace.tsx`; Test. (Verify `/api/leonardo` request/response shape first.)

- [ ] Inspect `src/app/api/leonardo/route.ts` for the generate action + response (image urls/ids). If a generate endpoint exists, wire a prompt input → generate → gallery of returned images with the download-then-delete discipline (per `feedback_leonardo_cleanup` memory). If the endpoint is upload/delete-only, the workspace shows the entity's existing 2D assets + a CLI-dispatch "generate concept art" action (no fake gen UI).
- [ ] Failing test → implement → pass. Register `('*','art-2d', Leonardo2DWorkspace)`. Commit `feat(ecw): 2D Leonardo workspace (Part 3c)`.

---

## Batch 3d — Animation + Audio workspaces
**Files:** `workspaces/AnimationWorkspace.tsx`, `workspaces/AudioWorkspace.tsx` + tests.
- [ ] AnimationWorkspace: `PipelineTrackDetail trackId="animation"` + the state-graph montage facets (reuse). Register `('*','animation', …)`.
- [ ] AudioWorkspace: `PipelineTrackDetail trackId="audio"` + audio-catalog tooling/facets. Register `('*','audio', …)`.
- [ ] Tests → pass. Commit `feat(ecw): Animation + Audio workspaces (Part 3d)`.

---

## Batch 3e — 3D + VFX (status-only)
- [ ] Confirm `art-3d`/`vfx` fall through to `DefaultTrackWorkspace` (status + Evaluate-CLI + "generation pending" note). No bespoke workspace until external mesh/VFX tooling lands. Add a test asserting the default + pending note render for an `art-3d` track. Commit `test(ecw): assert 3D/VFX default workspace + pending note (Part 3e)`.

---

## Final verification
- [ ] `npx vitest run src/__tests__/components/ecw src/__tests__/app` — all green.
- [ ] `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v AssetInspector || echo CLEAN` — CLEAN.
- [ ] Manual smoke: open a Spellbook entity → track tabs (Logic·…·Test) status-colored; Logic shows spec+facets; Test shows functional test; art-3d shows pending note.
