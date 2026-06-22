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
           2. VERIFY    — run gates (typecheck, lint, test, build, visual, custom)
           3. SELF-HEAL — on required-gate failure, spawn a fix session, re-verify
           4. RECONCILE — match parsed features back to planned ones, update status/quality
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
| `verifier.ts` | `verify` — runs quality gates; `parseErrors` structures tsc/eslint/UE5 output; `detectGates` auto-discovers |
| `claude-session.ts` | `spawnClaudeSession` — single-sourced CLI spawner (stream-json, cost parsing, result markers) |
| `checkpoint.ts` | `Checkpointer` — git branch/tag per green area, `rollbackToLastGreen` (reset --hard) |
| `visual-gate.ts` | `runVisualGate` — Playwright screenshots + perceptual diff (pixelmatch) + axe-core a11y scan |
| `guide-generator.ts` | accumulates a `GameBuildGuide` (phases, decisions, gotchas) as a side effect |
| `run-diff.ts` | `diffRuns` — pure run-to-run comparison (pass-rate / cost / per-area deltas) |
| `run-harness.ts` | standalone CLI entry point (`--project`, `--scenario`, `--theme`, `--checkpoint`, `--dry-run`) |
| `types.ts` | `GamePlan`, `ModuleArea`, `PlannedFeature`, `VerificationGate`/`Report`, `HarnessEvent`, `HarnessCostTotals`, `GameBuildGuide` |

**External-memory design** (from Anthropic's harness research): state files are JSON not Markdown (models corrupt JSON less); one module-area per executor session (large scope fills the 1M window); artifacts bridge context windows; gates enforce verification before advancing. Run artifacts land in `.harness/` (`game-plan.json`, `progress.json`, `guide.json` + `.md`, `cost.json`, `checkpoints.json`).

---

## Safety rails

- **Budget governor** — every session reserves an estimated cost at launch and reconciles on return; `wouldOverflowNow()` blocks new launches past the cap; on cap-hit it emits `harness:paused` and drains in-flight work instead of orphaning it.
- **Checkpoints** — each green area commits + tags on `harness/<runId>`; a failed area can `rollbackToLastGreen`. Because rollback is `git reset --hard`, checkpointing forces `maxConcurrent = 1` (concurrent siblings would be clobbered).
- **Self-heal** — a tri-state result (`healed | unverified | failed`): it only claims "healed" when a real verify command re-ran clean, never optimistically.
- **Pause/resume** — same `runId` row across pause/resume; the loop drains active sessions before stopping.

---

## Control surface

**HTTP** (`src/app/api/harness/`):
- `POST /api/harness` — `{ action: 'start' | 'pause' | 'resume', projectPath, projectName, ueVersion, maxIterations?, targetPassRate?, budgetUsd?, checkpoint? }`
- `GET /api/harness[?action=plan|guide|progress|events]` — status snapshot or the full plan/guide/progress/events
- `GET /api/harness/runs`, `/runs/[id]`, `/runs/diff?a=&b=` — run history & comparison
- `GET /api/harness/screenshot`, `/screenshots` — visual-gate captures

**MCP** (`tools/pof-mcp/`, for a Claude Code CLI to drive it):
- `pof_harness_start` — launch (returns immediately; poll status)
- `pof_harness_status` — run state, plan progress, cost, checkpoints, recent events
- `pof_harness_plan` — the full `GamePlan` (every area, feature, dependency)
- `pof_harness_control` — pause (after the current iteration) / resume
- `pof_harness_guide` — the accumulated build guide + learnings

**UI** (`src/components/harness/`): `HarnessGuideViewer` (the generated playbook), `HarnessRunHistory` (pick two runs → diff), `HarnessVisualGallery` (screenshot thumbnails per iteration/area).

---

## Output: the build guide

Beyond the code it writes, each run produces a `GameBuildGuide` — a human-readable playbook of how the game got built: per-phase steps, the PoF actions taken, the UE5 files touched, the decisions made, the gotchas hit, and how each phase was verified. It's the durable artifact that turns one autonomous run into a repeatable recipe.

---

*The gates this loop runs ground out in the same Unreal bridge described in [`llm-ue-interface.md`](llm-ue-interface.md). For building a single catalog entity (rather than a whole feature), see the [catalog pipeline architecture](../pipeline-architecture.md).*
