# Legacy-game ingest — reading a 90s RPG into PoF's catalogs

> **Status:** chassis BUILT + dry-run PROVEN on real data (2026-09-22). **Superseded as a
> backlog by the `/diablo` loop** (same day): the backlog, its decisions and the replication
> waves now live in the Obsidian vault `Diablo/` and are driven by `.claude/skills/diablo/`.
> Written from `/research` on *"ingest older PC games … populate a new pof project"*.

## Follow-up (2026-09-22): the `/diablo` loop and backlog wave W00

The operator descoped licensing (B1: a reference-only learning exercise, deleted at the end) and
turned this into a long-running loop whose product is the adjustments. W00 landed:

- **Wrapper store** — `src/lib/catalog/reference/`: a wrapper keeps the raw source row apart from its
  projection (`mapping_version`), so each mapping adjustment is a counted re-projection
  (`created / rawChanged / reprojected / unchanged`), with run history and a coverage trend. Reading
  techniques are registered by asset kind (`tsv@1` today), sources are data (`reference/sources.ts`).
  Scripts: `scripts/diablo/ingest.ts` (wrap, `--promote`, `--demote`) and `scripts/diablo/status.ts` (gate snapshot).
- **G1** fixed (`iconKey` + `ARCHETYPE_ICONS`), **B2** promotion, **B3** INGEST tag, **B4** link
  resolution (24 resolved, 4 genuine source dangles), plus three new: **B6** the lab never read
  `catalog_entities` back (hydration), **B7** value decoders (`spell=Null` on 142/168 items would have
  become 142 links to a spell called "Null"), **B9** demote.
- **Reclassified:** G2-G6 are not missing from PoF's GAME — UE already has `EEquipmentSlot`,
  resistances, `GE_DifficultyScaling` and `FAffixTableRow`. They are gaps between the app's catalog
  payloads and UE, and the schema-down snapshot that should close them is `{}` with no consumer (D6).
  The bestiary pipeline also already has `Resistances` / `Monster Rarity` STEPS — so the right target
  for those columns is a step artifact (decision D3), and PoF's canon injects its own world into every
  produce prompt, which a Diablo replication needs a profile for (D5).

## The question, and the answer

Can PoF ingest an old RPG's data files into its catalog structure — and would doing so
**validate the pipeline design** and **give a tool for remakes**?

**Yes to both, with one caveat that is not technical.** A dry run over **316 real entities**
from a shipped 1996 ARPG produced valid, persistable PoF entities with per-row provenance,
and the residue — what would not fit — is a concrete, derived list of **31 source fields
PoF has no place for** and **12 PoF fields no data can fill**. That list is the design
validation. The caveat is licensing: the numbers are another studio's work (see §Blockers).

## Feasibility — which games, what tooling

| Tier | Source class | Example | Extra tooling | Verdict |
|---|---|---|---|---|
| **1** | Reverse-engineered engine with **externalized data tables** | DevilutionX (Diablo I, 1996) — `assets/txtdata/*.tsv` | none — plain TSV | **ingested (this run)** |
| 1b | Open-source RPG with declarative gamedata | Angband — `lib/gamedata/*.txt` (44 record files) | a record-format reader (S) | ingest-ready |
| 2 | Data embedded in C source arrays | NetHack `objects.c` / `monst.c` | tolerant C-array parser (M) | feasible, lossy |
| 3 | Free commercial game, documented binary containers | Daggerfall `ARENA2/*.BSA` | ~500 MB download + port a reader from Daggerfall Unity (XL) | backlog |
| 4 | Owned commercial archives | Diablo `DIABDAT.MPQ`, Fallout `.DAT` | third-party extractor + owned copy | **blocked** — not redistributable |

**Why Tier 1 first:** the genre is PoF's own (ARPG: bestiary, affix loot, spellbook, level
curve), no binary container has to be cracked, and the schema is a *complete, shipped,
balanced* design rather than a prototype — which is what makes its gaps meaningful.

Tables available in that one source, and where they land:

| Table | Rows × cols | PoF catalog |
|---|---|---|
| `monsters/monstdat.tsv` | 112 × 41 | `bestiary` — **ingested** |
| `items/itemdat.tsv` | 168 × 23 | `items` — **ingested** |
| `spells/spelldat.tsv` | 36 × 15 | `spellbook` — **ingested** |
| `monsters/unique_monstdat.tsv` | 100 × 20 | `bestiary` (uniques) — next |
| `items/unique_itemdat.tsv` | 90 × 23 | `items` (legendary) — next |
| `items/item_prefixes.tsv` + `item_suffixes.tsv` | 178 × 12 | **no catalog exists** — gap G2 |
| `Experience.tsv` | 50 × 2 | `progression-curves` — next |
| `quests/`, `classes/`, `objects/`, `towners/`, `missiles/` | — | `quests`, `characters`, `props`, `vendors`, `vfx` |

## What was built

`src/lib/catalog/ingest/` — pure, no DB, no filesystem:

- **`tsv.ts`** — `parseTsv`. Blank cell ≠ absent key; a row whose arity disagrees with the
  header is REPORTED (`malformed`), never shifted into the wrong columns.
- **`fieldMap.ts`** — the mapping contract. Every source column is `mapped` / `dropped` /
  `gap`, and `auditColumns` DERIVES the residual, including **`unclassified`** (in the data,
  absent from the map — nobody judged it, a defect not a decision) and
  **`declaredButAbsent`** (the upstream file moved under the mapping). A hand-written gap
  list would be accurate on the day it was written and silently wrong after.
- **`run.ts`** — `ingestTable`. Entity AND audit from the one `FieldMap`, so they cannot
  drift. Positional identity fallback + colliding-key report (see finding 2 below).
- **`diablo1.ts`** — all 79 columns of three tables classified, plus `TARGET_GAPS`.
  **Carries the mapping, never the values** — the tables are read from an operator path.

Also: `EntityProvenance` on `CatalogEntityBase` (licence note **per row**, so it cannot be
separated from the data); `CatalogEntitySource` += `'ingest'`; `jsonUnsafeKeys` guard in
`upsertEntity`; the API's source list is now **derived** from the union.

Dry run (writes nothing):

```
npx tsx scripts/research/ingest-dry-run.ts <checkout>/assets/txtdata
```

## Dry-run result (live, 2026-09-22)

| Catalog | Entities | Coverage | Mapped · dropped · gap · unclassified | Notes |
|---|---|---|---|---|
| bestiary | 112 | 43.9% | 18 · 9 · 14 · **0** | 0 malformed, 0 collisions |
| items | 168 | 56.5% | 13 · 2 · 8 · **0** | **118 positional ids** |
| spellbook | 36 | 33.3% | 5 · 1 · 9 · **0** | |
| **total** | **316** | | **31 gaps · 0 unjudged** | 12 target-side gaps |

Every numeric value on the sample entity was checked against the raw row by hand
(`MT_NZOMBIE`: HP 4–7, damage 2–5, AC 5, XP 54 — all correct).

### Three things only the live run showed

1. **`ArchetypeConfig.icon` cannot be persisted — and this already bites the one-shot flow.**
   It is typed `typeof Skull` (a lucide `forwardRef` object). `JSON.stringify` reduces it
   to `{}`: **13 keys in, 13 keys out, one hollow** — the key survives, so every presence
   check passes. An ingest cannot produce a valid `ArchetypeConfig` at all. Guard shipped
   (named `logger.error` at the write); real fix is backlog G1.
2. **A legacy table's identity can be POSITIONAL.** `itemdat.tsv`'s `id` column is set on
   only **50 of 168** rows (the ones game code names directly), and `name` — the obvious
   substitute — has **21 duplicates** (147 unique). The first run keyed on `id` and silently
   produced 50 items; keying on `name` would have collided 21. Only a prediction written
   down before running (168) caught it. The chassis now falls back to `row<N>` and reports
   both counts.
3. **A boolean column was pushed into a name list** — `abilities: ['false']`, a monster
   with an ability literally called "false". The fixture left `hasSpecial` blank; real data
   did not. Booleans are now flags (`hasSpecialAttack`, `usable`), with a regression test.

## Pipeline-design validation → the backlog

The residue groups into themes. Each is a real decision, not a nice-to-have: it is a field a
complete, shipped ARPG needed and PoF cannot hold.

| # | Gap | Evidence (columns) | Kind | Effort |
|---|---|---|---|---|
| **G1** | **Entity payloads are not JSON-safe** — `icon` is a component | target `bestiary.icon` | **defect** | L — icon registry key |
| **G2** | **No affix catalog** — 178 affix records, no home | `item_prefixes`, `item_suffixes` | missing pipeline | L |
| G3 | No attribute **requirements** (what an item/spell demands) | `minStrength/Magic/Dexterity`, `minIntelligence` | schema | M |
| G4 | No **equipment slot** on items | `equipType` | schema | M |
| G5 | Entities are **difficulty-flat** | `resistanceHell` | schema | L |
| G6 | No per-element **resistance** / damage-type vocabulary | `resistance` | schema | M |
| G7 | `CatalogLink` has a role but **no quantity**; missing roles archetype→state-graph, archetype→status-effect, ability→vendor-price | `frames[6]`, `reducePlayer*` (6), `staffMin/Max`, `bookCost10` | contract | M |
| G8 | No per-level **scaling** on abilities | `manaMultiplier`, `minMana` | schema | M |
| G9 | **Genre assumptions**: `cooldown` required (Diablo has none — mana-gated); `rarity` intrinsic (Diablo: emergent from affixes) | target `spellbook.cooldown`, `items.rarity` | schema decision | M |
| G10 | Spawn range is free-text `area: string` | `minDunLvl`, `maxDunLvl`, `availability` | schema | S |
| G11 | Derived fields (`radar`, `role`, `tier`, `element`) have no derivation and no marker saying they are derived | target gaps | contract | M |

**Should steps be added or adjusted?** Adjusted, mostly — G3–G11 are payload-schema changes
inside existing catalogs. One **added**: an affix catalog (G2). And one new *source*: ingest,
which is not a step but a way an entity enters the catalog in `planned` — after which the
existing pipelines produce its UE assets exactly as for an authored one.

## Blockers

- **B1 — Licensing (not technical).** The values are Blizzard's design work recovered by a
  reverse-engineering project. The chassis never commits values and stamps `licenceNote` on
  every row, but **a remake shipped from ingested values needs rights cleared.** Safe uses
  today: reference, analysis, balance comparison, and ingesting open games (Angband is GPL).
- **B2 — No app path yet.** The only executing caller is the dry-run script; no API route or
  produce step writes `catalog_entities` with `source: 'ingest'`. Deliberate for a dry run.
- **B3 — `provenance` is not rendered.** An ingested entity looks authored in the lab UI.
- **B4 — Link resolution pass not built.** Links hold the source's raw refs (`GoldSmall`)
  with an honest `catalogId`; resolving them to PoF entity ids needs both sides ingested.
- **B5 — Tier 3 needs a binary reader** (Daggerfall BSA) — XL, only if Tier 1/1b proves the
  remake loop is worth it.

## Remake mode — the XL bet, specced not built

If the backlog lands, "remake" becomes a PoF mode rather than a tool: ingest a reference
game's design as `planned` entities → the existing catalog pipelines generate the UE assets →
`provenance` keeps every value traceable to its origin row, and a **reference-parity** check
compares produced balance against the ingested original (the `reference-parity-gating`
subject in the game-production registry). Order of work: G1 (unblocks all bestiary ingest)
→ B2 (route) → B3 (UI) → G2 (affixes, the most ARPG-defining gap) → the schema set.
