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
| [catalog/HARNESS-APPLICABILITY.md](catalog/HARNESS-APPLICABILITY.md) | How the Observation/Scenario harness wires across pipelines as the L3 (runtime) / L4 (visual) verification engine — observed behaviour over symbolic green |

## Feature & capability map

| Doc | Covers |
|-----|--------|
| [features/README.md](features/README.md) | Going-forward (Blueprint) capability map: all 31 catalog pipelines (one folder each) + the LLM↔Unreal harness, with the shared [pipeline architecture](features/pipeline-architecture.md) reference |

## UE integration & generation

| Doc | Covers |
|-----|--------|
| [ue5-companion-plugin-design.md](ue5-companion-plugin-design.md) | The PoF Bridge editor plugin (HTTP on :30040 — status, manifest, test runner, snapshots) |
| [ue5-capability-integration-candidates.md](ue5-capability-integration-candidates.md) | Backlog of native UE 5.6/5.7/5.8 features to target (engine-side) |
| [ue58-mcp-convergence-plan.md](ue58-mcp-convergence-plan.md) | Prototype plan for converging PoF's UE control surface onto UE 5.8's first-party MCP (Candidate G) while keeping the verification moat |
| [ue58-mcp-phase2-tool-map.md](ue58-mcp-phase2-tool-map.md) | Per-tool DROP/PORT verdict: our 40 MCPUnreal tools vs Epic's 5.8 first-party toolsets (the Phase 2 scope) |
| [concepts/UE/](concepts/UE/README.md) | **Maintained UE reference + followups** for future sessions — L4 autonomous visual capture (architecture + headless-launch recipe) and the UE followups backlog |
| [visual-generation-roadmap.md](visual-generation-roadmap.md) | The asset/character generation directions (what PoF *generates*: 2D/3D/material/rig) |
| [animation-capture-pipeline.md](animation-capture-pipeline.md) | **The autonomous animation pipeline**: text → Veo video → MetaHuman markerless capture → IK-retarget to Manny → harness render → VLM grade. The 5 hard-won fixes, the numeric+VLM verification, and the plan to remove Gemini (Leonardo/Wan video gen + Qwen-VL critique) |
| [parallel-development-plan.md](parallel-development-plan.md) | **4 concurrent Claude Code streams** building a Jedi vertical slice (environment / character / actions / inventory): the worktree+content isolation model, the shared-code coordination zones, per-stream scope + frame/observation acceptance, the integration order, and paste-ready kickoff prompts |

## Conventions

Project conventions (import alias, logger, chart-colors, timing constants, the catalog-authoring rules) live in [`.claude/CLAUDE.md`](../.claude/CLAUDE.md); the enforced subset is summarized in [architecture/runtime-patterns.md](architecture/runtime-patterns.md).

## Recent additions

- **2026-06-23** — Autonomous animation pipeline proven end-to-end: text → Veo video → MetaHuman markerless body capture → IK-retarget → Manny → render → VLM grade (42/100, first clip). Full backbone + the Gemini-removal plan (Leonardo/Wan for video gen, Qwen-VL for the critique) in [animation-capture-pipeline.md](animation-capture-pipeline.md).
- **2026-06-19** — Autonomous UE: `src/lib/ue-launch` (headless 5.8 launcher) + L4 visual capture wired into the test-gate runner (launch → render → Gemini, no operator). Reference + followups in [concepts/UE/](concepts/UE/README.md).
- **2026-06-18** — UE 5.8 first-party MCP research: Epic shipped an official MCP server (`AICallable` / Python Toolset Registry, tool-search, in-editor Terminal). Refreshed [Candidate G](ue5-capability-integration-candidates.md) and added a [convergence prototype plan](ue58-mcp-convergence-plan.md) — adopt the control surface, keep PoF's verification moat.
- **2026-05-27** — Scheduled nightly builds: a server-side cron (`src/instrumentation.ts`) runs a chosen build profile through preflight → cook → smoke → size-budget unattended, skipping the cook when git HEAD is unchanged since the last build. See [architecture/runtime-patterns.md §Server-side scheduler](architecture/runtime-patterns.md).
- **2026-05-26** — One-Shot Authoring: autonomous catalog-row production via gap-analysis → LLM proposal → step loop. See [architecture/ui-shell.md §8](architecture/ui-shell.md) and [catalog/AUTHORING.md §Alternative](catalog/AUTHORING.md).
