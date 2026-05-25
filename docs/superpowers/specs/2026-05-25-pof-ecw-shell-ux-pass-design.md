# ECW Shell UX Pass — Design

**Date:** 2026-05-25
**Branch:** `feature/entity-centric-workspace`
**Status:** Approved (design); spec for review before plan.

## Goal

Improve the ECW shell's day-to-day usability and push toward the long-term vision: a fully
automated per-entity asset pipeline (design → 2D → 3D → animation → live test). Three parts,
built in order:

1. **Both shells + working switcher** — keep ECW as the default but make the legacy shell reachable again (the cutover deleted it); fix the broken `ShellSwitcher`.
2. **Catalog sidebar** — N-level collapsible, virtualized tree (1000+ entities), driven by the C++-handshaked `categoryPath` metadata.
3. **Production Pipeline → track-tab inspector** — the inspector body becomes a status-colored track-tab switcher (Logic · 2D · 3D · Animation · Audio · VFX · Test); each tab hosts that stage's *tooling*. The existing per-catalog facets are absorbed into the matching track.

## Approved decisions (from brainstorming)

- **Both shells:** ECW remains the landing shell at `/`; legacy reachable on demand via the switcher. (Not a full cutover revert.)
- **Pipeline model:** tracks become the inspector's *primary* tabs; the facet components I built (Detail/Analysis/Author/Baseline/Tuner) are rehomed into the matching track workspace, and `EntityFacetsTabStrip` retires.
- **Tooling scope:** design + build the full track-tab architecture; wire every track from tooling that exists today; tracks without a ready external pipeline (3D mesh-gen, VFX) show real coverage status + CLI author/evaluate + an honest "generation pipeline pending" affordance — **no fake UI**. Ship in sequenced batches.
- **Sidebar:** include a name **filter box** (confirmed) — essential at 1000+.

---

## Part 1 — Both shells + working switcher

### Files
- **Restore:** `src/components/layout/**` (13 files) + `src/components/cli/InlineTerminal.tsx` via `git checkout c44665e~1 -- <paths>` (they live in `b1ef5f4`).
- **Modify:** `src/app/page.tsx`, `src/components/ecw/ShellSwitcher.tsx`, `src/__tests__/app/page.test.tsx`.

### Gate logic (inverted; ECW default)
`page.tsx` renders `<NewAppShell/>` by default and `<AppShell/>` only when the legacy flag is active.
- Flag source: `?legacy=1` URL param **OR** a persisted `localStorage['pof.shell'] === 'legacy'` preference. URL param wins when present (shareable); otherwise fall back to the stored preference; default ECW.
- Keep `useSyncExternalStore(popstate)` + an SSR snapshot of `false` (ECW).
- A tiny `src/lib/ecw/shell-pref.ts` (pure-ish): `readShellPref(): 'ecw' | 'legacy'` and `writeShellPref(v)`, so the gate and the switcher share one source of truth and it's unit-testable.

### `ShellSwitcher` fixes
- Flip semantics: **New** = default (clear `?legacy`, write pref `ecw`); **Legacy** = set `?legacy=1`, write pref `legacy`. Dispatch `popstate` so the swap is live (no reload).
- Replace `bg-[#00ff88]/20 text-[#00ff88]` (JIT no-render arbitrary-class bug + hex-lint violation) with a `chart-colors` token (e.g. inline `style={{ color: ACCENT_EMERALD }}` / a `var(--setup)` accent), matching the focus-ring token convention.
- Mount in **both** headers: `EcwTopBar` (already) and the restored legacy `TopBar`.

### Testing
- `shell-pref.ts` unit test (read/write, URL-over-storage precedence, default ecw).
- `page.test.tsx`: default → ECW; `?legacy=1` → legacy.
- `ShellSwitcher` test: New/Legacy buttons set the flag + `aria-pressed`; no arbitrary hex class on the active button.

---

## Part 2 — Catalog sidebar: N-level, collapsible, virtualized

### Data
`categoryPath` is already populated per catalog (spellbook `[category, element]`, bestiary `[Bestiary, tier, role]`, loot `[Loot Tables, tier]`, …). The tree is generic over its depth — no per-catalog tree code.

### New pure module `src/lib/catalog/tree.ts`
```ts
export interface TreeRow {
  kind: 'group' | 'entity';
  depth: number;            // 0-based indent level
  key: string;              // stable: joined categoryPath prefix (group) or entity id
  label: string;            // group segment, or entity name
  count?: number;           // group only: descendant entity count
  entity?: CatalogEntityBase; // entity rows only
}
/** Build the nested grouping from entities' categoryPath. */
export function buildEntityTree(entities: CatalogEntityBase[]): TreeNode;
/** Flatten to the visible linear row list, honoring collapsed groups + a name filter. */
export function flattenVisible(tree: TreeNode, collapsed: Set<string>, filter: string): TreeRow[];
```
- `filter` matches entity name case-insensitively; a group stays visible if any descendant entity matches (and auto-expands under an active filter).
- Group `key` = the joined `categoryPath` prefix (e.g. `Offensive/Fire`), stable across renders so collapse state survives re-sorts.
- Entities sort by name within their leaf group; groups sort alphabetically per level.

### `EntityTree.tsx` rewrite
- State: `collapsed: Set<string>` + `filter: string` (component state; collapse keyed by group-path).
- Compute `rows = flattenVisible(buildEntityTree(entities), collapsed, filter)` (memoized).
- Render `rows` through **`react-window`** (v2.2.7 — the plan must verify the v2 export/API, which differs from v1's `FixedSizeList`; fixed row height) so only the visible window mounts → 1000+ stays smooth. A non-virtualized fallback is acceptable if the v2 API proves awkward, but virtualization is the requirement at 1000+.
- Row renderer: `group` rows = chevron (collapsed?) + label + `(count)`, click toggles collapse, indented by `depth`; `entity` rows = the existing name + `LifecycleBadge` button (selects via `ecwStore.selectEntity`), indented by `depth`.
- A filter `<input>` pinned above the virtualized list.
- a11y: `role="tree"`, group rows `role="treeitem" aria-expanded`, entity rows `role="treeitem" aria-current`.

### Testing
- `tree.ts` unit tests: builds 2-level (spellbook) + 3-level (bestiary) trees; `flattenVisible` respects collapse (hides descendants) and filter (prunes + auto-expands); counts correct.
- `EntityTree` test: renders group headers + entities; clicking a header collapses (rows drop); filtering prunes; selecting an entity calls `selectEntity`. (Assert on the row set, not scroll mechanics.)

---

## Part 3 — Production Pipeline → track-tab inspector

### Inspector reorg
`EntityInspector` body becomes: `EntityHeader` → `TrackTabStrip` → active `TrackWorkspace`. The current `PipelineOverview` + `PipelineTrackDetail` + `EntityFacetsTabStrip` + `EntitySpecPanel`/`EntityLifecyclePanel`/`EntityCrossLinksPanel`/`EntityFunctionalTestPanel` are reorganized into the track model (see absorption map).

### `TrackTabStrip`
- Tabs from `pipelineForCatalog(catalogId)` (existing `PIPELINE_BY_CATALOG`).
- Each tab is **status-colored** by the track's persisted `TrackState` (`useEntityTracks` from pipelineStore) — reuses `trackVisuals` (`STATE_CLASSES`, `TRACK_ICON`). The strip *is* the coverage overview (replaces `PipelineOverview`).
- WAI-ARIA `tablist`/`tab`/`tabpanel`; selected track in component state, reset on entity change.

### `trackWorkspaceRegistry` (mirrors `facetRegistry`)
```ts
registerTrackWorkspace(catalogId: string | '*', trackId: PipelineTrackId, Component);
getTrackWorkspace(catalogId, trackId): Component; // exact (catalogId,trackId) → ('*',trackId) → DefaultTrackWorkspace
```
- **`DefaultTrackWorkspace`** = today's `PipelineTrackDetail` (status header + 4 state setters + Evaluate-with-CLI) + an honest *"generation pipeline pending"* note for tracks lacking ready tooling.
- Each `TrackWorkspace` is wrapped in `FacetErrorBoundary` (keyed by trackId) — one bad workspace can't crash the inspector.
- Self-registration via side-effect imports in `EntityInspector` (same pattern as facets).

### Per-track workspace map (facet absorption)
Track IDs are the existing `PipelineTrackId`s: `logic · ai · art-2d · art-3d · animation · audio · vfx · test` (a catalog shows only the tracks in its `PIPELINE_BY_CATALOG` entry).

| Track | Workspace content | Built from |
|---|---|---|
| **logic** | Spec + per-catalog Analysis/Balance/Baseline/Tuner + Author + Evaluate-CLI | `EntitySpecPanel` + existing facet components + `useEntityTrackHelp` |
| **ai** | AI-coverage view + CLI eval (bestiary: BT coverage) | `BestiaryAiFacet` + `useEntityTrackHelp` |
| **art-2d** | Leonardo generate + gallery (download-then-delete) | `/api/leonardo`, new `Leonardo2DWorkspace` |
| **animation** | Montage management | state-graph montage facets |
| **audio** | Audio catalog tooling | audio facets/catalog |
| **test** | Functional test + UE-gate trigger | `EntityFunctionalTestPanel` |
| **art-3d, vfx** | Status + CLI author/evaluate + "gen pending" slot | `DefaultTrackWorkspace` |
| (lifecycle, cross-links) | folded into `EntityHeader` / an overview affordance | existing panels |

The facet *components* are reused inside Logic; the facet *tab strip* (`EntityFacetsTabStrip`) and `registerFacet` are retired once their components are rehomed.

### Data / architecture
No new persistence. Reuses `pipelineStore` + `/api/pipeline` (track states), `catalogStore`, `baselineStore`, `useEntityTrackHelp`, `useModuleCLI`, `/api/leonardo`. New code is presentational (registry + workspaces) + the tree lib + the shell-pref helper.

### Testing
- `trackWorkspaceRegistry` unit test (exact → wildcard → default fallback).
- `TrackTabStrip` test: tabs from `pipelineForCatalog`; status color reflects pipelineStore; switching changes the rendered workspace.
- Each workspace tested with mocked stores/hooks, following the established facet-test patterns (mock `useModuleCLI`, seed `catalogStore`/`baselineStore`, stub `fetch`).

---

## Build order (each batch: TDD, tsc 0 + eslint 0 on touched files, targeted vitest, narrow commit)

1. **Part 1** — restore shells + `shell-pref` + invert gate + fix `ShellSwitcher`.
2. **Part 2** — `tree.ts` + virtualized/collapsible/filterable `EntityTree`.
3. **Part 3a** — `trackWorkspaceRegistry` + `TrackTabStrip` + `DefaultTrackWorkspace`; `EntityInspector` reorg (tabs replace overview+detail; facets temporarily still reachable until rehomed).
4. **Part 3b** — Logic + Test workspaces (rehome Spec + facets + functional test; retire `EntityFacetsTabStrip`).
5. **Part 3c** — 2D Leonardo workspace (generate + gallery).
6. **Part 3d** — Animation + Audio workspaces.
7. **Part 3e** — 3D + VFX (status + CLI now; real gen when external tooling lands).

## Out of scope (this pass)
- Actual 3D mesh / texture generation pipelines (Meshy/Tripo/Scenario) — slots only, wired when tooling matures.
- The legacy-View / `navigationStore` dead-code purge and the master merge (separate, deferred from the cutover).
- First-run guided tour.

## Invariants
- Branch `feature/entity-centric-workspace`; commit locally (operator pushes).
- `module-registry` + `sub_*/_shared/data*` preserved (cutover Constraints A/B still hold).
- Co-author every commit: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
