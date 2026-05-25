# Catalog Pipeline Expansion — Design

**Date:** 2026-05-25 · **Branch:** `feature/entity-centric-workspace` · **Status:** Approved (design).

Source of truth: `game_catalog_pipelines.xlsx` (parsed) — 30 catalog entities across 9 categories, each with a 12–17 step idea→UE-asset pipeline, plus a Notes/Conventions sheet.

## Goal

Stand up a **catalog pipeline program**: a `docs/catalog/` planning tree that lets a single Claude Code CLI take **one catalog entity end-to-end** (design well → produce one real asset, idea→UE→test → document cross-catalog opportunities + gaps/blockers), register the new catalog entities so they appear across the app (incl. **Live State**), and prove the model by **leading one complete item end-to-end (Skill/Ability → spellbook, asset = Fireball)** before the remaining rows are delegated to separate CLIs.

Mission Control is intentionally **left as-is** (a deeper redesign follows later); the fine 12–17-step model lives in the docs for now (the app keeps its 8-track pipeline model until that redesign).

## The 30 rows (category → entity → catalogId)

- **Core / Existing (8, already registered):** Item→`items`, Loot Table→`loot-tables`, Bestiary Entry→`bestiary`, Combat Map→`combat-map`, Zone Map→`zone-map`, Screen Flow→`screen-flow`, State Graph→`state-graph`, Material→`materials`.
- **Quests & Narrative (5, NEW):** Quest→`quests`, Dialog Tree→`dialog-trees`, Cutscene/Cinematic→`cutscenes`, Codex/Lore Entry→`codex`, Faction/Reputation→`factions`.
- **Game Assets (4):** Character→`characters` (NEW), Prop/Environment→`props` (NEW), **Skill/Ability→`spellbook` (existing)**, Status Effect/Buff→`status-effects` (NEW).
- **Systems (5, NEW):** Crafting Recipe→`crafting-recipes`, Vendor/Shop→`vendors`, Progression Curve→`progression-curves`, Achievement/Trophy→`achievements`, Save/Checkpoint→`save-points`.
- **Audio & FX (3, NEW):** Music Track/Stinger→`music`, Ambient Soundscape→`ambient`, VFX Asset→`vfx`.
- **UI (2, NEW):** HUD Element→`hud-elements`, Icon Set→`icon-sets`.
- **Input & Platform (1, NEW):** Input Scheme→`input-schemes`.
- **Onboarding (1, NEW):** Tutorial Beat→`tutorial-beats`.
- **Economy / Meta (1, NEW):** Currency→`currencies`.

**21 new catalogs** to register; **9 existing** reused (the 8 Core + spellbook).

## Findings driving this design (app surface, from exploration)

- `CATALOG_SECTIONS` (`src/lib/catalog/sections.ts`) is the authoritative catalog list; the Catalogs hub + roster auto-enumerate it. Adding a catalog = a `seed-<id>.ts` + a section entry.
- A new catalog also threads through `PIPELINE_BY_CATALOG` (`src/lib/pipeline/tracks.ts`) and `CATALOG_MODULE` (in **both** `src/hooks/useGeneration.ts` and `src/hooks/useEntityTrackHelp.ts`). `CATALOG_MODULE` has an `?? 'arpg-gas'` fallback. The API + lifecycle DB are already catalog-generic (no schema change).
- `LiveStateTab.tsx` currently shows only Bridge + Asset-Manifest cards — it does **not** enumerate entities. "Extend Live State" = add a catalog-entity view there.
- `CatalogSection` has no `category`/`description`; the 30 rows need grouping, so we extend it.
- The Skill/Ability row maps onto work already shipped: **B1** (enriched ability spec), **B2** (effect-timeline + tag-rule editors), **B3a/b/c** (GE C++ + wiring ability + `DT_GeneratedAbilities` registry), plus `damage-formula.ts`, `combo-analysis.ts`, `logic-prompts.ts`. This makes it the lowest-risk, highest-signal first complete item.

## The execution contract (the per-CLI model — lives in `index.md`)

Each catalog row is owned by **one Claude Code CLI**, highest effort:
1. **Design well** — read the row's `plan.md` + this index; design the entity's schema/rules before producing assets.
2. **Make one asset start→end** — drive **one named entity** through every pipeline step (idea→UE asset→test gate), reusing existing PoF capabilities (catalogs, recipes/dispatches, Leonardo-2D, Blender/Meshy, audio-import, GAS B3 codegen, functional tests) and producing real artifacts; where a capability is missing, build a minimal real version or record a gap.
3. **Document for future sessions** — fill the row's `## Session Findings`: **cross-catalog opportunities** discovered and **gaps/blockers**; also append one-liners to the index's shared **Cross-Catalog Opportunities** log and **Gaps/Blockers register** so knowledge compounds across sessions.

The Notes-sheet **agent roles** (Designer · Writer · Concept2D · 3DGen · Rigger · Animator · VFX · Audio · Balancer · QA · Packager) and **test-gate** definition (an explicit automated+human pass/fail before UE-asset promotion) are documented in the index as the shared vocabulary.

## `docs/catalog/` structure

```
docs/catalog/
  index.md            shared philosophy + execution contract + agent roles + test-gate def
                      + PoF-systems map + 30-row index table + Cross-Catalog Opportunities log
                      + Gaps/Blockers register
  _TEMPLATE.md        the per-row plan template
  <category-slug>/<entity-slug>/plan.md   one focused brief per row (×30)
```

Category slugs: `core-existing`, `quests-narrative`, `game-assets`, `systems`, `audio-fx`, `ui`, `input-platform`, `onboarding`, `economy-meta`.

**Each `plan.md`** (focused — shared contract is in the index):
- Header: entity, category, `catalogId` (new/existing), one-line description, the **target asset** (the named entity the CLI builds; tied to a seeded starter).
- **Pipeline** — the exact steps from the sheet as an ordered checklist; each step annotated with *what "done" looks like · owning agent role · the existing PoF capability to reuse OR a ⚠️ gap flag*.
- **PoF integration** — data schema to design, owning module, pipeline-track mapping, recipe/dispatch (if any).
- **Cross-catalog dependencies** — explicit (e.g., Quest→Dialog/Reward(Loot)/NPC(Character); Skill/Ability→Status Effect/Bestiary AI/Icon Set).
- **`## Session Findings`** — filled by the executing CLI (opportunities + gaps/blockers).

## Catalog registration (the 21 new catalogs)

For each new catalog: a `src/lib/catalog/seed-<id>.ts` seeding **1–2 minimal `planned` starters** (name, categoryPath, tags, short `data` with a description — the real schema is the "Data Schema Definition" pipeline step), a `CATALOG_SECTIONS` entry, a `PIPELINE_BY_CATALOG` entry (best-fit map of the row's fine steps → the existing 8 tracks), and `CATALOG_MODULE` entries in both hooks (best-fit `SubModuleId`, else the `arpg-gas` fallback). `CatalogSection` gains optional **`category`** and **`description`**; the 9 existing sections get categories too. Generation `recipe`s stay optional (deferred per catalog).

## Live State extension

A new **catalog-entity live view** in `LiveStateTab.tsx` (added alongside the existing cards): iterates `CATALOG_SECTIONS`, **groups by `category`**, and for each catalog shows entity counts by `lifecycle` + a per-entity line with `lifecycle` / `lastTestResult` / `ueAssets` — "what is actually live in-engine." All 30 catalogs (incl. the 21 new) appear automatically once registered.

## First complete item — Skill/Ability → spellbook, asset = **Fireball**

The reflection vehicle. Fireball already has a generated GE + wiring ability + registry row (B3 proofs). The CLI (me) takes it through the 16 Skill/Ability steps, at each step either reusing an existing PoF capability + verifying, producing the artifact now, or recording a gap:

| # | Step | Disposition |
|---|------|-------------|
| 1 | Concept Brief & Fantasy | author (doc) |
| 2 | Mechanical Effect Logic | **reuse B1/B2** enriched spec (effects) |
| 3 | Cost & Cooldown Rules | reuse scalar data + note cooldown-GE gap (B3b TODO) |
| 4 | Targeting Rules | author + ⚠️ bespoke targeting gap (B3b finding) |
| 5 | Damage/Healing/Status Formulas | **reuse** `damage-formula.ts` + the GE modifiers |
| 6 | Combo & Interaction Rules | **reuse** `combo-analysis.ts` / tag rules |
| 7 | Balancing & Tuning Pass | reuse damage/combo tuners |
| 8 | Animation Set | ⚠️ gap (no anim pipeline for abilities yet) |
| 9 | VFX (cast/projectile/impact) | ⚠️ gap / Niagara stub |
| 10 | SFX | reuse `import_audio_set` dispatch (best-effort) |
| 11 | UI (icon/tooltip/cooldown) | icon via Leonardo dispatch; tooltip reuse |
| 12 | Camera Shake / Feedback | ⚠️ gap |
| 13 | Localization | author keys + ⚠️ loc-system gap |
| 14 | AI Usage Hints | reuse bestiary AI conventions |
| 15 | Combat Test Gate | **build/run** a UE functional test (activate Fireball → Health delta) |
| 16 | UE Ability Asset Packaging | **reuse B3a/b/c** (GE + ability + `DT_GeneratedAbilities`) — done/proven |

The honest mix of reuse/produce/gap is the point — it measures real pipeline coverage. Findings feed the `game-assets/skill-ability/plan.md` + the index logs, informing direction before delegation.

## Phased delivery

- **Phase A — Framework + scaffold (I do):** `index.md`, `_TEMPLATE.md`, the `CatalogSection` category/description extension, register all 21 new catalogs (sections + minimal seeds + pipeline/module maps), the Live State catalog-entity view, a registration **coverage test** (every catalog has pipeline + module entries + a category), and **30 `plan.md` files generated from the template** (each carrying its real sheet step-list + cross-catalog links; `## Session Findings` empty). App green (tests + tsc).
- **Phase B — First complete item (I lead):** flesh out + **execute** the Skill/Ability pipeline for Fireball end-to-end per the table above; combat test gate; package via B3; fill `skill-ability/plan.md` findings + the index logs. **CHECKPOINT — reflect on process/direction with the operator.**
- **Phase C — Scale (future, delegated):** the remaining 29 rows executed by separate CLIs using their `plan.md` (catalogs already registered, briefs already written); each batch extends Live State as its entities progress.

## Testing

- **Registration coverage test** (vitest): every `CATALOG_SECTIONS` id has a `PIPELINE_BY_CATALOG` entry, a `CATALOG_MODULE` entry (both hooks), and a `category`; every new seed returns ≥1 valid `CatalogEntityBase`.
- **Live State view test**: renders all categories incl. new catalogs; groups by category; shows per-entity lifecycle/test state (mock `catalogStore`).
- **Seed unit checks**: each new `seed-<id>.ts` returns well-formed entities (id/catalogId/name/lifecycle).
- **Phase B**: the Fireball combat-test gate is a UE functional test (judged by `-abslog`); app-side reuse paths already covered by B1/B2/B3 tests.

## Scope / out of scope

- **In:** the `docs/catalog/` tree (index + template + 30 briefs), the 21 new-catalog registrations, the `CatalogSection` extension, the Live State entity view, and the one complete Skill/Ability execution (Fireball).
- **Out:** Mission Control changes (deferred redesign); deepening the app's 8-track pipeline model to the fine 12–17 steps (deferred with Mission Control); executing the other 29 rows (future CLIs); generation `recipe`s for the new catalogs (optional/later); full art/3D/anim production where tools are absent (recorded as gaps).

## Invariants

Branch-local app commits on `feature/entity-centric-workspace`; `@/` imports; `logger` not `console`; no hardcoded hex; timing via `UI_TIMEOUTS`; co-author tag. UE-side (Phase B): additive under the generated folders; judge builds/tests by `-abslog`; commit narrowly to `pof-exp`, don't push. Each app task ends targeted vitest green + `tsc`/eslint clean (excluding the 3 pre-existing foreign `AssetInspector` errors).
