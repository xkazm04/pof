# Autonomous Game-Builder Harness

A long-running orchestrator that builds whole game features autonomously: it **plans** coherent chunks of work, **spawns** Claude Code CLI sessions to implement them, **verifies** with quality gates, **self-heals** common failures, and **checkpoints** green states so it can roll back. Lives in `src/lib/harness/`.

Where the [interface layer](llm-ue-interface.md) verifies *one* thing against UE, this layer drives the *whole build loop* across many module-areas.

---

## The loop

```
start() → runLoop()
  ├─ build (or resume) a GamePlan from the module registry
  ├─ heal stranded 'in-progress' areas from a previous crash
  ├─ start the dev server if a visual gate is present
  └─ ITERATE until pass-rate ≥ target (or max iterations):
       pick next dependency-resolved areas → STREAMING POOL (up to maxConcurrent):
         processArea():
           1. EXECUTE   — spawn a Claude Code session, parse @@HARNESS_RESULT, record cost
           2. VERIFY    — run gates (typecheck, lint, test, build, visual, custom, ue-compile, ue-test, ue-visual).
                          A UE compile gate with no UE env is UNVERIFIABLE (never a silent pass);
                          the ue-test gate is judged by abslog content, not exit code; the opt-in
                          ue-visual gate boots the GAME headlessly and judges a rendered frame.
           3. SELF-HEAL — on a CODE-gate failure, spawn a fix session, re-verify; unverifiable gates
                          are skipped (no code error to fix) and a heal with no verify command returns false
           4. RECONCILE — match parsed features back to planned ones by EXACT normalized
                          name/id (no fuzzy substring, no force-pass); any feature the
                          session never reported stays 'unverified', never a silent pass
           5. RECORD    — append progress, commit+tag if green, append to guide, update AGENTS.md
       refill the pool as areas complete; enforce the budget on every launch
  └─ save plan/guide/progress/cost, record the run in SQLite, emit 'harness:completed'
```

It's a **streaming pool**, not lock-step waves: an area that finishes early frees its slot immediately, and newly-unblocked areas fill it. Wall-clock is the slowest dependency chain, not the sum of phases.

---

## Components (`src/lib/harness/`)

| File | Role |
|------|------|
| `orchestrator.ts` | `HarnessOrchestrator` — `runLoop`, `runStreamingPool`, `processArea`, `attemptSelfHeal`, budget governance, dev-server lifecycle, rollback |
| `plan-builder.ts` | `buildGamePlan` — turns the module registry + feature deps into ordered `ModuleArea`s via curated `AREA_PRESETS` + topological sort |
| `executor.ts` | `executeArea` — assembles the 1M-context executor prompt; `parseAreaResult` reads the `@@HARNESS_RESULT` markers |
| `verifier.ts` | `verify` — runs quality gates; `parseErrors` structures tsc/eslint/UE5 output; `detectGates` auto-discovers project type — **UE markers (`Source/` or `*.uproject`) win over `package.json`**, so a C++ tree carrying JS tooling still gets UE gates instead of `npx next build` |
| `ue-gates.ts` | the harness's OWN UE command layer (no `test-gate-runner` import): `resolveUeEnv`, `deriveUeCompileCommand` (UBT, exit-code judged), `deriveUeTestCommand` + `parseAutomationLog` (abslog-content judged), `detectUeGates` |
| `ue-visual-gate.ts` | the **game-runs gate**: boots the game headlessly, captures a rendered frame, judges it. Reuses (READ-only) `captureScenarioFrame` from `@/lib/ue-launch/capture` (the campaign-proven `-game -PoFScenario -RenderOffScreen` boot) as an injectable seam; `inspectFrame` is the documented black/near-empty heuristic; optional VLM via `/api/verify/visual`. Advisory + opt-in + de-duped per iteration |
| `claude-session.ts` | `spawnClaudeSession` — single-sourced CLI spawner (stream-json, cost parsing, result markers) |
| `checkpoint.ts` | `Checkpointer` — git branch/tag per green area, `rollbackToLastGreen` (reset --hard) |
| `visual-gate.ts` | `runVisualGate` — Playwright screenshots + perceptual diff (pixelmatch) + axe-core a11y scan |
| `guide-generator.ts` | accumulates a `GameBuildGuide` (phases, decisions, gotchas) as a side effect |
| `run-diff.ts` | `diffRuns` — pure run-to-run comparison (pass-rate / cost / per-area deltas) |
| `run-harness.ts` | standalone CLI entry point (`--project`, `--scenario`, `--theme`, `--checkpoint`, `--dry-run`) |
| `types.ts` | `GamePlan`, `ModuleArea`, `PlannedFeature`, `VerificationGate`/`Report`, `HarnessEvent`, `HarnessCostTotals`, `GameBuildGuide` |

**External-memory design** (from Anthropic's harness research): state files are JSON not Markdown (models corrupt JSON less); one module-area per executor session (large scope fills the 1M window); artifacts bridge context windows; gates enforce verification before advancing. Run artifacts land in `.harness/` (`game-plan.json`, `progress.json`, `guide.json` + `.md`, `cost.json`, `checkpoints.json`, plus `run-meta.json` + `harness-config.json` for durable resume).

---

## Safety rails

- **Budget governor** — every session reserves an estimated cost at launch and reconciles on return; `wouldOverflowNow()` blocks new launches past the cap; on cap-hit it emits `harness:paused` and drains in-flight work instead of orphaning it. An un-budgeted run is NOT uncapped: a `DEFAULT_BUDGET_USD` ($25) ceiling applies unless the caller passes `unlimited: true` (`resolveBudgetUsd`).
- **Stranded-run reaper** — the orchestrator's live state is in-memory, so a crash/restart would strand a `harness_runs` row in `running` forever. `reapStrandedRuns()` (lazy, once per process on the first status/history read) marks any `running` row NOT owned by a live orchestrator in this process as `interrupted`. This is NOT a dead-end: `interrupted` is a RESUMABLE status (`isResumableStatus`), and the reaper hands off to the rehydrate path — `reopenRun` flips a reaped row back to `running` and re-registers it live. Live runs are tracked in-process so an active run is never falsely reaped.
- **Durable run resume** — the orchestrator is an in-memory singleton, so a server restart used to make resume impossible and a fresh start over the same `statePath` minted a NEW runId (fragmenting history). Now every run writes two durable sidecars to its state dir: `run-meta.json` (the `statePath ⇄ runId` binding, plus a fork's `parentRunId`) and `harness-config.json` (a full config snapshot). `rehydrateHarnessOrchestrator(statePath)` rebuilds the orchestrator from those, ADOPTING the same runId, so `resume` continues ONE run across a restart (the stranded `in-progress → pending` healing — `healStrandedAreas` — runs on re-entry). `runLoop` `reopenRun`s the adopted row instead of inserting a new one. A fresh `start` pointed at an existing `statePath` is resolved by `resolveRunIdentity`: **resume** (same runId) when the prior run is resumable (paused/interrupted/stranded, or its DB row vanished but the plan is still on disk); **fork** with recorded provenance (new runId → `parentRunId`) when the prior run is terminal-done; **fresh** when there is no prior. `fork:true` forces a fork. The default is resume-not-fragment: a start over a populated statePath is almost always the same build being re-driven, and forking only when the prior run is genuinely finished keeps history honest without ever silently splitting one build into two ids.
- **Checkpoints** — each green area commits + tags on `harness/<runId>`; a failed area can `rollbackToLastGreen`. Because rollback is `git reset --hard`, checkpointing forces `maxConcurrent = 1` (concurrent siblings would be clobbered).
- **Self-heal** — only claims `healed` when a real verify command re-ran clean; with no verify command it returns `healed:false` with a reason (never optimistically advances), and it is skipped entirely for `unverifiable` gates (a missing UE env is not a code error to fix).
- **Real UE gates** — the default UE gate is a genuine UBT compile derived from `POF_UE_EDITOR_CMD`/`POF_UE_UPROJECT` (judged by exit code), with an opt-in headless automation-test gate (`ueTests`, judged by abslog content). With no UE env the compile gate is `unverifiable` — the area is honestly gapped, never self-certified by a directory existing.
- **Game-runs gate (`ue-visual`)** — the only gate that observes the built game actually BOOTS AND RENDERS. Opt-in (`ueVisual`) and **advisory** (`required:false` — never blocks the loop). On each `verify()` for a UE tree it boots the game headlessly via `captureScenarioFrame` (reused READ-only from `@/lib/ue-launch/capture` — the proven `-game -PoFScenario -RenderOffScreen` path; **not** modified) and judges the frame: no UE env → `unverifiable`; no frame produced (boot failed/timed out) → `unverifiable`; frame is black/near-empty → **fail** (`inspectFrame` heuristic: a byte-size floor of 12 KB always applies, plus a per-pixel non-black-fraction pass when `pngjs` is present — documented on the function); frame is rendered → **pass**. Optional VLM judging (`POF_UE_VISUAL_VLM`, via `/api/verify/visual`, default `lighting` mode) can override the floor to fail, but a judge *outage* never downgrades a captured frame. **Cost/placement:** a headless boot is MINUTES, so the gate is **de-duped per `(statePath, iteration)`** — the game boots ONCE per iteration and every concurrent area shares that frame; treat it as an end-of-iteration observation, not a per-area rerun. The captured **GAME** frame is stored under `<statePath>/screenshots/<iteration>/game.png` with a `result.json` row tagged `capture:'game'`, so `HarnessVisualGallery` surfaces it with a **GAME** badge (vs the **WEB** badge on webapp Playwright shots).
- **Pause/resume** — same `runId` row across pause/resume (in-process AND across a server restart via rehydrate, see Durable run resume); the loop drains active sessions before stopping. **A pause is not a completion:** the paused branch marks `stoppedForPause` and the loop tail RETURNS on it instead of falling through to `harness:completed` + `persistTerminal('completed')`. That fall-through used to flip the run row terminal, which cascaded — `resolveRunIdentity` forked instead of resuming, and the API's event wiring set the in-memory status to `completed` so `action:'resume'` answered 409 "Harness is not paused". Both pause triggers take this path: a user `pause()` and the budget governor's cap-hit (whose loop-top `harness:paused` reason now names the cap, not "User requested pause"). `runId` is deliberately left non-null on pause — it is what a resume adopts.
- **Honest reconciliation** — the ledger cannot lie: features are matched only by exact normalized name/id (`feature-match.ts`), unmatched reports are logged and left `unverified`, and an area promoted after exhausting retries records `completed-with-gaps` (not `completed`). Gapped areas unblock dependents but are **excluded from the pass-rate numerator** (`updatePlanStats`), so promote-with-gaps can never hit the target on unverified work. Gapped areas surface in run history (`gapped_areas`) and run-diff (`completedWithGaps`).
- **Verified vs self-reported truth** — an executor's own `pass` is a T0 self-report. Each feature is additionally stamped `verified` only when the area's **required gate** (the real UBT compile / abslog test) passed for that session — a self-reported pass on a tree whose required gate was `unverifiable` (e.g. no UE env) stays `verified: false`. `updatePlanStats` keeps both numerators (`passingFeatures` self-reported, `verifiedFeatures` gate-backed) and the **stop condition uses the verified rate by default** (`passRateBasis`, default `verified`; set `self-reported` to restore legacy counting). Both rates are surfaced by the status API (`verifiedPassRate` / `selfReportedPassRate`) and thus by `pof_harness_status`. This is bookkeeping over existing gate evidence — not a new verification mechanism.

---

## Control surface

**HTTP** (`src/app/api/harness/`):
- `POST /api/harness` — `{ action: 'start' | 'pause' | 'resume', projectPath, projectName, ueVersion, maxIterations?, targetPassRate?, passRateBasis?, budgetUsd?, unlimited?, maxConcurrent?, scenario?, checkpoint?, ueTests?, ueTestFilter?, themeDirective?, areaPassThreshold? }`. `targetPassRate`/`areaPassThreshold` accept a 0–1 fraction OR a 0–100 percent (normalized server-side; `areaPassThreshold` validated to `(0,100]`); `passRateBasis` (`verified` | `self-reported`) picks the stop-condition numerator; `themeDirective` (≤2000 chars, validated) injects creative direction into every executor prompt; `maxConcurrent` raises pool concurrency; `scenario` (`ui-overhaul` | `content-overhaul`, from the shared `scenarios.ts`) swaps in a curated area set; `unlimited: true` is the only way to run with no spend cap; `ueTests` opts in the automation-test gate; `ueVisual` opts in the game-runs gate.
  - `start` resolves DURABLE IDENTITY from the `statePath`: it RESUMES the prior run (same runId) rather than fragmenting history, FORKS with provenance from a terminal run, or starts fresh (`fork:true` forces a fork; the response carries `mode` + `resumedRunId`/`parentRunId`).
  - `resume` after a server restart REHYDRATES the orchestrator from disk (`run-meta.json` + `harness-config.json`) so the same run continues — pass `statePath` when the in-memory singleton is gone; the response carries `rehydrated` + `runId`.
- `GET /api/harness[?action=plan|guide|progress|events]` — status snapshot or the full plan/guide/progress/events
- `GET /api/harness/runs`, `/runs/[id]`, `/runs/diff?a=&b=` — run history & comparison
- `GET /api/harness/screenshot`, `/screenshots` — visual-gate captures

**MCP** (`tools/pof-mcp/`, for a Claude Code CLI to drive it):
- `pof_harness_start` — launch (returns immediately; poll status). Full parity with the HTTP surface: `themeDirective`, `sessionTimeoutMs`, `areaPassThreshold`, `passRateBasis` (+ the pre-existing budget/scenario/concurrency/ue-test levers).
- `pof_harness_status` — run state, plan progress (both `verifiedPassRate` + `selfReportedPassRate`), cost, checkpoints, recent events
- `pof_harness_plan` — the full `GamePlan` (every area, feature, dependency)
- `pof_harness_control` — pause (after the current iteration) / resume
- `pof_harness_guide` — the accumulated build guide + learnings
- `pof_harness_runs` / `pof_harness_run` / `pof_harness_run_diff` — run history, a single run's full snapshot, and a run-to-run comparison (proxy `/api/harness/runs*`)

**UI** (`src/components/harness/`): `HarnessGuideViewer` (the generated playbook), `HarnessRunHistory` (pick two runs → diff), `HarnessVisualGallery` (screenshot thumbnails per iteration/area, each badged **GAME** for a headless UE render vs **WEB** for a webapp Playwright shot).

---

## Output: the build guide

Beyond the code it writes, each run produces a `GameBuildGuide` — a human-readable playbook of how the game got built: per-phase steps, the PoF actions taken, the UE5 files touched, the decisions made, the gotchas hit, and how each phase was verified. It's the durable artifact that turns one autonomous run into a repeatable recipe.

---

*The gates this loop runs ground out in the same Unreal bridge described in [`llm-ue-interface.md`](llm-ue-interface.md). For building a single catalog entity (rather than a whole feature), see the [catalog pipeline architecture](../pipeline-architecture.md).*
