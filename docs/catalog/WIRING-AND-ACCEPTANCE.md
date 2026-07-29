# Wiring & Acceptance — UE ↔ SQLite balance, acceptance tiers, parallel-CLI model

Research feeding the multi-pipeline plan. Answers four operator questions: (1) what data lives in the UE project vs SQLite, (2) acceptance for Leonardo/Blender (human gallery selection), (3) how far an automated UE "live check" can go (live run + codebase analysis), (4) how 5–9 parallel CLIs each operate maximally with the live-UE step as an **accepted, skippable gap**. Grounded in the existing code — much of the plumbing is already present.

## 0. What already exists (so we extend, not rebuild)

**SQLite (`~/.pof/pof.db`, `src/lib/*-db.ts`):**
- `catalog_lifecycle` — `(catalog_id, entity_id)` → `lifecycle`, `ue_assets[]` (JSON), `last_test_result`, `last_verified_at`. Written by the `@@CALLBACK` system → `POST /api/catalog` → `upsertLifecycle` (`catalog-db.ts`), gated by `resolveTransition` (only `verified` needs a passing test).
- `pipeline_tracks` — per-entity production-track state (`not-started|in-progress|done|blocked`).
- `ability_specs` — GAS authoring state (`effects[]`, `tag_rules[]`, optional `provenance` JSON: adopted-forge C++ + prompt) → `POST /api/ability-spec`. The B3 codegen input; surfaced in the UI by the GAS Blueprint Editor's spec bar (load/save) and the Ability Forge's adopt bridge.
- `headless_builds` — **a UE build queue/results table** (`/api/ue5-bridge/build`). Already a single-resource serialization point.
- `visual_verifications` — **agentic screenshot + Gemini HUD verdicts** (`/api/verify/visual`). The visual-gate infra already exists.
- `balance_baselines`, `session_analytics`, `error_memory`, plus run-history (`procgen/scatter/mixamo/audio_import`).

**Not in SQLite:** the catalog entity's typed `data` payload (ItemData, SpellbookAbility…) lives in **seed files** (`src/lib/catalog/seed-*.ts`) + client localStorage. Only *lifecycle + assets + verdicts* are server-persisted.

**UE project (`C:\Users\kazda\Documents\Unreal Projects\PoF`, UE 5.8):**
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
- **B. Human-selection** *(Leonardo / Blender)* — generation produces candidates; **the user selects one from the gallery**, and the selection (+ chosen asset) persists. Acceptance grades the **selected candidate**. This is the operator's point #2: art steps are **human-gated**, not auto-judged. (The lab's Icon 2D already works this way.)

  > **The gallery grades the ASSET (2026-07-29).** Acceptance used to be "a selection exists": `selected()` was `typeof v === 'number' && v >= 0` and examined nothing else, so a gallery step went green whether or not anything had ever been generated — **44 of the 47** registered gallery steps were provably insensitive to any change in their own content (measured with the two mutation probes of `step-facts-derived.test.ts`). `selected()` now delegates to `gradeGallerySelection` (`acceptance/galleryArtifact.ts`), which resolves the selection against `data.genHistory` and grades the candidate it names:
  >
  > | Selected candidate | Verdict |
  > |---|---|
  > | carries a REAL generated asset — `imageUrl`, `payload.glbUrl` / `assetPath`, or a gap-loop-injected `swatch: url(data:…)` | **pass** (L1); the detail names the asset |
  > | a deterministic **swatch** placeholder | **deferred (L4)** with a reason — no generator has run, and no local edit can conjure one. *Honesty over greenness*: deliberately not a pass |
  > | resolves to no kept candidate, or projects an index other than the graded field | **fail** — the graded value is not the selected candidate's (cannot arise from a clean Produce) |
  > | no `genHistory` at all | **deferred (L4)** — the index alone proves nothing |
  >
  > Rule 5 still holds (`pass \| deferred`, never `fail`/`pending` after a clean Produce), and the deferral is reported at **L4** because what is missing is a *visual* asset — which is what the walker's deferred-banner rule expects. Every `gallery` produce stub now seeds the same artifact shape the lab writes, via `gallerySeed(field, count)` — one kept batch of honest swatch candidates, auto-selected — so the stub is faithful and the fleet metric is measurable. Two consequences for authors: (1) compose `selected(...)` **LAST** in an `allOf`, because `allOf` reports the first non-pass and a swatch deferral would otherwise mask a genuinely failing link / value / wiring check; (2) a gallery step reads green only once its generator has actually run. Ratchet: `src/__tests__/catalog/galleryGrading.test.ts` (0 of 47 shape-only, down from 44).

  > **Auto-picked is not human-chosen (2026-07-27).** `appendBatch` auto-selects the new batch's first candidate, so the `selected(...)` gate (~47 gallery steps, 45 of which still browse deterministic swatches) is satisfied the instant Produce is clicked once. Acceptance is deliberately **unchanged** — requiring a click would break the e2e walker's terminal-status rule — but the CLAIM is now honest: `GenHistory` records `autoSelected` (set by `appendBatch`, cleared by `selectCandidate`, including when a human clicks the machine's own pick), `selectionSource(history)` classifies it `none | auto | human | unrecorded` (a history persisted before the flag reads `unrecorded`, never back-filled as human), and `ArchetypeStep` passes it to `StepFrame` → `ProvenanceStrip`, which renders a colorblind-safe `SELECTION: AUTO` / `SELECTION: HUMAN` chip (glyph + word via `StatusTag`, never hue alone). The strip now renders for a step with **no** audited `StepFact` too, so fact-less gallery steps still carry the claim.
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

**Checker context (cross-step / cross-catalog).** A `Checker` (`src/lib/catalog/acceptance/types.ts`) takes an OPTIONAL second argument, `CheckerContext` — `{ catalog, siblings, has(catalog, entity) }`. It is backward-compatible (every single-argument checker is unchanged) and is threaded by **both** resolution paths: the lab acceptance path (`ArchetypeStep` builds `has` from the catalog store; `resolveAccept` forwards it) and the headless server path (`headless.ts` builds `siblings` from persisted artifacts and `has` from the seeded entities). This lets an **L2 data-integrity** check resolve declared cross-catalog links *in accept* rather than only in the display banner: `linksResolve()` (`linkCheckers.ts`) → satisfied links `pass`, a broken link `deferred` naming the unresolved target (never a hard fail — the target may be authored later). Compose it onto a step's shape check with `allOf(...)` (`combinators.ts`). **Fleet-wide since 2026-07-27:** EVERY step that declares cross-catalog links composes `linksResolve()` on top of its existing checks (66 steps across 26 pipelines) — enforced by rule (h) of the fleet spec linter (`src/__tests__/catalog/pipeline-spec-linter.test.ts`), which fails a step that declares links its acceptance never reads. Rule (i) of the same linter runs every step's `accept` under a seed-backed context and asserts a cleanly-produced step never grades `fail`, and that no L0–L2 step defers on unresolved links (Rule 5). A checker that reads context must **degrade gracefully when it is absent** (a ctx-free rollup path supplies none) — never regress a satisfied step.

**One context for the whole lab (2026-07-27).** The lab used to build that context in three places with three different answers — the banner (`ArchetypeStep`) passed `siblings: {}` + a live `has()`, while the write-through that PERSISTS the verdict (`Baseline/useBaseline`) and the rail/matrix recompute (`deriveEntityArtifacts`) passed real siblings + `has: () => false`. A sibling-aware checker could therefore show one verdict on screen and store another, and every link-aware checker persisted a pessimistic `deferred` while the banner read `pass`. All three now go through **`src/components/layout-lab/labCheckerContext.ts`**: `buildLabCheckerContext(catalogId, entitySteps, entitiesByCatalog)` (pure) and `labCheckerContext(catalogId, entityId)` (live snapshot, for the non-React write-through). Unified semantics: `siblings` = **every** persisted step of the entity, including the step being graded (mirroring the server's `serverCheckerContext`, which lists all of the entity's artifacts), and `has` = the **live catalog store** `entitiesByCatalog` (the lab's counterpart of the server's `seededEntities`) — `() => false` is not a neutral default, it asserts "no entity anywhere exists". The write-through grades through the single entry point `labGrade(catalogId, entityId, step, data)`, so the persisted status is by construction the status on screen.

**A failed write-through says WHY (2026-07-29).** The write-through is optimistic — the local
artifact is written first and `postArtifact` runs in the background — so its FAILURE reporting is the
only thing standing between "produced" and "produced somewhere no one else can see". Three holes are
closed. (1) `postArtifact` returns a `Result<PipelineArtifact, string>` instead of a boolean, and the
POST route folds zod's issue detail INTO the envelope's `error` string (the standard `tryApiFetch`
client surfaces `error` and drops `details`), so a rejected payload names its offending fields.
`LabStepArtifact.syncError` therefore holds a sentence, not a flag. (2) A produce dispatched with NO
sync sink registered — `setLabSync` is a module singleton the Baseline shell nulls on unmount —
records `NO_SYNC_SINK_REASON` instead of writing local-only in complete silence. (3) `hydrateEntity`
CLEARS a recorded `syncError` when the server returns a row at least as new as the local artifact
(the claim "your work never got there" has been disproved); a strictly older server row is a previous
produce and leaves the flag alone. The reason surfaces in two places: the rail dot's `⚠` title, and an
`InlineErrorRetry` banner in the work canvas directly ABOVE the step's acceptance banner, reading
"Acceptance below is LOCAL ONLY — <reason>" with Retry (re-POSTs the stored artifact) and Dismiss.

**The lab applies the judge bridge and the drain verdict.** `ArchetypeStep` derives its banner through `resolveStepAcceptance` — **checker → `serverVerdictOverlay` → `bridgeJudgeVerdict`** — then layers remediation copy. `serverVerdictOverlay(local, persisted)` (same file) is the ONE place a server verdict may win: only a local `deferred` (all a pure Checker can say about an unrun L3/L4 gate) is resolved by a concrete server `pass`/`fail`, carrying the server's tier + reason — the server never overrides a checker that could decide for itself. That server verdict reaches the client because `LabStepArtifact` now carries optional `status`/`tier`/`reason` (additive) which `hydrateEntity` merges onto an existing local artifact — **content stays add-only**, only the verdict is adopted — so running a gate drain visibly resolves the step instead of leaving it frozen at `deferred`. Judge verdicts come from `useStepJudgeVerdicts` (one cached `/api/judge-verdicts?catalogId=` read per catalog, non-throwing → no overlay on failure), so a current-rubric matching-class judge FAIL down-grades the on-screen banner exactly as it already did for `/status` and the headless recipe.

**Content invariants (L0/L2) — beyond shape.** A plain shape checker (`fieldsPopulated`, `minCount`) passes a config that *populates* its fields even when the numbers VIOLATE a design law. `src/lib/catalog/acceptance/invariants.ts` adds deterministic content assertions that read the actual numbers and check them against law THRESHOLDS **parsed from the canon rule bodies in `canon/canon-seed.ts`** (single source of truth — never hardcoded; a canon edit flows through, and a parse that no longer matches throws at module load). Covers price/power `0.8–1.2×` and power-target `±10%` (`proj-balance`), faucet/sink `±15%` (`proj-economy`), required-level band (`arpg-item-level`), rarity affix budget (`arpg-item-rarity`), XP growth rate (`arpg-leveling`), monster life multipliers (`arpg-monster-rarity`), plus structural `componentsSumTo` / `sumReconciles` / `arithmeticReconciles` (a stated total must equal its parts / product / quotient). Each non-pass emits a SPECIFIC reason (which law, actual vs allowed). Compose an invariant onto a step's existing shape check with `allOf(...)`. Extends the `withinPercent` precedent in `dataCheckers.ts`.

**Self-consistency invariants (canon-independent).** Most numeric steps declare their OWN ceiling/band/ladder in the artifact and then graded a literal copied from the prose — so the DECLARED budget was never enforced (a produce could write `cap: 8` next to `measured: 11` and pass). Three invariants close that: `budgetWithinCap(objPath, valueKey, capKey)` (measured ≤ the cap the artifact declares), `valueWithinDeclaredBand(objPath, valueKey, minKey, maxKey)` (a value inside its own declared band — also fails an INVERTED band), and `descendingSeries(objPath, keys, label, valueKey?)` (a budget ladder that must actually get cheaper: LOD0 > LOD1 > LOD2 tris, low-health > critical threshold). Where a step had no declared target, the target is now WRITTEN on the artifact (`economySim.marginTargetPct`, `gameTier.sizeCapMB`) and graded — one number, not a prose claim plus a literal.

**Adoption is enforced, not aspirational.** Every checker in `invariants.ts` is tagged via `acceptance/contentInvariant.ts` (`markContentInvariant` / `isContentInvariant`), and `allOf` propagates the tag, so composition is machine-detectable. The fleet spec linter therefore enforces rule **(k)**: every `archetype: 'balance'` step must compose ≥1 content invariant, plus a ratchet on fleet-wide adoption (`INVARIANT_ADOPTION_FLOOR`, currently 20 of 32 pipelines). Wired sites: all 16 balance steps (ambient, bestiary, character-pipeline, combat-map, crafting-recipes, currencies, items, loot-tables, materials, music, progression-curves, save-points, spellbook, status-effects, vendors, vfx) plus numeric non-balance steps (props LOD ladder, hud-elements state thresholds, input-schemes deadzone, zone density). `src/__tests__/catalog/content-invariants.test.ts` corrupts one graded number per wired step and asserts the verdict flips to `fail` — the invariants demonstrably BITE, they don't just exist.

**Actionable reasons.** Every shape checker (`dataCheckers.ts` / `graphCheckers.ts`) now emits a SPECIFIC structured `reason` on any non-pass — the offending field name + what failed + what was expected (e.g. `field "stats" missing: damage, armor`) — not a bare `pending`. That reason flows to the `StepFrame` banner's `why`/`suggestion` via `genericFixCopy` (used only as the fallback when a step has no bespoke `StepSpec.copy`). And `safeAccept` (`headless.ts`) no longer swallows a thrown checker into an opaque "unverified": it degrades to `pending` (never an optimistic pass) but SURFACES the real throw message (truncated) as the reason.

**The fix direction is never empty.** One-click "Produce fix" resolves its direction down a three-rung ladder — a step's bespoke `StepSpec.copy(...).fixDirection` → its `StepSpec.defaultDirection` → the direction **derived from the failing checker itself** (`fixDirectionFor`, `steps/shared/genericFixCopy.ts`). The last rung always returns a non-empty instruction, so a corrective produce can never run with no direction (it used to, for every step whose checker returned no `reason` — 0 of 344 steps author either of the first two rungs). The derived text names only the step's label, its archetype's authored corrective act (9 blocks, one per archetype — the largest unit that can say something concrete without inventing catalog content), the criterion label the checker reported and the checker's own `reason`; it never states a target value the checker did not. The exact string is **previewed in the banner's `suggestion` before dispatch**, so the operator reads what is about to be sent. `deferred` still gets no fix button and no direction — a runtime/visual gate is not locally fixable. Locked by `src/__tests__/components/layout-lab/genericFixCopy.test.ts`, which walks every registered step in every non-pass, non-deferred status. Acceptance grading is untouched: this is produce input only.

**Judge → acceptance bridge (one truth).** The acceptance ladder (a step's shape Checker) and the judge honesty-overlay (`judge_verdicts`) are two separate truths; `statusModel.deriveCell` merges them ONLY for the /status map, so the pipeline's own `AcceptanceResult` — what the lab, the headless recipe, and the gate-drain consume — used to show a bare checker-pass while a matching-class judge had scored the content FAIL. `src/lib/catalog/acceptance/judgeBridge.ts` (`bridgeJudgeVerdict`, pure) mirrors `deriveCell`'s judge semantics into the acceptance path: a **CURRENT-RUBRIC** judge FAIL down-grades a checker-`pass` to `fail` (which the map renders as `attention`), carrying the judge's verdict + findings excerpt as the `reason`. Only verdicts at `rubricVersion >= RUBRIC_VERSION` (`@/lib/judge/rubrics`) count — an older verdict is provisional/superseded and IGNORED; a wrong-judge-class verdict never speaks for the step (only the audited `StepFact.judge` class, or a `human` verdict, is relevant). It is **READ-ONLY** — it consults existing verdicts, never re-grades the judge, and never elevates (a judge PASS does not manufacture a checker pass; elevation stays a /status concern where the produced tier is known). Wired in `headless.ts` at the seams that produce/consume a step's `AcceptanceResult`: `gradeArtifact`, `submitStepArtifact` (the persisted artifact keeps the checker's own verdict — storage separation is deliberate — but the RETURNED acceptance is bridged), and `buildStepRecipe`'s `currentStatus`.

**ONE acceptance truth (2026-07-29).** `src/lib/catalog/acceptance/resolveStepAcceptance.ts` is now the **only** place the three verdict sources are merged, in the only correct order: the step's **Checker** → `serverVerdictOverlay` (a real L3/L4 drain outcome supersedes a local `deferred`) → `bridgeJudgeVerdict` (a current-rubric, matching-class judge FAIL condemns a shape-pass). `serverVerdictOverlay` + `PersistedVerdict` moved here from `labCheckerContext.ts` (re-exported there) so the server-importable path can use them too.

Before it, TWO derivations each claimed to be the one truth: the step banner (`useStepAcceptance`) applied all three layers, while the rail, the matrix, both coaches and the entity rollup (`deriveEntityArtifacts`) stopped after the server overlay — so a judge-failed step showed a **green rail dot next to its own red banner**, and `/status` (which bridges, via `headless.ts`) sided with the banner against the rail. Every consumer now funnels through the one function: `useStepAcceptance` (banner), `deriveEntityArtifacts` (rail + `summarizeEntity` rollup), `buildMatrixRows` (matrix), `buildGlobalCoach` + `NextStepCoach` (both coaches) and `headless.ts` `bridgeAcceptance` (`/status`, MCP, gate-drain). Guarded by `src/__tests__/catalog/oneAcceptanceTruth.test.ts`.

Two consequences worth knowing:
- **Verdict plumbing.** `deriveEntityArtifacts` / `buildMatrixRows` / `buildGlobalCoach` take the catalog's `JudgeVerdict[]` as a trailing argument (absent → no judge overlay, never a fabricated verdict); the React wrappers read them from `useCatalogJudgeVerdicts` / `useAllJudgeVerdicts` — ONE cached `/api/judge-verdicts` read per catalog (or one unscoped read for the cross-catalog coach). That cache was permanently module-scoped with a test-only clear, so a verdict written mid-session could never reach the screen; entries now expire after `JUDGE_VERDICT_CACHE_TTL_MS` and `invalidateJudgeVerdicts(catalogId?)` drops them on demand.
- **Drift now compares the SHOWN status.** `deriveEntityArtifacts.driftByStep` used to compare the PRE-judge checker status to the server row, which hid the most important divergence: write paths persist the **raw checker** verdict by design, so a judge-condemned step reads `fail` on screen while the server row still says `pass`. Drift is derived post-bridge, so `DriftBanner` / `nextActionableStep` can surface it. A local `deferred` resolved by the server stays reconciliation, not drift.

**Verdicts bind to content (2026-07-29).** A judge verdict used to condemn a step **forever**: `judge_verdicts` recorded no reference to the artifact content it judged, so `bridgeJudgeVerdict` filtered on rubric version alone — fix a step, re-produce it, and the obsolete verdict still downgraded it, with no way to tell a current condemnation from one about content that no longer exists. Measured against the live DB when this landed: of the **305 rubric-3 FAILs**, only **36 (12%)** still judged content the step actually holds — **92 (30%)** had no artifact row at all and **177 (58%)** had been re-produced since the judgment.

- **The binding.** `src/lib/judge/contentHash.ts` — `stepContentHash(data)` is a pure, isomorphic fingerprint (canonical key-sorted JSON → `<scheme>-<len>-<fnv1a>`); the gallery's `genHistory` re-roll log is excluded (browsing candidates is not a content change; the SELECTED candidate is already projected top-level, and hashing the log would silently clear real condemnations). `judge_verdicts` gains an **additive, nullable** `content_hash` column (migration-latch, as in `ability-spec-db.ts`) surfaced as `JudgeVerdict.contentHash`.
- **ONE hashing rule, three consumers (scheme `v2`, 2026-07-29).** The write path (`POST /api/judge-verdicts`), the verdict bridge (`judgeBridge`) and the lab's drift comparator (`labContentDrift`) all hash through `stepContentHash` — and `_provenance` is now excluded there, not locally. It had to be: `stampPromptVersion` writes `_provenance` onto **every** row the `/api/pipeline-artifacts` POST persists, the verdict's hash is derived from that persisted row, and the lab hashes the **local** artifact the browser produced, which never carried the stamp. The two could therefore never agree for a browser-produced step — a *current* judge FAIL classified `stale`, stopped condemning, and the strip claimed "re-produced since" about byte-identical content while `/status` still showed the fail. `labContentDrift` kept its own `_provenance` strip, so drift saw no divergence either and `adoptServer` was unreachable: the bug self-healed in neither direction. The **headless** seam has the opposite polarity — `submitStepArtifact` (MCP `pof_submit_artifact`) and the L3/L4 gate re-persists (`staticVerify` / `packagingVerify`, which re-write `existing.data` verbatim) store **no** stamp, so those rows agreed by accident. Excluding the stamp at the one seam makes both paths hash the produced content, which is all a judge ever read.
- **The scheme migration is explicit, never silent.** `CONTENT_HASH_SCHEME` prefixes every hash; changing the exclusion set bumps it (`v1` → `v2`). A stored hash from an older scheme is **not comparable** (`isComparableHash`), so `verdictProvenance` degrades it to `unknown` — explicitly unverified and **still condemning** — never to `stale`, which would retire every standing condemnation at once. The reason/note names the superseded scheme (`unverifiedReason`). Measured against the live DB at the bump: **0 verdicts changed classification** (all 420 rows predate the `content_hash` column and are NULL); of the 354 current-rubric verdicts, **208** would have been mis-classified `stale` on the next judging run under the old rule (their artifact row carries `_provenance`), **48** bound correctly by accident (headless rows, no stamp) and 98 have no artifact.
- **Written at the single write seam.** `POST /api/judge-verdicts` derives `contentHash` from the artifact on record for the same (catalog, entity, step) unless the producer supplies one — so `scripts/judge-run.ts`, the gap-loop scripts and anything future bind without opting in. No artifact yet → NULL, never a fabricated binding.
- **Four provenances, none silent.** `judgeBridge.verdictProvenance(v, content)`: `current` (hash matches → fully binding, condemns) · `stale` (hash disagrees, OR — for legacy hash-less rows — `judgedAt` predates the artifact's `updatedAt`; **does not condemn**) · `unknown` (no hash and no way to date it — it **still condemns**, because a recorded fail is evidence and dropping it would be the optimistic lie this layer exists to prevent, but the reason carries `[unverified provenance: …]` naming *why* — no binding recorded, or a binding from a superseded hash scheme) · `superseded` (older rubric — provisional, never condemns). Whenever a failing verdict exists the result carries `AcceptanceResult.judge` (`JudgeAttribution`: provenance, verdict, score, judge/model, judgedAt, plain-language `note`) **even when it was NOT applied** — that is the point: "unjudged since the re-produce" must never read as "judged and passed".
- **ONE rubric filter.** `@/lib/judge/rubrics` now owns it: `newestRubricVerdicts(verdicts)` — *only the verdicts at the newest rubric present speak* — applied by BOTH `judgeBridge` and `statusModel.deriveCell`, with strictness asked separately via `isCurrentRubric(v)`. The two previously spelled the rule differently (`>= RUBRIC_VERSION` vs `=== newestRubric`), which agrees today and diverges the moment `RUBRIC_VERSION` is bumped.
- **NOT a re-judge.** Nothing here re-runs or re-grades a judge; it is provenance binding only. Guarded by `src/__tests__/catalog/verdictContentBinding.test.ts` (unit) and `src/__tests__/api/judge-verdict-content-binding.test.ts` — the latter runs the **real** write path (both routes, real SQLite) against the **real** lab read path (`resolveStepAcceptance` on the local, unstamped artifact), which is the exact seam every unit test on either side missed.
- **On screen, not only in the data (2026-07-29).** `ProvenanceStrip` now renders `AcceptanceResult.judge` as a colorblind-safe chip: `VERDICT: CURRENT` (ok) vs `VERDICT: STALE` / `VERDICT: UNVERIFIED` / `VERDICT: SUPERSEDED` (warn). So "this step is condemned by a verdict nobody can bind to the content on record" is legible where the verdict is acted on. `StepFrame` passes it through from the banner's `Acceptance`; display only.

**Explain this verdict (2026-07-29).** `src/lib/catalog/acceptance/explainAcceptance.ts` (pure) reconstructs the whole chain for ONE step — for each layer (`checker` → `server-overlay` → `judge-bridge`) its **input**, its **output**, whether it **WON** (changed the verdict), and a plain-language note — plus `decidedBy`, the direct answer to "why is this step this colour?". For an `allOf` step it also names the **member that spoke**: `allOf` reports the FIRST non-pass, so the tier and reason on screen belong to one composed check and nothing said which; `combinators.ts` records its members on the composed function under a symbol (`allOfMembers`, metadata only — grading untouched, exactly like the content-invariant mark) and the explanation re-runs them to mark it.

It applies the SAME functions in the SAME order as `resolveStepAcceptance`, so `explanation.final` is that function's output by construction — asserted for a checker pass, a server-overlaid deferred and a judge-bridged fail in `src/__tests__/catalog/explainAcceptance.test.ts`. **Display only, and on demand:** `useStepAcceptance` hands the banner an `explain()` **thunk**, and `ProvenanceStrip` invokes it only while its existing "Why this grade?" disclosure is open — it re-runs the step's checker, which must be a reader's cost, never a per-render one across ~342 steps. No new panel and no new visual language: the chain renders inside that disclosure in the strip's own `MicroLabel`/`StatusTag` vocabulary.

**Headless-operability gate (/status).** A `verified` grade claims professional-grade, machine-reproducible proof — so a cell cannot grade `verified` unless its step is proven **headless-operable via pof-mcp** (drivable/verifiable without a human at the editor). A coverage walker, `scripts/headless-coverage.mjs` (regen: `node scripts/headless-coverage.mjs` with the dev server running), enumerates every registered step and records `{catalogId, step, operable}` into `src/lib/status/headless-coverage.json`. `statusModel.gateHeadless(cell, catalogId, step, lookup=getHeadlessFact)` (pure, lookup injectable) demotes a would-be-`verified` cell to `trusted` — the honest ceiling for a claim the machine can't reproduce — when the step has no coverage entry OR is `operable:false`, prefixing the reason `not headless-operable via pof-mcp`; all other grades pass through unchanged. `getHeadlessFact(catalogId, step)` exposes a single fact. `buildSwimlane` applies the gate to every cell after `deriveCell` (via an injectable `headless` parameter defaulting to the json-backed lookup), so `verifiedPct` reflects the gated grades. `deriveCell` itself is untouched — the gate is a `/status`-only overlay, like the judge bridge.

**Capability layer (/status, Phase 1).** The /status map has two layers. The four project-instance tabs (Pipelines / Category / Item Focus / Models) grade a *specific* project's realization, cell by cell. The **Capability** tab (the default landing) is a READ-ONLY lens *above* them: it grades our generation TECHNIQUE per **capability class** (text-config, 2d-art, ui-glyph, 3d-mesh, animation, audio, ue-runtime, graph-data, vfx-particles — one per step-facts `deliverable`, reusing the judge's `deliverableClassOf` ui-glyph split), answering "which parts of any game project can our stack generate at pro quality, where are the gaps." `src/lib/status/capabilityModel.ts` (pure — json + args only, mirrors `statusModel`) pools the latest `rubricVersion>=3` `llm-panel` verdict per `(catalog|entity|step)` cell (synthetic entities skipped), maps each to its class, and per class computes a **median + n + excluded count** and a grade: `proven` (median ≥90, n≥3) / `strong` (85-89) / `capped` (a documented technique wall, or median <85 with evidence) / `unproven` (no verdicts, or the class's steps are predominantly `generatorWired:false` / `trueEngine None` — e.g. `ue-runtime`/`animation`, which are graded by the L3/L4 gates, not the panel). Each row surfaces its technique stack (dominant `trueEngine`s), judge class, and a gap statement derived from the known walls. **`src/lib/status/ceiling-facts.json`** encodes the green-loop campaign's recorded ceilings, each classed `technique` (adversarial-escalation / craft-depth / judge-arithmetic — stays IN and caps the class) vs `project-data` (locked seeds, canon collisions, unseeded upstream, IP) vs `checker-structural` (a checker forces the number the judge then flags) — the latter two are EXCLUDED from the median so it measures TECHNIQUE, not this project's data; ambiguous causes are classed `technique` (conservative). `provenance` is the constant `'derived-from-project-instances'` for Phase 1; the type reserves `'neutral-benchmark'` for a future Phase 2 that would grade against a fixed benchmark set instead of the live project. Clicking a capability row drops into the Pipelines map filtered to that class's steps. This layer NEVER touches `statusModel` grading, the checkers, or any gate.

**Capability layer — neutral-brief benchmark (Phase 2).** Phase 1/1.5 graded a class from its *project-instance* verdicts, which entangles two things: how good our **technique** is, and how locked/unseeded *this* project's data happens to be. Phase 2 disentangles them with a **neutral benchmark** that makes a capability grade project-portable. It runs the whole **technique stack** — the quality prompt pack (`src/lib/prompts/quality`) + the generation engine + the model-policy model/effort — on **canon-FREE neutral briefs** (a generic grim-fantasy ARPG, world *"Emberfall"*, with **no** PoF canon, **no** siblings, **no** locked numbers), judged by the **same strict rubric with `canonContext`/`siblingContext` OMITTED** (canon-free), **median-of-3**, **sequential**. The score answers "can this stack ship an X for *any* game project," not "did it fit PoF canon." The brief bank is `scripts/capability-bench/briefs.json` (each: `id`, `class`, `title`, `brief`); the harness is `scripts/capability-benchmark.ts` (tsx — `--class <c>` filter, `--dry` plan, `--force` re-run; **resumable**: skips briefs already scored). Text/graph produce via `qualityPack(cls)` + the `claude` CLI at `getModelPolicy('produce-text')` (graph-data has no dedicated rubric, so it is produced and judged under the `text-config` contract). 2D/ui-glyph produce via `POST /api/leonardo` (mode `image`) with **`applyStyleDna:false` deliberately** — neutral ≠ project style, noted `styleDna:false` in the row — authoring the image prompt through the quality pack, then judging the served image by `Read`. Results append to **`src/lib/status/capability-benchmarks.json`** (`{generatedAt, rubricVersion, rows:[{class, briefId, score, draws, model, effort, engine, styleDna?, deferred?, note?}]}`, deterministic order). **Spend guard:** ≤6 Leonardo generations, **no** Tripo / ElevenLabs; a credit error records `benchmark-unavailable: credits` and stops that class — **never** a fabricated score. Classes with no neutral judge this phase carry an honest **deferred** row (no score): `3d-mesh` (Tripo spend not authorized), `audio` (human review only), `vfx-particles` (no engine wired), `ue-runtime` + `animation` (gate-proven — graded by live L3/L4 gates). `capabilityModel.buildCapabilityRows(verdicts, artifacts, benchmarks = CAPABILITY_BENCHMARKS)` overlays the benchmark: when a class has **scored** benchmark briefs the neutral median **drives** the grade on the same ladder (provenance flips to `'neutral-benchmark'`), the project-instance median is kept visible as the secondary `projectMedian` (the view reads "benchmark 84 · project 82"), and the documented project **technique cap is NOT re-applied** (the canon-free score IS the direct technique measurement; the `cappedByTechnique` flag stays visible for context). A deferred/unavailable **notes-only** row leaves the grade untouched and just surfaces the note in the gap statement — no faking. These verdicts are **not** posted to `/api/judge-verdicts` (they are not project cells); they live only in the benchmark JSON. Regenerate: `npx tsx scripts/capability-benchmark.ts` (dev server running for Leonardo).

**Capability layer — evidence streams per judge class (Phase 1.5).** Phase 1 graded *only* from `llm-panel` verdicts, so every non-text class read UNPROVEN despite real evidence. `buildCapabilityRows(verdicts, artifacts)` now routes each class to the evidence stream its steps' **audited `judge` class** (step-facts) demands, aggregating each cell by *its own* step's judge: (a) **score-judged** (`llm-panel` **and** `vlm`) keep the median ladder — a `vlm`-judged class (2d-art / 3d-mesh / ui-glyph) uses the latest `vlm` verdict per cell (NOT rubric-gated — vlm verdicts predate rubrics; legacy 0-10 vlm scores are normalized ×10 onto the 0-100 axis), and a class with both stream kinds aggregates each cell by its own judge and labels the row `mixed`; (b) **gate-judged** (`ue-test` → `ue-runtime`, `animation`) draw from declared **L3/L4** `pipeline_artifacts` (skip synthetic) — `passRate = gatesPassed / gatesDeclared` (declared = pass + deferred + fail; deferred = declared-not-run) on a conservative ladder: `proven` = rate ≥0.9 AND passed ≥10, `strong` = ≥0.7 AND ≥5, `capped` = declared below that (gap names the deferred/failing count), `unproven` = none declared — shown as "N/M gates pass" not a median; (c) **human / none** (audio VO, vfx `none`) stay `unproven` unless a `judge='human'` verdict exists for their human-judged cells. The row's `stream` field (`llm-panel` / `vlm` / `gates` / `human` / `mixed` / `none`) drives the provenance sub-label; `provenance` itself stays `'derived-from-project-instances'`. Data plumbing reuses the dashboard's existing fetches — all-judge `/api/judge-verdicts` plus per-catalog `fetchArtifacts` (same source as the Pipelines map) — no new aggregate endpoint. Still no new judging: existing verdicts and gate results only.

**What L2/L3 should actually assert** (salvaged from the Legacy 3-pass evaluator + wiring contract — see [`LEGACY-SALVAGE.md`](LEGACY-SALVAGE.md) §B): the legacy eval ran *Structure → Quality → Performance* + a per-domain *trace*. Map it onto the ladder: **L2** = structure + UE-convention quality (the symbol/row exists *and* follows conventions); **L3** = the *trace* (one observable end-to-end behavior, e.g. combat's one-hit path). Also enforce the **wiring contract**: an artifact that compiles but isn't *granted/activated* is **not** config-complete — a step's L2 must check it's registered + triggered (the "no gray-box" rule), and the step's Verification line becomes its acceptance `detail`/`reason`.

**The wiring contract is now GRADED and READABLE (2026-07-27).** The fleet authored **137** `wiringContract` blocks across 30 pipelines (`{ grantedBy, activatedBy, verification, dependencies }`, usually nested under the step's own view field) — and until this landed *nothing read them*: no view, no checker, so `grantedBy: 'TBD'` still graded `pass`.

- **Checker** — `src/lib/catalog/acceptance/wiringCheckers.ts` → `wiringContractSound(field?, label?)`, composed onto every one of those 137 steps with `allOf(...)` (existing checks untouched, exactly like `linksResolve()`). `field` is the dot-path of the container (`'triggerProgress'`, `'layers.bed'`); omit it for a root-level contract. It asserts **shape and content**: `grantedBy` / `activatedBy` / `verification` are non-blank prose ≥ `MIN_PROSE` chars and not placeholders (`TBD`/`TODO`/`n/a`/`none`), `verification` must NAME a ladder tier (`L0`–`L4`) — an unfalsifiable "it works" line is not a verification contract — and `dependencies` must be an array of non-blank strings (empty is legal). **Where present only**: a step that declares no contract passes (mirroring the empty-link-set pass), so it can never turn a clean Produce into a failure. Context-free and deterministic.
- **Linter rule (j)** — `src/__tests__/catalog/pipeline-spec-linter.test.ts` proves the composition *behaviourally*: for every step whose `produce()` writes a contract and whose clean accept passes (136 of the 137), it hollows the contract out to `TBD` and asserts the step no longer passes. A future step that authors a contract without grading it fails `validate`.
- **Reader** — `steps/shared/RawArtifactDisclosure.tsx` renders a collapsed `<details>` "Raw artifact" panel on **every generic step** (`ArchetypeStep` appends it to the panel grid): the stored `data`, `ueAssets` and the persisted server verdict, verbatim, invented nothing. Produce bodies write 10–60× what any View renders; this is the honest window onto the rest. Serialization happens **only when expanded**, so the ~342 generic steps pay nothing while collapsed.

**The bespoke Items steps rejoined the fleet rails (2026-07-29).** The 13 hand-built Items step UIs — the *reference* pipeline — had drifted into the least honest corner of the lab: three different grading contexts and none of the honesty affordances every generic step gained. `StaticStepFrame` hand-rolled a `CheckerContext` with `has: () => false` (the anti-pattern `labCheckerContext.ts` documents — it asserts "no entity anywhere exists"), and `ItemArt`'s three generative steps called `accept(data)` with **no** context at all; neither saw the server-drain overlay or the judge bridge, so a drained gate or a matching-class judge FAIL changed /status while the bespoke banner still read a bare checker pass.

- **One derivation** — `steps/shared/useStepAcceptance.ts` is the ONE on-screen acceptance path for *every* step UI: `buildLabCheckerContext` (real siblings + a live `has`) → `resolveStepAcceptance` (the shared merge, above). `ArchetypeStep`, `StaticStepFrame` and the new `GenerativeStepFrame` all consume it (the generic renderer still layers `withGenericFixCopy` on top).
- **One set of affordances** — `GenerativeStepFrame` (the generative counterpart to `StaticStepFrame`) wraps `useGenerativeStep` + `CandidateGallery` + `CliProduce` and supplies the SELECTION provenance chip; both frames append `RawArtifactDisclosure`. All 13 bespoke steps now render a provenance strip and a raw-artifact panel, asserted by `src/__tests__/components/layout-lab/bespokeStepHonesty.test.tsx`.
- **Un-audited is now loud** — the 2026-07-07 gap audit covers a subset of the fleet's steps, and a step with no `StepFact` used to render *no* strip, which read identically to "audited and fine". `StepFrame` now renders the strip whenever a step names itself (`catalogId` + `step`), and `ProvenanceStrip` shows a `PROVENANCE: UNAUDITED` warning tag when no fact resolves. (An anonymous `StepFrame` with no catalog/step still renders no strip.) Display only — grading is untouched. This is why the Items 11-fact vs 13-bespoke-step name duality no longer silently hides five steps.

### Step facts derive from the code (2026-07-29)

`step-facts.json` powers the strip's central claim — `CHECKER: MEANINGFUL` vs `SHAPE-ONLY` — and
it was hand-maintained JSON with **no guard**. Measured against the live registry it had already
drifted in **58 places**, 5 of them in the dangerous direction (the fact said shape-only while the
checker was a real content invariant, so the strip *under-claimed* verification the code performs),
plus 1 claim no code backed at all and 2 live steps (`character-pipeline::Apparel`, `::Skins`) with
no fact — each rendering `PROVENANCE: UNAUDITED` with nothing to notice.

`src/__tests__/catalog/step-facts-derived.test.ts` makes the code the evidence. Every claim is
probed against the step's real `produce()` output and `accept()` closure:

| Probe | What it proves |
|---|---|
| `content-invariant` | the `isContentInvariant` marker, **and** independently: perturbing ONE numeric leaf flips the verdict |
| `link-integrity` | the checker READS `links` (it resolves cross-catalog references) |
| `wiring-contract` | hollowing the declared `wiringContract` to `TBD` flips the verdict |
| `bridge-result` | `produce()` dispatches a python module — a runner supplies the truth |
| `value-content` | replacing every string leaf with a **same-length** nonsense token flips the verdict (a graph/reference law such as `graphValid` — it grades what the strings SAY, not how many there are) |

Two rules, both code-derived, pinning both edges:

1. **No under-claim** — a checker that is a content invariant may not be advertised as shape-only.
   This hides real verification, and it is what the 5 drifted rows did.
2. **No unjustified claim** — `checkerMeaningful: true` must be backed by ≥1 probe. A pure
   `minCount` / `fieldsPopulated` / `minLength` checker cannot claim it. (`character-pipeline::UE
   Import` — `minCount('created', 3)` — was corrected to `false`.)

Deliberately **not** enforced: 1:1 equality with `isContentInvariant`. 53 of the 58 disagreements
are a different *vocabulary* — a packaging manifest, a link resolution or a graph law is meaningful
without grading a number — and forcing them to the invariant definition would mislabel them. Rules
(1)+(2) get the guarantee without the mislabelling: a `true` is always backed by code, a `false` can
never hide a content invariant, and weakening a checker turns its `true` red on the next `validate`.

**Coverage runs both ways** — every live step has a fact, every fact has a live step, no duplicates.
A new step can no longer ship rendering `PROVENANCE: UNAUDITED`, and a deleted step can no longer
leave a fact asserting something about nothing. (`items` counts both specs' labels — see below.)

**`auditedAt` is gone.** It was a hand-written date with **zero readers** in `src/`, three weeks
stale on a file rewritten the same day, while `ProvenanceStrip` told readers the strip showed "the
2026-07-07 gap audit". A freshness claim nothing can keep true is worse than none. The derivation
rules above are the audit now: they re-run on every `validate`.

### Items is ONE pipeline — the duality is declared, not implied (2026-07-29)

`items` is the only catalog with **two** step specs, and they disagree: the registered
`src/lib/catalog/pipelines/items.ts` declares **11** labels, while `steps/itemsSteps.ts`
(`ITEM_STEP_SPECS`) declares the **13** the lab actually renders and grades — only 6 names overlap.
Every fleet guard enumerates `allCatalogPipelines()`, so the guards covered the 11 nobody sees and
none of the 13 everybody grades. Concretely: 7 on-screen steps had no `StepFact` (→ a loud
`PROVENANCE: UNAUDITED`), no linter rule touched a bespoke `accept`, and `items::Test Gate` graded a
non-terminal `pending` after a clean Produce — a **Rule 5 violation in the reference pipeline**.

- **Declared in one place** — `ITEMS_SPEC_DUALITY` (+ `ITEMS_ON_SCREEN_STEPS`,
  `itemsRegistrySteps()`, `itemsSharedSteps()`, `itemsAllStepLabels()`) in
  `src/components/layout-lab/catalogManifest.ts`, next to the `BESPOKE_CATALOGS` routing that
  creates the fork. **On-screen (13)** = what a human walks and grades; **registry (11)** = what
  `/status`, the headless pof-mcp drains, the L3/L4 runner and the judge fleet enumerate.
- **Not merged, on purpose** — registry labels key persisted `pipeline_artifacts` rows, recorded
  `judge_verdicts`, `step-facts.json` and the headless drains; bespoke labels key the per-step UI
  registry (`getStepComponent`) and the reference e2e walk. Renaming either side orphans recorded
  data. A `StepFact` row is keyed by `(catalogId, step)`, so a **shared** label carries one fact
  describing that step identity in both specs; the 7 bespoke-only labels now carry their own.
- **Guarded** — `src/__tests__/catalog/items-spec-duality.test.ts` asserts the declaration against
  both real sources, that **every** items label in either spec has a `StepFact` (18 rows, 0
  unaudited), and applies the fleet linter's rules to the bespoke specs: every field an `accept`
  reads is written by its `produce()`, and a clean Produce reaches a **terminal** status
  (`pass`, or `deferred` **with a reason**).
- **Rule 5 restored** — the bespoke `Test Gate` no longer returns `pending` when it has nothing to
  derive from. It ran, so it is terminal: **`deferred` at tier `L3`** with the reason
  "VSItemsDefinitionsTest has not reported and no sibling artifacts are in scope", mirroring the
  registry Items gate's `entityRuntimeDeferred`. With real siblings it still derives green from
  upstream acceptance, and an upstream failure still **fails** the gate — the derivation was
  restored, not weakened.

**Tables tell the truth (2026-07-29).** 99 of the fleet's 451 declared table columns could never resolve against their own `produce()` output — **28 tables rendered nothing but `— missing`** to every user (factions, cutscenes, dialog-trees, state-graph, screen-flow…). The cause was structural, not typos: the generic `table` view assumed the column keys lived at the TOP level of `data[field]`, while most produce bodies write a **LIST** of row records (`tiers: [{tier, minPoints, …}]`) or a **KEYED GROUP** of them (`layers: { bed: {name, gainDb, …} }`).

- **One resolver** — `src/lib/catalog/tableView.ts` (`resolveTableView`, pure) understands all three shapes (`kv` / `rows` / `absent`+`mismatch`) and reports which declared columns no row carries. A metadata sibling (`wiringContract`, a scalar note) is never turned into a blank row: a nested record becomes a row only if it carries at least one declared column.
- **One renderer** — `DataTable` gains a `rows` mode (columns become the header; the group key becomes a row label; list/record cells format instead of printing `[object Object]`). `ViewPanel`'s `table` branch drives it through the resolver, and a genuinely wrong shape now renders the loud `ShapeMismatch`, never a grid of "— missing".
- **`rowsKey`** — the optional table-descriptor key for a row list nested one level down (`hazards` + `rowsKey: 'hazardList'`, `telemetry` + `'events'`). `field` stays the top-level key, so linter rules (f) and (g) are untouched.
- **Linter rule (f2)** — `pipeline-spec-linter.test.ts` now descends into `view.columns`: every declared column must resolve against the step's own stub produce, through the same resolver the UI uses. Nine steps whose columns genuinely named the wrong keys were reconciled to the real produce data (never the reverse — no catalog content was invented to fill a column). Fleet-wide result: **129 table steps / 462 columns / 0 unresolved / 0 blank tables**.

## 3. How far the UE "live check" goes (live run + codebase analysis)

Per the research, the split is concrete:

- **Static / codebase analysis (L2) covers a lot, cheaply and in parallel:** symbol existence (class/struct/`UPROPERTY`/enum), source logic (cost/cooldown, damage formula, archetype const defaults), asset *reference path strings*, and data-integrity of the app-authored inputs (`manifest.json` schema, `seed_*` CATALOG format, app-spec vs DataTable-row diff). For a *config gate*, L2 is often enough to call a step "config-complete".
- **Live (L3) is required for** anything dynamic: a class/asset actually *loads*, a DataTable *has the row with the right values* (Python CDO read), an actor *spawns*, a `GameplayEffect` *applies and moves an attribute*, loot *drops*, cooldown tags *block re-activation*. Use the existing functional tests; judge by `-abslog` markers (`[gate] RESULT=PASS`).
- **Visual (L4)** — render correctness — needs RHI + Gemini (`visual_verifications`); this is the known "missing render gate" the catalog program keeps hitting.

So a single UE "live check" job can **combine** L2 (always, free) with L3 (when it can get the editor): the runner first does static analysis, then — if it holds the live-UE lease — runs the Python/functional-test pass and upgrades the verdict. The gate result records the **highest tier reached** and what was deferred.

**Two L2 drains re-grade persisted artifacts from disk truth** (operator-triggered, filesystem-only, no bridge):

- **`/api/pipeline-artifacts/verify-static`** — runs a step's declared `staticChecks` (`cppSymbolExists` / `seedRowPresent`) against the real UE tree (`src/lib/catalog/acceptance/staticVerify.ts`).
- **`/api/pipeline-artifacts/verify-packaging`** — the **packaging truth engine** (`src/lib/catalog/acceptance/packagingVerify.ts` + `src/lib/catalog/packaging/`): for every step matched by `isPackagingStep` (the `packaging: true` StepSpec flag, or the canonical `"UE Packaging"` label — so all pipelines are covered without per-pipeline edits), it **rebuilds the row's package from its SIBLING artifacts** — referenced files (incl. `/api/visual-gen/asset/…` URLs mapped to their `generated/triposr/` disk homes) hashed in place, embedded data-URL art materialized as real files — into `generated/packages/<catalogId>/<entityId>/` with a `manifest.json` (`files[]` bytes+sha1, honest `missing[]`, `ueDeclarations[]`). The verdict derives from the manifest: all staged files **and** all `/Game/...` declarations disk-realized (`Content/<path>.uasset|.umap` under the resolved UE root — Tier 2) → **L2 pass**; anything missing → **deferred** with the paths/declarations as reason; declarations unchecked (no UE root) → files-only verdict, saying so. A clean Produce can defer here, never fail. `GET` = dry-run preview, `POST` = apply. An L3 rung exists for the declarations too: `scripts/ue/verify_package_declarations.py` (headless pythonscript commandlet, `does_asset_exist` markers, manifest via `POF_PKG_MANIFEST`) — live-validated to agree with the disk check. Spec/history: `docs/research/packaging-truth-engine-spec.md`.

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

## 6. Contracts reach the PROMPT, not only the checker (2026-07-29)

The 137 authored `wiringContract` blocks (§2) were read by exactly one consumer —
`acceptance/wiringCheckers.ts`. Every Produce prompt therefore asked a CLI to author an
artifact **without telling it the contract the artifact would be graded against**.

`src/lib/catalog/contractPrompt.ts` is the pure extraction that closes that loop. It runs a
step's own produce stub, walks it (depth-bounded) for `wiringContract` / `criteria`, and
renders a size-capped `# ACCEPTANCE CONTRACT FOR THIS STEP` block ending in the rule the L2
checker actually enforces (no placeholder, ≥ `MIN_PROSE` chars, `verification` must name an
L0–L4 tier). Three seams consume it, so the prompt is identical wherever a step is driven:

- `ArchetypeStep.buildPrompt` — the ~330 generic lab steps (the high-leverage seam),
- `headless.ts` `buildStepRecipe` — the pof-mcp / API step recipe,
- `recipe.ts` `recipeBuilder` — the four-phase generation recipes. A `GenerationRecipe`
  phase (`scaffold-cpp | author-python | wire | verify`) has no defined mapping onto a named
  pipeline step, so the **whole catalog's** contract-bearing steps are injected (contracts
  only) as a `## Wiring Requirements` table, capped at `MAX_CATALOG_CONTRACT_ROWS`.

Canon scope follows the same module: `canonCategoriesForStep` widens a **content-invariant**
step (`isContentInvariant` — a wrong NUMBER fails it) to the FULL in-scope canon, so the
threshold the step will be graded by (tier power ≈100 ±10%, resists capped 75%, faucet/sink
±15%) is present in the prompt that authors the number. Shape-only steps keep the narrower
`ARCHETYPE_CANON` slice.

**This is injection only.** Nothing here re-derives, re-validates or grades a contract; no
acceptance verdict moves. Measured on the live registry: **137 contract-bearing steps across
30 catalogs** (140 steps receive a block once criteria-only steps are counted), largest block
1 920 chars against a 2 400 cap — guarded by `src/__tests__/lib/catalog/contractPrompt.test.ts`.
