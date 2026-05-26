# Wiring & Acceptance — UE ↔ SQLite balance, acceptance tiers, parallel-CLI model

Research feeding the multi-pipeline plan. Answers four operator questions: (1) what data lives in the UE project vs SQLite, (2) acceptance for Leonardo/Blender (human gallery selection), (3) how far an automated UE "live check" can go (live run + codebase analysis), (4) how 5–9 parallel CLIs each operate maximally with the live-UE step as an **accepted, skippable gap**. Grounded in the existing code — much of the plumbing is already present.

## 0. What already exists (so we extend, not rebuild)

**SQLite (`~/.pof/pof.db`, `src/lib/*-db.ts`):**
- `catalog_lifecycle` — `(catalog_id, entity_id)` → `lifecycle`, `ue_assets[]` (JSON), `last_test_result`, `last_verified_at`. Written by the `@@CALLBACK` system → `POST /api/catalog` → `upsertLifecycle` (`catalog-db.ts`), gated by `resolveTransition` (only `verified` needs a passing test).
- `pipeline_tracks` — per-entity production-track state (`not-started|in-progress|done|blocked`).
- `ability_specs` — GAS authoring state (`effects[]`, `tag_rules[]`) → `POST /api/ability-spec`. The B3 codegen input.
- `headless_builds` — **a UE build queue/results table** (`/api/ue5-bridge/build`). Already a single-resource serialization point.
- `visual_verifications` — **agentic screenshot + Gemini HUD verdicts** (`/api/verify/visual`). The visual-gate infra already exists.
- `balance_baselines`, `session_analytics`, `error_memory`, plus run-history (`procgen/scatter/mixamo/audio_import`).

**Not in SQLite:** the catalog entity's typed `data` payload (ItemData, SpellbookAbility…) lives in **seed files** (`src/lib/catalog/seed-*.ts`) + client localStorage. Only *lifecycle + assets + verdicts* are server-persisted.

**UE project (`C:\Users\kazda\Documents\Unreal Projects\PoF`, UE 5.7):**
- Modules: `PoF` (runtime), `PoFEditor` (editor, has PythonScriptPlugin/AssetTools/IKRig).
- Source-of-truth structs: `FARPGAbilityCatalogRow`, `FARPGGeneratedAbilityRow`, `FARPGAttributeInitRow`, `FARPGCurrencyDef`, `UARPGAttributeSet` (the stat schema), GAS `UGE_*`/`UGA_*`.
- DataTables: `DT_AbilityCatalog` (**synced from the app's `CHARACTER_ABILITIES` TS via `Content/Python/seed_ability_catalog.py`**), `DT_GeneratedAbilities` (from `Effects/Generated/manifest.json` + generated `GA_/GE_` C++ via `seed_generated_abilities.py`).
- Verification: `AARPGFunctionalTestBase` (phased) + ~15 `VS*Test` subclasses; headless via `UnrealEditor-Cmd … -run=pythonscript`/`-run=ContentValidation`/PIE, judged by **`-abslog` markers, not exit code** (headless shutdown null-derefs).

## 1. The UE ↔ SQLite balance (what lives where)

The dividing line is **intent vs. realization**:

| | **SQLite (`~/.pof/pof.db`)** — *authoring & pipeline system-of-record* | **UE project** — *realized engine truth* |
|---|---|---|
| Holds | The spec/intent + where we are: per-step produced artifacts, lifecycle, acceptance verdicts (per tier), the asset-path manifest, human selections, test/visual verdicts | What actually exists & runs: compiled C++ (`GA_/GE_`, structs), DataTable rows, assets (meshes/textures/Niagara/cues), GAS wiring |
| Authority | Authoritative for *pipeline state* and *design intent* | Authoritative for *runtime data + schema* |
| Example | "Iron Longsword: brief ✓, stats authored, icon `cand 0` selected, test deferred" | `DT_Items` row, `SM_IronLongsword`, `MI_IronLongsword`, `GE_Equip_IronLongsword` |

**Direction of truth — schema down, content up:**
- **Schema + math flow UE → app** (validate, don't re-author). The attribute schema is `UARPGAttributeSet`; row shapes are the `F*Row` structs; the damage formula is `ARPGDamageExecution`. The app's Attributes/Economy steps read these and **validate** against them — they don't define them. (Matches the existing "UE is source of truth" rule.)
- **Content/spec flows app → UE** via the existing pipes: TS catalog → seed script → DataTable (the `DT_AbilityCatalog` `SYNC SOURCE` pattern), or app spec → `manifest.json` + generated C++ → `seed_generated_abilities.py`.
- **A drift diff** reconciles the two (the SYNC SOURCE comment is today's manual version) — a step's acceptance can include "app spec == UE DataTable row".

**Recommendation — one new table, generalize the lab store.** The lab's `labPipelineStore` (per-entity/per-step `{data, ueAssets, error, done}`) is exactly the missing server table. Promote it to SQLite as **`pipeline_artifacts`** (mirrors the `catalog-db.ts` shape):

```
pipeline_artifacts (
  catalog_id, entity_id, step,           -- PK
  data         TEXT  DEFAULT '{}',        -- the step's produced payload (JSON)
  ue_assets    TEXT  DEFAULT '[]',        -- asset paths this step produced
  status       TEXT  DEFAULT 'pending',   -- pass | pending | fail | deferred
  tier         TEXT,                       -- highest acceptance tier reached (L0..L4)
  reason       TEXT,                        -- failure/deferral reason (Rule 4)
  updated_at   TEXT
)
```

- **Do not** duplicate the full typed `data` in both stores. Authoring spec lives in `pipeline_artifacts`; realized values live in UE DataTables; seed files become *initial import* only. `catalog_lifecycle.ue_assets` stays the rolled-up manifest (union of step `ue_assets`).
- Reuse what exists: GAS specs → `ability_specs`; UE builds → `headless_builds`; visual verdicts → `visual_verifications`. The new table is just the per-step generic artifact + acceptance.

## 2. Acceptance model — three kinds, four tiers

Acceptance is **derived** (never a manual toggle) but the *source* of the derivation differs by step. Three kinds:

- **A. Data-derived** — read the artifact in SQLite (char-count ≥ N, all schema fields populated, power within ±10%, cost on curve). No external dependency.
- **B. Human-selection** *(Leonardo / Blender)* — generation produces candidates; **the user selects one from the gallery**, and the selection (+ chosen asset) persists. Acceptance = a selection exists. This is the operator's point #2: art steps are **human-gated**, not auto-judged. (The lab's Icon 2D already works this way.)
- **C. UE-verified** — proven against the UE project, on a tiered ladder (next section).

**The acceptance ladder** (a step declares which tiers apply; status is one of `pass | pending | fail | deferred`):

| Tier | Proves | How | Shared resource? |
|---|---|---|---|
| **L0 Data** | The spec is complete & in-budget | SQLite artifact (kind A) | none — always available |
| **L1 Selection** | A human chose the asset | gallery pick persisted (kind B) | none — user action |
| **L2 Config/Static** | The claimed C++ class / DataTable row / asset path **exists in source** | codebase analysis (grep / Clang AST / JSON-schema on `manifest.json` + seed CATALOG); app-spec == UE DataTable diff | none — **read-only, parallel-safe** |
| **L3 Runtime** | It **loads, spawns, applies** | headless `UnrealEditor-Cmd` — Python `load_class`/`load_asset`/CDO (cheap) or `AARPGFunctionalTestBase`/`VS*Test` via PIE (expensive), judged by `-abslog` | **yes — one editor/PIE on the shared tree** |
| **L4 Visual** | It **renders** correctly | RHI screenshot + Gemini verdict → `visual_verifications` | yes — RHI + Gemini |

Two meaningful milestones fall out: **config-complete** = L0–L2 reached; **runtime-verified** = L3 (+L4 for presentation). A step at L2 with L3 `deferred` is *legitimately progressed*, not failed.

**What L2/L3 should actually assert** (salvaged from the Legacy 3-pass evaluator + wiring contract — see [`LEGACY-SALVAGE.md`](LEGACY-SALVAGE.md) §B): the legacy eval ran *Structure → Quality → Performance* + a per-domain *trace*. Map it onto the ladder: **L2** = structure + UE-convention quality (the symbol/row exists *and* follows conventions); **L3** = the *trace* (one observable end-to-end behavior, e.g. combat's one-hit path). Also enforce the **wiring contract**: an artifact that compiles but isn't *granted/activated* is **not** config-complete — a step's L2 must check it's registered + triggered (the "no gray-box" rule), and the step's Verification line becomes its acceptance `detail`/`reason`.

## 3. How far the UE "live check" goes (live run + codebase analysis)

Per the research, the split is concrete:

- **Static / codebase analysis (L2) covers a lot, cheaply and in parallel:** symbol existence (class/struct/`UPROPERTY`/enum), source logic (cost/cooldown, damage formula, archetype const defaults), asset *reference path strings*, and data-integrity of the app-authored inputs (`manifest.json` schema, `seed_*` CATALOG format, app-spec vs DataTable-row diff). For a *config gate*, L2 is often enough to call a step "config-complete".
- **Live (L3) is required for** anything dynamic: a class/asset actually *loads*, a DataTable *has the row with the right values* (Python CDO read), an actor *spawns*, a `GameplayEffect` *applies and moves an attribute*, loot *drops*, cooldown tags *block re-activation*. Use the existing functional tests; judge by `-abslog` markers (`[gate] RESULT=PASS`).
- **Visual (L4)** — render correctness — needs RHI + Gemini (`visual_verifications`); this is the known "missing render gate" the catalog program keeps hitting.

So a single UE "live check" job can **combine** L2 (always, free) with L3 (when it can get the editor): the runner first does static analysis, then — if it holds the live-UE lease — runs the Python/functional-test pass and upgrades the verdict. The gate result records the **highest tier reached** and what was deferred.

## 4. Parallel-CLI model — maximal solo work, live-UE as an accepted gap

**Constraint:** the UE project is **one shared tree with one editor/PIE/`.umap`**; concurrent live runs clobber `PoF.log` + the shared map. So with **5–9 parallel CLIs, they cannot all drive the live app.** Design so none of them *needs* to.

**Every CLI can reach config-complete entirely on its own (no shared-resource contention):**
1. Author the spec → `pipeline_artifacts` (L0).
2. Human-gated selections (L1) where applicable.
3. Edit UE **source as text** (generated `GA_/GE_` C++, `manifest.json`, DataTable CSV, seed script) and **commit narrowly** — text edits don't need the editor.
4. Run **L2 static analysis** (read-only on the UE tree) — parallel-safe.

**The live-UE step (L3/L4) is a single-resource gate behind a lease:**
- A CLI attempts to acquire the **live-UE lease** (reuse/extend the `headless_builds` queue, or a lock row). If free → run `UnrealEditor-Cmd -abslog=<unique-per-CLI-run>` (unique log avoids the shared-`PoF.log` clobber), write the verdict back via the `@@CALLBACK` → `/api/catalog`/`pipeline_artifacts` path, release the lease.
- If busy → mark the step **`deferred`** with reason `"live-UE busy"` and **move on** (the accepted gap). The CLI's work is complete-to-config; it does not block.
- A **serialized UE runner** (operator-triggered, or one dedicated always-on worker — *open decision*) drains `deferred` runtime/visual checks one at a time and posts verdicts. The existing build-queue + callback infra already does most of this.

**Net:** 5–9 CLIs all make real progress in parallel (data + config + human-selection + source edits); only L3/L4 verification serializes through one runner, and it never blocks a CLI. `deferred` is a first-class, expected state — Rule 4's "reports the reason" applies to skips too.

## 5. Resolved decisions (operator, 2026-05-26)

1. **Per-step artifact store → new `pipeline_artifacts` SQLite table.** Promote `labPipelineStore` to a server table keyed `(catalog_id, entity_id, step)` with `data / ue_assets / status / tier / reason / updated_at` (shape in §1), written via the `@@CALLBACK` → API path like `catalog_lifecycle`. Server-authoritative, shared across CLIs/sessions/machines. `catalog_lifecycle.ue_assets` remains the rolled-up manifest.
2. **Schema-down / content-up — ACCEPTED.** The app **validates against** the UE schema (`UARPGAttributeSet`, the `F*Row` structs, `ARPGDamageExecution`) and never re-authors it; content/spec flows app→UE via seed scripts / generated C++. The typed `data` stays in seed files as *import-only* (not migrated wholesale into SQLite). A drift diff (app-spec vs UE DataTable row) is part of the L2 check.
3. **"Done for parallel dev" bar → config-complete (L0–L2).** A step is done when it reaches **data (L0) + human selection (L1, where applicable) + config/static (L2) + source committed**; **runtime (L3) and visual (L4) are deferred** to the serialized runner and do not block the CLI. `deferred` is a first-class status. (Per-archetype *which* tiers apply is specified per row in the plan, but the parallel-dev completion bar is uniformly L0–L2.)
4. **Live-UE runner → configurable (both).** Build the L3/L4 lease/queue (reuse `headless_builds`) so it works **either** operator-triggered (manual drain) **or** with an optional always-on serialized worker; operating mode chosen later. Per-run unique `-abslog`; one editor on the shared tree at a time.
5. **Reuse, add one table.** Keep `headless_builds` (lease/queue), `visual_verifications` (L4), `ability_specs` (GAS) as-is; the only new persistence is `pipeline_artifacts`.

Next: fold this data-contract + acceptance spec into the per-row archetype plan (the L0–L2 completion bar, the `pipeline_artifacts` write path, the live-UE lease, human-gated presentation steps), then finalize for multi-pipeline parallel development.
