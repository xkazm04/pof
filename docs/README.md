# PoF documentation

**PoF (Pillars of Fortune)** is a Next.js 16 / React 19 web app that drives UE5 ARPG game development: it holds authoring truth in SQLite, dispatches Claude Code CLI sessions to produce real engine artifacts, and verifies them against a live Unreal Engine 5.7 project via a companion bridge plugin.

> New here? Read [`architecture/overview.md`](architecture/overview.md) first — it's the system map and links everything below.

## Architecture

The whole-app architecture, one doc per subsystem:

| Doc | Covers |
|-----|--------|
| [architecture/overview.md](architecture/overview.md) | System map, the app↔SQLite↔UE contract, subsystem index, a catalog row's lifecycle |
| [architecture/ui-shell.md](architecture/ui-shell.md) | The `/layout` homepage, Category→Catalog→Entity tree, the Baseline composition screen, the server-backed produce→persist→rollup loop, §8 One-Shot Authoring |
| [architecture/module-system.md](architecture/module-system.md) | Sub-module registry (checklists/quick-actions), the feature dependency graph + NBA engine, the per-module evaluator passes |
| [architecture/prompts-and-cli.md](architecture/prompts-and-cli.md) | The 6-section prompt builder, the `CLITask`/`TaskFactory` abstraction, the `@@CALLBACK` result-capture flow, skills packs |
| [architecture/state-and-persistence.md](architecture/state-and-persistence.md) | Zustand v5 stores (+ persist gotchas), the SQLite `*-db.ts` layer, the `{success,data}` API envelope |
| [architecture/runtime-patterns.md](architecture/runtime-patterns.md) | The typed event bus, the `Lifecycle` protocol, the suspend/LRU pattern, and the enforced coding conventions |

## Catalog pipeline

The system that turns a catalog "row" (item, monster, quest, material, …) into a tested, UE-wired pipeline — the focus of recent work:

| Doc | Covers |
|-----|--------|
| [catalog/index.md](catalog/index.md) | The StepSpec chassis: catalogs, rows, archetypes, `ArchetypeStep`, config-complete |
| [catalog/AUTHORING.md](catalog/AUTHORING.md) | How to author a row — the recipe + the per-CLI loop; §Alternative: One-Shot Mode |
| [catalog/WIRING-AND-ACCEPTANCE.md](catalog/WIRING-AND-ACCEPTANCE.md) | The UE↔SQLite data contract + the 4-tier acceptance ladder + the parallel-dev model |
| [catalog/PIPELINE_REVIEW.md](catalog/PIPELINE_REVIEW.md) | The step-archetype library + per-row archetype sequences |
| [catalog/ARPG-LAWS.md](catalog/ARPG-LAWS.md) | The Diablo/PoE-grade systems reference content must obey |
| [catalog/QUALITY-GATE.md](catalog/QUALITY-GATE.md) | The blocking content-fidelity + wiring review |
| [catalog/L3-L4-RUNNER.md](catalog/L3-L4-RUNNER.md) | The L3/L4 test-gate runner that drains deferred gates into real verdicts |
| [catalog/E2E-COVERAGE.md](catalog/E2E-COVERAGE.md) | The Playwright walker + vitest guard that e2e-cover every registered pipeline (CLAUDE.md Rule 5) |
| [catalog/LEGACY-SALVAGE.md](catalog/LEGACY-SALVAGE.md) | UE gotchas / known asset paths migrated into the Project Canon |

## UE integration & generation

| Doc | Covers |
|-----|--------|
| [ue5-companion-plugin-design.md](ue5-companion-plugin-design.md) | The PoF Bridge editor plugin (HTTP on :30040 — status, manifest, test runner, snapshots) |
| [ue5-capability-integration-candidates.md](ue5-capability-integration-candidates.md) | Backlog of native UE 5.6/5.7/5.8 features to target (engine-side) |
| [visual-generation-roadmap.md](visual-generation-roadmap.md) | The asset/character generation directions (what PoF *generates*: 2D/3D/material/rig) |

## Conventions

Project conventions (import alias, logger, chart-colors, timing constants, the catalog-authoring rules) live in [`.claude/CLAUDE.md`](../.claude/CLAUDE.md); the enforced subset is summarized in [architecture/runtime-patterns.md](architecture/runtime-patterns.md).

## Recent additions

- **2026-05-27** — Scheduled nightly builds: a server-side cron (`src/instrumentation.ts`) runs a chosen build profile through preflight → cook → smoke → size-budget unattended, skipping the cook when git HEAD is unchanged since the last build. See [architecture/runtime-patterns.md §Server-side scheduler](architecture/runtime-patterns.md).
- **2026-05-26** — One-Shot Authoring: autonomous catalog-row production via gap-analysis → LLM proposal → step loop. See [architecture/ui-shell.md §8](architecture/ui-shell.md) and [catalog/AUTHORING.md §Alternative](catalog/AUTHORING.md).
