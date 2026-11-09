# Codex CLI as a second engine: research and plan (2026-11-09)

Question from the owner: can Codex (GPT-6.1) take large, less complex work, using capacity we already pay for, and how should it work with Claude?

## Short answer

**Yes, as an executor whose work is graded by a machine before Claude reads it. Not as a builder that works unsupervised.**

Capacity is not the limit. Tonight's 32 Codex runs moved the weekly meter by about 1 point. The limit is checking the work, so Codex should only get tasks where a test or other mechanical check can say whether the result is right.

## What was measured tonight

### Capacity (from `~/.codex/sessions`)

| Fact | Value |
|---|---|
| Plan and limit | ChatGPT Pro, one 7-day window; the limit data shows no 5-hour window |
| Peak use, last window | 24 % |
| Use now | 17 %, resets 2026-11-11 13:32 |
| Tonight's 32 runs (20 fixes, 12 reviews) | about 1 point (the meter rounds to whole points) |
| Default model | `gpt-6.1-sol`; levels up to `max` and `ultra` |

Third-party guides disagree about Pro's limits, so the numbers above come only from this account's own logs. Current use is mostly image generation.

### Backtest: can GPT-6.1 fix real bugs? (n=20)

**Method.** 20 fixes that landed in this week's sweep. GPT-6.1 at medium effort got the code from before the fix and the one-line bug report, and made one attempt with no review. The landed test, which it never saw, graded the result. Each test was also confirmed red on the unfixed code.

| | Small fixes (4-35 lines, n=8) | Larger fixes (36-100 lines, n=12) | All |
|---|---|---|---|
| Passed the hidden test | 4 | 4 | **8** |
| Correct, but the test demanded the original's exact wording or an extra field | 2 | 2 | 4 |
| Undetermined (different design; the test can't judge it) | 1 | 2 | 3 |
| Real miss | 1 | 4 | **5** |

Each run took about 1-2 minutes and wrote 700-3,900 output tokens.

Three things limit how far this goes:
- **The middle rows are my own reading of the diffs**, not a second opinion. Only the 8 passes and the 5 misses are firm, and the misses still rest on my read of why each test failed.
- **There is no Claude baseline yet.** The tests were written around Claude's own fixes, which tilts the comparison against GPT. "8 of 20" cannot be called better or worse than Claude until Claude runs the same blind test.
- **All 20 are PoF TypeScript.** GDScript and the game repo are unmeasured.

The misses show where it breaks. Examples: nested modals, where effect order made the outer modal topmost; relabelling a fidelity rung instead of building the missing detection; a skin-binding edge case. **It handles local logic well and misses behaviour that depends on framework order or on intent the bug report doesn't state.** Larger fixes missed more often: 4 of 12 against 1 of 8.

### GDScript backtest (n=10, 2026-11-09)

Same method on real fixes from the game repo: GPT-6.1 medium, one attempt, about 1.5-3.5 minutes each, landed test hidden, each test confirmed red on the unfixed code. The bug report was the original commit subject, and some subjects name a constant or function the fix added, so this leans in Codex's favour.

| Result | Count | Which |
|---|---|---|
| Passed the hidden test | **6** | `bb7077f5`, `59584b62`, `d561498d`, `d61f48bc`, `035643c7`, `90e9a69c` |
| Correct, but the test calls the original's function name | 1 | `3cf3ffdc` (`core_drawn`) |
| Undetermined | 2 | `6438394e` (poses with `drive(0.0)`, test expects a pose that advances); `5c77021f` (gate placed in the caller, test reads `fires_drawn`) |
| Real miss | **1** | `988c0329` (revived every corpse: "a cop's corpse stays down" was intent the report did not state) |

The same pattern as PoF TypeScript: local logic holds, unstated intent does not. The middle rows are my reading of the diffs. n=10 is small and there is still no Claude baseline.

### Tests and tools pilot in the game repo (n=8, 2026-11-09)

Six GUT test files for classes with no tests, graded by `tools/mutate` (bar 70 %, 15 sampled mutants), and two gate tools, graded by hidden tests Claude wrote. One repair round allowed.

| Result | Count | Notes |
|---|---|---|
| Passed the machine grader | **8 of 8** | 6 on the first try; 2 needed the repair round, both for lint |
| Mutation score | 77.8-100 % | `save_meta` lowest, 2 survivors on one line |
| Time per task | 2-15 minutes | mostly grading |

**Claude's review still found what the grader could not.** Five tests pinned accidental behaviour, for example a 180 degree boss cone that excludes its exact edge, and one assertion hardcoded the length of a real voice file. A mutation score rewards exactly that kind of over-fitting. Those were removed or loosened before landing, so the review is not optional.

Possible real defects those pins exposed, not fixed: `BossZone` cone at 180 degrees excludes its exact edge; a default `QuestFailRule` matches any text. All of it is in rtai main (`bc2726b4`). Claude tokens per accepted task were not measured.

### Blind review: can it find bugs with no bug report? (n=12)

It named the known defect in **4 of 12** files, and in one more only partly. It also reported many other defects with concrete triggers, some marked "reproduced". **Those are unverified, so precision is unknown.** On its own this output would just add unverified work to the queue.

### Where the night lanes' effort goes (n10, 1,442 tool calls)

Edit and Write are **8.5 %** of calls. Reads are 24 % and Godot runs 15 %; git, tests and tooling are most of the rest. These are call counts, not tokens.

Writing code is the small part of a night lane. Most of the lane is looking at the game and deciding, so a cheaper code writer barely shortens one. Codex helps more with work beside the lanes than with work inside them.

### Earlier ledger

10 tasks on GPT-5.6 in September, all accepted, in hand-picked classes. Too small and too old to lean on. `routing.ts` still names 5.6 and should only change on measured results.

## Where it can be genuinely useful

Ranked by evidence, then value.

| # | Work | Grader | Why here | Evidence |
|---|---|---|---|---|
| 1 | **Sweep cards: first attempt at fixes** (162 in the spool, more each sweep) | A failing test written before the fix | Local, one file, plentiful | Backtest above |
| 2 | **Bug hunting where a finding must come with a failing test** | The test fails on current code | Turns unverified claims into proven defects | Blind review shows the volume; precision unmeasured |
| 3 | **Regression tests for code that lacks them** | Fails when the code is deliberately broken | Direct, mechanical, feeds #1 | Unmeasured |
| 4 | **Mechanical migrations** (API renames, tokens, model IDs, typed-error sweeps) | Typecheck, lint, existing tests | Exactly "large and less complex" | September ledger only |
| 5 | **Second-family review of Opus night branches** | Same as #2: a failing test | A different family has different blind spots | Unmeasured |
| 6 | **First drafts for `/conform` verdicts and doc-sync** | Claude spot-checks a sample | Volume reading work | Unmeasured; weakest grader |
| 7 | **GTAI sidecar**: GUT tests, tool scripts, report citation checks | GUT, headless evidence | Beside the lanes, not inside them | Unmeasured on GDScript |

**Keep it away from:** game feel, visual verdicts, canon, quest writing and voice lines, cross-module design, perf diagnosis, gates or secrets, and anything that has no grader. Image generation stays as it is.

## How it works with Claude

```
Claude picks and writes the task  ->  Codex works in its own worktree  ->  machine grades it
   (card, scope, grader)                 (never commits)                        |
                                                                   fail: one repair round with the
                                                                   failure output, then back to Claude
                                                                                |
                                       Claude reads only what passed  ->  lands, commits, records
```

Rules:
1. **No grader, no delegation.** The grader is named in the task before Codex starts.
2. **The test comes first and is confirmed red.** Otherwise Codex can write a test that agrees with its own bug.
3. **Codex never grades its own work.** The dispatcher re-runs the check independently.
4. **One repair round, then Claude takes it.** A task that fails twice is probably one Codex can't do, so more rounds waste review.
5. **Nothing reaches the owner's queue from Codex directly.** The owner's review time is the fixed resource; the registry's `human-gate-capacity` warns that overload there looks like success.
6. **Small and local only.** Up to about 40 lines and one file at first, because that is where the misses were fewest.
7. **Every run goes in the ledger** by task class. The ledger, not assumptions about the model, moves the routing table.
8. **Yield to the night runner.** Heavy test runs respect `bench.lock`.

The number that decides whether this pays: **Claude tokens per accepted fix, with Codex versus without.** If reviewing costs Claude as much as writing the fix would, the free capacity buys nothing.

## Phases

| Phase | Work | Exit |
|---|---|---|
| **0, done tonight** | Dispatcher can replay from a past commit and override the model; 32 measured runs | This document |
| **1, baseline** (half a day, unattended) | Same 20 blind on Sonnet and Opus; a second rater for the middle rows; rtai support in the dispatcher (repo path, GUT grader); 10 GDScript backtests | A true comparison table, including GDScript |
| **2, pilot** | Drain the 162 spool cards under the rules above; failing test first | Proposed: at least 60 % accepted, post-merge repair no worse than Claude-only, Claude tokens per accepted fix at most half |
| **3, widen** | Add bug hunting with proof (#2), tests (#3), migrations (#4); update `routing.ts` from the ledger | Each class keeps its own measured acceptance |
| **4, GTAI** | Codex sidecar in one night run; Opus lane lead hands it tasks | Lane output up, no new owner review load |

If Phase 2 misses its bar, stop at migrations and the test-writing classes that clear theirs, and keep Codex for images.

## Decisions for the owner

1. **Run Phase 1 next, unattended?** Recommended. It costs Claude usage for the baseline, and it is the only way to get a fair comparison.
2. **May Codex write game code in rtai?** Today it only makes art there. Recommended: yes, for tests and tools first, gameplay code only after the GDScript backtest.
3. **Keep a share of the weekly window for images?** Decided 2026-11-09 (c-1): the dispatcher stops starting text tasks when the total meter reaches 75 %, because the meter cannot separate text from images.

Decision 2 was also answered on 2026-11-09: tests and tools first, under Claude's control. Gameplay code stays out until a further decision. The Claude baseline in Phase 1 has not run.

## Batch 2 (2026-11-09, after renewal): the review changed the answer

| Class | Tasks | Passed the machine bar | Landed after Claude review | Landed unchanged |
| --- | --- | --- | --- | --- |
| GUT tests | 8 | 5 | 4 | 1 |
| Node tools | 3 | 3 | 3 | 2 |

Tools took 83 to 106 s each; test files took 11 to 34 minutes because of mutation runs and repair. Across batches 1 and 2, tools are 5 of 5.

What separates the failures: pure logic with clear rules scored well (`rig_hose`, `enemy_brain`). A generator with tuned tables scored 86.7 % by copying its constants, and was rejected. Removing pins from `sim_clips` cost 20 points of mutation score and made the test more honest: the score rewards pinning, so it can reject work but cannot accept it.

**Routing recommendation.** Send Codex: Node tools with a written contract and hidden tests, and GUT tests for pure rule modules. Keep with Claude: tests for generators and tuned tables, and any landing decision. Claude's review remains mandatory; what it saves is writing, not reading. Savings in Claude tokens are unmeasured, so the case for moving more work is not proven yet.
