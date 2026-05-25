# Phase 12 · Cutover Readiness Assessment (2026-05-25)

Non-destructive pre-cutover audit, run after Phase 10 (10-B/L/C/F/MC) landed. Pairs with the
cutover **plan** at `2026-05-24-pof-ecw-phase-12-cutover.md`. **Nothing here deletes anything** —
it sizes the blast radius and corrects the plan before any destructive step runs.

## Verdict: **GO, with two preservation constraints** (operator approval required to execute)

ECW is self-contained and every legacy dashboard ECW set out to replace now has a landed
replacement. Cutover is safe **provided** the two "do-not-delete" constraints below are honoured.
The destructive steps (shell + module deletion, merge to master) still need explicit operator
sign-off — this branch only commits locally; the user pushes/merges.

## 1. ECW self-containment — ✅ confirmed

- No file under `src/components/ecw/**` or `src/stores/ecwStore.ts` imports the legacy shell
  (`layout/AppShell`, `layout/Sidebar*`, `ModuleRenderer`), `navigationStore`, or `cli/InlineTerminal`.
  (The one grep hit in `ecwStore.ts` is a *comment* — "separate from the legacy navigationStore".)
- The `?ecw=1` gate in `src/app/page.tsx` is the only thing keeping both shells alive.

## 2. Legacy-shell deletion blast radius

| Symbol | Non-test consumers | Cutover disposition |
|---|---|---|
| `components/layout/AppShell` | 1 (`app/page.tsx`) | Delete after Step 2 removes the gate. |
| `cli/InlineTerminal` | 1 | Delete (replaced by CLI Rail). |
| `navigationStore` / `useNavigationStore` | 12 — all legacy module Views + sidebars | Deletable **after** those Views are deleted. No ECW consumer. |
| **`lib/module-registry`** | **55** | **DO NOT DELETE — see Constraint A.** |

## 3. Constraint A — `module-registry` is load-bearing, KEEP it

The cutover plan's Step 3.5 ("delete or trim module-registry") is **wrong as written**. `module-registry`
(esp. `SUB_MODULE_MAP`) is consumed by systems ECW *keeps*:
- `lib/nba-engine.ts` → `SUB_MODULE_MAP` (powers Mission Control's Next Best Actions / `computeProjectNBA`).
- `hooks/useModuleCLI.ts` + every facet's CLI dispatch (module IDs: `arpg-combat`, `arpg-loot`, `arpg-world`, `arpg-animation`, `arpg-ui`, `arpg-enemy-ai`, `arpg-gas`, …).
- `api/feature-matrix/batch-review` + the feature-matrix aggregate path (Quality/Coverage cards).

**Action:** keep `module-registry.ts` intact. What goes away is only the **sidebar navigation** that
renders its 37-module roster (`SidebarL1/L2`, `ModuleRenderer`, `TopBar`) — not the data itself.

## 4. Constraint B — catalog seeds depend on 8 in-module `_shared/data` files, PRESERVE them

The catalog substrate seeds its entities from data files that physically live **inside the legacy
module trees**. Deleting a `sub_*` module wholesale (plan Step 4) would break the catalogs. Preserve:

```
core-engine/sub_ability/_shared/data        (spellbook seed)
core-engine/sub_animation/_shared/data      (state-graph seed)
core-engine/sub_bestiary/_shared/data       (bestiary seed)
core-engine/sub_combat/_shared/data-metrics (combat-map seed)
core-engine/sub_inventory/_shared/data      (items seed)
core-engine/sub_loot/_shared/data-binding   (loot-tables seed)
core-engine/sub_ui/_shared/data             (screen-flow seed)
core-engine/sub_world/_shared/data          (zone-map seed)
```

**Action:** at cutover, delete module **`*View.tsx`** components and their sidebars, but keep each
`sub_*/_shared/` data file (and anything the facets import from `_shared/`). A pre-delete `tsc` will
catch any seed breakage immediately.

## 5. Legacy dashboard → ECW replacement map — ✅ all landed

| Legacy (consumed only by `evaluator/EvaluatorModule.tsx`) | ECW replacement |
|---|---|
| AggregateQualityDashboard, ProjectHealthDashboard | Mission Control **Quality** card |
| CrossModuleFeatureDashboard | Mission Control **Feature Coverage** card |
| UnifiedSummaryView | **Quality + Coverage + CLI Activity + Next Best Actions** cards |
| DirectorOverviewPanel | Mission Control **Playtests** + **CLI Activity** cards |
| EvalRoadmap / CalendarRoadmap | Mission Control **Roadmap** card |

All five legacy dashboards are reachable only through `EvaluatorModule` (a legacy module View deleted
at cutover). No ECW component imports them.

## 6. Pre-cutover checklist (safe order; each step ends `npm run validate` clean + commit)

1. **[non-destructive]** Snapshot tag `ecw-pre-cutover` on the branch HEAD.
2. Remove the `?ecw=1` gate → `page.tsx` renders `<NewAppShell/>` always; trim `page.test.tsx`.
3. Delete `layout/AppShell` + `cli/InlineTerminal` (1 consumer each, now severed).
4. Delete the legacy module **Views** + `layout/{Sidebar*,ModuleRenderer,TopBar,GlobalSearchPanel,CLIBottomPanel}` — **but keep all `sub_*/_shared/` data files (Constraint B)**.
5. Delete `navigationStore` (now zero consumers) — **keep `module-registry` (Constraint A)**.
6. `npx tsc --noEmit` — must be 0; any error here is a missed `_shared` dependency. Fix before continuing.
7. Re-run the 8 live UE gates (plan Step 5 table) — each must be `Result={Success}`.
8. Operator approves → tag `v2.0-entity-centric`, merge `--no-ff` to master (operator pushes).

## 7. Open (non-blocking) items at cutover time

- **Build History** Mission Control panel deferred (no build-telemetry source) — acceptable gap.
- **Phase 11** remaining infra batches + the **encounter-design** cross-catalog batch are deferred
  enhancements, not cutover blockers (operator decision per the plan's prerequisite line).
- **Materials / Audio / Animation-Assets** catalogs are substrate-only (thin data); their module Views
  delete cleanly since the catalogs read their own seeds, not the Views.

## Backout

Unchanged from the cutover plan: the merge is `--no-ff`, so a single `git revert` of the merge commit
restores both shells; re-apply the `?ecw=1` gate temporarily while diagnosing.
