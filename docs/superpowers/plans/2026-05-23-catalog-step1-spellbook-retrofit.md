# Catalog core + Spellbook retrofit (09 · Step 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the shared catalog data model + a `catalogStore` seeded from the existing static `SPELLBOOK_ABILITIES`, and retrofit the existing `AbilitiesSection` (the Spellbook tab) to read its abilities from the store (read-only) with a per-ability lifecycle badge.

**Architecture:** Greenfield `src/lib/catalog/` (types + a pure seed converter) feeds a Zustand+persist `catalogStore` seeded on init from `SPELLBOOK_ABILITIES` (`AbilityEntry.data` reuses the existing `SpellbookAbility` type, so the UI renders unchanged). `AbilitiesSection` swaps its static array for a store-backed list and shows a `LifecycleBadge`. App-repo only; no UE, no build.

**Tech Stack:** TypeScript, Zustand v5 (`persist`, `useShallow`), React 19, vitest + @testing-library/react.

**Conventions:** `@/` imports, no raw `console`, no hardcoded hex (use `chart-colors`), ≤200 LOC per file. Single test file: `npx vitest run <path>`; full gate: `npm run validate`.

**Zustand v5 + React 19 gotcha (from project memory):** array/object selectors must use `useShallow` (from `zustand/react/shallow`) or React warns "getSnapshot should be cached" and may re-render-loop. The array selectors below use it.

---

## File Structure

| File | Responsibility | Create/Modify |
|------|----------------|---------------|
| `src/lib/catalog/types.ts` | `CatalogEntityBase`, `AbilityEntry`, `LifecycleState` | Create |
| `src/lib/catalog/seed-spellbook.ts` | Pure `abilityToEntry` + `seedSpellbookEntries` converter | Create |
| `src/stores/catalogStore.ts` | Zustand+persist store seeded from `SPELLBOOK_ABILITIES` + selectors | Create |
| `src/components/catalog/LifecycleBadge.tsx` | Small colored lifecycle badge | Create |
| `src/components/modules/core-engine/unique-tabs/AbilitySpellbook/abilities/AbilitiesSection.tsx` | Source abilities from the store + render the badge | Modify (additive/swap) |
| `src/__tests__/lib/catalog-seed.test.ts` | Converter tests | Create |
| `src/__tests__/stores/catalogStore.test.ts` | Store seed/state tests | Create |
| `src/__tests__/components/lifecycle-badge.test.tsx` | Badge render test | Create |

**Source-of-truth note:** `SpellbookAbility` + `SPELLBOOK_ABILITIES` are exported from `@/components/modules/core-engine/unique-tabs/AbilitySpellbook/data`. The catalog imports from there (acceptable Step-1 coupling; relocatable later).

---

## Task 1: Catalog types + seed converter

**Files:**
- Create: `src/lib/catalog/types.ts`, `src/lib/catalog/seed-spellbook.ts`
- Test: `src/__tests__/lib/catalog-seed.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/lib/catalog-seed.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { abilityToEntry, seedSpellbookEntries } from '@/lib/catalog/seed-spellbook';
import { SPELLBOOK_ABILITIES } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook/data';

describe('abilityToEntry', () => {
  const a = SPELLBOOK_ABILITIES[0];

  it('preserves id and name', () => {
    const e = abilityToEntry(a);
    expect(e.id).toBe(a.id);
    expect(e.name).toBe(a.name);
  });

  it('derives categoryPath = [category, element] and tags = [tier]', () => {
    const e = abilityToEntry(a);
    expect(e.categoryPath).toEqual([a.category, a.element]);
    expect(e.tags).toEqual([a.tier]);
  });

  it('keeps data === input, lifecycle planned, catalogId spellbook', () => {
    const e = abilityToEntry(a);
    expect(e.data).toBe(a);
    expect(e.lifecycle).toBe('planned');
    expect(e.catalogId).toBe('spellbook');
  });
});

describe('seedSpellbookEntries', () => {
  it('maps every ability', () => {
    expect(seedSpellbookEntries().length).toBe(SPELLBOOK_ABILITIES.length);
  });

  it('produces unique ids', () => {
    const ids = seedSpellbookEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog-seed.test.ts`
Expected: FAIL — cannot resolve `@/lib/catalog/seed-spellbook`.

- [ ] **Step 3: Create the types**

`src/lib/catalog/types.ts`:

```ts
import type { SpellbookAbility } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook/data';

/** Where a catalog entity is in the generate-into-UE pipeline. */
export type LifecycleState =
  | 'planned' | 'scaffolded' | 'generated' | 'wired' | 'verified' | 'failed';

/** The shared envelope every catalog entity carries. */
export interface CatalogEntityBase {
  id: string;
  catalogId: string;        // 'spellbook' (more catalogs added by later 09 steps)
  name: string;
  categoryPath: string[];   // e.g. ['Offensive','Fire'] — the future L4 hierarchy
  tags: string[];           // e.g. ['basic']
  lifecycle: LifecycleState;
}

/** Ability catalog entity — payload reuses the existing UI shape, rendered unchanged. */
export interface AbilityEntry extends CatalogEntityBase {
  catalogId: 'spellbook';
  data: SpellbookAbility;
}
```

- [ ] **Step 4: Create the seed converter**

`src/lib/catalog/seed-spellbook.ts`:

```ts
import {
  SPELLBOOK_ABILITIES,
  type SpellbookAbility,
} from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook/data';
import type { AbilityEntry } from './types';

/** Convert one static SpellbookAbility into a catalog AbilityEntry. */
export function abilityToEntry(a: SpellbookAbility): AbilityEntry {
  return {
    id: a.id,
    catalogId: 'spellbook',
    name: a.name,
    categoryPath: [a.category, a.element],
    tags: [a.tier],
    lifecycle: 'planned',
    data: a,
  };
}

/** Seed the spellbook catalog from the existing static ability list. */
export function seedSpellbookEntries(): AbilityEntry[] {
  return SPELLBOOK_ABILITIES.map(abilityToEntry);
}
```

- [ ] **Step 5: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog-seed.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalog/types.ts src/lib/catalog/seed-spellbook.ts src/__tests__/lib/catalog-seed.test.ts
git commit -m "feat(catalog): catalog data model + spellbook seed converter"
```

---

## Task 2: `catalogStore`

**Files:**
- Create: `src/stores/catalogStore.ts`
- Test: `src/__tests__/stores/catalogStore.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/stores/catalogStore.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { useCatalogStore } from '@/stores/catalogStore';
import { SPELLBOOK_ABILITIES } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook/data';

describe('useCatalogStore', () => {
  it('seeds the spellbook catalog from SPELLBOOK_ABILITIES', () => {
    const spellbook = useCatalogStore.getState().entitiesByCatalog.spellbook;
    expect(Object.keys(spellbook).length).toBe(SPELLBOOK_ABILITIES.length);
  });

  it('resolves a seeded entry by id', () => {
    const e = useCatalogStore.getState().entitiesByCatalog.spellbook['off-fire-01'];
    expect(e).toBeDefined();
    expect(e.name).toBe('Fireball');
    expect(e.lifecycle).toBe('planned');
  });

  it('every seeded entry is planned with a categoryPath + tags', () => {
    const all = Object.values(useCatalogStore.getState().entitiesByCatalog.spellbook);
    for (const e of all) {
      expect(e.lifecycle).toBe('planned');
      expect(e.categoryPath.length).toBeGreaterThanOrEqual(2);
      expect(e.tags.length).toBeGreaterThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/stores/catalogStore.test.ts`
Expected: FAIL — cannot resolve `@/stores/catalogStore`.

- [ ] **Step 3: Create the store**

`src/stores/catalogStore.ts`:

```ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { CatalogEntityBase, AbilityEntry } from '@/lib/catalog/types';
import { seedSpellbookEntries } from '@/lib/catalog/seed-spellbook';

interface CatalogState {
  /** entitiesByCatalog[catalogId][entityId] */
  entitiesByCatalog: Record<string, Record<string, CatalogEntityBase>>;
  setEntities: (catalogId: string, entities: CatalogEntityBase[]) => void;
}

function indexById(entities: CatalogEntityBase[]): Record<string, CatalogEntityBase> {
  const map: Record<string, CatalogEntityBase> = {};
  for (const e of entities) map[e.id] = e;
  return map;
}

function buildInitial(): Record<string, Record<string, CatalogEntityBase>> {
  return { spellbook: indexById(seedSpellbookEntries()) };
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      entitiesByCatalog: buildInitial(),
      setEntities: (catalogId, entities) =>
        set((s) => ({
          entitiesByCatalog: { ...s.entitiesByCatalog, [catalogId]: indexById(entities) },
        })),
    }),
    {
      name: 'pof-catalog',
      storage: createJSONStorage(() => localStorage),
      // Re-seed any catalog the persisted blob is missing, so newly-added seed
      // entries appear after a code update without wiping persisted ones.
      merge: (persisted, current) => {
        const p = (persisted as Partial<CatalogState> | undefined)?.entitiesByCatalog ?? {};
        return {
          ...current,
          entitiesByCatalog: { ...current.entitiesByCatalog, ...p },
        };
      },
    },
  ),
);

/** All entities in a catalog (array). Uses useShallow to keep a stable snapshot. */
export function useCatalogEntities(catalogId: string): CatalogEntityBase[] {
  return useCatalogStore(
    useShallow((s) => Object.values(s.entitiesByCatalog[catalogId] ?? {})),
  );
}

/** A single entity by id. */
export function useCatalogEntity(
  catalogId: string,
  id: string,
): CatalogEntityBase | undefined {
  return useCatalogStore((s) => s.entitiesByCatalog[catalogId]?.[id]);
}

/** Typed convenience for the spellbook catalog. */
export function useSpellbookEntries(): AbilityEntry[] {
  return useCatalogStore(
    useShallow((s) => Object.values(s.entitiesByCatalog.spellbook ?? {}) as AbilityEntry[]),
  );
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/stores/catalogStore.test.ts`
Expected: PASS (all). (The seed is set synchronously at `create`; an empty mocked `localStorage` leaves it intact via `merge`.)

- [ ] **Step 5: Commit**

```bash
git add src/stores/catalogStore.ts src/__tests__/stores/catalogStore.test.ts
git commit -m "feat(catalog): catalogStore seeded from SPELLBOOK_ABILITIES + selectors"
```

---

## Task 3: `LifecycleBadge`

**Files:**
- Create: `src/components/catalog/LifecycleBadge.tsx`
- Test: `src/__tests__/components/lifecycle-badge.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/__tests__/components/lifecycle-badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';

describe('LifecycleBadge', () => {
  it('renders the planned label', () => {
    const { getByText } = render(<LifecycleBadge state="planned" />);
    expect(getByText(/planned/i)).toBeTruthy();
  });

  it('renders the verified label', () => {
    const { getByText } = render(<LifecycleBadge state="verified" />);
    expect(getByText(/verified/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/components/lifecycle-badge.test.tsx`
Expected: FAIL — cannot resolve `@/components/catalog/LifecycleBadge`.

- [ ] **Step 3: Create the badge**

`src/components/catalog/LifecycleBadge.tsx`. First confirm the exact `chart-colors` export names you need exist (grep `STATUS_SUCCESS`, `STATUS_WARNING`, `STATUS_ERROR`, `STATUS_INFO`, `STATUS_NEUTRAL`, `withOpacity`, `OPACITY_15` in `src/lib/chart-colors.ts`; `STATUS_WARNING` is already imported by `AbilitiesSection`). If a name differs (e.g. neutral is `NEUTRAL`), use the actual export.

```tsx
'use client';

import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_NEUTRAL,
  withOpacity, OPACITY_15,
} from '@/lib/chart-colors';
import type { LifecycleState } from '@/lib/catalog/types';

const LIFECYCLE_COLOR: Record<LifecycleState, string> = {
  planned: STATUS_NEUTRAL,
  scaffolded: STATUS_INFO,
  generated: STATUS_INFO,
  wired: STATUS_WARNING,
  verified: STATUS_SUCCESS,
  failed: STATUS_ERROR,
};

export function LifecycleBadge({ state }: { state: LifecycleState }) {
  const color = LIFECYCLE_COLOR[state];
  return (
    <span
      className="text-2xs font-mono font-bold px-1.5 py-0.5 rounded capitalize"
      style={{ backgroundColor: withOpacity(color, OPACITY_15), color }}
    >
      {state}
    </span>
  );
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/components/lifecycle-badge.test.tsx`
Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add src/components/catalog/LifecycleBadge.tsx src/__tests__/components/lifecycle-badge.test.tsx
git commit -m "feat(catalog): LifecycleBadge"
```

---

## Task 4: Retrofit `AbilitiesSection` to the store

**Files:**
- Modify: `src/components/modules/core-engine/unique-tabs/AbilitySpellbook/abilities/AbilitiesSection.tsx`

No new test (this is a UI wiring swap; the seeded store is identical to the static array, so behaviour is preserved). Verification is `npm run typecheck` + the full suite staying green + a no-regression read.

- [ ] **Step 1: Update imports**

Replace the `../data` import (which currently pulls `SPELLBOOK_ABILITIES`) — drop `SPELLBOOK_ABILITIES`, keep the rest — and add the store + badge imports. Change:

```ts
import {
  ABILITY_RADAR_AXES, SPELLBOOK_ABILITIES, ELEMENT_COLORS,
  type SpellbookAbility, type AbilityElement,
} from '../data';
import { useSpellbookData } from '../context';
import type { SectionProps } from '../types';
import { ScalableSelector } from '@/components/shared/ScalableSelector';
```
to:
```ts
import {
  ABILITY_RADAR_AXES, ELEMENT_COLORS,
  type SpellbookAbility, type AbilityElement,
} from '../data';
import { useSpellbookData } from '../context';
import type { SectionProps } from '../types';
import { ScalableSelector } from '@/components/shared/ScalableSelector';
import { useSpellbookEntries } from '@/stores/catalogStore';
import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import type { LifecycleState } from '@/lib/catalog/types';
```

- [ ] **Step 2: Source abilities from the store**

After the existing `const { COOLDOWN_ABILITIES } = useSpellbookData();` line, add:

```ts
  const entries = useSpellbookEntries();
  const abilities = useMemo(() => entries.map((e) => e.data), [entries]);
  const lifecycleById = useMemo(
    () => new Map<string, LifecycleState>(entries.map((e) => [e.id, e.lifecycle])),
    [entries],
  );
```

- [ ] **Step 3: Replace the four `SPELLBOOK_ABILITIES` references with `abilities`**

- In `selectedAbilities`: `.map(id => abilities.find(a => a.id === id))`.
- In the helper text: `the {abilities.length} available`.
- In `<ScalableSelector items={abilities} ...>`.
- In the selector title: ``Compare Abilities (${abilities.length} available)``.

(`useMemo` is already imported on line 3.)

- [ ] **Step 4: Render the lifecycle badge on each selected ability card**

In the selected-ability card, inside the element row (the `<div className="flex items-center gap-1.5 mt-0.5">` that shows the element dot + name), append the badge after the element `<span>`:

```tsx
                      <span className="text-2xs font-mono text-text-muted">{ability.element}</span>
                      <LifecycleBadge state={lifecycleById.get(ability.id) ?? 'planned'} />
```

- [ ] **Step 5: Typecheck + targeted test run**

Run: `npm run typecheck`
Expected: no errors.
Run: `npx vitest run src/__tests__/stores/catalogStore.test.ts src/__tests__/lib/catalog-seed.test.ts src/__tests__/components/lifecycle-badge.test.tsx`
Expected: PASS. Also run any existing AbilitySpellbook test if present (`npx vitest run src/__tests__ -t Spellbook` or grep for one) — it must still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/core-engine/unique-tabs/AbilitySpellbook/abilities/AbilitiesSection.tsx
git commit -m "feat(catalog): Spellbook reads abilities from catalogStore + lifecycle badge"
```

---

## Task 5: Full validation gate

**Files:** none.

- [ ] **Step 1: Run the full gate**

Run: `npm run validate`
Expected: typecheck clean; lint 0 errors (no unused imports — e.g. confirm `SPELLBOOK_ABILITIES` is fully removed from `AbilitiesSection`; no raw `console`; no hardcoded hex); all tests pass including the 3 new files.

- [ ] **Step 2: Fix any issues inline, re-run**

Most likely: a wrong `chart-colors` export name in `LifecycleBadge` (fix to the actual export) or a stray unused import. Fix and re-run `npm run validate` until green.

- [ ] **Step 3: Final commit (only if Step 2 changed files)**

```bash
git add -p
git commit -m "chore(catalog): validation fixups"
```

---

## Self-Review

**Spec coverage:**
- Spec §1 (data model) → Task 1 (`types.ts`).
- Spec §2 (store seeded from `SPELLBOOK_ABILITIES`) → Task 1 (converter) + Task 2 (store).
- Spec §3 (`AbilitiesSection` reads from store + badge) → Task 4 + Task 3 (badge).
- Spec §4 (tests) → Task 1/2/3 tests; Task 4/5 cover the no-regression DoD via typecheck + full suite.
- Spec DoD #4 (no Spellbook regression) → Task 4 Step 5 + Task 5 (the seeded store is identical to the static array; behaviour preserved).

**Placeholder scan:** none — every code step is complete; commands have expected output. The only "verify the actual export name" note (chart-colors) is a concrete safety check, not a placeholder.

**Type consistency:** `AbilityEntry`/`CatalogEntityBase`/`LifecycleState` are used identically across Tasks 1–4; `useSpellbookEntries(): AbilityEntry[]`, `abilityToEntry(a): AbilityEntry`, and `seedSpellbookEntries(): AbilityEntry[]` match across the store, seed file, and tests; `SpellbookAbility` field names (`manaCost`, `color`, `category`, `element`, `tier`) match the verified `data.ts` shape; the four `abilities` substitutions match the four verified `SPELLBOOK_ABILITIES` sites; the badge insertion point matches the verified element-row JSX.

**Shared-tree note:** commit only the listed files by exact path; do not switch the (shared, accumulation) branch.
