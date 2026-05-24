# Folder 09 · R3 UI retrofits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrofit the 5 R3 catalog tabs (EnemyBestiary, CombatActionMap, ScreenFlowMap, ZoneMap, AnimationStateGraph) to show their catalog lifecycle and dispatch a (Re)generate run — mirroring the proven `ItemCatalog/catalog/CatalogGearTab.tsx` pattern from R2.

**Architecture:** Each tab gains a small, additive integration: (1) `useCatalogEntities('<catalogId>')` to read entries, (2) `useGeneration(primaryEntry)` to dispatch, (3) `<CatalogLifecycleCell>` placed in/near the tab's existing header or selection panel. No restructuring of the host tabs' layouts. One prerequisite: extend `useGeneration`'s `CATALOG_MODULE` map (R1 only knew 3 catalogs — R3 catalogs currently fall through to default `arpg-gas` and would mislabel sessions).

**Tech Stack:** React 19 + Zustand v5 + the existing `useGeneration` hook + `<CatalogLifecycleCell>` component + `<LifecycleBadge>`. No new state. No new API routes.

---

## Files at a glance

- **Modify:** `src/hooks/useGeneration.ts` — extend `CATALOG_MODULE` map (5 entries)
- **Modify:** `src/__tests__/hooks/useGeneration.test.tsx` — assert R3 module routing
- **Modify (per-tab):** `src/components/modules/core-engine/unique-tabs/{EnemyBestiary,CombatActionMap,ScreenFlowMap,ZoneMap,AnimationStateGraph}/` — drop the lifecycle cell into existing UI

Each tab retrofit is purely additive: import `useCatalogEntities`/`useGeneration`/`CatalogLifecycleCell`, compute `primaryEntry` + `nextStep`, render the cell. No tab structure change.

---

## Task 1: Extend `useGeneration` CATALOG_MODULE map

**Files:**
- Modify: `src/hooks/useGeneration.ts` (lines ~20–24)
- Test: `src/__tests__/hooks/useGeneration.test.tsx`

- [ ] **Step 1: Add a failing test asserting R3 routing**

Append a new `it` block per R3 catalog (5 total) asserting that `useGeneration(<entityWithCatalogId>)` uses the matching SubModuleId in its `useModuleCLI` config. Use the existing mock pattern from the file (mocks `useModuleCLI` and checks the `moduleId` arg).

Map:
- `bestiary` → `arpg-enemy-ai`
- `combat-map` → `arpg-combat`
- `screen-flow` → `arpg-ui`
- `zone-map` → `arpg-world`
- `state-graph` → `arpg-animation`

- [ ] **Step 2: Run test to confirm fail**

`npx vitest run src/__tests__/hooks/useGeneration.test.tsx`
Expected: 5 new tests fail (all routed to `arpg-gas` via the default fallback).

- [ ] **Step 3: Extend the map**

```ts
const CATALOG_MODULE: Record<string, SubModuleId> = {
  spellbook: 'arpg-gas',
  items: 'arpg-inventory',
  'loot-tables': 'arpg-loot',
  bestiary: 'arpg-enemy-ai',
  'combat-map': 'arpg-combat',
  'screen-flow': 'arpg-ui',
  'zone-map': 'arpg-world',
  'state-graph': 'arpg-animation',
};
```

- [ ] **Step 4: Run test to confirm pass**

Expected: all useGeneration tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGeneration.ts src/__tests__/hooks/useGeneration.test.tsx
git commit -m "feat(catalog): route R3 catalogs to their PoF modules in useGeneration (folder-09)"
```

---

## Task 2: EnemyBestiary retrofit

**Files:**
- Modify: `src/components/modules/core-engine/unique-tabs/EnemyBestiary/archetypes/ArchetypesTab.tsx` (or `index.tsx` if the cell fits better in the tab header).

Pattern: the user lands on the Archetypes subtab — there's a selected archetype card. Drop the lifecycle cell near the archetype detail header (where the codegen modal trigger already lives, if present).

- [ ] **Step 1: Re-read the target file to confirm structure** (host file may have changed under shared-tree concurrency).

- [ ] **Step 2: Locate the archetype selection state + the archetype detail panel header**. Identify the line where the cell will sit (above the codegen / detail area).

- [ ] **Step 3: Apply the retrofit**

```tsx
import { useCatalogEntities } from '@/stores/catalogStore';
import { useGeneration } from '@/hooks/useGeneration';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import type { BestiaryEntry } from '@/lib/catalog/types';
import type { GenerationStep } from '@/lib/catalog/recipe';

// inside the component, after archetype selection state:
const entries = useCatalogEntities('bestiary') as BestiaryEntry[];
const entryByArchetypeId = useMemo(
  () => new Map(entries.map((e) => [e.data.id, e])),
  [entries],
);
const primaryEntry =
  (selectedArchetype && entryByArchetypeId.get(selectedArchetype.id)) ?? entries[0];
const gen = useGeneration(primaryEntry!);
const nextStep: GenerationStep =
  primaryEntry?.lifecycle === 'generated' ? 'wire'
    : primaryEntry?.lifecycle === 'wired' ? 'verify'
      : 'author-python';
```

In the JSX near the archetype detail header:

```tsx
{primaryEntry && (
  <CatalogLifecycleCell
    lifecycle={primaryEntry.lifecycle}
    ueAssetCount={primaryEntry.ueAssetPaths?.length ?? 0}
    busy={gen.isRunning}
    onRegenerate={() => gen.generate(nextStep)}
  />
)}
```

- [ ] **Step 4: Targeted verify**

`npx tsc --noEmit` (no project-wide errors introduced) and `npx vitest run src/__tests__/lib/catalog src/__tests__/hooks/useGeneration.test.tsx` (still green).

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/core-engine/unique-tabs/EnemyBestiary/
git commit -m "feat(bestiary-ui): lifecycle cell + (Re)generate on archetype detail (folder-09 R3)"
```

---

## Task 3: CombatActionMap retrofit

**Files:**
- Modify: the file that owns the primary combo/interaction selection inside `src/components/modules/core-engine/unique-tabs/CombatActionMap/` (re-read its `index.tsx` first to choose between subtab files like `flow/` or `hits/`).

Pattern: surface the lifecycle cell on the primary selected combo's detail header.

- [ ] **Step 1: Re-read** `CombatActionMap/index.tsx` and pick the host file (the one rendering the selected-combo header or first card).

- [ ] **Step 2: Apply the same shape as Task 2** with `'combat-map'` and `CombatInteractionEntry`. Entry lookup keyed on `entry.data.id`. Primary = `selectedComboId && entryByComboId.get(selectedComboId) ?? entries[0]`.

- [ ] **Step 3: Targeted verify** (tsc + catalog/useGeneration vitest).

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/core-engine/unique-tabs/CombatActionMap/
git commit -m "feat(combat-map-ui): lifecycle cell + (Re)generate on combo detail (folder-09 R3)"
```

---

## Task 4: ScreenFlowMap retrofit

**Files:**
- Modify: target file under `src/components/modules/core-engine/unique-tabs/ScreenFlowMap/` (likely `flow/` or `index.tsx`).

Pattern: surface the cell on the selected screen node detail.

- [ ] **Step 1: Re-read** `ScreenFlowMap/index.tsx` and pick host file.

- [ ] **Step 2: Apply the same shape** with `'screen-flow'` and `ScreenEntry`, key lookup on `entry.data.id` (the FLOW_NODE id).

- [ ] **Step 3: Targeted verify**.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/core-engine/unique-tabs/ScreenFlowMap/
git commit -m "feat(screen-flow-ui): lifecycle cell + (Re)generate on screen detail (folder-09 R3)"
```

---

## Task 5: ZoneMap retrofit

**Files:**
- Modify: target file under `src/components/modules/core-engine/unique-tabs/ZoneMap/` (likely `map/` or `index.tsx`).

Pattern: surface the cell on the selected zone detail (or a "primary zone" if no selection).

- [ ] **Step 1: Re-read** `ZoneMap/index.tsx` and pick host file.

- [ ] **Step 2: Apply the same shape** with `'zone-map'` and `ZoneEntry`, key lookup on `entry.data.id` (the ZONES id).

- [ ] **Step 3: Targeted verify**.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/core-engine/unique-tabs/ZoneMap/
git commit -m "feat(zone-map-ui): lifecycle cell + (Re)generate on zone detail (folder-09 R3)"
```

---

## Task 6: AnimationStateGraph retrofit

**Files:**
- Modify: target file under `src/components/modules/core-engine/unique-tabs/AnimationStateGraph/` (likely `combos-montages/` or `state-graph/`).

Pattern: surface the cell on the selected montage detail. **Important:** the State Graph recipe loudly flags `'author-python'` as MANUAL (AnimBP graph wall). The cell still drives the dispatch — the recipe text inside the prompt handles the MANUAL framing.

- [ ] **Step 1: Re-read** `AnimationStateGraph/index.tsx` and pick host file.

- [ ] **Step 2: Apply the same shape** with `'state-graph'` and `AnimationEntry`, key lookup on `entry.data.id` (the ALL_MONTAGES id).

- [ ] **Step 3: Targeted verify**.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/core-engine/unique-tabs/AnimationStateGraph/
git commit -m "feat(state-graph-ui): lifecycle cell + (Re)generate on montage detail (folder-09 R3)"
```

---

## Task 7: Final sweep

- [ ] **Step 1: Run targeted-test sweep**

```bash
npx vitest run src/__tests__/lib/catalog src/__tests__/hooks/useGeneration.test.tsx src/__tests__/components/catalog-lifecycle-cell.test.tsx src/__tests__/stores/catalogStore.test.ts src/__tests__/stores/catalogStore-sections.test.ts
```

Expected: all green.

- [ ] **Step 2: `npx tsc --noEmit`** — 0 errors.

- [ ] **Step 3: ESLint on touched files only**

```bash
npx eslint src/hooks/useGeneration.ts src/components/modules/core-engine/unique-tabs/EnemyBestiary/ src/components/modules/core-engine/unique-tabs/CombatActionMap/ src/components/modules/core-engine/unique-tabs/ScreenFlowMap/ src/components/modules/core-engine/unique-tabs/ZoneMap/ src/components/modules/core-engine/unique-tabs/AnimationStateGraph/
```

Expected: clean (warnings inherited from upstream are fine — fail only on errors I introduced).

- [ ] **Step 4: Report completion.**

---

## Self-review notes

- **Spec coverage:** the R3 plan's "out of scope" list explicitly named "UI retrofits of each section UI" — this plan addresses exactly that. Live UE proof (R1 Phase C) remains deferred.
- **Type consistency:** `useCatalogEntities('<catalogId>')` returns `CatalogEntityBase[]`; the cast to `<X>Entry[]` mirrors `useItemEntries()`'s internal pattern. `primaryEntry?.lifecycle` + `nextStep` logic is identical across all 5 retrofits (copy-pasta is intentional — they're testing the same lifecycle ladder).
- **Concurrency:** every per-tab task **re-reads the host file first** (shared-tree concurrency rule) and uses targeted `git add` (no `git add .`). If a host file's structure has changed mid-task or another session has already added a generation affordance, **STOP and report** rather than conflict.
- **No restructuring:** if a tab's current header has no obvious slot for the cell, drop it into the tab's top-level grid header above the subtab nav rather than reflowing inner sections.
