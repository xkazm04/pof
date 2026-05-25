# PoF Entity-Centric Workspace · Plan Index

> Master index for the 12-phase refactor specified in `docs/superpowers/specs/2026-05-24-pof-entity-centric-workspace-design.md`. Each phase gets its own bite-sized TDD plan file. Plans are written as we approach them — Phase N's plan can reference shapes (component names, store APIs) decided in Phases 1..N-1.

## Phase status

| # | Phase | Plan file | Status |
|---|---|---|---|
| 1 | **L1 shell scaffold** | `2026-05-24-pof-ecw-phase-01-shell.md` | ✅ DONE @ `ecw-phase-1-complete` (fd83f25) |
| 2 | **Entity Inspector primitive** | `2026-05-24-pof-ecw-phase-02-entity-inspector.md` | ✅ DONE @ `ecw-phase-2-complete` (04d4fcc) |
| 3 | **Catalog Hub** | `2026-05-24-pof-ecw-phase-03-catalog-hub.md` | ✅ DONE @ `ecw-phase-3-complete` |
| 4 | **CLI Rail + two-way binding** | `2026-05-24-pof-ecw-phase-04-cli-rail.md` | ✅ DONE @ `ecw-phase-4-complete` (core scope; ~12 enhancement ideas → P4b) |
| 5 | **Mission Control** | `2026-05-24-pof-ecw-phase-05-mission-control.md` | ✅ DONE @ `ecw-phase-5-complete` (focused scope; full dash consolidation → P10) |
| 6 | **Live State** | `2026-05-24-pof-ecw-phase-06-live-state.md` | ✅ DONE @ `ecw-phase-6-complete` (focused scope; UObject/crashes/3D-twin → P6b/P10) |
| 7 | **Module migration A — Core Engine catalogs** | `2026-05-24-pof-ecw-phase-07-migrate-core.md` | ✅ DONE @ `ecw-phase-7-complete` + `ecw-phase-7b-complete` (all 5 facets: bestiary/combat/screen/zone/state-graph) |
| 8 | **Module migration B — Promote Materials/Audio/Animation-Assets** | `2026-05-24-pof-ecw-phase-08-promote-catalogs.md` | ✅ DONE @ `ecw-phase-8-complete` + `ecw-phase-8b-complete` (all 3 substrates; 11 catalogs total) |
| 9 | **Module migration C — Fold Evaluator + Game Director + Game Systems** | `2026-05-24-pof-ecw-phase-09-fold-evaluator.md` | ✅ AUDIT @ `ecw-phase-9-audit-complete` (fold-in table mapped; execution → P10-MC) |
| 10 | **Per-catalog enhancements (KEEP-ENHANCE batches)** | `2026-05-24-pof-ecw-phase-10-enhancements.md` | 📋 ROADMAP — 6 batches mapped; multi-session execution |
| 11 | **Design-system + a11y + observability pass** | `2026-05-24-pof-ecw-phase-11-infra.md` | 🟡 STARTED @ `ecw-phase-11-batch1-complete` (GlossaryTerm + glossary + forecast + ForecastCard wired); remaining batches multi-session |
| 12 | **Cutover, cleanup, live proof** | `2026-05-24-pof-ecw-phase-12-cutover.md` | ✅ PLAN @ `ecw-phase-12-plan-complete` (8/8 UE gates GREEN; cutover gated on P10 + rest of P11) |

## Cross-phase invariants

- **Branch**: `feature/entity-centric-workspace`. All work lands here.
- **Legacy flag**: Phases 1–11 keep the old shell behind `?legacy=1`. Operator A/B at any point.
- **Each phase ends green**: `npm run validate` clean (or only foreign errors from shared-tree concurrency), targeted vitest green, `npx tsc --noEmit` 0.
- **Commits**: bite-sized, end every step with a green-test commit. Co-author tag every commit with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **Shared-tree discipline**: `git add` only files I touched. Watch foreign WIP modifications and leave them alone.
- **Catalog substrate**: do NOT touch `src/lib/catalog/{types,recipe,sections,batch}.ts`, `catalogStore.ts`, `useGeneration.ts` unless an additive widening is documented. The folder-09 work is the foundation; this refactor sits on top.

## Backlog ideas mapped per phase

See `docs/_scratch/idea_verdicts.md` for the full assignment. Summary:

- **Phase 1** (shell): ideas `c09e7172`, `18ad7099`, `41c61ebf`, `675dc44d`, `a79bc1c5`, `c59b4ae9`, `d3b45c2e`, `bb068439` (palette + onboarding + TopBar polish).
- **Phase 2** (entity inspector): ideas `23d79c4d`, `e9255c2c`, `ad320c67`, `f0797199`, `a920346d`, `e4e85439`, `da8d4fef` (the universal primitive).
- **Phase 3** (catalog hub): ideas `b2668699` (project home → IS the catalog hub root for v1 → moves to MC root in P5).
- **Phase 4** (CLI rail): ideas `04a08364`, `0ee551b8`, `4974ec2c`, `5144e216`, `6d9c9b9a`, `7bc512b9`, `8db7a7ed`, `a465ebf2`, `a89549dc`, `af5fbfe9`, `dafd6380`, `e0ed7c04`, `f340c77b`, `fe9b39ab`, `9eebaf16`, `3b8efd65`, `135ee09d`.
- **Phase 5** (Mission Control): ideas `043728da`, `08d07649`, `0a08d250`, `0a9fe477`, `13107c70`, `15defbed`, `1e301d12`, `21cea6d3`, `26a2c5f7`, `2c4da945`, `2c5de488`, `2cba6df6`, `3f4977fb`, `4e8d7fda`, `6237f43c`, `75fe1f1a`, `7b6ccedf`, `7df95d2a`, `8603d0d6`, `8a45533b`, `925151c6`, `96f25afc`, `ae20a945`, `b7927f28`, `c7cff73a`, `ce5b130d`, `d67fa562`, `e1d1b89b`, `ef237c77`, `f0f6e2e3`, `ff53b742`, `9e354881`, `ab134014`, `2a5aaf2f` (the 26-tab consolidation).
- **Phase 6** (Live State): ideas `34b53407`, `4328916d`, `53d018a8`, `a23c6e6d`, `a615e7f7`, `a65d0226`, `d876056b`, `fff73bb0`, `ce85ff81`, `d5e081f5`, `3271c34c` (always-on UE).
- **Phase 10** (per-catalog enhancements): ~67 KEEP-ENHANCE ideas, distributed by catalog (see `idea_verdicts.md` table).
- **Phase 11** (infra): ~37 KEEP-INFRA ideas (typography, a11y, design-system unification, glossary).
- **Phase 12** (cutover): final cleanup + 8 live UE gates re-verification + tag `v2.0-entity-centric`.

## Pre-flight done (P0)

- ✅ P0-A: backlog categorization consolidated → `docs/_scratch/idea_verdicts.md` (commit 83889ef)
- ✅ P0-B: spec written and committed → `docs/superpowers/specs/2026-05-24-pof-entity-centric-workspace-design.md` (commit 83889ef)
- ✅ P0-C: 156 DROP-* backlog files deleted (commit d4eca1e)
- 🔄 P0-D: writing plans (this index + Phase 1 ready; Phases 2-12 written as approached)
