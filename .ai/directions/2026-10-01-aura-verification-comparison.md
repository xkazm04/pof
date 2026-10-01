---
subject: game-production/runtime-observation-evidence + game-production/engine-integration-safety (comparison study; no single subject)
project: pof
raised_by: ai-registry intake 2026-10-01 (source: Aura documentation site, tryaura.dev/documentation)
source: ai-registry intake note librarian/sources/2026-10-01-aura-documentation.md
stage: pof test-gate runner, spawn executor, verification primitives (src/lib/test-gate-runner/, src/lib/ue-automation/, e2e/helpers/)
size: study; the ranked features below carry their own sizes
status: proposed
---

# Aura verification stack against the pof test gate

## 1. How to read this

- Peer: Aura is a commercial agent that drives the Unreal editor to decide whether its own change works. pof's runner does the same job for a UE 5.8 project, so the two are the same class of system with different product shapes.
- Aura evidence is twelve vendor documentation pages only, cited `[page-slug: quote]`. "Undocumented" means the pages are silent, not that Aura lacks the thing. Every Aura number is a vendor-claim.
- pof evidence is pinned to commit 88f1b080 (`path:line`). The two files under edit this session (`src/lib/test-gate-runner/batchAutomation.ts`, `src/lib/ue-automation/abslog.ts`) are read as they stood at that commit. Commit 9a64fd4b landed on both during this study; its diff was not read. Files marked "UE repo" are the Unreal project's own repository, read at its working tree, outside the pin.
- Verdicts: adopt, adapt, keep ours, different forces. Each row carries a reason. Nothing was run; all pof behaviour below is from reading code.

## 2. Points

### A. Verification evidence and rungs

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 1 | [verification-agent: "Aura inspects real runtime state, not just whether the code compiled"] | Tiers T0-T4; "T0-T2 are necessary but never sufficient" (docs/features/harness-llm-unreal/llm-ue-interface.md:11-21) | keep ours | Each intent declares the tier it needs; Aura's pages describe one mode, play. |
| 2 | [verification-agent: "reports back with evidence, including recorded video of the run"] | Bounded `GateEvidence`: markers, 8 samples, stats, frame path, 500-char judge text (src/types/observation.ts:200-221); the audit lists verdicts with no proof (src/lib/test-gate-runner/evidenceAudit.ts:47-50, 84) | keep ours | pof flags a verdict that carries no proof; how Aura keeps or audits evidence is undocumented. |
| 3 | [verification-agent: "It attempts a fix and verifies again."] | Healing sits in the harness, never in the runner; unverifiable gates are not healed (src/lib/harness/orchestrator.ts:968, 1028-1031); a linter bars live reruns without a fixture (e2e/helpers/fix-and-rerun-lint.ts:1-12) | keep ours | The runner stays a judge; the linter records the cost of "the next fix is the last one" loops. |
| 4 | [verification-agent: "Needs an observable result"], runtime-silent changes "can't be meaningfully verified" | Zero-match becomes `deferred` (src/lib/test-gate-runner/spawnExecutor.ts:313-320); harness reports `unverifiable` (src/lib/harness/ue-gates.ts:114-122) | keep ours | Same limit; pof stores it as a typed state with a reason, Aura states it as prose. |

### B. What a verification run observes

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 5 | [verification-agent: "Gameplay Ability System: abilities granted, attributes and their values, active effects"], plus actors and UMG widgets | `ObsSample`: pose, location, speed, montage, health/stamina/mana, `ability_found` (src/types/observation.ts:28-51); 8 assertion kinds, 3 attributes (src/lib/test-gate-runner/types.ts:29-39); no widget or actor-existence observation found | adapt | Real gap for active effects and widget state; add only fields a pending gate asserts on (the spine's additive rule, observation.ts:41-49). |
| 6 | [verification-agent: "Multiplayer: behavior across multiple connected clients where the feature calls for it"] | `ScenarioSpec` is one map and one pawn (observation.ts:78-87); `network_debug` is listed runtime-only and uncovered (docs/concepts/UE/mcp-bakeoff-verdict.md:35) | different forces | No networked-feature gate found in the runner; build only if scope adds one. |
| 7 | [verification-agent: "On an empty map with no player start, there's nothing to observe."] | L4 with a missing or unlit declared map is `deferred` with a reason (src/lib/test-gate-runner/captureResolver.ts:72-82); L3 "no samples" is a `fail` (spawnExecutor.ts:149-152) | keep ours | Same precondition; pof types the L4 case, and keeps the L3 case a fail by choice. |

### C. Routing a change to a verification layer

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 8 | [custom-agents-workflows: "Aura decides whether a specialist, a custom sub-agent, or a full workflow fits"]; verification is by request or plan step | Gate tier is declared per catalog step (observation.ts:171-185) or harness plan (src/lib/harness/types.ts:143-157); nothing maps a change to the gates able to judge it. Record: harness `visual-check` gave no verdict in 77 of 77 deciding iterations (.ai/applied.jsonl:1) | adapt | Take route-by-change-class, not model-decides; a path-class table can be replayed offline (test d). |
| 9 | Undocumented: no preflight or coverage report described | `checkSuccessReachable` warns before a run (src/lib/harness/verifier.ts:288-340); run-end lines name gates with zero real verdicts (orchestrator.ts:525-567) | keep ours | Both ends of the loop exist; point 8 is the missing middle. |

### D. Engine launch modes and boot cost

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 10 | [advanced-settings: "it starts Unreal Engine as a lightweight background process (headless mode)"] | Spawn exists but is off unless `allowSpawn` (spawnExecutor.ts:25-30, 329-331); default is the bridge into a running editor (src/lib/test-gate-runner/executors.ts:43-47; bridgeExecutor.ts:157-160) | different forces | Aura owns its editor; pof shares one UE tree with sessions it cannot see (spawnExecutor.ts:25-29). |
| 11 | [aura-1-0-launches: "under a minute per test case"]; boots per verification undocumented (vendor-claim) | One `UnrealEditor-Cmd` boot per drain pass for all automation gates (batchAutomation.ts:1-16; spawnExecutor.ts:338-350); `limit` bounds the batch (drain.ts:221-231) | keep ours | Cold start is paid once; a unit test asserts boot count through an injected spawn (spawnExecutor.ts:41-45). |
| 12 | [advanced-settings: "no full editor UI needed"], standalone app keeps a headless editor | Bridge default reuses a running editor (executors.ts:43-47); `KeepAliveEditor` reuses one over Python remote exec (e2e/helpers/keep-alive-editor.ts:1-12) but has no crashed state (:16, 78-95) | keep ours | Warm reuse exists on both sides; the missing state is too small for its own row. |

### E. Parallelism and concurrency

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 13 | [aura-1-0-launches: "3 test cases verified in parallel"]; mechanism undocumented | One job at a time under a lease (docs/catalog/L3-L4-RUNNER.md:8; src/lib/test-gate-runner/drain-lease.ts:1-12); ticks never overlap (worker.ts:121-128) | different forces | One non-reentrant editor on a shared tree. 2-3 min to under 1 min is about 2-3x per case, so "8x" reads as throughput once 3-way parallelism multiplies it (vendor-claim). Test e. |
| 14 | [advanced-settings: "Aura automatically shuts down the headless instance and connects to the editor instead"] | The lease is an in-process Map (drain-lease.ts:22): it excludes pof's own drains, not a sibling session launching the engine | different forces | Aura is the editor's only driver; pof's tree has other drivers, so it needs a cross-process lock, not a handoff. |

### F. Crash handling and resume

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 15 | [automatic-crash-recovery: "A crash while Aura is idle is left alone."]; closing the editor yourself never triggers it | The spawn seam keeps only `{timedOut}` (spawnExecutor.ts:49-65); exit code is dropped on purpose, headless exits non-zero on a benign shutdown (src/lib/ue-automation/abslog.ts:8-11); `Fatal error` is read only to stop zero-match reading as "planned" (batchAutomation.ts:48) | adapt | Type the outcome as clean, timed-out or crashed from marker plus exit status; Aura's crash-report reading needs no copy. Test f. |
| 16 | [automatic-crash-recovery: "Aura waits for the editor to finish loading and confirms it stays up."] | If a crash leaves no index.json (unverified), per-test scoping keeps earlier verdicts and defers the crasher and every later test (batchAutomation.ts:195-217; test batchAutomation.test.ts:135-148 under src/__tests__/lib/test-gate-runner/). Next pass rebuilds the same batch (drain.ts:225-231); a `deferred` verdict sets no cooldown (worker.ts:95-98); one 180 s cap covers the whole batch (spawnExecutor.ts:38-39). Dead bridge: skipped, 5-minute cooldown, no relaunch (drain.ts:264-267). Harness path reads a truncated whole log as pass (ue-gates.ts:114-128 never reads `fatal`) | adapt | Resuming the remaining tests is what transfers; relaunch-and-continue is tied to Aura's chat task. In flight (test a). |
| 17 | [automatic-crash-recovery: "closes the Unreal crash-report window for you"] | Watchdog is SIGKILL (spawnExecutor.ts:58-61). Recovery-state cleanup exists only as a manual launcher in the UE repo (Content/Python/observation/launch_editor.sh:15, commit f122800), which no pof code calls | adapt | Test first whether a headless `-unattended` relaunch hangs (test g); clearing Autosaves in a shared tree deletes a sibling's recovery data. |
| 18 | [automatic-crash-recovery: "Aura reads Unreal's crash report and works out the likely cause."] | A crash analyzer parses pasted UE5 logs and keeps signature history (src/components/modules/evaluator/CrashAnalyzerView/ImportPanel.tsx:88; src/__tests__/lib/crash-history-db.test.ts); nothing in src/lib/test-gate-runner reads it | adapt | Name the crasher in the deferred reason from the signature bucket pof already has; no auto-fix. |
| 19 | [automatic-crash-recovery: "it never edits code based on a single crash."] | The history store counts occurrences per signature (src/__tests__/components/CrashAnalyzerHistory.test.tsx:179); no runner rule uses the count | adopt | A rule, not a mechanism: act on a repeated signature only. One counter on a bucket pof already computes keeps a first crash from quarantining a healthy test. |

### G. Isolation, sandboxing and undo

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 20 | [filesystem-sandbox: "creates a virtual filesystem inside your project's Intermediate directory to capture all asset changes"] | No overlay. Undo is a git checkpoint per green area, `rollbackToLastGreen` (src/lib/harness/checkpoint.ts:1-15; docs/features/harness-llm-unreal/autonomous-builder.md:67), which forces one session at a time. The Conductor loop's "snapshot affected .uassets" step (llm-ue-interface.md:34-44) has no implementing code in what I searched | different forces | pof authors autonomously in a git project; the overlay's gain, review before persist, is for a human in the loop, and it is experimental (reject "may sometimes fail"). |
| 21 | [filesystem-sandbox: "C++ is not sandboxed. Sandboxing only affects assets"] | Purpose is "building UE5 C++ games" (.ai/manifest.yaml:9); the required harness gate is the UBT compile (src/lib/harness/ue-gates.ts:146-156) | different forces | The overlay misses the change class pof's required gate targets. |
| 22 | [filesystem-sandbox: "Changes do not show up in the Sandbox change list until they have been saved"] | Recorded: "VerticalSlice combat tests are order-dependent in the full suite (isolated runs pass)" (.claude/fleet-memory.md:268). The tests share one map (UE repo: Content/Python/place_combat_tests.py:17-23) and mutate live actors: `ApplyModToAttribute` Override on player and enemy (Source/PoF/Test/Combat/VSCombatDamageFormulaTest.cpp:77-83), Mana base 9999 (VSCombatHotbarTest.cpp:82); only GrayBoxPath cleans up (VSCombatGrayBoxPathTest.cpp:163-170) | different forces | The leak is in-memory world state; an asset overlay cannot reach it (test b). |
| 23 | [verification-agent: "Interrupting mid-run loses the evidence for that attempt."] | Verdicts persist per gate (drain.ts:130-154); each run has its own `-abslog` that survives a watchdog kill (batchAutomation.ts:178); batch verdicts wait in an in-memory Map until applied (spawnExecutor.ts:258) | keep ours | A killed run still yields scoped verdicts; the loss window is one cached batch. |

### H. Performance capture as a test stage

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 24 | [performance-profiling: "identifies CPU, GPU, and render-thread bottlenecks, and reports the results directly in chat"] | Analysis half exists: CSV import, triage, base/head compare (src/app/api/performance-profiling/route.ts:38-46, 100-118), sessions in memory only (:9-11); `generate-sample` fabricates one (:48-58); `data-perf.ts:9-20` is hardcoded; no capture step, no runner link | adapt | Connect a scripted capture to analysis pof already has; Aura's own page calls autonomous capture experimental. |
| 25 | [performance-profiling: "This mode is intended for use with the verification agent and is highly experimental"] | Scenario windows are scripted (observation.ts:105-113) on a fixed 1/60 s step, `-benchmark -fps=60` (observation.ts:136-139, 158); L3 runs `-nullrhi`, so GPU time is not measured (observation.ts:141-142) | different forces | pof can script the window, so manual start and stop is moot; GPU numbers need the offscreen path and a separate boot. |

### I. Test authoring, registration and reachability

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 26 | Undocumented; the check is generated per request, [verification-agent: "Ask for the outcome, not the implementation."] | A standing suite: `VSCombatDamageFormulaTest` "had never been placed in any map, so it had never run" (docs/superpowers/specs/2026-09-22-combat-attackpower-adds-zero.md:21-23); zero-match covers only unregistered names (batchAutomation.ts:115-117); a test can go stale as assets move (specs/2026-09-25-vs-enemy-attack-test-stale-premise.md:27-31) | different forces | A generated check cannot be left unplaced; a standing suite can, so reachability is pof's own problem (ranked feature 1). |
| 27 | [from-one-week-to-one-hour: "Slate gave Aura more predictable output because it's entirely code-driven."] | State is read through the spine and abslog markers, not UI the agent generates (observation.ts:21-26) | keep ours | Headless state is checkable by code; a generated debug UI is one more artifact to verify. |

### J. Tool-surface split

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 28 | [ide-claude-code-alpha: "unreal_inspector (read-only inspection and planning) and unreal_editor (authoring and mutation)"]; the inspector also holds "engine lifecycle (launch/recompile/shutdown)" | One pof-mcp server; every tool has read-only and destructive hints pinned to behaviour by a guard test (tools/pof-mcp/src/annotations.test.ts:13-20, 92-99); topology gating (tools/pof-mcp/src/tools/topology.ts:1-30); verdict writing (`pof_drain_gates`) is apart from the evidence reader `pof_gate_evidence` (docs/catalog/L3-L4-RUNNER.md:19) | keep ours | Hints are tested claims; a process split adds a coarse allow-list for hosts that ignore hints, and I found no such host. Aura's "read-only" server still launches and shuts down the engine. |

### K. Evidence retention and review

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 29 | [verification-agent: "The recorded video often shows a detail that a passing verdict won't mention"] | Numeric sample stream plus one action-peak frame (src/lib/ue-launch/capture.ts:199-218); a single frame is "the gross-error floor" (visualExecutor.ts:116-118) | keep ours | The sample stream is code-checkable; video needs a viewing judge. pof's own filmstrip trial was not-better (.ai/applied.jsonl:14). |
| 30 | Undocumented: whether recorded video is kept | `visual_verifications` stores `screenshot_path` text, not bytes (src/lib/visual-verification-db.ts:33-45); capture dir defaults to the OS temp dir (capture.ts:248); whether the file survives is unverified | adapt | Copy the judged frame beside the verdict so `pof_gate_evidence` points at a file that lasts. |
| 31 | Undocumented: a judge failure is not described | Judge outage becomes `deferred` with the frame kept and returned (visualExecutor.ts:103-114); any answer other than "pass" maps to `fail` (:115) | keep ours | An outage is not an observed failure; the binary map is the weak spot. |

### L. Cost and budgets

| # | Aura | pof (88f1b080) | Verdict | Reason |
|---|---|---|---|---|
| 32 | [verification-agent: "Verification is genuinely more expensive than a plain chat response."]; workflows capped at "up to 35 minutes" | 180 s watchdog per boot (spawnExecutor.ts:254), bridge poll deadline (bridgeExecutor.ts:221), `limit` caps the batch (drain.ts:221-231), harness budget governor (orchestrator.ts:191-206, 239-243) | keep ours | Aura reports cost; pof caps it where it is spent. Caveat: the 180 s cap is not scaled by batch size. |

Tally: adopt 1, adapt 8, keep ours 14, different forces 9 (32 points).

## 3. Corrections to the seed points

1. Crash-recovery cleanup. "No code implements it" is wrong as stated. The UE repo holds a manual launcher that removes `Saved/Autosaves`, `Saved/Crashes`, `Saved/SaveRecovery` and `Intermediate/DisasterRecovery` and launches `-unattended` (`Content/Python/observation/launch_editor.sh:15`, commit f122800, 2026-05-29). It sits outside the pof tree, hard-codes UE_5.7 (:9), and no pof code calls it. A `git grep` for the four directory names finds nothing at the pin, so "no pof code" holds.
2. Performance profiling. "No integration exists" is too strong. An evaluator module imports Unreal Insights and stat-dump CSV, triages, and compares base against head (`src/app/api/performance-profiling/route.ts:38-46, 100-118`; sources `unreal-insights`, `csv-stats`, `manual`, `src/types/performance-profiling.ts:3`). Still true: pof launches no capture, nothing in `src/lib/test-gate-runner` references it, sessions live in a process-local Map (`route.ts:9-11`), and `data-perf.ts` is hardcoded.
3. The 0-of-77 record. `.ai/applied.jsonl:1` concerns the harness's advisory `visual-check` gate in two webapp runs ("dev server did not start / no tests found"; `src/lib/harness/visual-gate.ts:378`), not the UE L4 `visualExecutor`. L4 verdict yield is not measured anywhere I read.
4. Exit code. Discarded as stated (`spawnExecutor.ts:49-65`) but by design (`abslog.ts:8-11`). Not universal: the cooked-build self-check judges by exit code because Shipping strips logs (`e2e/helpers/ue-verification.ts:119-130`).
5. One grouped boot per pass. True on the success path. The retry-then-degrade path (`drain.ts:232-246`) fires only when `prepareBatch` throws; a crash or timeout does not throw (`batchAutomation.ts:182-206`), so a crash is not retried in-pass. The 180 s cap covers the whole batch (`spawnExecutor.ts:38-39`).
6. No CI wiring. No workflow file exists at the pin, but a `ci` harness mode does (`e2e/helpers/ci-harness.ts:1-30`; `e2e/all-verifications.spec.ts:10`) and an env-gated live-drain test (`src/__tests__/lib/test-gate-runner/live-drain.integration.test.ts:16-18`). The e2e helpers default to UE_5.7 binaries (`ue-verification.ts:17`) while the capture path defaults to 5.8 (`captureResolver.ts:30-31`).
7. Combat order-dependence is one recorded line (`.claude/fleet-memory.md:268`) with no count of affected tests. The 58/62 line (:267) is a different set, four red tests that "fail identically pre-W12".

Confirmed unchanged: zero-match becomes `deferred`; verdicts come from `-abslog` markers and `-ReportOutputPath` `index.json` (`batchAutomation.ts:9-11, 185-193`); a never-placed test existed (point 26).

## 4. Tests to initiate

**T-a. Crash-truncated grouped boot (DONE 2026-10-01 in `9a64fd4b`, after this study was written: N=6, one crasher at K=3, three drain passes on a simulated editor; tests with a real verdict 2 -> 5, existing tests labelled "planned" 4 -> 0, launches 3 -> 4; a clean batch is still one launch. Not run at K=1 or K=N, and not against a real engine crash log. Points 15, 16 and 19 describe the tree as it stood at `88f1b080`; point 16's harness-path finding is NOT fixed by that commit: `src/lib/harness/ue-gates.ts` `parseAutomationLog` still never reads the fatal marker, so a suite cut by a crash after N passes reads as a pass. It is left alone because the floor is unmeasured: whether a benign teardown fault prints the same marker needs one captured clean-run log.)**
Arms: A = 88f1b080; B = the director's change (not read). Instrument: `runBatchAutomation` plus `drainJobs` with an injected `SpawnFn` (`batchAutomation.ts:27`) that writes an abslog cut at position K of N with a `Fatal error` line, extending `batchAutomation.test.ts:135-148`; N=8, K in {1,4,8}, three passes. Moves: tests carrying a real verdict after three passes (A predicted K-1 from reading, unmeasured). Floor: a clean batch costs exactly one `spawn` call with identical verdicts; no test is credited a sibling's marker. Falsifier: B does not beat A at some K, or the crasher itself receives a verdict from a sibling's marker.

**T-b. Does an asset overlay prevent combat order-dependence?**
Decision from repo evidence: no, the leak is runtime world state (points 22, 26). Arms: A = full VerticalSlice functional suite; B = same with Sandboxed Editing on (5.8, experimental); C = each combat test in its own boot, the recorded pass case. Instrument: `Automation RunTests` with a per-arm `-abslog`; three random orders in A. Moves: combat tests whose verdict differs from C (uncounted today). Floor: tests green in C stay green in A and B; B writes nothing outside the sandbox directory. Falsifier: B's red set is smaller than A's, meaning the leak crosses saved assets.

**T-c. Perf capture with a fixed timestep.**
Arms: A = scenario with L3 verdict only; B = same scenario plus a scripted CSV-profiler window under `-benchmark -fps=60`, fed to the existing `import-csv` and `compare`. Instrument: a branch build with an injected 2 ms per-frame busy tick against an unmodified build, five runs each, plus five A/A pairs. Moves: detection rate of the injected regression. Floor: zero false flags over the five A/A pairs; clean L3 drain still one boot (capture is a separate boot). Falsifier: A/A spread of median frame time exceeds half the injected delta, so the fixed step does not buy a stable gate.

**T-d. Change-class router.**
Arms: A = run-end coverage lines (`orchestrator.ts:525-567`); B = a pre-run table from changed path class, gate type and environment to "can any gate return a verdict". Instrument: offline replay over the four recorded runs (`.harness-ui`, `.harness-content`, `.harness-dzin`, `.harness-dzin-full`: `game-plan.json`, `progress.json`). Moves: agreement between B's "cannot be judged" set and the recorded unjudged features (323 in the 2026-08-30 row). Floor: scheduling and pass-rate basis untouched (`isDependencyResolved` unchanged, harness suite green), as in the 2026-09-29 row. Falsifier: B marks "cannot judge" any feature that received a real verdict, or only restates `checkSuccessReachable`.

**T-e. Three-way parallel boots against one grouped boot.**
Arms: A = one grouped boot of three tests; B = three concurrent `UnrealEditor-Cmd` boots, each with its own `-abslog` and `-ReportOutputPath`. Instrument: spawn executor with a real engine, batches of 3 and 12 identical short tests. Moves: wall-clock per batch. Floor: per-test verdicts identical across arms; no `PoF_2.log`-style log spill. Falsifier: B is no slower than A at N=3 without collisions, which would make the vendor's 3-way claim plausible here.

**T-f. Outcome classification from exit status.**
Arms: A = `{timedOut}` (today); B = `{timedOut, exitCode, signal}` classified with the `fatal` marker (`abslog.ts:63-64`). Instrument: 10 clean batches and 10 deterministic-crasher batches. Moves: crash classification accuracy for marker alone, exit code alone, both. Floor: zero of 10 clean batches classed as crashed. Falsifier: exit code is non-zero in both populations and the marker alone separates them, so exit code adds nothing and A stays.

**T-g. Relaunch after a kill.**
Arms: A = SIGKILL a running headless batch at 30 s, relaunch with the same arguments; B = the same after clearing the four recovery directories, in a scratch copy of the UE project. Moves: seconds from relaunch to the first `Result=` marker. Floor: cold-boot time unchanged; nothing deleted outside the scratch copy. Falsifier: A relaunches within the normal boot band, so cleanup is needed only for the windowed bridge editor.

## 5. Features ranked

Scope block (`.ai/manifest.yaml:39-41`): `does: an AI companion for building UE5 C++ games: headless engine tooling, MCP wiring, UI workflows`.

1. **Test reachability audit (S).** Why scope admits it: "headless engine tooling" covers enumerating registered tests with the engine headless. First context: the C++ test classes under the UE repo's `Source/PoF/Test`, the engine's `Automation List` output (cf. `docs/research/impact-map.md:209`), and gate test names; it must not absorb the drain write path or `parse.ts`. Measurable: test classes that appear in no registered list, against a planted unplaced canary class in a scratch UE copy. Falsifier: the audit misses the canary, or flags a test that returned a verdict in the last drain. Size S.
2. **Change-class router (M).** Why scope admits it: the harness is the "AI companion for building UE5 C++ games" loop, and the router is a preflight over its gates. First context: `src/lib/harness/verifier.ts` preflight and the `orchestrator.ts` coverage tally; it must not absorb `isDependencyResolved` scheduling, `required` flags or the L3/L4 drain. Measurable: agreement with the recorded unjudged set (test d). Falsifier: test d. Size M.
3. **Perf-capture stage (M).** Why scope admits it: "headless engine tooling" includes a scripted engine run that emits a profile. First context: the scenario launch builder (`observation.ts:155-163`) and `src/lib/profiling/` import and compare; it must not absorb the PerformanceProfilingView UI, GPU pass analysis or `data-perf.ts`. Measurable: detection rate of an injected 2 ms regression (test c). Falsifier: test c. Size M.

## 6. What pof does better

- Typed non-verdicts with named reasons: `deferred` and `unverifiable`, and "a judge OUTAGE is not an observed failure" (`visualExecutor.ts:103-114`; `ue-gates.ts:114-122`).
- A verdict is never credited to a test with no marker; ambiguous matches degrade to deferred (`abslog.ts:94-127, 136-209`; `bridgeExecutor.ts:44-90`).
- An evidence reader that lists verdicts with no proof (`evidenceAudit.ts:47-50, 84`), so the judge fleet audits without re-running.
- A transport-failure taxonomy (unreachable, timeout, aborted, malformed-body) so a wedged editor is never reported as a plugin bug (`src/lib/bridge/run-python.ts:24-34, 43-54`).
- Shared-tree conservatism: spawn off by default, one `-abslog` per run, a lease with catalog containment, and synthetic fixture entities excluded from sweeps (`spawnExecutor.ts:25-29`; `drain-lease.ts:44-63`; `drain.ts:70-78`).
- Rollback that covers C++ and assets through a checkpoint ledger that survives resume (`checkpoint.ts:1-15`; `autonomous-builder.md:67`), where Aura's overlay excludes C++.
- A fixed 1/60 s timestep for scenario runs, so observed motion is reproducible (`observation.ts:136-139`).

## 7. Not evaluated

- Aura internals beyond the pages: how its three parallel runs work, whether video is retained, how a crash is told from a hang, what autonomous capture does, whether verification runs inside the sandbox. All Aura numbers are vendor claims. The pricing and Unity pages were not read; the level-design, blueprints and prompting-tips pages were read only for their testing lines.
- No engine, test or measurement was run. Every crash outcome above is code reading, including the K-1 prediction, whether UE writes `index.json` on a fatal exit, and whether a headless relaunch after SIGKILL hangs.
- Commit 9a64fd4b (the director's change) was not read. UE-repo files were read at its working tree, not pinned. One recorded gotcha (force-kill leaves a recovery modal) comes from a pof session memory note outside the repo.
- Not read in full: `ue-visual-gate.ts`, the C++ scenario controller, the e2e specs, the crash analyzer internals, `pof-mcp` annotations for every tool. Sandboxed Editing was not tried. The count of unreachable test classes today was not taken.
