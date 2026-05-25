# Phase 10 · Per-catalog Enhancements · Batch Roadmap

> Multi-session work. Each batch ≈ 0.5–2 sessions of focused TDD. Order by dependency: catalog substrate (P7 facet registry) must exist before per-catalog batches can land. Pick batches by impact + readiness, not strict serial order.

## Batches keyed to KEEP-ENHANCE ideas in docs/_scratch/idea_verdicts.md

### Batch 10-S · Spellbook deepening
Ideas: `058687cb` (C++↔BP roundtrip), `158f9e5e` (auto-balance pipe), `21f15b68` (sentence→ability), `99292419` (effect param decoder). Each ships as one facet in `facets/spellbook/`.

### Batch 10-I · Items deepening
Ideas: `05f25f33` (XP curve morph), `327e3733` (closed-loop balance), `3f7e7c81` (curve library), `5eee9409` (sensitivity sweep), `84abc79e` (faucet/sink tables). Facets in `facets/items/`.

### Batch 10-L · Loot Tables deepening (largest batch — 12 ideas)
Ideas: `0b7d17a0`, `1aa2d0a2`, `1ae5a8f8`, `1d82300f`, `448c5209`, `56f5c3dc`, `5b1db241`, `884b95bd`, `cc0b91ba`, `f88f6bbf`, `eed3b9d2`, `ff6ff0d2`. The loot economy is the biggest enhancement surface. Plan to ship 3-4 ideas per session.

### Batch 10-B · Bestiary deepening
Ideas: `1e6353c7` (perception tuner), `375a9f88` (balance baselines), `3bf34f3d` (sensitivity), `3e817d61` (LLM combat director), ✅ `40a97970` (archetype guardrails — DONE `ecw-phase-10-B-kickoff`: `lintArchetypeBalance` + BestiaryBalanceFacet), `42f7d140` (frame data), `7d150641` (describe-a-boss), `7f745e3c` (describe-your-hero), `acca239f` (NL enemy AI), `ce107528` (custom archetype lib). Already has the Phase 7 BestiaryDetailFacet base.

**Template established (10-B kickoff):** per-catalog enhancement = pure `src/lib/<domain>/*.ts` function (fully unit-tested) + a facet in `src/components/ecw/facets/<catalog>/*Facet.tsx` that reads needed data from stores, runs the function, renders results, and self-registers via `registerFacet`. Side-effect import added to `EntityInspector.tsx`. Each remaining 10-* idea follows this shape.

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
