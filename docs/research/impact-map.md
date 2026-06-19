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

### Visual-gen / asset pipeline (2D→3D→rig→texture→assemble)
- **Anchors:** `src/lib/visual-gen/` — `providers.ts` (3D-gen providers, e.g. Tripo/TripoSR), `prompt-chips.ts` + `style-keywords.ts` (no-jargon visual prompt builder), `reference-roles.ts` (reference-role scaffold + generation-prompting best practices — block-first/role-tagged/multi-view), `rig-presets.ts` (retarget *targets*: UE5 Mannequin/MetaHuman/Minimal — NOT rig tools), `lighting-presets.ts` (Lumen best-practice configs per tier; consumed by prompts/pipelines), `material-db.ts` + `biome-textures.ts` (PBR/material gen), `generators/{terrain,dungeon,vegetation}.ts`, `asset-library-db.ts`, `ue5-import-templates.ts`, `poll.ts`; UI `src/components/modules/visual-gen/auto-rig/AutoRigView.tsx` + `material-lab/`.
- **Lands here:** new 2D/3D/material/texture providers, auto-rig methods, lighting/Lumen presets, procedural generators, asset library.
- **Already-has:** Tripo-family 3D gen, Material Lab PBR, retarget presets, same-style/modular-kit workflow, (2026-06-18) Lumen `lighting-presets.ts`, generation-prompting `reference-roles.ts` (block-first + role-tagged refs for on-model consistency). **Off-domain (declined):** AI promo-video relight/VFX/bg-replace (OpenArt) — PoF makes game assets, not promo videos. **Auto-rig direction = MetaHuman conform (UE 5.8, scriptable/headless)** — Candidate B in `ue5-capability-integration-candidates.md`; UniRig was a placeholder. **Lighting-pipeline spec:** `docs/research/lighting-pipeline-spec.md` (K4 — a new `environment-lighting` catalog pipeline, not built).
- **Gaps / verdicts:** ⛔ **AccuRig is GUI-only (no CLI/headless/API)** → a manual tool, off the automation-loop goal and inferior to the planned MetaHuman-conform path (run `weekend-game-pipeline` 2026-06-18). Backlog providers (not picked): Tripo smart-mesh/segmentation-V2/retopology; Patina/Poliigon cheap PBR-set-from-image for Material Lab.
- **Docs/memory:** `docs/visual-generation-roadmap.md`, `docs/ue5-capability-integration-candidates.md`.

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
- **Backlog deltas (from /research, target the external plugin — not in this repo):** (1) **runtime Python-API introspection tools** (list a class's methods/signatures/docstrings/subsystems) so the agent self-discovers UE APIs instead of guessing — `mcp-unreal` has `lookup_class`/`lookup_docs`/`subsystem_query` but not full reflection; VibeUE ships this. (2) **blueprint graph auto-layout/tidy pass** (generated BPs are "spaghetti"; no auto-layout tool exists). (3) **StateTree editing tools** (VibeUE ships ~94 methods; PoF targets StateTree AI — verify the plugin's coverage on reconnect). Source: `Research/2026-06-18-claude-took-over-ue5.md`.

---

## D — Prompt / knowledge / skill

- **Anchors:** `src/lib/module-registry.ts` (checklist prompts), `src/lib/prompts/` + `prompt-context.ts` (`buildProjectContextHeader`, 6-section builder), `src/lib/evaluator/module-eval-prompts.ts` (4-pass eval), `src/lib/knowledge/ue-gotchas.ts` (`UE_GOTCHAS` + `formatGotchas`, filtered by `PromptKind`), `src/components/cli/skills.ts` (12 domain skill packs), `src/lib/cli-task.ts` (`TaskFactory`, `@@CALLBACK`).
- **Lands here:** prompt-quality ideas, new skill packs, UE_GOTCHAS/tripwires (only UE_GOTCHAS + tripwire reach dispatch prompts — knowledgeTips are UI-only). To add a UE pitfall: append to `UE_GOTCHAS` with `appliesTo` (`ue-python`/`ue-cpp`/`packaging`) + a test in `__tests__/knowledge/ue-gotchas.test.ts`.
- **Already-has:** prompt-injected UE pitfalls incl. (2026-06-18) a `ue-python` "introspect-before-you-guess" gotcha + 3 `lumen-*` gotchas (SWRT thin-geo Distance-Field-Resolution / detail-vs-global by world scale / HWRT surface-cache reflections → Hit Lighting for Reflections) + a modular-character accessory/rigging gotcha (rigid-accessory single-bone weight / occluded-mesh hiding / exclusive swap-slots) + 2 Niagara optimization gotchas (Effect Types significance/max-instance/visibility-cull — hidden systems still tick; Insights needs `stat named events`); evaluator `arpg-world` performance checks incl. (2026-06-18) static-mesh polygon-budget / Nanite-LOD criteria + `arpg-animation` quality checks incl. generated/AI-mocap source guidance.
- **Docs/memory:** `[[reference_prompt_knowledge_injection]]`, `docs/architecture/prompts-and-cli.md`.

---

## E — Framework / cross-cutting (automation-framework bets)

- **Verification moat (Tiers of Truth T0-T4):** no "done" without a ground-truth observation; T4 = an agent reads a rendered frame. Anchors: `src/lib/test-gate-runner/`, observation spine. `[[project_llm_ue_interface]]`.
- **Pipeline data contract:** UE↔SQLite (SQLite = authoring SOR, UE = realized truth), 4-tier acceptance ladder (L0-L4 + `deferred`). `docs/catalog/WIRING-AND-ACCEPTANCE.md`, `[[project_pipeline_data_contract]]`.
- **Event bus / lifecycle / suspend:** `src/lib/event-bus.ts`, `src/lib/lifecycle.ts`, `src/hooks/useSuspend.ts`. `docs/architecture/runtime-patterns.md`.
- **Server cron:** `src/instrumentation.ts` (the only server wall-clock interval; nightly builds). `[[project_server_cron_scheduler]]`.
- **Lands here:** orchestration patterns, contracts, closed-loop idea→UE→tested, anything that makes the whole pipeline more autonomous/trustworthy.
- **Research validation (2026-06-18):** the 2025-26 agentic-3D-asset-generation frontier (arxiv 2505.20129 / SAGE / 3DCodeBench / Articraft) **converges on PoF's architecture** (render→VLM-critique→refine + structured-KB working memory = observation spine + pipeline-artifacts/impact-map); PoF adds bounded iteration + persistent authoring truth the papers lack. Synthesis: `docs/research/agentic-3d-asset-generation.md`. **Gap:** asset-GENERATION has no self-correction loop (`visual-gen/poll.ts` is fire-and-poll) → spec `docs/research/self-correcting-asset-gen-spec.md` (reuse the L4 visual critic as the asset critic).

---

## Maintenance log
- **2026-06-19** — run `niagara-optimization` (Unreal Fest 2025, A. Kurali): 2 Niagara perf gotchas (Effect Types significance/culling — hidden systems still tick + GPU dispatch cost; Insights needs `stat named events`). Authoritative Epic source. Niagara perf maps to `niagara_ops` / VFX modules; no dedicated VFX evaluator module (candidate future home: `arpg-polish`).
- **2026-06-19** — run `modular-character` (Stefan 3D AI): modular-character rigging/optimization gotcha (rigid-accessory single-bone weight, occluded-mesh hiding, exclusive swap-slots). AccuRig/Tripo = catches (off-domain per user-pref). Cleaner hardened (strip VTT cue-numbers).
- **2026-06-18** — seeded.
- **2026-06-18** — run `claude-took-over-ue5` (Stefan 3D AI): added D-bucket gotcha; logged 3 C-bucket backlog deltas (introspection/BP-layout/StateTree). Mostly already-have catches (visual self-review, build automation, git checkpoints, mcp tool surface) — confirms PoF is ahead of the manual workflow.
- **2026-06-18** — run `weekend-game-pipeline` (Stefan 3D AI): first two-gate run (candidate list → user picked C2/C4). Added a **visual-gen** subsystem entry (was thin). C4 evaluator poly-budget check implemented (S). C2 AccuRig deep-verify → **GUI-only/manual, declined** (off automation-goal; MetaHuman-conform is the better path). Asset-pipeline-centric source = off the harness/MCP north star.
- **2026-06-18** — run `lumen-best-practices` (Karim Yasser): **knowledge source** mined into prompt-consumable form (user's lens: best practices → pipelines/presets/knowledge-base). K1 = 3 Lumen gotchas; K3 = `lighting-presets.ts` (4 tier presets); K4 = `environment-lighting` pipeline spec (not built). Shows the knowledge-injection path (D/B) raising automation output quality — distinct from tooling sources.
- **2026-06-18** — run `ai-render-engine` (Stefan 3D AI): promo-video workflow, **mostly off-domain**; mined the one transferable best practice → `reference-roles.ts` (block-first + role-tagged refs + multi-view master for on-model generation consistency). Declined off-domain video relight/VFX/bg tooling. Focus per user: high-quality **asset/animation generation** is the real indie gap (engineering/harness talks don't exist yet — UE 5.8 MCP too fresh).
- **2026-06-18** — run `agentic-3d` (**web-discovery**, no URL): searched/fetched 2025-26 arxiv research on agentic 3D-asset generation. W1 synthesis (`agentic-3d-asset-generation.md`) — frontier converges on PoF's architecture (validation). W2 spec (`self-correcting-asset-gen-spec.md`) — close the asset-gen self-correction gap. W3 — `arpg-animation` mocap-source criterion. Thread A (Mixamo alt tooling) = GUI/credit-based, off-domain (→ promoted user-preference). Exercised bucket E. Skill gained a web-discovery source mode.
