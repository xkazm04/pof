# Catalog Pipeline Expansion — Phase A (Framework + Scaffold) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stand up the catalog program scaffold — register the 21 new catalogs from one DRY driver, extend Live State with a catalog-entity view, and generate the `docs/catalog/` tree (index + template + 30 per-row briefs) — so the per-CLI execution model (Phase B/C) can run.

**Architecture:** A single `NEW_CATALOGS` data table drives `CATALOG_SECTIONS`, `PIPELINE_BY_CATALOG`, and a deduplicated shared `CATALOG_MODULE`. `CatalogSection` gains `category`/`description`. A new `CatalogLiveGrid` groups all catalogs by category in Live State. A committed Node generator reads the parsed spreadsheet (`docs/catalog/_sheet.json`) + the driver and emits the docs tree.

**Tech Stack:** Next.js 16 / React 19, Vitest + Testing Library, a Node ESM docs generator.

**Reference spec:** `docs/superpowers/specs/2026-05-25-pof-catalog-pipeline-expansion-design.md`

**Invariants:** branch-local commits on `feature/entity-centric-workspace`; `@/` imports; `logger` not `console`; no hardcoded hex; co-author every commit with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Each code task ends targeted vitest green + `npx tsc --noEmit` clean (filter `| grep -v AssetInspector`).

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/lib/catalog/new-catalogs.ts` | Create | `NEW_CATALOGS: NewCatalogDef[]` (21) + derive helpers (sections, starters) |
| `src/lib/catalog/catalog-module.ts` | Create | shared `CATALOG_MODULE` + `catalogModule()` (dedups the 2 hook copies; merges `NEW_CATALOGS`) |
| `src/lib/catalog/sections.ts` | Modify | `CatalogSection` gains `category?`/`description?`; add categories to the 11; append `NEW_CATALOGS` sections |
| `src/lib/pipeline/tracks.ts` | Modify | merge `NEW_CATALOGS` track maps into `PIPELINE_BY_CATALOG` |
| `src/hooks/useGeneration.ts`, `src/hooks/useEntityTrackHelp.ts` | Modify | use shared `catalogModule()` instead of private maps |
| `src/components/ecw/live/CatalogLiveGrid.tsx` | Create | per-category catalog/entity live view |
| `src/components/ecw/live/LiveStateTab.tsx` | Modify | mount `CatalogLiveGrid` |
| `src/__tests__/lib/catalog/catalog-coverage.test.ts` | Create | every section has pipeline+module+category; new seeds valid |
| `src/__tests__/components/ecw/live/CatalogLiveGrid.test.tsx` | Create | renders categories incl. new catalogs |
| `docs/catalog/_sheet.json` | Create | parsed spreadsheet (move from repo-root `_catalog_dump.json`) |
| `docs/catalog/_generate.mjs` | Create | docs generator |
| `docs/catalog/index.md`, `_TEMPLATE.md`, `<cat>/<entity>/plan.md` ×30 | Generate | the planning tree |

---

## Task 1: `NEW_CATALOGS` driver + shared module map + registration

**Files:**
- Create: `src/lib/catalog/new-catalogs.ts`, `src/lib/catalog/catalog-module.ts`
- Modify: `src/lib/catalog/sections.ts`, `src/lib/pipeline/tracks.ts`, `src/hooks/useGeneration.ts`, `src/hooks/useEntityTrackHelp.ts`
- Test: `src/__tests__/lib/catalog/catalog-coverage.test.ts`

- [ ] **Step 1: Create the driver** `src/lib/catalog/new-catalogs.ts`

```ts
import type { CatalogEntityBase } from './types';
import type { PipelineTrackId } from '@/lib/pipeline/tracks';
import type { SubModuleId } from '@/types/modules';

interface StarterDef { id: string; name: string; categoryPath: string[]; tags: string[]; description: string }
export interface NewCatalogDef {
  catalogId: string;
  label: string;
  category: string;
  description: string;
  module: SubModuleId;
  tracks: PipelineTrackId[];
  starters: StarterDef[];
}

/** The 21 new catalog entities from game_catalog_pipelines.xlsx. One source of truth:
 *  CATALOG_SECTIONS, PIPELINE_BY_CATALOG and CATALOG_MODULE are all derived from this. */
export const NEW_CATALOGS: NewCatalogDef[] = [
  // ── Quests & Narrative ──
  { catalogId: 'quests', label: 'Quests', category: 'Quests & Narrative', description: 'Structured player objectives with stages, rewards, and narrative beats.', module: 'dialogue-quests', tracks: ['logic', 'audio', 'test'],
    starters: [{ id: 'quest-ember-pact', name: 'The Ember Pact', categoryPath: ['Main'], tags: ['intro'], description: 'A 3-stage introductory fetch-and-choice quest.' }] },
  { catalogId: 'dialog-trees', label: 'Dialog Trees', category: 'Quests & Narrative', description: 'Branching conversations with conditions, effects, and voice.', module: 'dialogue-quests', tracks: ['logic', 'art-2d', 'audio', 'test'],
    starters: [{ id: 'dialog-gatekeeper', name: 'Gatekeeper Greeting', categoryPath: ['NPC'], tags: ['intro'], description: 'A simple gate-NPC conversation with a skill check.' }] },
  { catalogId: 'cutscenes', label: 'Cutscenes', category: 'Quests & Narrative', description: 'Scripted in-engine sequences for story moments.', module: 'dialogue-quests', tracks: ['animation', 'audio', 'vfx', 'test'],
    starters: [{ id: 'cutscene-prologue', name: 'Prologue: The Fall', categoryPath: ['Story'], tags: ['intro'], description: 'The opening in-engine cinematic.' }] },
  { catalogId: 'codex', label: 'Codex', category: 'Quests & Narrative', description: 'In-game encyclopedia entries unlocked by play.', module: 'dialogue-quests', tracks: ['logic', 'art-2d', 'test'],
    starters: [{ id: 'codex-sundering', name: 'The Sundering', categoryPath: ['Lore'], tags: ['history'], description: 'A foundational lore entry on the world\'s cataclysm.' }] },
  { catalogId: 'factions', label: 'Factions', category: 'Quests & Narrative', description: 'Group affiliations with standings, rewards, and consequences.', module: 'dialogue-quests', tracks: ['logic', 'art-2d', 'audio', 'test'],
    starters: [{ id: 'faction-ashen-order', name: 'The Ashen Order', categoryPath: ['Faction'], tags: [], description: 'A militant order with a reputation ladder.' }] },
  // ── Game Assets ──
  { catalogId: 'characters', label: 'Characters', category: 'Game Assets', description: 'Playable or named NPCs with full presentation and behavior.', module: 'arpg-character', tracks: ['logic', 'art-3d', 'animation', 'audio', 'vfx', 'test'],
    starters: [{ id: 'char-captain-vael', name: 'Captain Vael', categoryPath: ['NPC'], tags: ['named'], description: 'A named quest-giver NPC.' }] },
  { catalogId: 'props', label: 'Props', category: 'Game Assets', description: 'Static or interactable world objects.', module: 'models', tracks: ['art-3d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'prop-reinforced-crate', name: 'Reinforced Crate', categoryPath: ['Interactable'], tags: ['destructible'], description: 'A destructible loot container.' }] },
  { catalogId: 'status-effects', label: 'Status Effects', category: 'Game Assets', description: 'Temporary or persistent modifiers applied to an actor.', module: 'arpg-gas', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [
      { id: 'status-burning', name: 'Burning', categoryPath: ['Debuff'], tags: ['fire', 'dot'], description: 'Fire damage-over-time; pairs with Fireball (State.Burning).' },
      { id: 'status-chilled', name: 'Chilled', categoryPath: ['Debuff'], tags: ['ice', 'slow'], description: 'Movement-speed slow from ice damage.' }] },
  // ── Systems ──
  { catalogId: 'crafting-recipes', label: 'Crafting Recipes', category: 'Systems', description: 'Combine inputs into output items with conditions.', module: 'arpg-inventory', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'recipe-health-potion', name: 'Health Potion', categoryPath: ['Alchemy'], tags: ['consumable'], description: 'Combine herb + vial into a healing potion.' }] },
  { catalogId: 'vendors', label: 'Vendors', category: 'Systems', description: 'NPC merchants with inventory, pricing, and restock rules.', module: 'arpg-inventory', tracks: ['logic', 'art-2d', 'audio', 'test'],
    starters: [{ id: 'vendor-wandering-merchant', name: 'Wandering Merchant', categoryPath: ['Shop'], tags: [], description: 'A roaming general-goods vendor.' }] },
  { catalogId: 'progression-curves', label: 'Progression Curves', category: 'Systems', description: 'XP, level, or mastery curves driving advancement.', module: 'arpg-progression', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'curve-hero-level', name: 'Hero Level Curve', categoryPath: ['XP'], tags: [], description: 'The main character XP-to-level curve.' }] },
  { catalogId: 'achievements', label: 'Achievements', category: 'Systems', description: 'Player accomplishments tracked across sessions.', module: 'arpg-progression', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'achievement-first-blood', name: 'First Blood', categoryPath: ['Combat'], tags: [], description: 'Defeat your first enemy.' }] },
  { catalogId: 'save-points', label: 'Save / Checkpoint', category: 'Systems', description: 'Persistence points capturing player and world state.', module: 'arpg-save', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'save-bonfire', name: 'Bonfire Checkpoint', categoryPath: ['Checkpoint'], tags: [], description: 'An interact-to-save world checkpoint.' }] },
  // ── Audio & FX ──
  { catalogId: 'music', label: 'Music', category: 'Audio & FX', description: 'Adaptive or linear music assets.', module: 'audio', tracks: ['audio', 'test'],
    starters: [{ id: 'music-combat-a', name: 'Combat Theme A', categoryPath: ['Combat'], tags: ['adaptive'], description: 'An adaptive combat music track with stems.' }] },
  { catalogId: 'ambient', label: 'Ambient', category: 'Audio & FX', description: 'Layered environmental audio for a zone or scene.', module: 'audio', tracks: ['audio', 'test'],
    starters: [{ id: 'ambient-forest-day', name: 'Forest Day', categoryPath: ['Outdoor'], tags: [], description: 'A daytime forest soundscape (bed + one-shots).' }] },
  { catalogId: 'vfx', label: 'VFX Assets', category: 'Audio & FX', description: 'Reusable particle/Niagara effects.', module: 'arpg-polish', tracks: ['vfx', 'art-3d', 'audio', 'test'],
    starters: [{ id: 'vfx-fire-impact', name: 'Fire Impact Burst', categoryPath: ['Impact'], tags: ['fire'], description: 'An impact burst; pairs with Fireball.' }] },
  // ── UI ──
  { catalogId: 'hud-elements', label: 'HUD Elements', category: 'UI', description: 'Persistent in-game UI widgets.', module: 'ui-hud', tracks: ['logic', 'art-2d', 'animation', 'vfx', 'audio', 'test'],
    starters: [{ id: 'hud-health-bar', name: 'Health Bar', categoryPath: ['Vitals'], tags: [], description: 'The player health bar widget.' }] },
  { catalogId: 'icon-sets', label: 'Icon Sets', category: 'UI', description: 'Coherent icon families (items, abilities, statuses).', module: 'ui-hud', tracks: ['art-2d', 'test'],
    starters: [{ id: 'iconset-abilities', name: 'Ability Icons', categoryPath: ['Abilities'], tags: [], description: 'A coherent ability-icon family.' }] },
  // ── Input & Platform ──
  { catalogId: 'input-schemes', label: 'Input Schemes', category: 'Input & Platform', description: 'Bindings and feel for one input device family.', module: 'input-handling', tracks: ['logic', 'art-2d', 'test'],
    starters: [{ id: 'input-gamepad', name: 'Gamepad Default', categoryPath: ['Gamepad'], tags: [], description: 'The default gamepad binding scheme.' }] },
  // ── Onboarding ──
  { catalogId: 'tutorial-beats', label: 'Tutorial Beats', category: 'Onboarding', description: 'Single scripted teaching moments.', module: 'arpg-ui', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'tutorial-dodge', name: 'Learn to Dodge', categoryPath: ['Combat'], tags: [], description: 'Teach the dodge input in a sandbox.' }] },
  // ── Economy / Meta ──
  { catalogId: 'currencies', label: 'Currencies', category: 'Economy / Meta', description: 'Spendable resource types in the economy.', module: 'arpg-inventory', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'currency-gold', name: 'Gold', categoryPath: ['Standard'], tags: [], description: 'The primary soft currency.' }] },
];

/** Materialize a new catalog's starters into CatalogEntityBase[] (planned, minimal data). */
export function newCatalogStarters(def: NewCatalogDef): CatalogEntityBase[] {
  return def.starters.map((s) => ({
    id: s.id, catalogId: def.catalogId, name: s.name, categoryPath: s.categoryPath, tags: s.tags,
    lifecycle: 'planned' as const, data: { description: s.description },
  }));
}
```

- [ ] **Step 2: Create the shared module map** `src/lib/catalog/catalog-module.ts`

```ts
import type { SubModuleId } from '@/types/modules';
import { NEW_CATALOGS } from './new-catalogs';

/** Catalog id → owning PoF module (session labelling + analytics). Single source of
 *  truth (was duplicated in useGeneration + useEntityTrackHelp). */
export const CATALOG_MODULE: Record<string, SubModuleId> = {
  spellbook: 'arpg-gas',
  items: 'arpg-inventory',
  'loot-tables': 'arpg-loot',
  bestiary: 'arpg-enemy-ai',
  'combat-map': 'arpg-combat',
  'screen-flow': 'arpg-ui',
  'zone-map': 'arpg-world',
  'state-graph': 'arpg-animation',
  materials: 'materials',
  audio: 'audio',
  'animation-assets': 'arpg-animation',
  ...Object.fromEntries(NEW_CATALOGS.map((c) => [c.catalogId, c.module])),
};

/** Owning module for a catalog; falls back to arpg-gas for unknown ids. */
export function catalogModule(catalogId: string): SubModuleId {
  return CATALOG_MODULE[catalogId] ?? 'arpg-gas';
}
```

- [ ] **Step 3: Write the failing coverage test** `src/__tests__/lib/catalog/catalog-coverage.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { PIPELINE_BY_CATALOG } from '@/lib/pipeline/tracks';
import { CATALOG_MODULE } from '@/lib/catalog/catalog-module';
import { NEW_CATALOGS, newCatalogStarters } from '@/lib/catalog/new-catalogs';

describe('catalog program coverage', () => {
  it('registers the 21 new catalogs as sections (32 total)', () => {
    const ids = new Set(CATALOG_SECTIONS.map((s) => s.catalogId));
    for (const c of NEW_CATALOGS) expect(ids.has(c.catalogId)).toBe(true);
    expect(CATALOG_SECTIONS.length).toBe(11 + NEW_CATALOGS.length);
  });

  it('every section has a category, a pipeline, and a module', () => {
    for (const s of CATALOG_SECTIONS) {
      expect(s.category, `${s.catalogId} category`).toBeTruthy();
      expect(PIPELINE_BY_CATALOG[s.catalogId], `${s.catalogId} pipeline`).toBeTruthy();
      expect(CATALOG_MODULE[s.catalogId], `${s.catalogId} module`).toBeTruthy();
    }
  });

  it('every new catalog seeds ≥1 well-formed starter', () => {
    for (const c of NEW_CATALOGS) {
      const starters = newCatalogStarters(c);
      expect(starters.length).toBeGreaterThan(0);
      for (const e of starters) {
        expect(e.id).toBeTruthy();
        expect(e.catalogId).toBe(c.catalogId);
        expect(e.name).toBeTruthy();
        expect(e.lifecycle).toBe('planned');
      }
    }
  });
});
```

- [ ] **Step 4: Run it — expect FAIL** (`category` missing on sections, new ids absent).

Run: `npx vitest run src/__tests__/lib/catalog/catalog-coverage.test.ts`

- [ ] **Step 5: Extend `CatalogSection` + register new sections + categories** in `src/lib/catalog/sections.ts`

Add import near the top: `import { NEW_CATALOGS, newCatalogStarters } from './new-catalogs';`

Change the interface:
```ts
export interface CatalogSection {
  catalogId: string;
  label: string;
  /** Spreadsheet category for grouping (Live State, hub). */
  category?: string;
  /** One-line description of the entity type. */
  description?: string;
  seed: () => CatalogEntityBase[];
}
```

Replace the `CATALOG_SECTIONS` array with categorized existing rows + the derived new rows:
```ts
export const CATALOG_SECTIONS: CatalogSection[] = [
  { catalogId: 'spellbook', label: 'Spellbook', category: 'Game Assets', description: 'Active/passive abilities used by characters and enemies.', seed: seedSpellbookEntries },
  { catalogId: 'items', label: 'Items', category: 'Core / Existing', description: 'Equippable, consumable, or quest items.', seed: seedItemEntries },
  { catalogId: 'loot-tables', label: 'Loot Tables', category: 'Core / Existing', description: 'Drop distributions for enemies, containers, quests, vendors.', seed: seedLootEntries },
  { catalogId: 'bestiary', label: 'Bestiary', category: 'Core / Existing', description: 'Creature/NPC archetypes with stats, AI, and presentation.', seed: seedBestiaryEntries },
  { catalogId: 'combat-map', label: 'Combat Map', category: 'Core / Existing', description: 'Tactical encounter arenas with rules and spawn logic.', seed: seedCombatInteractionEntries },
  { catalogId: 'screen-flow', label: 'Screen Flow', category: 'Core / Existing', description: 'UI navigation graph between screens/menus.', seed: seedScreenEntries },
  { catalogId: 'zone-map', label: 'Zone Map', category: 'Core / Existing', description: 'Explorable regions with POIs, navigation, ambient systems.', seed: seedZoneEntries },
  { catalogId: 'state-graph', label: 'State Graph', category: 'Core / Existing', description: 'Generic finite state machines used across systems.', seed: seedAnimationEntries },
  { catalogId: 'materials', label: 'Materials', category: 'Core / Existing', description: 'Shader/material definitions with parameters and variants.', seed: seedMaterialEntries },
  { catalogId: 'audio', label: 'Audio', category: 'Audio & FX', description: 'SFX sets imported into UE.', seed: seedAudioEntries },
  { catalogId: 'animation-assets', label: 'Animation Assets', category: 'Core / Existing', description: 'Imported/retargeted animation assets.', seed: seedAnimationAssetEntries },
  ...NEW_CATALOGS.map((c) => ({
    catalogId: c.catalogId, label: c.label, category: c.category, description: c.description,
    seed: () => newCatalogStarters(c),
  })),
];
```

- [ ] **Step 6: Merge new tracks into `PIPELINE_BY_CATALOG`** in `src/lib/pipeline/tracks.ts`

Add import after the type declarations (top of file is type-only, so this value import is safe — `new-catalogs` imports `PipelineTrackId` as a type only):
```ts
import { NEW_CATALOGS } from '@/lib/catalog/new-catalogs';
```
Change the `PIPELINE_BY_CATALOG` declaration to spread the new entries:
```ts
export const PIPELINE_BY_CATALOG: Record<string, PipelineTrackId[]> = {
  spellbook: ['logic', 'art-2d', 'animation', 'vfx', 'audio', 'test'],
  items: ['logic', 'art-2d', 'art-3d', 'test'],
  'loot-tables': ['logic', 'test'],
  bestiary: ['logic', 'ai', 'art-3d', 'animation', 'audio', 'test'],
  'combat-map': ['logic', 'animation', 'test'],
  'screen-flow': ['logic', 'art-2d', 'test'],
  'zone-map': ['logic', 'art-3d', 'test'],
  'state-graph': ['animation', 'test'],
  materials: ['art-3d', 'test'],
  audio: ['audio', 'test'],
  'animation-assets': ['animation', 'test'],
  ...Object.fromEntries(NEW_CATALOGS.map((c) => [c.catalogId, c.tracks])),
};
```

- [ ] **Step 7: Dedup the module map in both hooks**

In `src/hooks/useGeneration.ts`: delete the private `const CATALOG_MODULE = {...}` block (lines ~19-29) and its usage `CATALOG_MODULE[entity.catalogId] ?? 'arpg-gas'` → import + use `catalogModule`. Add `import { catalogModule } from '@/lib/catalog/catalog-module';` and change the moduleId line to `const moduleId = catalogModule(entity.catalogId);`.

In `src/hooks/useEntityTrackHelp.ts`: same — delete its private `CATALOG_MODULE` block, add `import { catalogModule } from '@/lib/catalog/catalog-module';`, replace the lookup with `catalogModule(entity.catalogId)`. (Re-read the file first to match its exact lookup expression.)

- [ ] **Step 8: Run the coverage test — expect PASS**

Run: `npx vitest run src/__tests__/lib/catalog/catalog-coverage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head`
Expected: no output. (Watch for an unexpected import cycle between `pipeline/tracks` and `catalog/new-catalogs`; the back-import is type-only so it should be clean.)

- [ ] **Step 10: Commit**

```bash
git add src/lib/catalog/new-catalogs.ts src/lib/catalog/catalog-module.ts src/lib/catalog/sections.ts src/lib/pipeline/tracks.ts src/hooks/useGeneration.ts src/hooks/useEntityTrackHelp.ts src/__tests__/lib/catalog/catalog-coverage.test.ts
git commit -m "$(cat <<'EOF'
feat(catalog): register 21 new catalogs from a single NEW_CATALOGS driver (Phase A.1)

NEW_CATALOGS drives CATALOG_SECTIONS, PIPELINE_BY_CATALOG, and a deduplicated shared
CATALOG_MODULE (was copied in two hooks). CatalogSection gains category/description.
Coverage test guards that every catalog has pipeline + module + category.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Live State catalog-entity view

**Files:**
- Create: `src/components/ecw/live/CatalogLiveGrid.tsx`
- Modify: `src/components/ecw/live/LiveStateTab.tsx`
- Test: `src/__tests__/components/ecw/live/CatalogLiveGrid.test.tsx`

- [ ] **Step 1: Write the failing test** `src/__tests__/components/ecw/live/CatalogLiveGrid.test.tsx`

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CatalogLiveGrid } from '@/components/ecw/live/CatalogLiveGrid';
import { useCatalogStore } from '@/stores/catalogStore';

describe('CatalogLiveGrid', () => {
  afterEach(cleanup);

  it('groups catalogs by category and shows the new catalogs', () => {
    render(<CatalogLiveGrid />);
    // category headings from the spreadsheet
    expect(screen.getByRole('heading', { name: 'Quests & Narrative' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Economy / Meta' })).toBeTruthy();
    // a new catalog label is present
    expect(screen.getAllByText('Currencies').length).toBeGreaterThan(0);
  });

  it('reflects an entity lifecycle from the store', () => {
    useCatalogStore.setState((s) => ({
      entitiesByCatalog: {
        ...s.entitiesByCatalog,
        currencies: { 'currency-gold': { id: 'currency-gold', catalogId: 'currencies', name: 'Gold', categoryPath: [], tags: [], lifecycle: 'verified' } },
      },
    }));
    render(<CatalogLiveGrid />);
    expect(screen.getAllByText('Gold').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (module missing).

Run: `npx vitest run src/__tests__/components/ecw/live/CatalogLiveGrid.test.tsx`

- [ ] **Step 3: Implement `CatalogLiveGrid`**

```tsx
'use client';

import { useMemo } from 'react';
import { CATALOG_SECTIONS, type CatalogSection } from '@/lib/catalog/sections';
import { useCatalogStore } from '@/stores/catalogStore';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { LifecycleState } from '@/lib/catalog/types';

const LIFECYCLE_COLOR: Record<LifecycleState, string> = {
  planned: STATUS_NEUTRAL, scaffolded: STATUS_NEUTRAL, generated: STATUS_NEUTRAL,
  wired: STATUS_NEUTRAL, verified: STATUS_SUCCESS, failed: STATUS_ERROR,
};

function groupByCategory(sections: CatalogSection[]): [string, CatalogSection[]][] {
  const map = new Map<string, CatalogSection[]>();
  for (const s of sections) {
    const cat = s.category ?? 'Other';
    (map.get(cat) ?? map.set(cat, []).get(cat)!).push(s);
  }
  return [...map.entries()];
}

/** Live State catalog view: every catalog grouped by category, with per-entity
 *  lifecycle/test/asset status (what is actually progressing toward in-engine). */
export function CatalogLiveGrid() {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const groups = useMemo(() => groupByCategory(CATALOG_SECTIONS), []);

  return (
    <div className="space-y-6 max-w-5xl">
      {groups.map(([category, sections]) => (
        <section key={category}>
          <h2 className="text-sm font-semibold text-text mb-2">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sections.map((s) => {
              const entities = Object.values(entitiesByCatalog[s.catalogId] ?? {});
              const verified = entities.filter((e) => e.lifecycle === 'verified').length;
              return (
                <div key={s.catalogId} className="rounded-lg border border-border/40 bg-surface-deep p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text">{s.label}</span>
                    <span className="text-2xs text-text-muted">{verified}/{entities.length} verified</span>
                  </div>
                  {entities.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {entities.slice(0, 6).map((e) => (
                        <li key={e.id} className="flex items-center gap-2 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: LIFECYCLE_COLOR[e.lifecycle] }} />
                          <span className="text-text truncate">{e.name}</span>
                          <span className="text-text-muted ml-auto">{e.lastTestResult ?? e.lifecycle}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
```

(If `STATUS_NEUTRAL` is not exported from chart-colors, re-read `@/lib/chart-colors` and use the nearest neutral token, e.g. `STATUS_STALE`.)

- [ ] **Step 4: Mount it in `LiveStateTab.tsx`** — add `import { CatalogLiveGrid } from './CatalogLiveGrid';` and insert a section before the placeholder cards:

```tsx
      <div className="mb-6">
        <CatalogLiveGrid />
      </div>

      <div className="max-w-5xl">
        <LiveStatePlaceholderCards />
      </div>
```

- [ ] **Step 5: Run the test — expect PASS**

Run: `npx vitest run src/__tests__/components/ecw/live/CatalogLiveGrid.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS" | head` → no output.
Run: `npx eslint src/components/ecw/live/CatalogLiveGrid.tsx src/components/ecw/live/LiveStateTab.tsx` → clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/ecw/live/CatalogLiveGrid.tsx src/components/ecw/live/LiveStateTab.tsx src/__tests__/components/ecw/live/CatalogLiveGrid.test.tsx
git commit -m "$(cat <<'EOF'
feat(ecw): Live State catalog-entity grid grouped by category (Phase A.2)

LiveStateTab now lists every catalog (incl. the 21 new) grouped by spreadsheet
category, with per-entity lifecycle/test status. Bridge + manifest cards unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `docs/catalog/` tree (index + template + 30 briefs)

**Files:**
- Create: `docs/catalog/_sheet.json` (move the parsed dump), `docs/catalog/_generate.mjs`, `docs/catalog/index.md`, `docs/catalog/_TEMPLATE.md`, and 30 `docs/catalog/<cat>/<entity>/plan.md`.

- [ ] **Step 1: Move the parsed spreadsheet into the docs as the source data**

Run: `mv C:/Users/kazda/kiro/pof/_catalog_dump.json C:/Users/kazda/kiro/pof/docs/catalog/_sheet.json` (create `docs/catalog/` first).

- [ ] **Step 2: Write `docs/catalog/_TEMPLATE.md`** — the per-row template (placeholders in `<…>`):

```markdown
# <Entity> — Catalog Pipeline Brief

**Category:** <Category> · **Catalog:** `<catalogId>` (<new|existing>) · **Owning module:** `<module>`
**Description:** <description>

> Read `../../index.md` first — it carries the shared execution contract, agent roles, test-gate definition, and the PoF-systems map. This brief is the entity-specific layer.

## Target asset (build this one end-to-end)
**<Target Asset Name>** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
<ordered checklist of the row's steps; each: `- [ ] N. <Step>` — _agent role · reuse-or-⚠️gap_>

## PoF integration
- **Pipeline tracks:** `<tracks>`
- **Data schema:** design during the schema step; persist via the catalog `data` field.
- **Reuse:** <existing PoF capabilities to reuse> · **Gaps:** <known missing capabilities>

## Cross-catalog dependencies
<explicit links to other catalog rows this entity consumes/produces>

## Session Findings
_Fill this in at the end of the session._
### Cross-catalog opportunities
-
### Gaps / blockers for future sessions
-
```

- [ ] **Step 3: Write the generator `docs/catalog/_generate.mjs`**

It reads `_sheet.json`, maps each row to `<catSlug>/<entSlug>/plan.md`, and writes `index.md`. Full script:

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const sheet = JSON.parse(readFileSync(join(ROOT, '_sheet.json'), 'utf-8'));
const rows = sheet['Catalog Pipelines'].slice(1); // drop header

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// entity name → { catalogId, status }
const CATALOG = {
  'Item': ['items', 'existing'], 'Loot Table': ['loot-tables', 'existing'], 'Bestiary Entry': ['bestiary', 'existing'],
  'Combat Map': ['combat-map', 'existing'], 'Zone Map': ['zone-map', 'existing'], 'Screen Flow': ['screen-flow', 'existing'],
  'State Graph': ['state-graph', 'existing'], 'Material': ['materials', 'existing'],
  'Quest': ['quests', 'new'], 'Dialog Tree': ['dialog-trees', 'new'], 'Cutscene / Cinematic': ['cutscenes', 'new'],
  'Codex / Lore Entry': ['codex', 'new'], 'Faction / Reputation System': ['factions', 'new'],
  'Character (Hero / NPC)': ['characters', 'new'], 'Prop / Environment Asset': ['props', 'new'],
  'Skill / Ability': ['spellbook', 'existing'], 'Status Effect / Buff': ['status-effects', 'new'],
  'Crafting Recipe': ['crafting-recipes', 'new'], 'Vendor / Shop': ['vendors', 'new'],
  'Progression Curve': ['progression-curves', 'new'], 'Achievement / Trophy': ['achievements', 'new'],
  'Save / Checkpoint': ['save-points', 'new'], 'Music Track / Stinger': ['music', 'new'],
  'Ambient Soundscape': ['ambient', 'new'], 'VFX Asset': ['vfx', 'new'], 'HUD Element': ['hud-elements', 'new'],
  'Icon Set': ['icon-sets', 'new'], 'Input Scheme': ['input-schemes', 'new'], 'Tutorial Beat': ['tutorial-beats', 'new'],
  'Currency': ['currencies', 'new'],
};
const TARGET = { // first named asset per row (matches NEW_CATALOGS starters where applicable)
  'Skill / Ability': 'Fireball', 'Item': 'Iron Longsword', 'Loot Table': 'Brute Drop Table', 'Bestiary Entry': 'Brute',
  'Combat Map': 'Arena Slice', 'Zone Map': 'Ashen Forest', 'Screen Flow': 'Main Menu Flow', 'State Graph': 'Door FSM',
  'Material': 'Weathered Stone', 'Quest': 'The Ember Pact', 'Dialog Tree': 'Gatekeeper Greeting',
  'Cutscene / Cinematic': 'Prologue: The Fall', 'Codex / Lore Entry': 'The Sundering', 'Faction / Reputation System': 'The Ashen Order',
  'Character (Hero / NPC)': 'Captain Vael', 'Prop / Environment Asset': 'Reinforced Crate', 'Status Effect / Buff': 'Burning',
  'Crafting Recipe': 'Health Potion', 'Vendor / Shop': 'Wandering Merchant', 'Progression Curve': 'Hero Level Curve',
  'Achievement / Trophy': 'First Blood', 'Save / Checkpoint': 'Bonfire Checkpoint', 'Music Track / Stinger': 'Combat Theme A',
  'Ambient Soundscape': 'Forest Day', 'VFX Asset': 'Fire Impact Burst', 'HUD Element': 'Health Bar', 'Icon Set': 'Ability Icons',
  'Input Scheme': 'Gamepad Default', 'Tutorial Beat': 'Learn to Dodge', 'Currency': 'Gold',
};

const indexRows = [];
for (const r of rows) {
  const [category, entity, description, ...steps] = r;
  const cleanSteps = steps.filter(Boolean);
  const [catalogId, status] = CATALOG[entity] ?? [slug(entity), 'new'];
  const catSlug = slug(category), entSlug = slug(entity);
  const rel = `${catSlug}/${entSlug}/plan.md`;
  const stepList = cleanSteps.map((s, i) => `- [ ] ${i + 1}. ${s}  \n  _agent: TBD-by-session · reuse/gap: TBD-by-session_`).join('\n');
  const body = `# ${entity} — Catalog Pipeline Brief

**Category:** ${category} · **Catalog:** \`${catalogId}\` (${status}) · **Description:** ${description}

> Read \`../../index.md\` first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**${TARGET[entity] ?? entity}** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
${stepList}

## PoF integration
- **Catalog:** \`${catalogId}\` (${status === 'existing' ? 'already registered' : 'registered Phase A'}).
- **Data schema:** design during the schema step; persist via the catalog \`data\` field.
- **Reuse / gaps:** assess against existing PoF capabilities (catalogs, recipes, dispatches, Leonardo-2D, Blender, audio-import, GAS B3 codegen, functional tests) — record in Session Findings.

## Cross-catalog dependencies
- _Identify during design (e.g. consumers/producers of other catalog rows)._

## Session Findings
_Fill this in at the end of the session._
### Cross-catalog opportunities
-
### Gaps / blockers for future sessions
-
`;
  const outPath = join(ROOT, catSlug, entSlug, 'plan.md');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, body, 'utf-8');
  indexRows.push(`| ${category} | [${entity}](${rel}) | \`${catalogId}\` | ${status} |`);
}

console.log(`generated ${rows.length} plan.md files`);
writeFileSync(join(ROOT, '_index_rows.md'), indexRows.join('\n'), 'utf-8');
```

- [ ] **Step 4: Run the generator**

Run: `node docs/catalog/_generate.mjs`
Expected: `generated 30 plan.md files`, and `docs/catalog/_index_rows.md` written.

- [ ] **Step 5: Write `docs/catalog/index.md`** — the shared philosophy + contract + agent roles + test-gate def + PoF-systems map, then paste the table header + the generated `_index_rows.md` content, then the two living logs. (Full content authored in this step; the 30-row table body comes from `_index_rows.md`, after which delete `_index_rows.md`.)

Header/sections to include verbatim: Vision; Execution contract (one CLI per row, highest effort, design well → one asset start→end → document cross-catalog + gaps); Common pipeline shape; Agent roles (Designer · Writer · Concept2D · 3DGen · Rigger · Animator · VFX · Audio · Balancer · QA · Packager); Test-gate definition; PoF-systems map (catalogs/sections, lifecycle, recipes/dispatches, Leonardo-2D/Blender/audio-import/GAS-B3, pipeline tracks, Live State); the **Catalog Index** table (`| Category | Entity | Catalog | Status |` + rows); a **Cross-Catalog Opportunities** log (append-only); a **Gaps / Blockers Register** (append-only).

- [ ] **Step 6: Delete the scratch index-rows file**

Run: `rm docs/catalog/_index_rows.md`

- [ ] **Step 7: Verify the tree**

Run: `find docs/catalog -name plan.md | wc -l` → `30`. Spot-check `docs/catalog/game-assets/skill-ability/plan.md` exists (the Phase B target).

- [ ] **Step 8: Commit**

```bash
git add docs/catalog
git commit -m "$(cat <<'EOF'
docs(catalog): generate the catalog pipeline tree — index + 30 per-row briefs (Phase A.3)

docs/catalog/index.md (shared contract, agent roles, test-gate, PoF map, 30-row index +
living cross-catalog/gaps logs), _TEMPLATE.md, _sheet.json (parsed spreadsheet),
_generate.mjs (regenerable), and 30 <category>/<entity>/plan.md briefs carrying each
row's real pipeline steps.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Full relevant suite + project typecheck**

Run: `npx vitest run src/__tests__/lib/catalog src/__tests__/components/ecw/live` → green.
Run: `npx tsc --noEmit 2>&1 | grep -iE "error TS" | grep -v AssetInspector | wc -l` → `0`.

- [ ] **Confirm app tree clean of scratch files**

Run: `git status --short` — no stray `_catalog_dump.json` / `_index_rows.md` (moved/removed).

- [ ] **Checkpoint:** Phase A complete — the 21 new catalogs are registered + visible in Live State + Catalogs hub, and the `docs/catalog/` tree is the per-CLI assignment plan. Next: **Phase B** (lead Skill/Ability → Fireball end-to-end), its own plan.

---

## Self-Review Notes (resolved during planning)

- **Spec coverage:** Task 1 = the 21-catalog registration + the DRY driver + CatalogSection category/description; Task 2 = the Live State entity view; Task 3 = the docs tree (index + template + 30 briefs). Phase B/C are out of this plan (separate). Mission Control untouched.
- **Placeholder scan:** the `TBD-by-session` strings in generated briefs are intentional (the executing CLI fills agent/reuse per step); not plan placeholders.
- **DRY/dedup:** `CATALOG_MODULE` was duplicated across two hooks (explored); Task 1 consolidates it into `catalog-module.ts` driven by `NEW_CATALOGS` — a targeted improvement to code being touched.
- **Import-cycle risk:** `pipeline/tracks.ts` imports `NEW_CATALOGS` (value); `new-catalogs.ts` imports `PipelineTrackId` (type-only) — type imports erase, so no runtime cycle. Step 9 explicitly checks tsc.
- **Type consistency:** `NewCatalogDef.tracks: PipelineTrackId[]` and `.module: SubModuleId` match the maps they feed; `newCatalogStarters` returns `CatalogEntityBase[]` (lifecycle `'planned'`), matching `CatalogSection.seed`'s return type; all 21 `module` values are members of the `SUB_MODULE_IDS` union.
```
