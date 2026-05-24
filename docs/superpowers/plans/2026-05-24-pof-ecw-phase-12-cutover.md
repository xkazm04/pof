# Phase 12 · Cutover, cleanup, live UE proof — Plan

> **Prerequisite:** Phases 7-11 (all batches) substantially complete OR explicit operator decision to cutover with remaining surfaces deferred. The legacy `/` shell is reachable through Phase 11.

## Cutover steps

### Step 1 · Final inventory of legacy modules

Re-audit `src/components/modules/` against the Phase 9 fold-in table. Confirm:
- Every "Folded INTO X" module has its replacement Mission Control panel landed
- Every "Out of scope — deleted" module has no remaining external consumers
- The 12 DROP-STUB modules from `idea_verdicts.md` are confirmed dead

### Step 2 · Remove the `?ecw=1` URL flag

```ts
// src/app/page.tsx
export default function Home() {
  return <NewAppShell />;  // always
}
```

Delete the `useSyncExternalStore` URL gate. Delete `src/__tests__/app/page.test.tsx` (or trim its tests to just "renders NewAppShell").

### Step 3 · Delete the legacy shell

In order (every step → `npm run validate` clean + git commit):
1. Remove `src/components/layout/AppShell.tsx` import from `src/app/page.tsx`
2. Delete `src/components/layout/{AppShell,SidebarL1,SidebarL2,Sidebar,ModuleRenderer,CLIBottomPanel,TopBar,GlobalSearchPanel}.tsx`
3. Delete `src/components/cli/InlineTerminal.tsx` (replaced by CLI Rail)
4. Delete `src/stores/navigationStore.ts` (replaced by ecwStore)
5. Delete or trim `src/lib/module-registry.ts` (37-module roster no longer needed; keep only what catalog substrate consumes)

### Step 4 · Delete the dead modules

Per Phase 9 audit, these have no replacement and no remaining consumers:
- `src/components/modules/evaluator/{PostProcessStudioView,LocalizationPipelineView,CodebaseArcheologistView}.tsx`
- `src/components/modules/game-systems/MultiplayerView.tsx`
- `src/components/modules/game-systems/blueprint-transpiler/`
- `src/components/modules/core-engine/sub_polish/` (audit at cutover time)
- `src/components/modules/core-engine/sub_debug/` (audit at cutover time)
- Associated `*Store`, types, and tests

### Step 5 · Re-run the 8 per-section live UE gates

Per `project_folder_09_catalog.md` memory, the 8 gates are:

| Catalog | Gate test path | Map |
|---|---|---|
| spellbook | `Project.Functional Tests.Maps.VS09Ability.VSAbility09Test` | VS09Ability.umap |
| items | `Project.Functional Tests.Maps.VSItems.VSItemsDefinitionsTest` | VSItems.umap |
| loot-tables | `Project.Functional Tests.Maps.VSLoot.VSLootDistributionTest` | VSLoot.umap |
| bestiary | `Project.Functional Tests.Maps.VSEnemyAttack.VSEnemyAttackTest` | VSEnemyAttack.umap |
| combat-map | `Project.Functional Tests.Maps.VerticalSlice.VSCombatGrayBoxPathTest` | VerticalSlice.umap |
| screen-flow | `Project.Functional Tests.Maps.VerticalSlice.VSHUDFunctionalTest` | VerticalSlice.umap |
| zone-map | `Project.Functional Tests.Maps.VerticalSlice.VSArenaSetupTest` | VerticalSlice.umap |
| state-graph | `Project.Functional Tests.Maps.ProcGenDungeon.ProcGenWalkTest` | ProcGenDungeon.umap |

Verdict per gate must be `Result={Success}` per `reference_ue_headless_shutdown_crash` memory (exit code unreliable).

### Step 6 · Tag and merge

```bash
git tag v2.0-entity-centric
git checkout master
git merge feature/entity-centric-workspace --no-ff -m "merge: v2.0 Entity-Centric Workspace refactor"
git push origin master v2.0-entity-centric
```

### Step 7 · First-run guided tour (idea bb068439)

Implement the first-run guided tour as a one-off post-cutover task. Show new users the 3 L1 tabs + the (Re)generate flow in one entity.

## Backout strategy

If cutover surfaces a critical regression:
1. `git revert` the cutover merge commit (it's `--no-ff` so a single revert restores both shells)
2. Re-apply the `?ecw=1` flag temporarily
3. Diagnose + fix on a new branch
4. Re-attempt cutover

The branch's tagged milestones (`ecw-phase-1-complete` ... `ecw-phase-7-complete`) provide intermediate revert points if cutover needs to defer specific phases.
