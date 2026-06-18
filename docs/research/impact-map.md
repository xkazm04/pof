# PoF Research Impact-Map

> **Purpose:** a fast triage index so `/research` (and any contributor) can map an idea to the handful of files it touches **without re-scanning the whole codebase**. Each entry: subsystem → key file anchors → *what kind of idea lands here* → *known gaps* / *already-has* → doc links.
>
> **How to use (Phase 6):** find the impacted subsystem here → it names the likely anchors and whether the area already has something → confirm with ONE targeted grep + a short read → land the change. **How to grow (Phase 9):** if a run touches an area that's missing/thin here, or finds a new anchor/gap/structural fact, append it. The map's value compounds — keep entries thin.
>
> Seeded 2026-06-18 from `docs/README.md`, `docs/architecture/*`, `docs/catalog/*`, and project memory. Buckets mirror `.claude/skills/research/SKILL.md`.

---

## A — Headless tooling (the automation loop)

### Harness (autonomous dev loop)
- **Anchors:** `src/lib/harness/` — `orchestrator.ts` (run loop, self-heal), `executor.ts` (`executeArea`), `claude-session.ts` (`spawnClaudeSession`/`buildClaudeArgs`, `@@HARNESS_RESULT` marker), `verifier.ts`, `visual-gate.ts`, `plan-builder.ts`, `checkpoint.ts`, `state-io.ts`.
- **Lands here:** new autonomous-build behaviors, per-area execution, self-heal passes, budget/cost governance, result-marker contracts.
- **Already-has:** stream-json parse, cost tracking (`total_cost_usd`/`cost_usd`), SIGTERM timeout, allowed-tools/bare/verbose flags, **optional `--mcp-config` via `enableMcp`** (Phase 1, commit `059c95a`).
- **Docs/memory:** `[[project_harness]]`.

### CLI terminal service (app-spawned Claude)
- **Anchors:** `src/lib/claude-terminal/cli-service.ts` (`startExecution`/`buildCliArgs`, stream-json events, `@@CALLBACK`), `mcp-config.ts` (`resolveAutonomousMcpArgs`, `POF_CLI_MCP_CONFIG`), `skills.ts`, components in `src/components/cli/`.
- **Lands here:** how the app spawns Claude Code, MCP wiring, callback capture, session reuse, prompt skills injection.
- **Already-has:** `--dangerously-skip-permissions`, stream-json, resume, autonomous `--mcp-config` opt-in.
- **Docs/memory:** `docs/architecture/prompts-and-cli.md`.

### pof-mcp (headless MCP over the app API)
- **Anchors:** `tools/pof-mcp/src/` — `index.ts`, `pofClient.ts`, `tools/{pipeline,harness,sims,ue,design}.ts`.
- **Lands here:** new headless MCP tools that drive catalog pipelines / harness / sims from the CLI. **Thin adapter over the app HTTP API (`:3000`); never touches UE directly** (raw UE = mcp-unreal).
- **Docs/memory:** `[[project_pof_mcp_layer]]`.

### Verification / test-gate runner (Tiers of Truth)
- **Anchors:** `src/lib/test-gate-runner/` — `bridgeExecutor.ts` (`:30040` automation), `spawnExecutor.ts` (headless `UnrealEditor-Cmd`, `observations.json`), `visualExecutor.ts` (`/pof/snapshot/capture` → Gemini), `drainAll`.
- **Lands here:** L3 runtime / L4 visual gates, observation contracts, the "no done without a ground-truth observation" moat.
- **Docs/memory:** `docs/catalog/L3-L4-RUNNER.md`, `[[project_llm_ue_interface]]` (Observation Spine).

---

## B — UI / catalog workflow

### Catalog pipeline + `/layout` lab (reference surface)
- **Anchors:** `src/components/layout-lab/` — `steps/` (`StepFrame.tsx`, `shared/CliProduce.tsx`, `shared/ChartPanel.tsx`, `shared/CandidateGallery.tsx`, `ArchetypeStep`), `steps/index.ts` (`getStepComponent`), `Baseline.tsx`, `CatalogTree.tsx`, `LabBridgeStrip.tsx`. Registry/specs under `src/lib/catalog/`.
- **Lands here:** new pipeline steps, step archetypes, View/Produce/Acceptance UIs, the server-backed produce→persist→rollup loop.
- **Already-has:** 30+ catalog pipelines, StepSpec chassis, server-derived acceptance (`pipeline_artifacts` table), e2e walker.
- **Docs/memory:** `docs/catalog/*` (AUTHORING, WIRING-AND-ACCEPTANCE, PIPELINE_REVIEW), `docs/architecture/ui-shell.md`, `[[project_ui_identity_lab]]`, `[[project_catalog_pipeline]]`.

### Modules (game-dev domains)
- **Anchors:** `src/components/modules/{core-engine,content,game-systems,evaluator,game-director,visual-gen,shared}/`. Registry `src/lib/module-registry.ts`; deps `src/lib/feature-definitions.ts`.
- **Lands here:** new module views, checklists/quick-actions, feature-matrix/NBA, evaluator passes.
- **Docs/memory:** `docs/architecture/module-system.md`.

### Stores / API
- **Anchors:** `src/stores/` (Zustand v5 + persist), `src/lib/*-db.ts` (better-sqlite3), `src/types/api.ts` + `src/lib/api-utils.ts` (`apiSuccess`/`apiError`, `apiFetch`).
- **Lands here:** persistence, the `{success,data}` envelope, new API routes.
- **Docs/memory:** `docs/architecture/state-and-persistence.md`.

---

## C — UE bridge / MCP

- **mcp-unreal (`:8090`):** external C++ plugin (`…/Unreal Projects/PoF/Plugins/MCPUnreal/`), driven by a stdio MCP server declared in `.mcp.json` → the `mcp__mcp-unreal__*` tools. ~37 hand-registered routes, no tool-search. **Lands here:** raw UE control tools, `execute_script` ("code mode").
- **PoF Bridge (`:30040`):** `…/Plugins/PillarsOfFortuneBridge/` (auth-token REST); app client `src/lib/pof-bridge/client.ts`, `src/stores/pofBridgeStore.ts`, `LabBridgeStrip`. **Lands here:** status/manifest/test-runner/snapshot, the verification+auth layer.
- **UE 5.8 convergence:** `docs/ue58-mcp-convergence-plan.md` (adopt first-party `AICallable`/Toolset-Registry control surface, keep PoF's verification moat). **Engine targets 5.7; 5.8 not installed locally.**
- **Docs/memory:** `docs/ue5-companion-plugin-design.md`, `docs/ue5-capability-integration-candidates.md`, `[[project_ue58_official_mcp]]`.

---

## D — Prompt / knowledge / skill

- **Anchors:** `src/lib/module-registry.ts` (checklist prompts), `src/lib/prompts/` + `prompt-context.ts` (`buildProjectContextHeader`, 6-section builder), `src/lib/evaluator/module-eval-prompts.ts` (4-pass eval), `src/components/cli/skills.ts` (12 domain skill packs), `src/lib/cli-task.ts` (`TaskFactory`, `@@CALLBACK`).
- **Lands here:** prompt-quality ideas, new skill packs, UE_GOTCHAS/tripwires (only UE_GOTCHAS + tripwire reach dispatch prompts — knowledgeTips are UI-only).
- **Docs/memory:** `[[reference_prompt_knowledge_injection]]`, `docs/architecture/prompts-and-cli.md`.

---

## E — Framework / cross-cutting (automation-framework bets)

- **Verification moat (Tiers of Truth T0-T4):** no "done" without a ground-truth observation; T4 = an agent reads a rendered frame. Anchors: `src/lib/test-gate-runner/`, observation spine. `[[project_llm_ue_interface]]`.
- **Pipeline data contract:** UE↔SQLite (SQLite = authoring SOR, UE = realized truth), 4-tier acceptance ladder (L0-L4 + `deferred`). `docs/catalog/WIRING-AND-ACCEPTANCE.md`, `[[project_pipeline_data_contract]]`.
- **Event bus / lifecycle / suspend:** `src/lib/event-bus.ts`, `src/lib/lifecycle.ts`, `src/hooks/useSuspend.ts`. `docs/architecture/runtime-patterns.md`.
- **Server cron:** `src/instrumentation.ts` (the only server wall-clock interval; nightly builds). `[[project_server_cron_scheduler]]`.
- **Lands here:** orchestration patterns, contracts, closed-loop idea→UE→tested, anything that makes the whole pipeline more autonomous/trustworthy.

---

## Maintenance log
- **2026-06-18** — seeded.
