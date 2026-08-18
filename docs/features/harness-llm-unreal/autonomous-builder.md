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
| `run-harness.ts` | standalone CLI entry point — full HTTP parity (`--project`, `--budget`/`--unlimited`, `--pass-rate-basis`, `--ue-tests`/`--ue-visual`, `--scenario`, `--theme`, `--checkpoint`, `--fork`, `--dry-run`); pure, exported helpers (`parseCliOptions`, `configFromCliOptions`, `cliOrchestratorOptions`, `formatRateLine`) so the surface is testable without spawning a loop |
| `types.ts` | `GamePlan`, `ModuleArea`, `PlannedFeature`, `VerificationGate`/`Report`, `HarnessEvent`, `HarnessCostTotals`, `GameBuildGuide` |

**External-memory design** (from Anthropic's harness research): state files are JSON not Markdown (models corrupt JSON less); one module-area per executor session (large scope fills the 1M window); artifacts bridge context windows; gates enforce verification before advancing. Run artifacts land in `.harness/` (`game-plan.json`, `progress.json`, `guide.json` + `.md`, `cost.json`, `checkpoints.json`, plus `run-meta.json` + `harness-config.json` for durable resume).

---

## Safety rails

- **Budget governor** — every session reserves an estimated cost at launch and reconciles on return; `wouldOverflowNow()` blocks new launches past the cap; on cap-hit it emits `harness:paused` and drains in-flight work instead of orphaning it. An un-budgeted run is NOT uncapped: a `DEFAULT_BUDGET_USD` ($25) ceiling applies unless the caller passes `unlimited: true` (`resolveBudgetUsd`). **Self-heal spend is inside the ceiling (2026-08-18).** A heal spawns a full second `claude -p` session, and `SelfHealResult` used to discard its `costUsd` — so a `budgetUsd: 25` run could materially exceed $25, and every gate failure widened the gap. `SelfHealResult` now carries `costUsd` **and** `sessionSpawned` (the second field is what keeps "unmeasured" from collapsing into "free" — only the no-verify-command early bail is genuinely free), and `recordHealCost` folds heal spend into `spentUsd`/`byArea` plus `healUsd`/`healSessions`/`healUnmeasuredSessions`. A heal reporting no cost is booked at the per-session estimate and flagged unmeasured. Counting alone would not have held the ceiling — heals fire inside `processArea`, never through `fillPool`'s governor — so the heal is itself gated by `wouldOverflowNow()` and reserves its estimate while in flight. Heal sessions stay OUT of the `sessions` denominator on purpose: that figure estimates the next *executor* session, and short heals would drag it down and make the in-flight reservation less conservative.
- **Durable state writes (2026-08-18)** — run state is published atomically: `writeJsonFile` serializes first, writes a sibling temp file, fsyncs, then renames over the target (bounded retry for transient Windows locks), leaving no residue on failure. Previously a plain `writeFileSync` could truncate `game-plan.json` mid-crash, and because `runLoop` did `loadPlan(...) ?? buildGamePlan(config)` a corrupted plan made the run **silently restart from scratch**. Reads now distinguish three states (`missing | ok | corrupt`): missing still means first-run, but corrupt is a fatal `harness:error` that stops the run and leaves the damaged file on disk for inspection. Atomicity is pinned by inode identity, with an in-place-write control so the assertion is discriminating rather than vacuous.
- **Session timeout kills the process tree (2026-08-18)** — a timed-out session was killed with `proc.kill('SIGTERM')` on a process spawned through a shell on Windows, which leaves the real child alive and still spending. Worse, the orphan held the stdio pipes open so `close` never fired and the session promise never resolved — a timeout hung for the full guard window instead of failing. `killProcessTree` is now ONE helper shared by the session path and `killDevServer` (which deleted its duplicate), the kill outcome is appended to the session's `errors` rather than assumed, and the non-Windows path is behaviourally unchanged.
- **Stranded-run reaper** — the orchestrator's live state is in-memory, so a crash/restart would strand a `harness_runs` row in `running` forever. `reapStrandedRuns()` (lazy, once per process on the first status/history read) marks any `running` row NOT owned by a live orchestrator in this process as `interrupted`. This is NOT a dead-end: `interrupted` is a RESUMABLE status (`isResumableStatus`), and the reaper hands off to the rehydrate path — `reopenRun` flips a reaped row back to `running` and re-registers it live. Live runs are tracked in-process so an active run is never falsely reaped.
- **Durable run resume** — the orchestrator is an in-memory singleton, so a server restart used to make resume impossible and a fresh start over the same `statePath` minted a NEW runId (fragmenting history). Now every run writes two durable sidecars to its state dir: `run-meta.json` (the `statePath ⇄ runId` binding, plus a fork's `parentRunId`) and `harness-config.json` (a full config snapshot). `rehydrateHarnessOrchestrator(statePath)` rebuilds the orchestrator from those, ADOPTING the same runId, so `resume` continues ONE run across a restart (the stranded `in-progress → pending` healing — `healStrandedAreas` — runs on re-entry). `runLoop` `reopenRun`s the adopted row instead of inserting a new one. A fresh `start` pointed at an existing `statePath` is resolved by `resolveRunIdentity`: **resume** (same runId) when the prior run is resumable (paused/interrupted/stranded, or its DB row vanished but the plan is still on disk); **fork** with recorded provenance (new runId → `parentRunId`) when the prior run is terminal-done; **fresh** when there is no prior. `fork:true` forces a fork. The default is resume-not-fragment: a start over a populated statePath is almost always the same build being re-driven, and forking only when the prior run is genuinely finished keeps history honest without ever silently splitting one build into two ids.
- **Checkpoints** — each green area commits + tags on `harness/<runId>`; a failed area can `rollbackToLastGreen`. Because rollback is `git reset --hard`, checkpointing forces `maxConcurrent = 1` (concurrent siblings would be clobbered). **The ledger survives a resume:** `runLoop` rehydrates `checkpoints.json` into the checkpointer (adopting it only when its `branch` matches this run's), so a resumed run rolls back to the REAL last green. Previously the checkpointer always started empty, `init()` re-`checkout -B`'d the branch and recorded a NEW baseline at the resume-time tree — the rollback reset to the wrong commit while the UI kept rendering the on-disk ledger the rollback ignored (silent work loss in the recovery path). **Resume-time branch semantics** (`createCheckpointer(..., initial)`): the ledger's last green must still resolve to a commit (if not, the ledger is discarded and a fresh baseline is taken — never arm a rollback at a missing object); re-attach with a PLAIN `checkout <branch>` so `-B` can't move the ref onto the resume-time HEAD and orphan the checkpoint commits (branch gone but commits alive → recreate it AT the last green); a dirty resume-time tree is committed and tagged `harness/<runId>/resume-<stamp>` as a RESUME SNAPSHOT — reachable after a later hard reset but never entered in the ledger, so it can never become the rollback target; and no new baseline is appended. Display ledger and rollback target therefore cannot disagree.
- **Self-heal** — only claims `healed` when a real verify command re-ran clean; with no verify command it returns `healed:false` with a reason (never optimistically advances), and it is skipped entirely for `unverifiable` gates (a missing UE env is not a code error to fix).
- **No gate self-certifies** — a gate with NO command runs nothing, so it reports `unverifiable` (never `passed:true`), uniformly for every gate type. `runGate` used to answer "No command specified — skipped" with `passed:true`, so any required custom/build/test/lint/typecheck gate configured without a command silently green-lit the area — only `ue-compile` had the honest treatment. A commandless gate now carries the same `requiredGates` consequences as `ue-compile`: it counts toward `requiredFailures`, is excluded from self-heal (no code error to fix), and records `verification:'unverifiable'`. Gates that DO have a command are unchanged (exit code judges them; a real failure stays a failure, not "unknown"). `visual`/`ue-visual` keep their own handlers — they are commandless by design.
- **Unreachable-success preflight** — the default `passRateBasis:'verified'` only counts a feature when every REQUIRED gate passed, so a required gate that can never verify pins the verified rate at 0% and the loop grinds all `maxIterations` sessions into the budget cap with nothing explaining why. `checkSuccessReachable(gates, passRateBasis)` (verifier.ts) detects that combination at launch — a required commandless gate, or a required `ue-test` with no UE env (`visual`/`ue-visual` are runtime-determined and never judged statically) — and `runLoop` **warns loudly**: `logger.warn` plus a NON-fatal `harness:error` event naming the blocking gates, the maxIterations/cap consequence, and the three fixes (configure the command / drop `required` / `passRateBasis:'self-reported'`). It warns, it never blocks — a run's side effects can be wanted without a reachable stop condition.
- **Real UE gates** — the default UE gate is a genuine UBT compile derived from `POF_UE_EDITOR_CMD`/`POF_UE_UPROJECT` (judged by exit code), with an opt-in headless automation-test gate (`ueTests`, judged by abslog content). With no UE env the compile gate is `unverifiable` — the area is honestly gapped, never self-certified by a directory existing.
- **Game-runs gate (`ue-visual`)** — the only gate that observes the built game actually BOOTS AND RENDERS. Opt-in (`ueVisual`) and **advisory** (`required:false` — never blocks the loop). On each `verify()` for a UE tree it boots the game headlessly via `captureScenarioFrame` (reused READ-only from `@/lib/ue-launch/capture` — the proven `-game -PoFScenario -RenderOffScreen` path; **not** modified) and judges the frame: no UE env → `unverifiable`; no frame produced (boot failed/timed out) → `unverifiable`; frame is black/near-empty → **fail** (`inspectFrame` heuristic: a byte-size floor of 12 KB always applies, plus a per-pixel non-black-fraction pass when `pngjs` is present — documented on the function); frame is rendered → **pass**. Optional VLM judging (`POF_UE_VISUAL_VLM`, via `/api/verify/visual`, default `lighting` mode) can override the floor to fail, but a judge *outage* never downgrades a captured frame. **Cost/placement:** a headless boot is MINUTES, so the gate is **de-duped per `(statePath, iteration)`** — the game boots ONCE per iteration and every concurrent area shares that frame; treat it as an end-of-iteration observation, not a per-area rerun. The captured **GAME** frame is stored under `<statePath>/screenshots/<iteration>/game.png` with a `result.json` row tagged `capture:'game'`, so `HarnessVisualGallery` surfaces it with a **GAME** badge (vs the **WEB** badge on webapp Playwright shots).
- **Pause/resume** — same `runId` row across pause/resume (in-process AND across a server restart via rehydrate, see Durable run resume); the loop drains active sessions before stopping. **A pause is not a completion:** the paused branch marks `stoppedForPause` and the loop tail RETURNS on it instead of falling through to `harness:completed` + `persistTerminal('completed')`. That fall-through used to flip the run row terminal, which cascaded — `resolveRunIdentity` forked instead of resuming, and the API's event wiring set the in-memory status to `completed` so `action:'resume'` answered 409 "Harness is not paused". Both pause triggers take this path: a user `pause()` and the budget governor's cap-hit (whose loop-top `harness:paused` reason now names the cap, not "User requested pause"). `runId` is deliberately left non-null on pause — it is what a resume adopts.
- **Honest reconciliation** — the ledger cannot lie: features are matched only by exact normalized name/id (`feature-match.ts`), unmatched reports are logged and left `unverified`, and an area promoted after exhausting retries records `completed-with-gaps` (not `completed`). Gapped areas unblock dependents but are **excluded from the pass-rate numerator** (`updatePlanStats`), so promote-with-gaps can never hit the target on unverified work. Gapped areas surface in run history (`gapped_areas`) and run-diff (`completedWithGaps`).
- **Verified vs self-reported truth** — an executor's own `pass` is a T0 self-report. Each feature is additionally stamped `verified` only when the area's **required gate** (the real UBT compile / abslog test) passed for that session — a self-reported pass on a tree whose required gate was `unverifiable` (e.g. no UE env) stays `verified: false`. `updatePlanStats` keeps both numerators (`passingFeatures` self-reported, `verifiedFeatures` gate-backed) and the **stop condition uses the verified rate by default** (`passRateBasis`, default `verified`; set `self-reported` to restore legacy counting). Both rates are surfaced by the status API (`verifiedPassRate` / `selfReportedPassRate`) and thus by `pof_harness_status`. This is bookkeeping over existing gate evidence — not a new verification mechanism.

---

## Control surface

**HTTP** (`src/app/api/harness/`):
- `POST /api/harness` — `{ action: 'start' | 'pause' | 'resume', projectPath, projectName, ueVersion, statePath?, fork?, maxIterations?, targetPassRate?, passRateBasis?, sessionTimeoutMs?, budgetUsd?, unlimited?, maxConcurrent?, scenario?, checkpoint?, ueTests?, ueTestFilter?, ueVisual?, themeDirective?, areaPassThreshold? }`. `targetPassRate`/`areaPassThreshold` accept a 0–1 fraction OR a 0–100 percent (normalized server-side; `areaPassThreshold` validated to `(0,100]`); `passRateBasis` (`verified` | `self-reported`) picks the stop-condition numerator; `themeDirective` (≤2000 chars, validated) injects creative direction into every executor prompt; `maxConcurrent` raises pool concurrency; `scenario` (`ui-overhaul` | `content-overhaul`, from the shared `scenarios.ts`) swaps in a curated area set; `unlimited: true` is the only way to run with no spend cap; `ueTests` opts in the automation-test gate; `ueVisual` opts in the game-runs gate.
  - `start` resolves DURABLE IDENTITY from the `statePath`: it RESUMES the prior run (same runId) rather than fragmenting history, FORKS with provenance from a terminal run, or starts fresh (`fork:true` forces a fork; the response carries `mode` + `resumedRunId`/`parentRunId`).
  - `resume` after a server restart REHYDRATES the orchestrator from disk (`run-meta.json` + `harness-config.json`) so the same run continues — pass `statePath` when the in-memory singleton is gone; the response carries `rehydrated` + `runId`.
- `GET /api/harness[?action=plan|guide|progress|events]` — status snapshot or the full plan/guide/progress/events
- `GET /api/harness/runs`, `/runs/[id]`, `/runs/diff?a=&b=` — run history & comparison
- `GET /api/harness/screenshot`, `/screenshots` — visual-gate captures

**MCP** (`tools/pof-mcp/`, for a Claude Code CLI to drive it):
- `pof_harness_start` — launch (returns immediately; poll status). Every HTTP start lever, including `statePath`, `fork` and `ueVisual` (the game-runs gate — previously UNREACHABLE from MCP)
- `pof_harness_status` — run state, plan progress (both `verifiedPassRate` + `selfReportedPassRate`), cost, checkpoints, recent events; `feed: 'events' | 'progress'` swaps in the raw event ring / the full progress log (`GET ?action=events|progress`)
- `pof_harness_plan` — the full `GamePlan` (every area, feature, dependency)
- `pof_harness_control` — pause (after the current iteration) / resume; pass `statePath` so a resume AFTER A SERVER RESTART rehydrates the same run from disk instead of 409ing
- `pof_harness_guide` — the accumulated build guide + learnings
- `pof_harness_runs` / `pof_harness_run` / `pof_harness_run_diff` — run history, a single run's full snapshot, and a run-to-run comparison (proxy `/api/harness/runs*`)

**CLI** (`npx tsx src/lib/harness/run-harness.ts`, no dev server needed): every HTTP lever has a flag — `--budget`/`--unlimited`, `--pass-rate-basis`, `--ue-tests`/`--ue-test-filter`/`--ue-visual`, `--fork`, alongside the pre-existing `--project`/`--name`/`--ue-version`/`--max-iterations`/`--target-pass-rate`/`--timeout`/`--concurrency`/`--area-threshold`/`--state-path`/`--theme`/`--scenario`/`--checkpoint`/`--dry-run` (run with `--help` for the full text). It resolves the same **durable identity** as the HTTP route (`cliOrchestratorOptions` → `resolveRunIdentity`): a start over an existing `.harness` RESUMES that runId instead of minting a new one — before this the CLI fragmented one build's history across a row per invocation. Its console **headlines the VERIFIED rate** (the numerator the stop condition actually compares) with the executor's self-report shown second and explicitly labeled, and it prints the launch preflight's unreachable-success advisory as `⚠ WARNING` (non-fatal `harness:error`) rather than swallowing it or dressing it as a crash.

### Parity table (audited — no surface silently lags)

| Lever | HTTP `POST /api/harness` | MCP | CLI |
|---|---|---|---|
| `projectPath` / `projectName` / `ueVersion` | ✅ | ✅ | `--project` / `--name` / `--ue-version` |
| `statePath` | ✅ | ✅ (`start` + `control`) | `--state-path` |
| `fork` | ✅ | ✅ | `--fork` |
| `maxIterations` / `targetPassRate` / `passRateBasis` | ✅ | ✅ | `--max-iterations` / `--target-pass-rate` / `--pass-rate-basis` |
| `budgetUsd` / `unlimited` | ✅ | ✅ | `--budget` / `--unlimited` |
| `sessionTimeoutMs` / `maxConcurrent` / `areaPassThreshold` | ✅ | ✅ | `--timeout` / `--concurrency` (default 4, vs 1 over HTTP) / `--area-threshold` |
| `scenario` / `themeDirective` / `checkpoint` | ✅ | ✅ | `--scenario` / `--theme` / `--checkpoint` |
| `ueTests` / `ueTestFilter` / `ueVisual` | ✅ | ✅ | `--ue-tests` / `--ue-test-filter` / `--ue-visual` |
| status / plan / guide / progress / events reads | ✅ | ✅ (`pof_harness_status` `feed`, `pof_harness_plan`, `pof_harness_guide`) | streamed as console events; artifacts land in `<statePath>/` |
| `pause` / `resume` | ✅ | ✅ | **CLI-shaped, not absent:** SIGINT/SIGTERM pause the loop after the current iteration; resume = re-run the same `--state-path` (durable identity adopts the runId). A *live* pause/resume RPC needs a long-lived server — that is HTTP/MCP-only by design |
| Run history (`/api/harness/runs*`) | ✅ | ✅ | **HTTP/MCP-only** — history is a DB read, not a build lever; use `pof_harness_runs` / the UI |
| Screenshots (`/api/harness/screenshot[s]`) | ✅ | ❌ **HTTP/MCP-gap, intentional** — images are served bytes, not tool JSON; the UI's `HarnessVisualGallery` is the consumer | files under `<statePath>/screenshots/` |
| `--dry-run` (print the plan, build nothing) | ❌ **CLI-only** — HTTP has no side-effect-free plan preview | — | ✅ |

The MCP half of this table is **mechanically enforced**: `tools/pof-mcp/src/harness-tools.test.ts` parses the POST body type out of `src/app/api/harness/route.ts` and fails if any field is unreachable from `pof_harness_start`/`pof_harness_control` (only `action` is allowlisted, with its reason). A new HTTP lever therefore breaks the build until MCP exposes it — the parity claim can't rot. The CLI half is covered by `src/__tests__/lib/harness/cli-parity.test.ts` (flags, identity resolution, headline).

**UI** (`src/components/harness/`): `HarnessGuideViewer` (the generated playbook), `HarnessRunHistory` (pick two runs → diff), `HarnessVisualGallery` (screenshot thumbnails per iteration/area, each badged **GAME** for a headless UE render vs **WEB** for a webapp Playwright shot).

---

## Output: the build guide

Beyond the code it writes, each run produces a `GameBuildGuide` — a human-readable playbook of how the game got built: per-phase steps, the PoF actions taken, the UE5 files touched, the decisions made, the gotchas hit, and how each phase was verified. It's the durable artifact that turns one autonomous run into a repeatable recipe.

---

*The gates this loop runs ground out in the same Unreal bridge described in [`llm-ue-interface.md`](llm-ue-interface.md). For building a single catalog entity (rather than a whole feature), see the [catalog pipeline architecture](../pipeline-architecture.md).*
