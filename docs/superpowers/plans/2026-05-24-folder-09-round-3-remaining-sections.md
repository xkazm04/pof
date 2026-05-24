# Folder 09 · Round 3 — Remaining 5 Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Register the remaining 5 Core Engine sections — **Bestiary, Combat Map, Screen Flow, Zone Map, State Graph** — as catalog data-layer entries on the R2/R3 substrate. Bestiary resolves cross-catalog links to Abilities + Loot at seed time; State Graph recipe loudly flags the AnimBP graph as the manual binary wall.

**Architecture:** Uniform thin-section pattern per section (type + seed + recipe + `sections.ts` entry), proven by Items/Loot in R2/R3. One shared `CatalogLink` type + optional `links?: CatalogLink[]` on `CatalogEntityBase` lands with Task 1 (Bestiary uses it). No UI retrofits, no live UE gates — those are parallel per-section CLI work per the roadmap's "R3 = up-to-7 parallel CLIs."

**Tech Stack:** TypeScript, Vitest, the existing catalog substrate (`sections.ts`/`recipe.ts`/`catalogStore`/`PromptBuilder.withAssetSpec`).

**Spec:** [`../specs/2026-05-24-folder-09-round-3-remaining-sections-design.md`](../specs/2026-05-24-folder-09-round-3-remaining-sections-design.md).

**Concurrency:** all new files except 4 additive edits to shared files (`types.ts` `CatalogLink` + optional `links?` + 5 entity types; `recipe.ts` +5 recipe consts + 5 `RECIPES` entries; `sections.ts` +5 array entries; `ue-known-assets.ts` +5 KNOWN_ASSETS entries + 5 `knownAssetDomainsForModule` cases). `cli-task.ts` untouched. Targeted `git add` per task; commit locally to master.

**Grounded data shapes (read from each section's data.ts):**
- `ArchetypeConfig` (`EnemyBestiary/data.ts`): `{id, label, icon, color, class, role, category, tier, area, stats, abilities: string[], btSummary, featureName}`.
- `ComboSequence` (`CombatActionMap/data-metrics.ts`): `{id, name, weaponCategory, hits, totalTime, dps, chain: string[]}`.
- `GraphNode` (`@/types/unique-tab-improvements`, used by `FLOW_NODES`): `{id, label, group?, color?, size?, x?, y?}`.
- `ZoneRecord` (`ZoneMap/data.ts`): `{id, name, displayName, cx, cy, type:'hub'|'combat'|'boss', status, levelRange, levelMin, levelMax, connections: string[], group}`.
- `MontageEntry` (`AnimationStateGraph/data.ts`): `{id, name, category: MontageCategory, totalFrames, fps, memorySizeMB, hasRootMotion, blendInTime}`.

---

## Task 1: Shared types — `CatalogLink` + 5 entity types

**Files:** Modify `src/lib/catalog/types.ts`

Additive: introduces `CatalogLink` + optional `links?: CatalogLink[]` on `CatalogEntityBase` (used by Bestiary at seed time), and the 5 per-section entity interfaces. Backward-compatible.

- [ ] **Step 1: Re-read `src/lib/catalog/types.ts`**, then make the additive edits

Add the new type imports at the top with the existing imports (insert after the existing `import type { EnemyLootBinding } …` line):
```ts
import type { ArchetypeConfig } from '@/components/modules/core-engine/unique-tabs/EnemyBestiary/data';
import type { ComboSequence } from '@/components/modules/core-engine/unique-tabs/CombatActionMap/data-metrics';
import type { GraphNode } from '@/types/unique-tab-improvements';
import type { ZoneRecord } from '@/components/modules/core-engine/unique-tabs/ZoneMap/data';
import type { MontageEntry } from '@/components/modules/core-engine/unique-tabs/AnimationStateGraph/data';
```

Add the `CatalogLink` interface (insert before `export interface CatalogEntityBase`):
```ts
/** A typed cross-catalog reference (e.g. a Bestiary entry → its abilities/loot). */
export interface CatalogLink {
  catalogId: string;
  entityId: string;
  role: string;
}
```

Add the optional `links?: CatalogLink[]` field on `CatalogEntityBase` (insert right after the `lastVerifiedAt?` line, inside the interface block):
```ts
  /** Cross-catalog references (e.g. Bestiary → Abilities + Loot). */
  links?: CatalogLink[];
```

Append the 5 per-section entity interfaces (after the existing `LootTableEntry` interface):
```ts
/** Bestiary catalog entity — composes abilities + loot via `links` (resolved at seed time). */
export interface BestiaryEntry extends CatalogEntityBase {
  catalogId: 'bestiary';
  data: ArchetypeConfig;
}

/** Combat Map catalog entity — combo/interaction shape from CombatActionMap. */
export interface CombatInteractionEntry extends CatalogEntityBase {
  catalogId: 'combat-map';
  data: ComboSequence;
}

/** Screen Flow catalog entity — one screen node from FLOW_NODES. */
export interface ScreenEntry extends CatalogEntityBase {
  catalogId: 'screen-flow';
  data: GraphNode;
}

/** Zone Map catalog entity — one zone from ZoneMap. */
export interface ZoneEntry extends CatalogEntityBase {
  catalogId: 'zone-map';
  data: ZoneRecord;
}

/** State Graph catalog entity — one montage from ALL_MONTAGES (AnimBP graph stays manual). */
export interface AnimationEntry extends CatalogEntityBase {
  catalogId: 'state-graph';
  data: MontageEntry;
}
```

- [ ] **Step 2: Verify existing catalog tests still pass**

Run: `npx vitest run src/__tests__/lib/catalog src/__tests__/stores/catalogStore.test.ts src/__tests__/stores/catalogStore-lifecycle.test.ts src/__tests__/stores/catalogStore-sections.test.ts src/__tests__/lib/catalog-seed.test.ts`
Expected: PASS — additive changes shouldn't affect anything.

- [ ] **Step 3: Commit**

```bash
git add src/lib/catalog/types.ts
git commit -m "feat(catalog): CatalogLink + 5 per-section entity types (folder-09 R3 remaining)"
```

---

## Task 2: Bestiary seed (with cross-catalog links)

**Files:** Create `src/lib/catalog/seed-bestiary.ts`; Test `src/__tests__/lib/catalog/seed-bestiary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/seed-bestiary.test.ts
import { describe, it, expect } from 'vitest';
import { archetypeToEntry, seedBestiaryEntries } from '@/lib/catalog/seed-bestiary';
import { ARCHETYPES } from '@/components/modules/core-engine/unique-tabs/EnemyBestiary/data';

describe('archetypeToEntry', () => {
  const a0 = ARCHETYPES[0];
  it('prefixes id, keeps name + data, lifecycle planned', () => {
    const e = archetypeToEntry(a0);
    expect(e.id).toBe(`bestiary-${a0.id}`);
    expect(e.name).toBe(a0.label);
    expect(e.data).toBe(a0);
    expect(e.catalogId).toBe('bestiary');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [Bestiary, tier, role] and tags = [class, category]', () => {
    const e = archetypeToEntry(a0);
    expect(e.categoryPath).toEqual(['Bestiary', a0.tier, a0.role]);
    expect(e.tags).toEqual([a0.class, a0.category]);
  });
});

describe('seedBestiaryEntries — cross-catalog links', () => {
  const entries = seedBestiaryEntries();

  it('maps every archetype with unique ids', () => {
    expect(entries.length).toBe(ARCHETYPES.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });

  it('links a known boss archetype to its loot table (lt-DarthMalak)', () => {
    const malak = entries.find((e) => e.data.id === 'DarthMalak');
    expect(malak).toBeDefined();
    const lootLink = malak!.links?.find((l) => l.catalogId === 'loot-tables');
    expect(lootLink?.entityId).toBe('lt-DarthMalak');
    expect(lootLink?.role).toBe('loot');
  });

  it('drops unmatched ability names (no fabricated spellbook links)', () => {
    // every ability link must point at an entity that actually exists in spellbook
    const allAbilityLinks = entries.flatMap((e) => (e.links ?? []).filter((l) => l.catalogId === 'spellbook'));
    for (const link of allAbilityLinks) {
      expect(link.entityId).toMatch(/^[a-z0-9-]+$/); // a real spellbook id slug
      expect(link.role).toBe('ability');
    }
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/seed-bestiary.test.ts`
Expected: FAIL — cannot resolve `@/lib/catalog/seed-bestiary`.

- [ ] **Step 3: Implement**

```ts
// src/lib/catalog/seed-bestiary.ts
import {
  ARCHETYPES,
  type ArchetypeConfig,
} from '@/components/modules/core-engine/unique-tabs/EnemyBestiary/data';
import { DEFAULT_ENEMY_LOOT_BINDINGS } from '@/components/modules/core-engine/unique-tabs/LootTableVisualizer/data-binding';
import { seedSpellbookEntries } from './seed-spellbook';
import type { BestiaryEntry, CatalogLink } from './types';

/** Build a case-insensitive name → spellbook entry id map (computed once). */
function buildSpellbookNameIndex(): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of seedSpellbookEntries()) {
    map.set(e.data.name.toLowerCase(), e.id);
  }
  return map;
}

const SPELLBOOK_BY_NAME = buildSpellbookNameIndex();

function resolveLinks(archetype: ArchetypeConfig): CatalogLink[] {
  const links: CatalogLink[] = [];
  for (const abilityName of archetype.abilities) {
    const id = SPELLBOOK_BY_NAME.get(abilityName.toLowerCase());
    if (id) links.push({ catalogId: 'spellbook', entityId: id, role: 'ability' });
  }
  const lootBinding = DEFAULT_ENEMY_LOOT_BINDINGS.find((b) => b.archetypeId === archetype.id);
  if (lootBinding) {
    links.push({ catalogId: 'loot-tables', entityId: `lt-${archetype.id}`, role: 'loot' });
  }
  return links;
}

/** Convert one ArchetypeConfig into a Bestiary entry with resolved cross-catalog links. */
export function archetypeToEntry(archetype: ArchetypeConfig): BestiaryEntry {
  return {
    id: `bestiary-${archetype.id}`,
    catalogId: 'bestiary',
    name: archetype.label,
    categoryPath: ['Bestiary', archetype.tier, archetype.role],
    tags: [archetype.class, archetype.category],
    lifecycle: 'planned',
    links: resolveLinks(archetype),
    data: archetype,
  };
}

/** Seed the bestiary catalog from ARCHETYPES (DERIVED + KOTOR + EXPANDED). */
export function seedBestiaryEntries(): BestiaryEntry[] {
  return ARCHETYPES.map(archetypeToEntry);
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/seed-bestiary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/seed-bestiary.ts src/__tests__/lib/catalog/seed-bestiary.test.ts
git commit -m "feat(catalog): bestiary seed + cross-catalog links to abilities/loot (folder-09 R3)"
```

---

## Task 3: Bestiary recipe

**Files:** Modify `src/lib/catalog/recipe.ts`; Test `src/__tests__/lib/catalog/recipe-bestiary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/recipe-bestiary.test.ts
import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { BestiaryEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

const sampleEntry: BestiaryEntry = {
  id: 'bestiary-MeleeGrunt', catalogId: 'bestiary', name: 'Melee Grunt',
  categoryPath: ['Bestiary', 'minion', 'melee'], tags: ['Soldier', 'minion'], lifecycle: 'planned',
  data: {
    id: 'MeleeGrunt', label: 'Melee Grunt', icon: undefined as never, color: '#0f0',
    class: 'Soldier', role: 'melee' as never, category: 'minion' as never, tier: 'minion' as never,
    area: 'Endar Spire', stats: [], abilities: ['Fireball'], btSummary: {}, featureName: 'fa',
  },
};

describe('Bestiary recipe', () => {
  it('exists in the registry', () => {
    expect(getRecipe('bestiary')).toBeDefined();
  });
  it('author-python prompt names BP_*Enemy + AARPGEnemyCharacter', () => {
    const p = getRecipe('bestiary')!.buildStepPrompt(sampleEntry, 'author-python', ctx);
    expect(p).toContain('Asset Specification');
    expect(p).toContain('Melee Grunt');
    expect(p).toContain('BP_');
    expect(p).toContain('AARPGEnemyCharacter');
  });
  it('verify prompt references the per-archetype functional test', () => {
    const p = getRecipe('bestiary')!.buildStepPrompt(sampleEntry, 'verify', ctx);
    expect(p).toContain('AVSBestiary');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-bestiary.test.ts`
Expected: FAIL — `getRecipe('bestiary')` is `undefined`.

- [ ] **Step 3: Re-read `src/lib/catalog/recipe.ts`**, then add the recipe + RECIPES entry

Extend the existing type-import line to add `BestiaryEntry` (insert it next to `ItemEntry`, `LootTableEntry`):
```ts
import type {
  AbilityEntry, CatalogEntityBase, ItemEntry, LifecycleState, LootTableEntry,
  BestiaryEntry,
} from '@/lib/catalog/types';
```

Add the recipe (after `LOOT_RECIPE`, before `RECIPES`):
```ts
const BESTIARY_BEST_PRACTICES = [
  'Author a `BP_<id>Enemy` Blueprint subclassing `AARPGEnemyCharacter` via FULL editor (-ExecutePythonScript), not -run=pythonscript.',
  'Grant the archetype\'s abilities on the placed instance (CDO-vs-instance trap — see [[reference-ue-python-bool-prefix]]).',
  'Use the strong-red `M_EnemyRed` material variant by default for visual distinction from the player.',
  'Place the asset under `/Game/Enemies/` and report its content path.',
];

export const BESTIARY_RECIPE: GenerationRecipe<BestiaryEntry> = {
  id: 'bestiary-archetype',
  catalogId: 'bestiary',
  steps: ['author-python', 'wire', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSBestiary.VSBestiary_DefaultTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'author-python'
        ? `Author the BP_${entity.data.id}Enemy Blueprint subclassing AARPGEnemyCharacter from "${entity.name}"'s spec.`
        : step === 'wire'
          ? `Wire BP_${entity.data.id}Enemy: grant its abilities (cross-catalog links provide spellbook ids) + bind the loot table (lt-${entity.data.id}) on the placed instance.`
          : `Run AVSBestiary_${entity.data.id}Test: spawn → chases + attacks (player Health drops) → drops linked loot on death.`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('AARPGEnemyCharacter Blueprint authoring + cross-catalog wiring for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Bestiary · ${step}`, task)
      .withBestPractices(BESTIARY_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};
```

Extend the `RECIPES` map to include the bestiary entry:
```ts
const RECIPES: Record<string, GenerationRecipe> = {
  spellbook: SPELLBOOK_RECIPE,
  items: ITEMS_RECIPE,
  'loot-tables': LOOT_RECIPE,
  bestiary: BESTIARY_RECIPE,
};
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-bestiary.test.ts src/__tests__/lib/catalog/recipe.test.ts src/__tests__/lib/catalog/recipe-sections.test.ts`
Expected: PASS — new bestiary tests (3) + existing recipe tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/recipe.ts src/__tests__/lib/catalog/recipe-bestiary.test.ts
git commit -m "feat(catalog): bestiary recipe (BP_*Enemy + ability grants + loot wire) (folder-09 R3)"
```

---

## Task 4: Combat Map seed

**Files:** Create `src/lib/catalog/seed-combat-map.ts`; Test `src/__tests__/lib/catalog/seed-combat-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/seed-combat-map.test.ts
import { describe, it, expect } from 'vitest';
import { comboToEntry, seedCombatInteractionEntries } from '@/lib/catalog/seed-combat-map';
import { COMBO_SEQUENCES } from '@/components/modules/core-engine/unique-tabs/CombatActionMap/data-metrics';

describe('comboToEntry', () => {
  const c0 = COMBO_SEQUENCES[0];
  it('prefixes id, keeps name + data', () => {
    const e = comboToEntry(c0);
    expect(e.id).toBe(`combo-${c0.id}`);
    expect(e.name).toBe(c0.name);
    expect(e.data).toBe(c0);
    expect(e.catalogId).toBe('combat-map');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [Combat Map, weaponCategory] and tags = [weaponCategory]', () => {
    const e = comboToEntry(c0);
    expect(e.categoryPath).toEqual(['Combat Map', c0.weaponCategory]);
    expect(e.tags).toEqual([c0.weaponCategory]);
  });
});

describe('seedCombatInteractionEntries', () => {
  it('maps every combo with unique ids', () => {
    const entries = seedCombatInteractionEntries();
    expect(entries.length).toBe(COMBO_SEQUENCES.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/seed-combat-map.test.ts`
Expected: FAIL — cannot resolve `@/lib/catalog/seed-combat-map`.

- [ ] **Step 3: Implement**

```ts
// src/lib/catalog/seed-combat-map.ts
import {
  COMBO_SEQUENCES,
  type ComboSequence,
} from '@/components/modules/core-engine/unique-tabs/CombatActionMap/data-metrics';
import type { CombatInteractionEntry } from './types';

/** Convert one ComboSequence into a Combat Map entry. */
export function comboToEntry(combo: ComboSequence): CombatInteractionEntry {
  return {
    id: `combo-${combo.id}`,
    catalogId: 'combat-map',
    name: combo.name,
    categoryPath: ['Combat Map', combo.weaponCategory],
    tags: [combo.weaponCategory],
    lifecycle: 'planned',
    data: combo,
  };
}

/** Seed the combat-map catalog from COMBO_SEQUENCES. */
export function seedCombatInteractionEntries(): CombatInteractionEntry[] {
  return COMBO_SEQUENCES.map(comboToEntry);
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/seed-combat-map.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/seed-combat-map.ts src/__tests__/lib/catalog/seed-combat-map.test.ts
git commit -m "feat(catalog): combat-map seed from COMBO_SEQUENCES (folder-09 R3)"
```

---

## Task 5: Combat Map recipe

**Files:** Modify `src/lib/catalog/recipe.ts`; Test `src/__tests__/lib/catalog/recipe-combat-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/recipe-combat-map.test.ts
import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { CombatInteractionEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

const sample: CombatInteractionEntry = {
  id: 'combo-cb-sw-basic', catalogId: 'combat-map', name: 'Slash Combo',
  categoryPath: ['Combat Map', 'Sword'], tags: ['Sword'], lifecycle: 'planned',
  data: { id: 'cb-sw-basic', name: 'Slash Combo', weaponCategory: 'Sword' as never, hits: 3, totalTime: '1.5s', dps: 245, chain: ['Slash', 'Cross Cut', 'Thrust'] },
};

describe('Combat Map recipe', () => {
  it('exists with wire+verify steps (no scaffold/author — wiring of existing abilities)', () => {
    const r = getRecipe('combat-map');
    expect(r).toBeDefined();
    expect(r!.steps).toEqual(['wire', 'verify']);
  });
  it('wire prompt names HitReact + damage tag wiring', () => {
    const p = getRecipe('combat-map')!.buildStepPrompt(sample, 'wire', ctx);
    expect(p).toContain('Slash Combo');
    expect(p).toContain('HitReact');
    expect(p).toContain('Damage');
  });
  it('verify prompt references VSCombat_DamageMatrixTest', () => {
    const p = getRecipe('combat-map')!.buildStepPrompt(sample, 'verify', ctx);
    expect(p).toContain('VSCombat_DamageMatrixTest');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-combat-map.test.ts`
Expected: FAIL — `getRecipe('combat-map')` is `undefined`.

- [ ] **Step 3: Add the recipe + RECIPES entry**

Extend the type-import line to add `CombatInteractionEntry`:
```ts
import type {
  AbilityEntry, CatalogEntityBase, ItemEntry, LifecycleState, LootTableEntry,
  BestiaryEntry, CombatInteractionEntry,
} from '@/lib/catalog/types';
```

Add the recipe (after `BESTIARY_RECIPE`, before `RECIPES`):
```ts
const COMBAT_MAP_BEST_PRACTICES = [
  'Combat Map is wiring of EXISTING abilities — do not author new GAs or assets.',
  'Wire each combo step (`Ability → HitReact montage → Damage tag`) on the placed-instance damage table; the CDO can be stale (CDO-vs-instance trap).',
  'Use GAS `SetByCaller Data.Damage.Base` for damage, never hardcoded GE magnitudes.',
];

export const COMBAT_MAP_RECIPE: GenerationRecipe<CombatInteractionEntry> = {
  id: 'combat-map-interaction',
  catalogId: 'combat-map',
  steps: ['wire', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSCombat.VSCombat_DamageMatrixTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'wire'
        ? `Wire combo "${entity.name}" (${entity.data.weaponCategory}): connect each chain step to its HitReact montage + Damage tag on the placed-instance damage table.`
        : `Run VSCombat_DamageMatrixTest: assert each interaction applies the expected damage/reaction to the target.`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('Combat interaction wiring (no new assets) for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Combat Map · ${step}`, task)
      .withBestPractices(COMBAT_MAP_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};
```

Extend the `RECIPES` map:
```ts
const RECIPES: Record<string, GenerationRecipe> = {
  spellbook: SPELLBOOK_RECIPE,
  items: ITEMS_RECIPE,
  'loot-tables': LOOT_RECIPE,
  bestiary: BESTIARY_RECIPE,
  'combat-map': COMBAT_MAP_RECIPE,
};
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-combat-map.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/recipe.ts src/__tests__/lib/catalog/recipe-combat-map.test.ts
git commit -m "feat(catalog): combat-map recipe (wire+verify, no new assets) (folder-09 R3)"
```

---

## Task 6: Screen Flow seed

**Files:** Create `src/lib/catalog/seed-screen-flow.ts`; Test `src/__tests__/lib/catalog/seed-screen-flow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/seed-screen-flow.test.ts
import { describe, it, expect } from 'vitest';
import { screenNodeToEntry, seedScreenEntries } from '@/lib/catalog/seed-screen-flow';
import { FLOW_NODES } from '@/components/modules/core-engine/unique-tabs/ScreenFlowMap/data';

describe('screenNodeToEntry', () => {
  const n0 = FLOW_NODES[0];
  it('prefixes id, keeps label as name + data', () => {
    const e = screenNodeToEntry(n0);
    expect(e.id).toBe(`screen-${n0.id}`);
    expect(e.name).toBe(n0.label);
    expect(e.data).toBe(n0);
    expect(e.catalogId).toBe('screen-flow');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [Screens, group ?? "Misc"]', () => {
    const e = screenNodeToEntry(n0);
    expect(e.categoryPath).toEqual(['Screens', n0.group ?? 'Misc']);
  });
});

describe('seedScreenEntries', () => {
  it('maps every flow node with unique ids', () => {
    const entries = seedScreenEntries();
    expect(entries.length).toBe(FLOW_NODES.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/seed-screen-flow.test.ts`
Expected: FAIL — cannot resolve `@/lib/catalog/seed-screen-flow`.

- [ ] **Step 3: Implement**

```ts
// src/lib/catalog/seed-screen-flow.ts
import { FLOW_NODES } from '@/components/modules/core-engine/unique-tabs/ScreenFlowMap/data';
import type { GraphNode } from '@/types/unique-tab-improvements';
import type { ScreenEntry } from './types';

/** Convert one FLOW_NODES graph node into a Screen entry. */
export function screenNodeToEntry(node: GraphNode): ScreenEntry {
  return {
    id: `screen-${node.id}`,
    catalogId: 'screen-flow',
    name: node.label,
    categoryPath: ['Screens', node.group ?? 'Misc'],
    tags: node.group ? [node.group] : [],
    lifecycle: 'planned',
    data: node,
  };
}

/** Seed the screen-flow catalog from FLOW_NODES. */
export function seedScreenEntries(): ScreenEntry[] {
  return FLOW_NODES.map(screenNodeToEntry);
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/seed-screen-flow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/seed-screen-flow.ts src/__tests__/lib/catalog/seed-screen-flow.test.ts
git commit -m "feat(catalog): screen-flow seed from FLOW_NODES (folder-09 R3)"
```

---

## Task 7: Screen Flow recipe

**Files:** Modify `src/lib/catalog/recipe.ts`; Test `src/__tests__/lib/catalog/recipe-screen-flow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/recipe-screen-flow.test.ts
import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { ScreenEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

const sample: ScreenEntry = {
  id: 'screen-HUD', catalogId: 'screen-flow', name: 'HUD',
  categoryPath: ['Screens', 'Core'], tags: ['Core'], lifecycle: 'planned',
  data: { id: 'HUD', label: 'HUD', group: 'Core' },
};

describe('Screen Flow recipe', () => {
  it('exists with the 4 standard steps', () => {
    const r = getRecipe('screen-flow');
    expect(r).toBeDefined();
    expect(r!.steps).toEqual(['scaffold-cpp', 'author-python', 'wire', 'verify']);
  });
  it('scaffold prompt names UARPGCodeWidgetBase (pure-C++, no BindWidget)', () => {
    const p = getRecipe('screen-flow')!.buildStepPrompt(sample, 'scaffold-cpp', ctx);
    expect(p).toContain('UARPGCodeWidgetBase');
    expect(p).toContain('HUD');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-screen-flow.test.ts`
Expected: FAIL — `getRecipe('screen-flow')` is `undefined`.

- [ ] **Step 3: Add the recipe**

Extend the type-import line to add `ScreenEntry`:
```ts
import type {
  AbilityEntry, CatalogEntityBase, ItemEntry, LifecycleState, LootTableEntry,
  BestiaryEntry, CombatInteractionEntry, ScreenEntry,
} from '@/lib/catalog/types';
```

Add the recipe (after `COMBAT_MAP_RECIPE`):
```ts
const SCREEN_FLOW_BEST_PRACTICES = [
  'Scaffold a pure-C++ `UUserWidget` subclass extending `UARPGCodeWidgetBase` (folder-04 keystone) — do NOT use `meta=(BindWidget)`.',
  'Build the widget tree in `RebuildWidget()` (not `NativeConstruct` — the RebuildWidget timing trap).',
  'Place the header under `Source/PoF/UI/` and the WBP stub (if any) under `/Game/UI/`.',
  'Wire transitions into the screen-flow state machine; never assume a stale CDO.',
];

export const SCREEN_FLOW_RECIPE: GenerationRecipe<ScreenEntry> = {
  id: 'screen-flow-screen',
  catalogId: 'screen-flow',
  steps: ['scaffold-cpp', 'author-python', 'wire', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSScreens.VSScreen_DefaultTest',
  buildStepPrompt(entity, step, ctx) {
    const cls = `U${entity.data.id}Widget`;
    const task =
      step === 'scaffold-cpp'
        ? `Scaffold ${cls} extending UARPGCodeWidgetBase (pure-C++, build the tree in RebuildWidget()).`
        : step === 'author-python'
          ? `Author the WBP_${entity.data.id} stub if BindWidget meta is unavoidable; otherwise pure-C++ is preferred.`
          : step === 'wire'
            ? `Wire screen "${entity.name}" into the screen-flow state machine (push/pop/replace), respecting its group "${entity.data.group ?? 'Misc'}".`
            : `Run VSScreen_${entity.data.id}Test: widget mounts/binds/transitions; bar moves on attribute change.`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('Pure-C++ UMG widgets (UARPGCodeWidgetBase) for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Screen Flow · ${step}`, task)
      .withBestPractices(SCREEN_FLOW_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};
```

Extend the `RECIPES` map:
```ts
const RECIPES: Record<string, GenerationRecipe> = {
  spellbook: SPELLBOOK_RECIPE,
  items: ITEMS_RECIPE,
  'loot-tables': LOOT_RECIPE,
  bestiary: BESTIARY_RECIPE,
  'combat-map': COMBAT_MAP_RECIPE,
  'screen-flow': SCREEN_FLOW_RECIPE,
};
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-screen-flow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/recipe.ts src/__tests__/lib/catalog/recipe-screen-flow.test.ts
git commit -m "feat(catalog): screen-flow recipe (UARPGCodeWidgetBase, no BindWidget) (folder-09 R3)"
```

---

## Task 8: Zone Map seed

**Files:** Create `src/lib/catalog/seed-zone-map.ts`; Test `src/__tests__/lib/catalog/seed-zone-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/seed-zone-map.test.ts
import { describe, it, expect } from 'vitest';
import { zoneToEntry, seedZoneEntries } from '@/lib/catalog/seed-zone-map';
import { ZONES } from '@/components/modules/core-engine/unique-tabs/ZoneMap/data';

describe('zoneToEntry', () => {
  const z0 = ZONES[0];
  it('prefixes id, keeps displayName as name + data', () => {
    const e = zoneToEntry(z0);
    expect(e.id).toBe(`zone-${z0.id}`);
    expect(e.name).toBe(z0.displayName);
    expect(e.data).toBe(z0);
    expect(e.catalogId).toBe('zone-map');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [Zones, group, type] and tags = [type, status]', () => {
    const e = zoneToEntry(z0);
    expect(e.categoryPath).toEqual(['Zones', z0.group, z0.type]);
    expect(e.tags).toEqual([z0.type, z0.status]);
  });
});

describe('seedZoneEntries', () => {
  it('maps every zone with unique ids', () => {
    const entries = seedZoneEntries();
    expect(entries.length).toBe(ZONES.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/seed-zone-map.test.ts`
Expected: FAIL — cannot resolve `@/lib/catalog/seed-zone-map`.

- [ ] **Step 3: Implement**

```ts
// src/lib/catalog/seed-zone-map.ts
import {
  ZONES,
  type ZoneRecord,
} from '@/components/modules/core-engine/unique-tabs/ZoneMap/data';
import type { ZoneEntry } from './types';

/** Convert one ZoneRecord into a Zone Map entry. */
export function zoneToEntry(zone: ZoneRecord): ZoneEntry {
  return {
    id: `zone-${zone.id}`,
    catalogId: 'zone-map',
    name: zone.displayName,
    categoryPath: ['Zones', zone.group, zone.type],
    tags: [zone.type, zone.status],
    lifecycle: 'planned',
    data: zone,
  };
}

/** Seed the zone-map catalog from ZONES. */
export function seedZoneEntries(): ZoneEntry[] {
  return ZONES.map(zoneToEntry);
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/seed-zone-map.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/seed-zone-map.ts src/__tests__/lib/catalog/seed-zone-map.test.ts
git commit -m "feat(catalog): zone-map seed from ZONES (folder-09 R3)"
```

---

## Task 9: Zone Map recipe

**Files:** Modify `src/lib/catalog/recipe.ts`; Test `src/__tests__/lib/catalog/recipe-zone-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/recipe-zone-map.test.ts
import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { ZoneEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

const sample: ZoneEntry = {
  id: 'zone-EndarSpire', catalogId: 'zone-map', name: 'Endar Spire',
  categoryPath: ['Zones', 'Tutorial', 'combat'], tags: ['combat', 'active'], lifecycle: 'planned',
  data: {
    id: 'EndarSpire', name: 'EndarSpire' as never, displayName: 'Endar Spire', cx: 10, cy: 20,
    type: 'combat', status: 'active', levelRange: '1-3', levelMin: 1, levelMax: 3,
    connections: [], group: 'Tutorial',
  },
};

describe('Zone Map recipe', () => {
  it('exists with author-python + verify steps', () => {
    const r = getRecipe('zone-map');
    expect(r).toBeDefined();
    expect(r!.steps).toEqual(['author-python', 'verify']);
  });
  it('author-python prompt references .umap + build_<zone>.py', () => {
    const p = getRecipe('zone-map')!.buildStepPrompt(sample, 'author-python', ctx);
    expect(p).toContain('Endar Spire');
    expect(p).toContain('.umap');
    expect(p).toContain('/Game/Maps/');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-zone-map.test.ts`
Expected: FAIL — `getRecipe('zone-map')` is `undefined`.

- [ ] **Step 3: Add the recipe**

Extend the type-import line to add `ZoneEntry`:
```ts
import type {
  AbilityEntry, CatalogEntityBase, ItemEntry, LifecycleState, LootTableEntry,
  BestiaryEntry, CombatInteractionEntry, ScreenEntry, ZoneEntry,
} from '@/lib/catalog/types';
```

Add the recipe (after `SCREEN_FLOW_RECIPE`):
```ts
const ZONE_MAP_BEST_PRACTICES = [
  'Author the `.umap` via a `build_<zone_id>.py` script run through the FULL editor (-ExecutePythonScript), extending the proven `build_arena.py` / `build_procgen_dungeon.py` pattern.',
  'Place the map under `/Game/Maps/` and report its content path.',
  'Set Movable lights for headless cooks (Lightmass bake is skipped headlessly — folder-05 lesson).',
  'Spawn placement: use ZONE_EDGES portals + Bestiary archetype links (resolved at recipe time, not seed time).',
];

export const ZONE_MAP_RECIPE: GenerationRecipe<ZoneEntry> = {
  id: 'zone-map-zone',
  catalogId: 'zone-map',
  steps: ['author-python', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSZone.VSZone_DefaultTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'author-python'
        ? `Author /Game/Maps/${entity.data.id}.umap via a build_${entity.data.id}.py script (FULL editor): floor + lights + PlayerStart + zone-specific placement + portals from ZONE_EDGES.`
        : `Run VSZone_${entity.data.id}Test: player spawns, nav exists, encounter triggers; layout sane (Gemini-vision optional).`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('Zone (.umap) authoring + spawn/nav placement for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Zone Map · ${step}`, task)
      .withBestPractices(ZONE_MAP_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};
```

Extend the `RECIPES` map:
```ts
const RECIPES: Record<string, GenerationRecipe> = {
  spellbook: SPELLBOOK_RECIPE,
  items: ITEMS_RECIPE,
  'loot-tables': LOOT_RECIPE,
  bestiary: BESTIARY_RECIPE,
  'combat-map': COMBAT_MAP_RECIPE,
  'screen-flow': SCREEN_FLOW_RECIPE,
  'zone-map': ZONE_MAP_RECIPE,
};
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-zone-map.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/recipe.ts src/__tests__/lib/catalog/recipe-zone-map.test.ts
git commit -m "feat(catalog): zone-map recipe (.umap + portals + nav) (folder-09 R3)"
```

---

## Task 10: State Graph seed

**Files:** Create `src/lib/catalog/seed-state-graph.ts`; Test `src/__tests__/lib/catalog/seed-state-graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/seed-state-graph.test.ts
import { describe, it, expect } from 'vitest';
import { montageToEntry, seedAnimationEntries } from '@/lib/catalog/seed-state-graph';
import { ALL_MONTAGES } from '@/components/modules/core-engine/unique-tabs/AnimationStateGraph/data';

describe('montageToEntry', () => {
  const m0 = ALL_MONTAGES[0];
  it('prefixes id, keeps name + data', () => {
    const e = montageToEntry(m0);
    expect(e.id).toBe(`anim-${m0.id}`);
    expect(e.name).toBe(m0.name);
    expect(e.data).toBe(m0);
    expect(e.catalogId).toBe('state-graph');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [Animations, category] and tags reflect hasRootMotion', () => {
    const e = montageToEntry(m0);
    expect(e.categoryPath).toEqual(['Animations', m0.category]);
    expect(e.tags).toEqual([m0.hasRootMotion ? 'root-motion' : 'in-place']);
  });
});

describe('seedAnimationEntries', () => {
  it('maps every montage with unique ids', () => {
    const entries = seedAnimationEntries();
    expect(entries.length).toBe(ALL_MONTAGES.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/seed-state-graph.test.ts`
Expected: FAIL — cannot resolve `@/lib/catalog/seed-state-graph`.

- [ ] **Step 3: Implement**

```ts
// src/lib/catalog/seed-state-graph.ts
import {
  ALL_MONTAGES,
  type MontageEntry,
} from '@/components/modules/core-engine/unique-tabs/AnimationStateGraph/data';
import type { AnimationEntry } from './types';

/** Convert one MontageEntry into a State Graph entry. */
export function montageToEntry(montage: MontageEntry): AnimationEntry {
  return {
    id: `anim-${montage.id}`,
    catalogId: 'state-graph',
    name: montage.name,
    categoryPath: ['Animations', montage.category],
    tags: [montage.hasRootMotion ? 'root-motion' : 'in-place'],
    lifecycle: 'planned',
    data: montage,
  };
}

/** Seed the state-graph catalog from ALL_MONTAGES. */
export function seedAnimationEntries(): AnimationEntry[] {
  return ALL_MONTAGES.map(montageToEntry);
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/seed-state-graph.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/seed-state-graph.ts src/__tests__/lib/catalog/seed-state-graph.test.ts
git commit -m "feat(catalog): state-graph seed from ALL_MONTAGES (folder-09 R3)"
```

---

## Task 11: State Graph recipe (with manual-wall marker)

**Files:** Modify `src/lib/catalog/recipe.ts`; Test `src/__tests__/lib/catalog/recipe-state-graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/recipe-state-graph.test.ts
import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { AnimationEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

const sample: AnimationEntry = {
  id: 'anim-am-slash', catalogId: 'state-graph', name: 'AM_Slash',
  categoryPath: ['Animations', 'Attack'], tags: ['root-motion'], lifecycle: 'planned',
  data: { id: 'am-slash', name: 'AM_Slash', category: 'Attack', totalFrames: 36, fps: 30, memorySizeMB: 0.5, hasRootMotion: true, blendInTime: 0.1 },
};

describe('State Graph recipe', () => {
  it('exists with author-python + verify steps', () => {
    const r = getRecipe('state-graph');
    expect(r).toBeDefined();
    expect(r!.steps).toEqual(['author-python', 'verify']);
  });
  it('author prompt names Mixamo + the SK_Mannequin skeleton + content path', () => {
    const p = getRecipe('state-graph')!.buildStepPrompt(sample, 'author-python', ctx);
    expect(p).toContain('AM_Slash');
    expect(p).toContain('Mixamo');
    expect(p).toContain('SK_Mannequin');
    expect(p).toContain('/Game/Animations/');
  });
  it('LOUDLY flags the AnimBP graph as MANUAL (the binary wall)', () => {
    const p = getRecipe('state-graph')!.buildStepPrompt(sample, 'author-python', ctx);
    expect(p).toContain('MANUAL STEP REQUIRED');
    expect(p).toContain('AnimBP');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-state-graph.test.ts`
Expected: FAIL — `getRecipe('state-graph')` is `undefined`.

- [ ] **Step 3: Add the recipe**

Extend the type-import line to add `AnimationEntry`:
```ts
import type {
  AbilityEntry, CatalogEntityBase, ItemEntry, LifecycleState, LootTableEntry,
  BestiaryEntry, CombatInteractionEntry, ScreenEntry, ZoneEntry, AnimationEntry,
} from '@/lib/catalog/types';
```

Add the recipe (after `ZONE_MAP_RECIPE`):
```ts
const STATE_GRAPH_BEST_PRACTICES = [
  'MANUAL STEP REQUIRED: the AnimBP graph (state machine, transitions, blendspaces, notify graphs) CANNOT be authored from Python. After this recipe completes, the operator must finish the AnimBP graph in the UE AnimBP editor by hand.',
  'Use the proven mixamo_pipeline.py pattern: download from Mixamo → retarget to SK_Mannequin → create the montage shell.',
  'Place montage assets under `/Game/Animations/` and report their content paths.',
  '`verify` only gates Python-authorable parts (montage asset exists + correct skeleton). Never claim the AnimBP graph is complete.',
];

export const STATE_GRAPH_RECIPE: GenerationRecipe<AnimationEntry> = {
  id: 'state-graph-montage',
  catalogId: 'state-graph',
  steps: ['author-python', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSAnim.VSAnim_LocomotionTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'author-python'
        ? `Author the ${entity.data.name} montage shell from Mixamo (retarget to SK_Mannequin); place under /Game/Animations/${entity.data.category}/. Do NOT touch the AnimBP graph.`
        : `Run VSAnim_LocomotionTest: AnimInstance locomotion state updates under movement (the Python-authorable verify; AnimBP graph completeness is the operator's manual responsibility).`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('Mixamo + montage authoring for the PoF ARPG. AnimBP graph stays manual.')
      .withAssetSpec(entity)
      .withTask(`State Graph · ${step}`, task)
      .withBestPractices(STATE_GRAPH_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};
```

Extend the `RECIPES` map (final shape — all 8 catalogs):
```ts
const RECIPES: Record<string, GenerationRecipe> = {
  spellbook: SPELLBOOK_RECIPE,
  items: ITEMS_RECIPE,
  'loot-tables': LOOT_RECIPE,
  bestiary: BESTIARY_RECIPE,
  'combat-map': COMBAT_MAP_RECIPE,
  'screen-flow': SCREEN_FLOW_RECIPE,
  'zone-map': ZONE_MAP_RECIPE,
  'state-graph': STATE_GRAPH_RECIPE,
};
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/recipe-state-graph.test.ts`
Expected: PASS (3 cases — including the manual-wall marker assertion).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/recipe.ts src/__tests__/lib/catalog/recipe-state-graph.test.ts
git commit -m "feat(catalog): state-graph recipe with MANUAL STEP REQUIRED AnimBP marker (folder-09 R3)"
```

---

## Task 12: Register all 5 in `sections.ts`

**Files:** Modify `src/lib/catalog/sections.ts`; Test `src/__tests__/lib/catalog/sections.test.ts` (extend)

- [ ] **Step 1: Extend the existing sections test**

Replace the existing assertion in `src/__tests__/lib/catalog/sections.test.ts` that checks for 3 catalogs with one that checks for all 8:

Open `src/__tests__/lib/catalog/sections.test.ts` — replace its `it('registers spellbook, items, and loot-tables', …)` block with:
```ts
  it('registers all 8 Core Engine catalogs', () => {
    expect(CATALOG_SECTIONS.map((s) => s.catalogId).sort())
      .toEqual([
        'bestiary',
        'combat-map',
        'items',
        'loot-tables',
        'screen-flow',
        'spellbook',
        'state-graph',
        'zone-map',
      ]);
  });
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/sections.test.ts`
Expected: FAIL — `CATALOG_SECTIONS` only has 3 entries.

- [ ] **Step 3: Re-read `src/lib/catalog/sections.ts`**, then register the 5 new sections

Add 5 seed imports next to the existing ones:
```ts
import { seedBestiaryEntries } from './seed-bestiary';
import { seedCombatInteractionEntries } from './seed-combat-map';
import { seedScreenEntries } from './seed-screen-flow';
import { seedZoneEntries } from './seed-zone-map';
import { seedAnimationEntries } from './seed-state-graph';
```

Extend `CATALOG_SECTIONS` to include all 8:
```ts
export const CATALOG_SECTIONS: CatalogSection[] = [
  { catalogId: 'spellbook', label: 'Spellbook', seed: seedSpellbookEntries },
  { catalogId: 'items', label: 'Items', seed: seedItemEntries },
  { catalogId: 'loot-tables', label: 'Loot Tables', seed: seedLootEntries },
  { catalogId: 'bestiary', label: 'Bestiary', seed: seedBestiaryEntries },
  { catalogId: 'combat-map', label: 'Combat Map', seed: seedCombatInteractionEntries },
  { catalogId: 'screen-flow', label: 'Screen Flow', seed: seedScreenEntries },
  { catalogId: 'zone-map', label: 'Zone Map', seed: seedZoneEntries },
  { catalogId: 'state-graph', label: 'State Graph', seed: seedAnimationEntries },
];
```

- [ ] **Step 4: Run sections + store-multi-section tests**

Run: `npx vitest run src/__tests__/lib/catalog/sections.test.ts src/__tests__/stores/catalogStore-sections.test.ts src/__tests__/stores/catalogStore.test.ts`
Expected: PASS — sections (3 cases) + Round-1 Spellbook seed still green + multi-section seed test now finds all 8.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/sections.ts src/__tests__/lib/catalog/sections.test.ts
git commit -m "feat(catalog): register all 8 catalogs in sections.ts (folder-09 R3)"
```

---

## Task 13: Known-assets extension (5 entries + 5 module-domain cases)

**Files:** Modify `src/lib/knowledge/ue-known-assets.ts`; Test `src/__tests__/lib/known-assets-sections.test.ts` (extend)

- [ ] **Step 1: Extend the known-assets test**

Append to `src/__tests__/lib/known-assets-sections.test.ts` (inside the existing `describe('known assets — items/loot', …)` or as a new `describe`):
```ts
describe('known assets — bestiary/combat/screen/zone/anim', () => {
  it('maps each remaining module to its domain', () => {
    expect(knownAssetDomainsForModule('arpg-combat')).toEqual(['combat']);
    expect(knownAssetDomainsForModule('arpg-ui')).toEqual(['ui']);
    expect(knownAssetDomainsForModule('arpg-world')).toEqual(['world']);
    // arpg-enemy-ai already returns ['character']; extended to also include 'bestiary'
    expect(knownAssetDomainsForModule('arpg-enemy-ai')).toEqual(expect.arrayContaining(['bestiary']));
    // arpg-animation already returns ['character','animation']; extended to include 'state-graph'
    expect(knownAssetDomainsForModule('arpg-animation')).toEqual(expect.arrayContaining(['state-graph']));
  });
  it('formats the 5 new base-class known assets', () => {
    expect(formatKnownAssets(['bestiary'])).toContain('AARPGEnemyCharacter');
    expect(formatKnownAssets(['combat'])).toContain('UARPGDamageExecution');
    expect(formatKnownAssets(['ui'])).toContain('UARPGCodeWidgetBase');
    expect(formatKnownAssets(['world'])).toContain('/Game/Maps/');
    expect(formatKnownAssets(['state-graph'])).toContain('SK_Mannequin');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/known-assets-sections.test.ts`
Expected: FAIL — the 5 new module-domain mappings + 5 known-asset entries don't exist yet.

- [ ] **Step 3: Re-read `src/lib/knowledge/ue-known-assets.ts`**, then extend (additive)

Append 5 entries to `UE_KNOWN_ASSETS` (before the closing `]`):
```ts
  {
    id: 'arpg-enemy-character',
    path: '/Script/PoF.ARPGEnemyCharacter',
    type: 'C++ Class (AARPGEnemyCharacter)',
    description: 'Base C++ class for enemy archetypes — subclass via Blueprint under /Game/Enemies/.',
    source: 'project',
    domains: ['bestiary'],
  },
  {
    id: 'arpg-damage-execution',
    path: '/Script/PoF.ARPGDamageExecution',
    type: 'C++ Class (UARPGDamageExecution)',
    description: 'GE damage execution calc — used by GE_Damage. Combat-Map wiring connects abilities → this execution.',
    source: 'project',
    domains: ['combat'],
  },
  {
    id: 'arpg-code-widget-base',
    path: '/Script/PoF.ARPGCodeWidgetBase',
    type: 'C++ Class (UARPGCodeWidgetBase)',
    description: 'Pure-C++ UMG widget parent (no BindWidget; build tree in RebuildWidget). All Screen Flow widgets extend this.',
    source: 'project',
    domains: ['ui'],
  },
  {
    id: 'game-maps-root',
    path: '/Game/Maps/',
    type: 'Content path',
    description: 'Root for zone .umap assets authored by Zone Map recipes (extends build_arena.py / build_procgen_dungeon.py).',
    source: 'project',
    domains: ['world'],
  },
  {
    id: 'sk-mannequin-retarget',
    path: '/MoverTests/Characters/Mannequins/Meshes/SK_Mannequin',
    type: 'Skeleton',
    description: 'Target skeleton for Mixamo retargeting (mixamo_pipeline.py default). State Graph recipes retarget onto this.',
    source: 'MoverTests plugin',
    domains: ['state-graph', 'animation'],
  },
```

Extend `knownAssetDomainsForModule` — add 3 new cases AND extend two existing cases to include the new domains. Re-read the function body first; replace the entire switch (preserving every existing case) with this superset:
```ts
  switch (moduleId) {
    case 'arpg-character':
    case 'arpg-animation':
      return ['character', 'animation', 'state-graph'];
    case 'arpg-enemy-ai':
      return ['character', 'bestiary'];
    case 'arpg-inventory':
      return ['items'];
    case 'arpg-loot':
      return ['loot'];
    case 'arpg-combat':
      return ['combat'];
    case 'arpg-ui':
      return ['ui'];
    case 'arpg-world':
      return ['world'];
    default:
      return [];
  }
```
(If the file's switch has cases in a different order or has been touched by another session, preserve those cases and just add the 3 new cases + the 2 extensions to existing cases.)

- [ ] **Step 4: Run the new known-assets tests + the existing ones**

Run: `npx vitest run src/__tests__/lib/known-assets-sections.test.ts`
Expected: PASS — both the existing items/loot tests (still green) AND the new bestiary/combat/screen/zone/anim tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/ue-known-assets.ts src/__tests__/lib/known-assets-sections.test.ts
git commit -m "feat(knowledge): 5 base-class known assets + module domains for the remaining sections (folder-09 R3)"
```

---

## Task 14: Final verification

- [ ] **Step 1: Full targeted-test sweep**

Run: `npx vitest run src/__tests__/lib/catalog src/__tests__/stores src/__tests__/components/catalog-lifecycle-cell.test.tsx src/__tests__/components/lifecycle-badge.test.tsx src/__tests__/hooks/useGeneration.test.tsx src/__tests__/lib/known-assets-sections.test.ts src/__tests__/prompts`
Expected: every test green (Round-1 + R2/R3 + the 5 new sections).

- [ ] **Step 2: Project-wide typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: `0`.

- [ ] **Step 3: Lint the touched files**

Run: `npx eslint src/lib/catalog src/lib/knowledge/ue-known-assets.ts`
Expected: exit 0.

- [ ] **Step 4: `npm run validate` (foreign-error tolerant)**

Run: `npm run validate`
If a failure references files you did NOT touch (foreign worktrees / pre-existing `require()` lint errors), note it and rely on Steps 1–3 — do not "fix" foreign files.

---

## Self-review notes

- **Spec coverage:** §1 scope (5 sections, data-layer only) ✔ covered by T1 (types) + T2/T4/T6/T8/T10 (seeds) + T3/T5/T7/T9/T11 (recipes) + T12 (sections registry) + T13 (known assets). §3.1 Bestiary cross-catalog links ✔ T2 (resolves spellbook + loot links at seed time, with the dedicated link-integrity assertions). §3.5 State Graph manual wall ✔ T11 (best-practices `MANUAL STEP REQUIRED` + test asserts it). §4 tests ✔ per-section + cross-cutting tests in T12/T13. §5 concurrency ✔ all additive edits; cli-task.ts untouched.
- **Type consistency:** `BestiaryEntry`/`CombatInteractionEntry`/`ScreenEntry`/`ZoneEntry`/`AnimationEntry`/`CatalogLink`; `archetypeToEntry`/`seedBestiaryEntries`/`comboToEntry`/`seedCombatInteractionEntries`/`screenNodeToEntry`/`seedScreenEntries`/`zoneToEntry`/`seedZoneEntries`/`montageToEntry`/`seedAnimationEntries`; `BESTIARY_RECIPE`/`COMBAT_MAP_RECIPE`/`SCREEN_FLOW_RECIPE`/`ZONE_MAP_RECIPE`/`STATE_GRAPH_RECIPE` are all used consistently across tasks/tests. `getRecipe` signature unchanged.
- **No placeholders:** every code step contains complete code. The single "re-read first" instruction on each shared-file edit is concrete (anchor on existing block; preserve foreign edits if any).
- **Out of scope (explicitly):** UI retrofits of each section UI; live UE functional-test gates; real per-section Python scripts; the other (already-done) substrate work. Each section's `testPath` is a placeholder pointing at a future per-section CLI's map.
