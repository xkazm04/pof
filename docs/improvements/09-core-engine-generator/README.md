# 09 · Core Engine Generator — cross-module roadmap

> **This folder is the deliberate cross-cutting exception** to the
> "one isolated concern" rule in [`../INDEX.md`](../INDEX.md). It is a *roadmap
> layer above* folders 01–08: it consumes 01's wiring/gotchas machinery and the
> per-domain panels sketched in 02–06, and unifies them into one architecture
> for turning PoF from a **game tracker** into a **game generator** with a
> scalable authoring UI. Individual buildable deliverables sliced out of this
> roadmap are still isolated, single-CLI units (see "Multi-CLI slicing").

## The shift: from tracking to generating

Today each module is a **checklist + feature matrix** — it *tracks* what the
game has. The vertical-slice initiative proved PoF can *drive* Claude to
generate real gameplay (12+ C++ systems, a packaged `.exe`, and — in the
character CLI just shipped — a hostile enemy with a passing functional test).
The next step is to make that generation **first-class, high-quality, and
scalable**: PoF should let an operator author hundreds of game assets
(abilities, items, enemies, animations, loot tables, screens, zones) and
generate the corresponding UE logic + assets + code, each verified by a
functional-test gate.

This requires two things the app does not have yet:

1. A **generation engine** — typed, recipe-based pipelines that emit UE
   artifacts (C++ + Python-authored Blueprints/data assets/levels) and gate each
   on a functional test, reusing the existing `CLITask`/`@@CALLBACK`/
   `PromptBuilder`/harness seams.
2. A **scalable authoring UI** — a catalog framework that holds hundreds of
   typed assets with deep categorization, faceted search, virtualized lists, a
   detail/editor drawer, bulk generation, and deep-link routing.

## The unifying abstraction: the Catalog

Every Core Engine module becomes a **Catalog** of one primary typed entity,
surfaced through a module-specific **section view**. The eight modules the
operator named map to existing PoF sub-modules:

| Module (operator's name) | Section view | Sub-module | Catalog entity | Primary UE output |
|---|---|---|---|---|
| Animation system | **State Graph** | `arpg-animation` | `AnimationEntry` (clip / montage / state) | Mixamo import + montage shells + locomotion data (Python); AnimBP graph = manual |
| Ability system | **Spellbook** | `arpg-gas` | `AbilityEntry` (GA + GE + tags + costs) | `UGameplayAbility` C++ subclass + `BP_GA_*` config + `GE_*` + tag registration |
| Combat system | **Combat Map** | `arpg-combat` | `CombatInteraction` (attacker → ability → reaction → damage) | damage tables, hit-react montage shells, wiring graph |
| Enemy UI | **Bestiary** | `arpg-enemy-ai` | `EnemyEntry` (archetype + stats + abilities + loot) | `BP_*Enemy` CDO (Python) + archetype tuning + ability grants + controller |
| Items & Inventory | **Items** | `arpg-inventory` | `ItemEntry` (ItemDefinition + affixes + slot) | `UARPGItemDefinition` data assets (Python) + icons (Leonardo) |
| Loot & Drops | **Loot Tables** | `arpg-loot` | `LootTableEntry` (weighted entries) | `UARPGLootTable` data assets (Python) + drop wiring |
| UI & HUD | **Screen Flow** | `arpg-ui` | `ScreenEntry` (widget + transitions) | pure-C++ `UUserWidget` subclasses + screen-flow state machine |
| Worlds & Levels | **Zone Map** | `arpg-world` | `ZoneEntry` (level + spawns + portals) | `.umap` (Python level build) + spawn placement + nav |

Each section is a *specialized view* over its catalog (a spellbook codex, a
monster manual, a weighted-loot-table editor, a zone hierarchy map), but all
sections sit on **one shared catalog framework** — that shared substrate is the
high-leverage build, not eight bespoke UIs.

## Multilayer navigation (the scalable-UI core)

Navigation goes from today's 2 layers to **5**, which is what makes "hundreds of
assets" tractable:

```
L1  Category            (core-engine)                — existing SidebarL1
L2  Module              (arpg-gas)                   — existing SidebarL2
L3  Section / tab       (Spellbook)                  — existing tab system
L4  Catalog tree        (Offensive ▸ Fire ▸ AoE)     — NEW: hierarchical + faceted
L5  Entity detail       (GA_Fireball)                — NEW: detail/editor drawer
```

L4/L5 are the new primitives: a **categorization hierarchy** (4+ levels, not the
current flat group-by-category) + **faceted search** (type, tag, rarity, status,
generation-state) over a **virtualized** list/grid, and a **detail drawer** that
is both the entity's editor and its generation cockpit (status, UE asset link,
last functional-test result, "(re)generate" action). Every level is
**URL-routable** (`/core-engine/arpg-gas/spellbook/offensive/fire/GA_Fireball`)
so deep state is bookmarkable and dispatchable.

## The asset lifecycle (richer than feature status)

The feature matrix has a 5-value status (implemented/improved/partial/missing/
unknown). A generated asset needs a **lifecycle** that mirrors the pipeline this
initiative proved:

```
Planned  →  Scaffolded  →  Generated   →  Wired      →  Verified
(catalog    (C++ class     (Python BP/    (CDO/        (functional
 entry       compiled)      data asset/    instance      test green)
 only)                      level built)   wired)
```

Each catalog entity carries its lifecycle state, the UE asset path(s) it owns
(from the known-assets registry), and its last functional-test verdict. The
catalog renders these as columns/badges — extending folder 01's "compiled, not
wired" matrix column into a full per-asset lifecycle, so the "compiles ≠ runs"
gap is visible at a glance across hundreds of assets.

## Binary-content boundary (what PoF can actually generate)

The vertical slice's central wall — *binary UE content cannot be authored as
text* — is real but **narrower than first feared**, as the character CLI proved
this session. The catalog marks each entity's generation method and flags the
manual remainder:

- **C++ generated** (build): gameplay classes — `UGameplayAbility`, `UGameplayEffect`,
  `UAttributeSet`, `AAIController`, pure-C++ `UUserWidget`, `UARPGItemDefinition`/
  `UARPGLootTable` classes, functional tests.
- **Python-authorable** (full editor): Blueprint **CDOs/config**, **data asset**
  instances, **materials**, **levels (`.umap`)**, **montage shells**, **placed
  actors + instance overrides**. (This is the bulk of "assets".)
- **Manual / the wall**: AnimBP **graphs**, Behaviour **Trees**, montage **notify
  graphs**, complex Blueprint **event graphs**. The catalog surfaces these as an
  explicit "manual step" badge with instructions — never silently skipped.

The recurring lessons are baked into every recipe (detailed in
[`game.md`](game.md)): **functional-test gating** is the only true pass signal
(file-existence is gameable); **gray-box-then-real** progression (ship the
gameplay-correct gray-box, then swap in art); **single-dispatch isolation** for
batch generation; the **CDO-vs-instance** serialization trap (set class-pointer
props on placed *instances*, not just CDOs); and the **shared-tree** discipline
(monolithic editor build, commit only your files, coordinate the single editor).

## Multi-CLI slicing & sequencing

This roadmap is built to be parallelized across the next CLI rounds. Slice it so
the shared substrate lands first, then fan out:

1. **Round 1 — Catalog framework + generation engine + studio foundation
   (foundational, 1 CLI).** The `CatalogView` UI framework (tree + facets +
   virtualization + detail drawer + URL routing), the catalog data model, the
   lifecycle store, and the recipe/batch-dispatch engine — built *already
   conforming* to the two polish dimensions: the **design-token layer + `viz/`
   chart primitives** ([`ux-design.md`](ux-design.md)) and the **200-LOC rule +
   feature-folder structure + lazy/virtualized performance + the ESLint
   `max-lines` gate** ([`code-standards.md`](code-standards.md)). Landing the
   lint gate here means every later section *physically cannot* regress.
   *Everything else depends on this.* Prove it end-to-end through **one**
   section — recommend **Spellbook** (`arpg-gas`), because abilities are
   pure-C++/Python (no binary wall) and the character CLI already shipped the
   GA/GE/grant/functional-test path.
2. **Round 2 — known-assets registry + lifecycle wiring (1 CLI).** The
   single-source-of-truth registry of generated UE asset paths + lifecycle
   state (extends folder 02 §2's `ue-known-assets.ts`), surfaced as catalog
   columns. Can overlap Round 1's tail.
3. **Round 3 — the remaining 7 sections (up to 7 parallel CLIs).** Each builds
   its section view + entity schema + generation recipes + functional-test gate
   on the shared substrate. Natural ordering by independence/leverage:
   **Items** and **Loot Tables** (pure data assets, Python-clean) →
   **Bestiary** (composes abilities + items + loot) → **Combat Map** (composes
   abilities, mostly relationships) → **Screen Flow** (pure-C++ widgets, builds
   on folder 04) → **Zone Map** (level building, builds on folder 05) →
   **State Graph** (most binary-walled — Mixamo + AnimBP-manual; sequence last).

Each Round-3 slice is a normal isolated CLI deliverable (its own spec → plan →
subagent-driven execution + functional-test gate), exactly like the character
CLI. Dependencies between catalogs (a Bestiary entry references Ability + Loot
entries) are modeled as cross-catalog links — see [`pof-app.md`](pof-app.md).

**The two polish dimensions are global constraints, not a separate round.**
Every slice — Round 1 onward — honors [`ux-design.md`](ux-design.md) (tokens,
viz primitives, motion, premium states) and [`code-standards.md`](code-standards.md)
(≤200 LOC/`.tsx`, feature-folder structure, virtualized + lazy-loaded, lint-gated).
Round 1 *establishes* them in the framework + lands the lint gate; later rounds
*inherit* them automatically.

## The files in this folder

- [`pof-app.md`](pof-app.md) — the PoF Next.js app architecture: catalog data
  model, the `CatalogView` framework + new UI primitives, the generation engine,
  the navigation redesign, and per-section app work.
- [`game.md`](game.md) — what gets generated into the UE project per module: the
  per-entity generation recipes and the binary-content boundary per asset type.
- [`tests.md`](tests.md) — verification strategy: app-side tests for the catalog
  framework, and the per-asset functional-test gates that make generation
  trustworthy at scale.
- [`ux-design.md`](ux-design.md) — **Dimension 1:** studio-grade UI/UX — a
  design-token system, the per-section visual-chart/viz layer, 3D asset preview,
  motion/micro-interactions, the multi-pane studio layout, and premium states.
- [`code-standards.md`](code-standards.md) — **Dimension 2:** code quality —
  the 200-LOC-per-`.tsx` rule, balanced feature-based folder structure,
  separation of concerns, performance + staggered/lazy loading, and the lint/CI
  gate that enforces them.
