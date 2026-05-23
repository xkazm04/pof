# 09 · Core Engine Generator — verification strategy

Two layers must be trustworthy for generation-at-scale to be safe: the
**app-side catalog/engine** (so the operator can author hundreds of assets
without the UI or batch dispatcher misbehaving) and the **per-asset
functional-test gate** (so "generated" actually means "works in-engine"). The
guiding lesson from the vertical slice: *the report is gameable; only a
functional test that drives the real path is a true pass signal.*

## App-side tests (PoF, vitest + Playwright)

### Catalog data model + store
1. **`catalogStore` reducer tests** — add/update/remove entities; lifecycle
   transitions are monotonic and only advance on the right signal
   (`wired`→`verified` only with a `pass` test result). Assert transient
   generation-run state is **not** persisted (the moduleStore `isRunning`
   lesson).
2. **Cross-catalog link integrity** — a Bestiary entry referencing a deleted
   Ability/Loot entry surfaces a broken-link state, not a crash.
3. **Feature-matrix roll-up** — a catalog entity declaring `featureName` rolls
   its lifecycle into the existing feature-matrix status correctly.

### `CatalogView` framework (the scalability gates)
4. **Virtualization render test** — mount a catalog with **1000 synthetic
   entities**; assert only the visible window renders (DOM node count bounded),
   scroll stays responsive. This is the explicit guard against the FeatureMatrix
   "render all 200+ rows" failure mode.
5. **Faceted filter correctness** — combined text + lifecycle + tag + type
   facets produce the exact intersection; debounce doesn't drop the final query.
6. **Tree ↔ list sync** — selecting an L4 `categoryPath` node narrows the list to
   that subtree; counts per node are correct at 4+ levels.
7. **URL round-trip (Playwright)** — deep link
   `/core-engine/arpg-gas/spellbook/offensive/fire/ga-fireball` restores section
   + tree path + open detail drawer; back/forward preserve state.
8. **Bulk-select + action bar** — N selected → one batch op enqueues N jobs;
   selection survives filter changes within the same catalog.

### Generation engine
9. **Recipe prompt-assembly test** — `buildPrompt(entity, step, ctx)` includes
   the `.withAssetSpec` payload + the wiring-requirements + binary-content
   tripwire (folder 01); a fixture entity produces a stable prompt (snapshot).
10. **`@@CALLBACK` merge test** — a generation callback merges `staticFields`
    (`catalogId/entityId/step`) over model output (tamper-proof), validates the
    UE-asset-paths shape, and advances exactly one lifecycle step.
11. **Batch dispatcher isolation** — given M queued entities, assert the
    dispatcher runs **one isolated dispatch at a time** (the SP-B single-dispatch
    lesson), advances each only on its own success, and a mid-queue failure
    marks that entity `failed` without poisoning the rest.
12. **Lifecycle-gate test** — `verified` is reachable **only** when the recipe's
    `testPath` returns `Result={Success}`; a failing/absent test leaves the
    entity at `wired` (no silent promotion).

## Per-asset functional-test gates (UE, `AFunctionalTest`)

Each section's recipe ships with a gate the `verify` step runs headless via
`Automation RunTests`. These are the in-engine truth. Reparent them onto folder
08's `AARPGFunctionalTestBase` once it lands.

| Section | Gate | Asserts |
|---|---|---|
| Spellbook | `AVSAbility_<id>Test` | activate by tag → target attribute changes (the `AVSEnemyAttackTest` pattern) |
| Bestiary | `AVSBestiary_<id>Test` | spawn → chases + attacks (player Health drops) → drops linked loot on death |
| Items | `AVSItems_DefinitionsTest` | all definitions load; required fields/slots valid; icons resolve |
| Loot Tables | `AVSLoot_<id>Test` | roll N times → empirical distribution matches configured weights within tolerance |
| Combat Map | `AVSCombat_DamageMatrixTest` | each interaction applies expected damage/reaction to the target |
| Screen Flow | `AVSScreen_<id>Test` + Gemini | widget mounts/binds/transitions; bar moves on attribute change |
| Zone Map | `AVSZone_<id>Test` (in-map) + Gemini | player spawns, nav exists, encounter triggers; layout sane |
| State Graph | `AVSAnim_LocomotionTest` + screenshot | AnimInstance locomotion state updates under movement |

**Batch verification.** A composite `all-catalog-verifications` run (extends
folder 08's `all-verifications.spec.ts`) runs every section's gate; the catalog
shows a per-entity green/red column. A nightly run catches any entity that
regressed to `failed`.

## What makes scale safe

- **Virtualization + faceting are tested** (tests 4–6) so the UI provably holds
  1000 items — the single biggest gap in today's `FeatureMatrix`.
- **The lifecycle gate is tested** (tests 11–12) so `verified` can never be
  reached without a green functional test — the "compiles ≠ runs" gap closed at
  the framework level, for every asset, automatically.
- **The CDO-vs-instance trap is encoded in recipes** (see [`game.md`](game.md))
  and caught by the per-asset gates (a wrong instance value fails the spawn
  assertion loudly, as it did this session).
- **Single-dispatch isolation is tested** (test 11) so batch generation of
  hundreds of assets degrades gracefully (one failure ≠ whole-batch loss) — the
  expensive lesson from SP-B, made cheap and permanent.

## Anti-goals (don't test, don't build)

- No test that asserts a `.uasset` exists on disk as a proxy for "works" — it's
  gameable; use the functional gate.
- No bespoke per-section list UI — the framework tests (4–8) cover all 8
  sections; a section that needs its own list test means the schema abstraction
  leaked and should be fixed in the framework, not duplicated.
