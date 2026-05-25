# Phase 10 · Per-catalog Enhancements · Batch Roadmap

> Multi-session work. Each batch ≈ 0.5–2 sessions of focused TDD. Order by dependency: catalog substrate (P7 facet registry) must exist before per-catalog batches can land. Pick batches by impact + readiness, not strict serial order.

## Batches keyed to KEEP-ENHANCE ideas in docs/_scratch/idea_verdicts.md

### Batch 10-S · Spellbook deepening
Ideas: `058687cb` (C++↔BP roundtrip), `158f9e5e` (auto-balance pipe), `21f15b68` (sentence→ability), `99292419` (effect param decoder). Each ships as one facet in `facets/spellbook/`.

### Batch 10-I · Items deepening
Ideas: `05f25f33` (XP curve morph), `327e3733` (closed-loop balance), `3f7e7c81` (curve library), `5eee9409` (sensitivity sweep), `84abc79e` (faucet/sink tables). Facets in `facets/items/`.

### Batch 10-L · Loot Tables deepening — ROUNDS 1+2 COMPLETE (4 facets; catalog saturated)
Loot-tables had **no** custom facets before this; now it has **4**: Economy · Author · Baseline · Balancer.
- ✅ Economy (`690454b` lib + `305a1dd` facet) → `src/lib/loot/economy.ts` (`computeExpectedValue` gold/kill, `rarityBreakdown`, `lintLootEconomy` — weight count/sum, drop-chance range, negative weights, roster-aware EV outlier) + LootEconomyFacet. Pure-function template.
- ✅ Author (`e384973`) → `loot-author-prompt.ts` (`buildLootPrompt` — reuse UARPGLootTable/FLootEntry, existing item pool, tier-consistent weights) + LootAuthorFacet (NL→CLI via `arpg-loot`). CLI-dispatch template.
- ✅ Baseline (`3c6f482`) → LootBaselineFacet (EV as score, per-rarity contribution as breakdown) over the **shared** `EntityBaselinePanel` extracted this round. Persisted-store template — reuses baseline-db/api/store; no new infra.
- Extracted `src/components/ecw/facets/shared/EntityBaselinePanel.tsx` — domain-agnostic persisted-baseline UI (fetch-load + capture + score/breakdown drift). BestiaryBaselineFacet refactored onto it (behaviour unchanged, tests green). The persisted-store template is now a reusable shell, not copy-paste.
- ✅ **Round 2 — Balancer** (`908d481` solver + `72bb7ef` facet) → `src/lib/loot/auto-balancer.ts` `solveWeightsForTargetEV` (set a target gold/kill; lerp current↔extreme weights, EV linear in α ⇒ closed-form, no search; reports reachability + weight diff) + LootBalancerFacet (target input → diff → CLI apply). **Consolidates 4 ideas: `0b7d17a0`+`1aa2d0a2`+`1d82300f`+`eed3b9d2`** (all "auto-balancer / goal-seek / self-balancing"). Also extracted `asLootBinding` into economy.ts (3 facet copies → 1).
- **Round-2 triage of the other 8 ideas (no-stubs rule):**
  - covered by existing facets → `448c5209`, `f88f6bbf`, `cc0b91ba`, `ff6ff0d2` (NL/conversational design = Author + Balancer CLI dispatch); `56f5c3dc` (audit-lint = Economy lint).
  - **wrong subsystem** (the ItemEconomySimulator `src/lib/economy/*` faucets/sinks/Gini/flowOverrides, NOT the loot-tables catalog's `EnemyLootBinding`) → `1ae5a8f8` (multiverse branch/diff), `884b95bd` (digital twin). These belong to a future "Economy Simulator deepening" batch, not 10-L. `884b95bd` is also a self-described stub (needs live UE telemetry).
  - **no backing data model** → `5b1db241` (PoE-style player loot-filter; no filter-rule data on EnemyLootBinding — would be inventing a subsystem).
- **Verdict: loot-tables catalog is facet-saturated** for its `EnemyLootBinding` data (evaluate→Economy, author→Author, regression→Baseline, auto-tune→Balancer). Further loot work = the Economy Simulator subsystem (separate batch).

### Batch 10-B · Bestiary deepening — PER-ENTITY FACETS SATURATED (7 facets shipped)
Bestiary entities now have **7 facets**: Detail (P7) · Balance · Threat · AI · Remix · Baseline · Encounter.
- ✅ `40a97970` (archetype guardrails) → `lintArchetypeBalance` + BestiaryBalanceFacet (`ecw-phase-10-B-kickoff`)
- ✅ `3bf34f3d` (stat-weight/sensitivity flavor) → `threat-score.ts` + ThreatScoreFacet (`ecw-phase-10-B-facets`)
- ✅ `acca239f` (NL enemy AI — coverage view) → `ai-coverage.ts` + BestiaryAiFacet (`ecw-phase-10-B-facets`)
- ✅ `7d150641` (describe-a-boss) + `acca239f` (NL authoring) → `remix-prompt.ts` + BestiaryRemixFacet (`ecw-phase-10-B-remix`)
- ✅ `375a9f88` (balance baselines) → `baseline.ts` (drift calc) + `baseline-db.ts` + `/api/balance-baseline` + `baselineStore` + BestiaryBaselineFacet (`7b5717b`). **First non-pipeline use of the persisted-store template.**
- ✅ `3e817d61` (encounter/combat director) → `encounter-mix.ts` (`suggestEncounterMix` + `buildEncounterPrompt`) + BestiaryEncounterFacet (`db06266`). Pure-fn + CLI-dispatch combined.
- ❌ `1e6353c7` (perception tuner) — SKIPPED: no perception/aggro/radius data on `ArchetypeConfig`, would be a stub (no-stubs directive).
- ↪ moved to other catalogs: `42f7d140` (frame data → combat-map), `7f745e3c` (describe-your-hero → character catalog).
- ⏳ only remaining bestiary-scoped idea: `ce107528` (custom archetype library — catalog-level, persisted-store template). Different surface than per-entity facets (a library panel / save-template flow), so a deliberate scope decision rather than another facet.

**Per-entity facets exploit all of `ArchetypeConfig`'s data** (stats → Balance/Threat/Baseline, btSummary → AI, role/tier+roster → Encounter, NL → Remix). Further bestiary value lives at the catalog level (archetype library) or in other catalogs.

**Three enhancement templates now proven:**
1. **Pure-function facet** (Balance/Threat/AI): pure `src/lib/<domain>/*.ts` (unit-tested) + facet reads stores/runs fn/renders + `registerFacet` + side-effect import in `EntityInspector.tsx`.
2. **CLI-dispatch facet** (Remix): pure prompt composer + facet with input → `useModuleCLI.execute(TaskFactory.quickAction(...))`.
3. **Persisted-store facet** (Baseline): pure model+calc + `<domain>-db.ts` (table + `rowTo*` pure mapper) + `/api/<domain>` GET/POST + a no-persist Zustand store (DB is source of truth, loaded on entity open) + facet that fetch-loads on mount and POSTs on action. Mirrors Phase 13 pipeline-db/pipelineStore.
Every remaining 10-* idea maps to one of these three.

### Batch 10-C · Combat Map deepening
Ideas: `01131c98` (dramatic tension), `0545ec6c` (combat auto-tuner), `1d6c71ad` (encounter sim), `1d108361` (A/B scenarios), `3d267f25` (difficulty topology), `43c47c8b` (self-balancing encounters), `5f579b32` (NL encounter design), `61e19e05` (combo library), `6bf2f7a3` (bot playtesting), `7b5e0a4a` (pacing curve), `b59a3d1d` (touch/kbd timelines), `c3d28b98` (LLM combo chor), `d098f8dc` (difficulty budget), `e1a395e5` (live PIE feel sync).

### Batch 10-F · Screen Flow + Zone Map + State Graph deepening
Combined batch (smaller individually):
- Screen Flow: `c9dd5463` (branching dialogue), `79afa857` (game master quests)
- Zone Map: `0b977d4d`, `2a2e30d7`, `2cca4005`, `3d267f25`, `671327ea`, `6ceabe12`, `8fe58af0`, `9a559a37`, `c2d7c71c`, `def6a488`, `ee2fd596`
- State Graph: `141c2420`, `1d108361`, `381106a5`, `4a0cf97d`, `6ef3584f`, `9c3f9b79`, `dbe71c3d`

### Batch 10-MC · Mission Control consolidation (Phase 9 fold-in execution)
Each Mission Control panel from the Phase 9 audit lands here. Insights, Quality, Critical Path DAG, Playtests, Roadmap, Build History panels.

## Sequencing recommendation
1. Start with 10-MC — extends Mission Control which is highest-traffic.
2. Then 10-B — extends the Phase 7 proof.
3. Then 10-L (loot economy is high-impact; many ideas; longest batch).
4. Remaining batches in any order; each is independent.

## Per-batch plan template
Each batch gets a dedicated plan file `2026-05-24-pof-ecw-phase-10-<catalog>.md` written when starting that batch. Plans follow the bite-sized TDD pattern from Phases 1-7.
