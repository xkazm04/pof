# LLM ↔ UE Interface — verification & control

The control surface and verification spine between an agent and the live Unreal editor. Four pieces: the **Observation Spine** (what counts as proof), the **PoF Bridge** (how the app reaches UE), the **test-gate-runner** (how deferred gates get drained), and the **agent-facing surfaces** (`pof-mcp` tools + the CLI callback system).

---

## 1. The Observation Spine — Tiers of Truth

The Spine is a verification architecture: "done" is never claimed on symbolic proxies alone. Each intent declares the **tier of evidence** it requires.

| Tier | Question | Mechanism | Example verdict |
|------|----------|-----------|-----------------|
| **T0 Existence** | Is the artifact on disk / in the registry? | `FPackageName::DoesPackageExist`, asset registry | "asset exists" |
| **T1 Structural** | Does it parse / compile / resolve refs? | compile status, load success | "Blueprint loads" |
| **T2 Wiring** | Are properties set, nodes connected? | reflection / introspection | "AnimBP property correct" |
| **T3 Behavioural** | Does the evaluated system produce the intended state? | tick the AnimInstance, read bone transforms — deterministic, headless | "pelvis moves; `isRefPose ≈ false`" |
| **T4 Perceptual** | Does the rendered frame look right to a *seeing* agent? | render → PNG → a multimodal Claude Code agent `Read`s and judges it | "I see a walking character, not a T-pose" |

The lesson baked in: **T0–T2 are necessary but never sufficient.** The player-movement T-pose passed every structural gate. T4 is cheap now precisely because the driver *is* a multimodal agent — its own read of the captured frame is the canonical T4 authority.

These map directly onto the catalog acceptance ladder: L2 ≈ T0–T2 (static), L3 ≈ T3 (runtime/behavioural), L4 ≈ T4 (perceptual).

**The five observation verbs** (Python modules dispatched on the editor thread):

| Verb | Tier | What it returns |
|------|------|-----------------|
| `EvaluatePose` | T3 | ticks the AnimInstance, reads component-space transforms → `{ maxBoneDeltaFromRefPose, pelvisLocationOverTime, isRefPose }` |
| `CaptureFrame` | T4 | runs a scenario in PIE with RHI, writes PNG(s) for an agent to read |
| `RunScenario` | T3+T4 | `{ map, spawn/possess, inputs[], timeline, ticks, observeAt[] }` → opens PIE, injects EnhancedInput over time, ticks deterministically, captures observations at marked points |
| `GetState` | T3 | semantic asset introspection ("BS_Locomotion: 11 samples, each with N keyframes/M bone-tracks") — catches empty retargeted clips |
| `ApiGroundingProbe` | — | queries UE's real API/state *before* authoring (class methods, asset property names+types, assets at a path) |

**The Conductor loop** (the contract these enable):
```
Intent (declares required Tier)
  → Ground (ApiGroundingProbe)
  → [Transaction] snapshot affected .uassets
  → Act (author/mutate via the bridge)
  → Observe (the REQUIRED-tier observation — T3/T4)
  → Verdict
       pass         → commit, advance
       fail         → rollback, diagnose FROM the observation, retry
       inconclusive → escalate
```

App-side contract: `src/lib/observation/{types,client,record}.ts` (`Observation`, `Verdict`, `Scenario` types; `observe()` over the bridge; persist to `pipeline_artifacts`). UE-side: `Content/Python/observation/*.py` + the C++ PIE harness `PoFScenarioRunner`.

---

## 2. The PoF Bridge plugin (`:30040`)

The primary, durable channel. A C++ editor plugin (`PillarsOfFortuneBridge`) runs an HTTP/JSON server on the editor **game thread** (never blocks the UI). Routes register once at editor startup.

| Route | Method | Purpose | Response shape |
|-------|--------|---------|----------------|
| `/pof/python/run` | POST | dispatch a Python module/function on the editor thread | `{ ok, data \| error, logs }` |
| `/pof/test/run-automation` | POST | run a UE automation test synchronously (`UPofTestRunner::RunAutomationTest`) | `{ status: "passed"\|"failed"\|"not_found", testId }` |
| `/pof/test/results` | GET | fetch automation results | `{ results: [{ testId, status, startTime, endTime, durationMs }] }` |
| `/pof/snapshot/capture` | POST | capture a HighResShot (`UPofSnapshotCapture::CapturePreset`) | `{ status: "captured", filePath, width, height }` |
| `/pof/status` | GET | plugin/editor liveness | `{ connected, editorState, engineVersion, pluginVersion }` |

App-side client: `src/lib/bridge/run-python.ts` — `runPython(modulePath, fn, args) → RunPythonResult<{ ok, data|error, logs }>`. Verified live (rebuilt editor, bridge on `:30040`): `run-automation {filter:"GenFireball"}` → `{status:"passed", testId:"FVSGenFireballEffectTest"}`; unmatched filter → honest `not_found`; snapshot capture wired.

> **Historical note.** A bespoke `mcp-unreal` Go server (`:8090`) + `MCPUnreal` C++ plugin previously provided raw editor control. It has been **retired** in favour of UE 5.8's first-party MCP; only the `PillarsOfFortuneBridge` (`:30040`) remains as PoF's verification moat. New work targets the Bridge, not `:8090`.

---

## 3. The test-gate-runner (L3/L4 drain)

Catalog steps that need the live editor are recorded as `status: 'deferred'` in `pipeline_artifacts`. The runner (`src/lib/test-gate-runner/`) collects them and runs them against UE **serially, one at a time**, turning symbol-only gates into reality-grounded verdicts.

**Executor seam** — three concrete executors chosen at runtime:

| Executor | Tier | Mechanism | Default | File |
|----------|------|-----------|---------|------|
| **bridge** | L3 | POSTs the test name to `:30040/pof/test/run-automation`, polls results. Safest on a shared tree — no spawn, no log clobber. | ✅ default | `bridgeExecutor.ts` |
| **spawn** | L3 | runs a fresh headless `UnrealEditor-Cmd … -ExecCmds="Automation RunTests …;Quit" -nullrhi`, judges by `-abslog` markers (`Result={Success}` / `[gate] RESULT=PASS`), not exit code. | ⛔ gated (needs `POF_UE_EDITOR_CMD` + `POF_UE_UPROJECT` + `allowSpawn`) | `spawnExecutor.ts` |
| **visual-bridge** | L4 | requests a HighResShot via the bridge, runs the visual check (`/api/verify/visual`, a multimodal verdict), records to `visual_verifications`. Honestly **skips** (stays deferred) when there's no screenshot source. | ✅ best-effort | `visualExecutor.ts` |

**Core functions** (`drain.ts`): `collectDeferred(filter)` → `GateJob[]`; `drainOne(job, executor)` runs one and upserts the verdict; `drainJobs(jobs, executors)` runs all serially picking the first available tier-matched executor; `drainAll(filter, opts)` is the convenience wrapper.

**Triggers**: a one-shot operator drain (`/api/pipeline-artifacts/drain`) or an always-on worker loop (`/api/pipeline-artifacts/drain/worker`, with a skip-cooldown so unavailable jobs aren't retried every tick). A server-side concurrency guard rejects overlapping drains for the same `catalogId|entityId` scope with HTTP 409. Verdict changes emit a `gate.verdict.changed` event that an opt-in webhook notifier (`src/lib/notify/gate-notifier.ts`) can forward (modes: all / failures / regressions).

---

## 4. Agent-facing surfaces

### `pof-mcp` UE tools (`tools/pof-mcp/`)

A stdio MCP server that lets a Claude Code CLI query and control UE. Many tools work **offline** (read source/content on disk) — useful for grounding without a running editor.

| Tool | Editor? | Purpose |
|------|---------|---------|
| `pof_ue_status` | no | bridge connection, engine/plugin version, editor state, manifest asset count |
| `pof_ue_manifest` | yes | asset manifest + content checksum |
| `pof_ue_compile` | yes | trigger live-coding compile, return diagnostics |
| `pof_ue_run_tests` / `pof_ue_test_results` | yes | run automation tests by filter / fetch verdicts |
| `pof_ue_scan_project` | no | scan `Source/` — C++ classes, plugins, build deps |
| `pof_ue_scan_assets` | no | inventory `Content/` — `.uasset`/`.umap`, sizes, deps |
| `pof_ue_verify_semantic` | no | do C++ classes match design? per-item `full\|partial\|stub\|missing` + completeness % |
| `pof_ue_source_parse` | no | offline parse of ability-system C++ |
| `pof_ue_build` / `pof_ue_build_status` / `pof_ue_build_health` | no | enqueue local UBT build, poll status, reliability report |
| `pof_asset_code_oracle` | no | C++ ↔ asset consistency analysis |
| `pof_package_preflight` / `pof_package_history` | no | pre-cook validation / build-cook history + sizes |
| `pof_drain_gates` | — | run deferred L3/L4 gates for an entity (bridge, or `spawn` if `allowSpawn`) |

Plus pipeline tools (`pof_list_catalogs`, `pof_get_pipeline`, `pof_get_step`, `pof_submit_artifact`, `pof_get_acceptance`) and the harness tools documented in [`autonomous-builder.md`](autonomous-builder.md).

### The CLI callback system

When the app spawns a Claude Code CLI to produce content, it captures structured results via a marker protocol (`src/lib/claude-terminal/cli-service.ts`, `src/lib/cli-task.ts`):

- `startExecution(projectPath, prompt, …)` spawns `claude -p - --output-format stream-json …`, parses each stdout line, and emits typed events (`init`, `text`, `tool_use`, `tool_result`, `result`, `error`).
- The prompt embeds `@@CALLBACK:<id> … @@END_CALLBACK`. The terminal intercepts the marker, validates the JSON, merges static fields (e.g. `catalogId`, `entityId`, `step`), and POSTs it to the registered endpoint. `awaitCallback()` resolves when a valid marker arrives.
- `TaskFactory` / `cli-task-handlers.ts` build the prompts (`.checklist()`, `.featureFix()`, `.featureReview()`, `.moduleScan()`), so callers never assemble prompts by hand.

This is how a Produce step's CLI output becomes a validated `pipeline_artifacts` row without trusting free-form model text.

---

*Catalog acceptance tiers and the `deferred` lifecycle: [`../pipeline-architecture.md`](../pipeline-architecture.md). The loop that orchestrates many of these calls at feature scale: [`autonomous-builder.md`](autonomous-builder.md).*
