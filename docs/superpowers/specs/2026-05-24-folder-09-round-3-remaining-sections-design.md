# Folder 09 · Round 3 — Remaining Sections (Bestiary, Combat Map, Screen Flow, Zone Map, State Graph) Design

**Date:** 2026-05-24 · **Status:** Approved (scope), pending spec review → plan.
**Builds on:** R1 (engine, live UE proof) + R2/R3 partial (substrate, Items, Loot).
**Roadmap:** [`docs/improvements/09-core-engine-generator/`](../../improvements/09-core-engine-generator/) — Round 3 sections.

## 1. Scope

Register the **five remaining Core Engine sections** as catalog data-layer entries
on the substrate proven by R2/R3:

| Section | Module | Seed source | Notes |
|---|---|---|---|
| **Bestiary** | `arpg-enemy-ai` | `ARCHETYPES: ArchetypeConfig[]` | Composer — cross-catalog links to Abilities + Loot |
| **Combat Map** | `arpg-combat` | `COMBO_SEQUENCES: ComboSequence[]` | Interactions (attacker→ability→reaction) — wiring-heavy |
| **Screen Flow** | `arpg-ui` | `FLOW_NODES: GraphNode[]` (+ `FLOW_EDGES`) | Pure-C++ widgets via `UARPGCodeWidgetBase` |
| **Zone Map** | `arpg-world` | `ZONES: ZoneRecord[]` (+ `ZONE_EDGES`) | `.umap` build + spawns + nav |
| **State Graph** | `arpg-animation` | `ALL_MONTAGES: MontageEntry[]` | Mixamo+montages; **AnimBP graph = manual binary wall** |

Each section is a **data layer only**: entity type + seed converter + recipe +
`sections.ts` registry entry + tests. **No UI retrofits** (each section UI is
owned by another active CLI per the roadmap's "R3 = up-to-7 parallel CLIs";
retrofits are each owner's job). **No live UE gates** (deferred to per-section
CLIs; recipes carry placeholder `testPath`s).

**Operator decision locked (D1):** one consolidated plan covering all 5 sections
as data-layer-only. UI retrofits + live UE per parallel per-section CLIs.

## 2. Architecture (uniform pattern per section)

Each section adds these files (mirroring Items/Loot):
- `src/lib/catalog/types.ts` — additive `<Section>Entry extends CatalogEntityBase`
  with a typed `data: <SourceShape>`; first edit also introduces a shared
  `CatalogLink { catalogId; entityId; role }` type + optional `links?: CatalogLink[]`
  on `CatalogEntityBase` (used by Bestiary).
- `src/lib/catalog/seed-<section>.ts` — `<entity>To<Entry>` + `seed<Section>Entries()`
  mapping the canonical static array to entries. Bestiary additionally resolves
  cross-catalog links (see §3).
- `src/lib/catalog/recipe.ts` — additive `<SECTION>_RECIPE: GenerationRecipe<<Section>Entry>`
  with section-appropriate `steps` + best-practices + placeholder `testPath`;
  `RECIPES` map gains one entry per section.
- `src/lib/catalog/sections.ts` — `CATALOG_SECTIONS` array gains one entry per
  section (`{catalogId, label, seed}`).
- `src/lib/knowledge/ue-known-assets.ts` — additive `KnownAsset` entries for the
  section's generated-asset base classes (`UARPGEnemyCharacter`, `UARPGCodeWidgetBase`,
  level paths, montage paths) + matching `knownAssetDomainsForModule` cases.
- Tests under `src/__tests__/lib/catalog/` — per-section seed test + recipe test;
  Bestiary additionally has a cross-catalog link-integrity test (tests.md #2).

## 3. Per-section data + recipe details

### 3.1 Bestiary (`arpg-enemy-ai`)
- `BestiaryEntry.data: ArchetypeConfig` (from `EnemyBestiary/data.ts`).
- `categoryPath = ['Bestiary', archetype.tier, archetype.role]`; `tags = [archetype.class, archetype.category]`.
- **Cross-catalog links** (seed-time resolution): for each archetype, derive
  `links: CatalogLink[]` from
  - `archetype.abilities: string[]` (ability *names*) → look up `seedSpellbookEntries()` by name → `{catalogId:'spellbook', entityId, role:'ability'}`;
  - `DEFAULT_ENEMY_LOOT_BINDINGS.find(b => b.archetypeId === archetype.id)` → `{catalogId:'loot-tables', entityId:'lt-'+archetype.id, role:'loot'}`.
  Unmatched names skipped (no fabricated entries). This makes Bestiary the
  visible *composer* the roadmap calls for.
- **Recipe** `BESTIARY_RECIPE`: steps `['author-python', 'wire', 'verify']`. Author
  `BP_*Enemy` Blueprint CDO + ability grants via `setup_enemy_ai.py`-style script;
  wire `BP_VSEnemy` placed-instance + grants; verify via per-archetype
  `AVSBestiary_<id>Test` (placeholder testPath).

### 3.2 Combat Map (`arpg-combat`)
- `CombatInteractionEntry.data: ComboSequence` (from `CombatActionMap/data-metrics.ts`).
- `categoryPath = ['Combat Map', combo.archetype ?? 'General']`; `tags = [combo.weaponType]`
  (exact fields confirmed at plan time against ComboSequence shape; the spec ties to
  the array name, not its inner field names — see §5 open risks).
- **Recipe** `COMBAT_MAP_RECIPE`: steps `['wire', 'verify']` only (Combat Map is
  wiring of existing abilities — no new assets). The wire prompt connects
  `Ability → HitReact montage → Damage tag` per the spec; verify gates on a
  `AVSCombat_DamageMatrixTest` (placeholder testPath).

### 3.3 Screen Flow (`arpg-ui`)
- `ScreenEntry.data: GraphNode` (from `ScreenFlowMap/data.ts`'s `FLOW_NODES`).
- `categoryPath = ['Screens', flow_node.group]`; `tags = [flow_node.inputMode]` (best
  effort against the GraphNode shape; confirmed at plan time).
- **Recipe** `SCREEN_FLOW_RECIPE`: steps `['scaffold-cpp', 'author-python', 'wire', 'verify']`.
  Scaffold pure-C++ `UUserWidget` extending **`UARPGCodeWidgetBase`** (folder-04
  keystone — `RebuildWidget` ordering, no `BindWidget` by default); author optional
  WBP starter via `wbp-starter` lesson; wire the screen-flow state machine; verify
  via `AVSScreen_<id>Test` (placeholder testPath).

### 3.4 Zone Map (`arpg-world`)
- `ZoneEntry.data: ZoneRecord` (from `ZoneMap/data.ts`).
- `categoryPath = ['Zones', zone.level_range]`; `tags = [zone.biome]` (per ZoneRecord
  fields; confirmed at plan time).
- **Recipe** `ZONE_MAP_RECIPE`: steps `['author-python', 'verify']`. Author the
  `.umap` via a `build_<zone_id>.py` script (extends the proven `build_arena.py` /
  `build_procgen_dungeon.py` pattern) — placement + portals (from `ZONE_EDGES`) +
  spawn density; verify via `AVSZone_<id>Test` + Gemini-vision check (placeholder
  testPath). Cross-catalog **enemy spawn** links to Bestiary at recipe time
  (not seed time — spawn lists are zone-config data, not entity-level metadata).

### 3.5 State Graph (`arpg-animation`)
- `AnimationEntry.data: MontageEntry` (from `AnimationStateGraph/data.ts`'s `ALL_MONTAGES`).
- `categoryPath = ['Animations', montage.category]` (Attack/Dodge/HitReact/Death/Idle/Locomotion/Ability/Emote);
  `tags = [montage.character ?? 'shared']`.
- **Recipe** `STATE_GRAPH_RECIPE`: steps `['author-python', 'verify']`. Author montage
  shells via `mixamo_pipeline.py`-style script (Mixamo import + retarget + montage
  shell creation under `/Game/Animations/`); verify via `AVSAnim_<category>Test`.
  **Best-practices includes a loud "MANUAL STEP REQUIRED"** for the AnimBP graph
  (the binary wall) — the recipe NEVER claims to author AnimBP graph nodes.

## 4. Tests (TDD, app-side vitest)

Per section: seed test + recipe test (prompt-assembly snapshot — must contain the
section's asset spec + UE class name(s) + section best-practices). Plus:
- **Bestiary cross-catalog link integrity** (single shared test): every
  resolvable ability-name maps to a spellbook entry; every archetype with a
  loot binding gets a `loot-tables` link; unmatched ability names are dropped
  silently, not fabricated.
- **State Graph manual-step badge**: recipe prompt includes the explicit
  "MANUAL STEP REQUIRED" marker the binary-wall guidance demands.
- **`sections.ts` updated** to include all 8 catalogs after this round.

Round-1 + R2/R3 tests must remain green (no regression on Spellbook, Items, Loot,
lifecycle, dispatch, known-assets).

## 5. Concurrency & integration

All edits are **additive new files** plus single-anchor additive edits to:
`types.ts` (one block: `CatalogLink` + optional `links?`), `recipe.ts` (5 recipe
consts + 5 RECIPES entries), `sections.ts` (5 array entries), `ue-known-assets.ts`
(per-section entries + 5 switch cases). **No edits to any section UI** (per the
roadmap's parallel-CLI design — Bestiary/Combat/Screen/Zone/State sections each
have an active owner; their UI retrofits are out of scope).

`cli-task.ts` untouched (R2/R3 already widened the dispatch path).

`@/` imports only; `≤200 LOC` per new `.tsx` (no new `.tsx` in this round — UI
is intentionally out of scope, so the scoped `max-lines` gate has nothing to bite).

Commit locally to master; targeted `git add`.

## 6. Out of scope (→ parallel per-section CLIs)

- UI retrofits of `EnemyBestiary`, `CombatActionMap`, `ScreenFlowMap`, `ZoneMap`,
  `AnimationStateGraph` (drop `CatalogLifecycleCell` + `(Re)generate` into each —
  trivially mirrors `CatalogGearTab` once each owner is ready).
- Live UE functional-test gates for the 5 sections (their `testPath`s are
  placeholders).
- Real per-section Python scripts (`build_<zone>.py`, the actual State Graph
  Mixamo runner). The recipes *describe* them in their prompts; authoring lives
  with each section's owner.
- Round 2 cross-cutting work that's already done (substrate, section registry,
  reusable lifecycle cell, entity-generic dispatch).

## 7. Open risks (resolved at plan time)

- **`ComboSequence` / `GraphNode` / `ZoneRecord` field names** for
  `categoryPath`/`tags` derivation are best-effort against the canonical exported
  arrays. The plan reads each `data.ts` to confirm exact field names; if a chosen
  derivation field doesn't exist, the plan picks the closest existing field
  (categoryPath always derivable from at least one categorical field). No game
  data invented.
- **Ability-name → spellbook entry resolution** (Bestiary §3.1) depends on
  archetype `abilities` names matching spellbook entry names (case-sensitive).
  Plan adds a small case-insensitive normalisation if needed; unmatched names are
  dropped (not fabricated), surfaced by the link-integrity test.
- **State Graph binary wall** — the recipe never asserts AnimBP graph completion;
  `verify` only gates on what's Python-authorable (montage assets present, attached
  to the correct skeleton). The manual AnimBP authoring stays the operator's job.
