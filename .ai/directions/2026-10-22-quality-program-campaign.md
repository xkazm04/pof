---
subject: game-production/quality-verdict-integrity (the Quality Program's three open compute campaigns)
project: pof
raised_by: App Master charter project-kpi-stewardship, 2026-10-22 (headless builder, branch autopilot/project-kpi-stewardship-fd5c9ae2)
source: evidence audit recorded in .claude/plans/quality-program.md, "Execution status (2026-10-22, evidence audit)"
stage: the strict judge and its campaigns (src/lib/judge/, scripts/judge-run.ts, scripts/model-benchmark.ts, src/lib/benchmark-db.ts, src/lib/model-policy.ts)
size: decision only; three campaigns, one of them gated on a harness repair (M)
status: proposed
---

# Quality Program: what to run, in what order, and what it costs

## 1. How to read this

- The evidence is the 2026-10-22 status block in `.claude/plans/quality-program.md`. Every claim below points back to a row there. Tree: local `master` at `331fd0f2`, 23 commits behind `origin/master`; none of the 23 touch an audited path.
- Nothing was run. No judge, benchmark or calibration draw was spent, and `~/.pof/pof.db` was not queried. A DB-held fact is "unverified" here.
- Fourth open item (media prompts into the repo): a parallel builder is changing `src/lib/media-prompts/` this wake. Not graded, not ordered here.
- Status is `proposed`: a headless builder recorded it for the operator. It becomes `accepted` only when the operator accepts it.

## 2. What the audit found that decides the order

| # | Finding | Evidence | What it forces |
|---|---|---|---|
| A | The rubric is v4. The 2026-07-08 status block describes v2. | `src/lib/judge/rubrics.ts:25`; v3 83725ebd, v4 99ed6fcf | Every v2/v3 verdict is provisional. Only v4 verdicts count toward any of the three campaigns. |
| B | The 2026-10-19 reset destroyed `pof.db`. Artifacts were not bulk-restored. | `.claude/fleet-memory.md` 2026-10-22 [diablo] DECISION and W108 DELIVERED; `~/.pof/` holds a 2026-10-22 4 MB `pof.db` and no `judge-calibration.jsonl` | A label POST needs an artifact on record (`/api/judge-calibration` returns 400 without one), and the rejudge judges stored artifacts. Without an artifact store neither can start. Whether the rebuilt DB holds artifacts is unverified. |
| C | The rejudge is paused for judge drift. | fleet-memory 2026-10-09 [readiness]: stored 88-90 text cells score 70-77 on non-recording probes | A full sweep now would demote cells on an instrument nobody has checked against a human. Calibration is that check. |
| D | Calibration has zero confirmed labels and has never run. | `calibration.ts:95-99` (3 provisional media seeds); no history file → standing `unrun` | The judge's agreement with a human is unknown, so neither the rejudge nor the benchmark ranking can be trusted yet. |
| E | The benchmark harness cannot produce an honest matrix as it stands. | `scripts/model-benchmark.ts` unchanged since d7180662: canon-blind judge prompt (:75), no rubric version in `model_benchmarks`, one draw per cell overwritten on re-run (benchmark-db.ts:44), no cost recorded, no spend metering or budget gate, judge alias differs from judge-run's pinned id (:76 vs model-policy.ts:46) | Running it now spends unmetered money on scores that do not compare to v4. Repair it before running. |
| F | The sibling-projection digest filed on 2026-09-16 is not built. | bba723dc; no digest field in `src/lib/judge` or `scripts/` | A v4 verdict can still stand after a sibling it read has changed. That is acceptable for this sweep; filing it again keeps it visible. |

## 3. The decision: order, acceptance, cost

Step 0 picks the artifact set. Then calibration, then the full-map rejudge, then the benchmark after its repair. Each step has an acceptance that must hold before the next step starts.

**Step 0 — an artifact store to judge (operator decision, no compute).**
The operator chooses one: re-produce the catalog artifacts, restore them, or accept a smaller judged map (e.g. the /diablo generation-2 entities as they are promoted). Free check of what exists: `GET /api/judge-verdicts?plan=1`. It is read-only and counts the judgeable artifacts on record (route.ts:24-46). Exit: the preview lists a non-empty step set, and the operator signs off that this set is the map.

**Step 1 — calibration (operator time, a little compute).**
- Do: the operator labels ≥ 10 artifacts, target ~20 (the `CALIBRATION` docstring), in the /status Evidence modal. Cover all three bands and every deliverable class present. Then `npx tsx scripts/judge-run.ts --calibrate --dry`, then the same command without `--dry` plus `--median 3`.
- Tables: `judge_calibration_labels` in, `~/.pof/judge-calibration.jsonl` out. Nothing is written to `judge_verdicts`.
- Acceptance: standing `enforced-pass`, i.e. ≥ 0.85 agreement over ≥ 10 confirmed labels at rubric v4 (`calibration.ts:38`, `:52`).
- Cost: ≤ 20 × 3 = ≤ 60 Opus/high draws. The binding cost is labelling time.
- On `enforced-fail`: rubric wording work and a `RUBRIC_VERSION` bump to 5, then calibrate again. Never lower the threshold. Step 2 waits.
- Optional, one session: a second labeller on the same set measures PoF's own inter-human agreement. Today that is unmeasured (`CALIBRATION_HUMAN_CEILING_NOTE`).
- Why first: this is the measurement the 2026-10-09 pause waits for. It shows which of "88-90" and "70-77" a human agrees with. It is also the cheapest step.

**Step 2 — full-map rejudge at rubric v4 (the big compute).**
- Do: preview with `GET /api/judge-verdicts?plan=1`, which is free and shows the budget fit. Then `npx tsx scripts/judge-run.ts --all --median 3 --concurrency 4`. Add `--rejudge` only for rows judged from a pre-v4 contaminated payload (judge-run.ts:44-51).
- Tables: `judge_verdicts` + `judge_verdict_history`, written through `src/lib/judge/admission.ts`.
- Acceptance: the preview afterwards lists every judgeable artifact as `unchanged`, with no `never`, `scheme`, `rubric` or `content` bucket left. The /status map shows the honest v4 picture. A red wave is the expected truth, not a regression (plan risk notes).
- Cost: draws = judgeable artifacts × 3, each Opus/high.
  - Ceiling: 299 judgeable (catalog, step) pairs in `step-facts.json` × the entities holding an artifact.
  - The 2026-07-08 plan sized the map at ~250 verdicts, which is ~750 draws.
  - Dollars per draw: unverified. The preview prices from `cli_spend` estimates and flags a floor where none exists.
  - Run in 2-3 batches under a configured budget. The harness drains in-flight draws on a budget stop and never kills them.

**Step 3 — benchmark matrix (after a harness repair).**
- Repair first. This is a source change outside this direction and goes to a builder as its own task:
  - meter and budget-gate through `spendMeter.ts`, as judge-run does;
  - build the judge prompt with judge-run's canon and sibling context;
  - add a `rubric_version` column to `model_benchmarks`;
  - median-of-3 judge draws per cell, accumulated instead of overwritten;
  - record cost per sample;
  - pin the same judge model id as judge-run;
  - add sample tasks beyond produce-text: at least fix-content and the media-prompt classes, plus a judge-content cell scored against the step 1 labels. That cell is the plan's "is Opus worth the judging cost" question.
- Then run: `npx tsx scripts/model-benchmark.ts --dry`, the run itself, then `--write-winners`.
- Tables: `model_benchmarks` → `model_policy` (`source: 'benchmark'`).
- Acceptance: each benchmarked class has a winner with ≥ 3 samples per cell at rubric v4 and a recorded cost, shown on the /status Models tab.
- Cost: per cell, 1 produce draw + 3 Opus/high judge draws. The present 2 tasks × 5 combos = 10 produce + 30 judge draws. The plan's target of ~30 tasks × ~10 combos = ~300 produce + ~900 judge draws. Start at the present size and widen only if the winners are not separated.
- Why last: a benchmark ranks models by the judge's score. Until step 1 proves the judge agrees with a human, the ranking measures the judge. It needs no artifact store, so it may run beside step 2 once step 1 passes, but the two share one budget.

## 4. What this does not decide

- Whether the judge of record moves off `claude-opus-4-8` (`model-policy.ts:46`). A new judge model is a new instrument and would void the step 1 calibration. That is an operator question, asked in the run result.
- The media-prompts item (in flight elsewhere).
- Lifting the 2026-10-09 pause. That stays the App Master's call once step 1's measurement exists.
