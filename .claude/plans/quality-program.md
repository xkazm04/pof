# Quality Program — professional-grade outputs, strict gating, model policy

Plan authored 2026-07-08 (Fable analysis pass). Execution: Opus-orchestrated, workstream
by workstream. Goal: move `/status` from "technically correct" to "professional-grade,
strictly judged, produced by the right model at the right thinking budget."

## Execution status (2026-10-22, evidence audit — supersedes the 2026-07-08 block below)

**Tree the audit saw:** branch `autopilot/project-kpi-stewardship-fd5c9ae2` cut from local `master`
at `331fd0f2`. The local master was **23 commits behind `origin/master`** when this was read
(`git rev-list --count master..origin/master` = 23). None of those 23 commits touch an audited
path (`git diff --stat master origin/master` over `src/lib/judge`, the judge/benchmark scripts,
`model-policy.ts`, `benchmark-db.ts`, the three API routes, `ModelsView.tsx`, `.claude/plans`,
`.ai/directions` is empty). Documentation and decision only: no source was changed or run, and no
judge, benchmark or calibration draw was spent.

**The rubric is v4, not v2.** `src/lib/judge/rubrics.ts:25` — `RUBRIC_VERSION = 4`. History the
2026-07-08 block never recorded (header comment, rubrics.ts:8-24):
- **v3** (83725ebd, 2026-07-13): canon-aware — the judge receives the catalog's binding canon and
  a projection of the entity's sibling steps; every v2 pass became provisional.
- **v4** (99ed6fcf, 2026-08-04): same contract TEXT, corrected harness INPUT — `produceDirection`
  stripped from the judged payload (`payload.ts`), nested sibling projection on by default. The
  header's "+16.9 contaminated" A/B was later found CONFOUNDED (it omitted canon context); on
  identical content v4 ≈ v3 (n=31, mean −1.5) — `.claude/fleet-memory.md` 2026-07-30 [judge].

**The judge library is 16 modules, not 2.** `src/lib/judge/`: admission, bindingRule,
calibration, calibrationLabels, calibration-labels-db, contentHash, dimensions, fleetPlan, payload,
rejudgePlan, rubrics, siblingContext, spendMeter, stepBinding, verdictStanding, verdictTrend.

**The 2026-10-19 machine reset.** `.claude/fleet-memory.md` 2026-10-22 [diablo] DECISION records
that the reset destroyed `~/.pof/pof.db` with no backup, and the W108 DELIVERED line records
"promoted/artifacts/UE assets are 0 and are NOT being bulk-restored". On 2026-10-22 `~/.pof/`
holds a 4 MB `pof.db` dated 2026-10-22 and **no `judge-calibration.jsonl`** (file listing only).
What tables that rebuilt DB holds — `pipeline_artifacts`, `judge_verdicts`,
`judge_calibration_labels`, `model_benchmarks`, `model_policy` — is **unverified: the DB was not
queried (not this audit's to query)**. Every DB-held result recorded before 2026-10-19 (the
2026-07-08 scores, the sweeps below) survives only as commit messages and fleet-memory lines.

| # | Item | Closed (built, with evidence) | Open | What remains — script · table · acceptance · cost shape |
|---|------|-------------------------------|------|---------------------------------------------------------|
| 1 | Full-map rejudge | The sweep harness. `scripts/judge-run.ts --all` with `--median N` (:128, default 1), bounded pool `--concurrency` (:138, default 4), a skip rule that reuses a verdict only while it binds to the same `stepContentHash` + rubric (`fleetPlan.ts` `judgeSkipDecision`; 8f7d1bf9), every draw metered and budget-gated with drain-never-kill on a stop (`spendMeter.ts`; judge-run header), a free read-only cost preview `GET /api/judge-verdicts?plan=1[&force=1]` (`rejudgePlan.ts`, route.ts:24-46; b04927cd), one admission door for verdict writes (`admission.ts`; 41ef5d36), append-only history + trend (`verdictTrend.ts`, `VERDICT_HISTORY_LIMIT` 20; 2b72b454), standing that counts only what acceptance counts (`verdictStanding.ts`; b0b3b8d6). | **The sweep itself.** No committed evidence of a full-map v4 sweep — only partial ones: 90 swept cells around the v4 bump (fleet-memory 2026-07-30), the 8 input-schemes cells re-judged sweep-v4 median-of-3 on 2026-10-07 (ef149746). The campaign is **paused by App Master decision** (fleet-memory 2026-10-09 [readiness]): untouched 2026-09-01 text cells score 70-77 on non-recording `judge-one` probes where their stored verdicts say 88-90, so the stored baseline does not reproduce. The sibling-projection digest filed on 2026-09-16 (bba723dc: 131 of 143 bound panel verdicts had a sibling updated since judgment) is **not implemented** (no digest field anywhere in `src/lib/judge` or `scripts/`). After the reset, whether any artifacts exist to judge is unverified (see above). | Script: `npx tsx scripts/judge-run.ts --all --median 3` (add `--rejudge` only for rows judged from a pre-v4 contaminated payload, judge-run header :44-51). Writes `judge_verdicts` + `judge_verdict_history` through `admission.ts`. Acceptance: `GET /api/judge-verdicts?plan=1` lists every judgeable artifact as `unchanged` (no `never`/`scheme`/`rubric`/`content` bucket), i.e. each holds a v4 verdict bound to its content on record. Cost: draws = judgeable artifacts × 3, Opus/high each (`model-policy.ts` `judge-content`). Structural ceiling 299 judgeable (catalog, step) pairs in `src/lib/status/step-facts.json` (219 text-config, 39 2d-art, 15 audio, 13 3d-mesh, 13 animation, across 33 catalogs) × entities with an artifact; the 2026-07-08 plan estimated ~250 verdicts, so ~750 draws. Dollars per draw: unverified (the preview prices from `cli_spend` estimates and flags unestimated types as a floor). **Blocked on** (a) the drift pause and (b) an artifact store to judge. |
| 2 | Calibration labels | The bench. Content-bound labels in `judge_calibration_labels` (`calibration-labels-db.ts`; 5f5f08ca), bound to `stepContentHash` + `RUBRIC_VERSION` and retired when either moves (`calibrationLabels.ts` `labelBindingIssue`); labelling from the /status Evidence modal (`CalibrationLabelBar.tsx`; e6c5aacd); `GET/POST /api/judge-calibration` (POST operator-guarded, route.ts:102); `judge-run.ts --calibrate` scores the served set, writes nothing to `judge_verdicts`, appends to `~/.pof/judge-calibration.jsonl`, exits 4 under threshold (6d5d9f43); standing ladder unrun/stale/unscored/provisional/undersampled/enforced-pass/enforced-fail (`calibration.ts:205-212`); threshold 0.85 (`:38`), enforcement floor 10 confirmed (`:52`); guard test `src/__tests__/lib/judge/calibration.test.ts`; docs d617ca35. | **Every label.** The repo seed `CALIBRATION` (`calibration.ts:95-99`) is 3 targets, all `provisional`, all media (fleet-memory 2026-07-30: "never cite it as rubric-safety evidence"). No committed evidence of any confirmed label or any `--calibrate` run. `~/.pof/judge-calibration.jsonl` does not exist on 2026-10-22, so the standing reads **`unrun`** (`readCalibrationHistory`: missing file = empty history). Labels in the rebuilt DB: unverified. Inter-human agreement: never measured (`CALIBRATION_HUMAN_CEILING_NOTE`). A label POST needs an artifact on record (route.ts doc, 400 otherwise), so this is also gated on an artifact store. | Human: the operator labels ≥ 10 artifacts (the docstring's target is ~20) spanning all three bands and the text, 2D, 3D, audio and animation classes, in the Evidence modal. Then `npx tsx scripts/judge-run.ts --calibrate --median 3` (`--dry` plans it free). Table: `judge_calibration_labels` in, `~/.pof/judge-calibration.jsonl` out. Acceptance: standing `enforced-pass` (confirmed agreement ≥ 0.85 over ≥ 10 confirmed labels at rubric v4); `enforced-fail` means rubric work + a version bump, never a lower threshold. Cost: ≤ 20 targets × 3 draws = ≤ 60 Opus/high draws (dollars unverified, as above); the binding cost is operator labelling time. |
| 3 | Full benchmark matrix | The harness and the surface: `scripts/model-benchmark.ts` (d7180662, untouched since 2026-07-08), `model_benchmarks` (`benchmark-db.ts`), `GET /api/model-benchmarks`, `GET/PUT /api/model-policy`, /status Models tab (`ModelsView.tsx`). The policy registry is live and dispatches resolve through it (`model-policy.ts` `taskClassForDispatchType`). | **The matrix, and the harness is not fit to run it honestly.** Committed evidence of results is the two 2026-07-08 cells only (opus/med 79 vs sonnet/low 70). From the code: 2 sample tasks (`SAMPLE_TASKS` :24) × 5 combos (`DEFAULT_COMBOS` :30), produce-text only, so 8 of 9 task classes are unbenchmarked; one judge draw per cell, and the upsert on `(task_class, model, effort, task_id)` (benchmark-db :44) overwrites a re-run instead of accumulating; the judge prompt is canon-blind (`buildRubricPrompt` without `canonContext`/`siblingContext`, :75), so its scores are not v4-comparable, and the table has no `rubric_version` column; no cost is recorded (`--output-format text`, `tokens` never set) though the winner rule breaks ties on cost and the ModelsView header promises cost; no `recordSpend` and no preflight budget gate, which judge-run and judge-one both have; the judge spawns with the alias `judge.model` (:76) while judge-run spawns `MODEL_IDS[...]` (`claude-opus-4-8`, model-policy.ts:46), so the two need not be the same judge; `--write-winners` writes produce-text only, from aggregates over every row ever recorded. Whether any `model_benchmarks` / `model_policy` rows survive the reset: unverified. | Harness repair first (a source change under `scripts/` and `src/lib/`, outside this audit): meter + budget-gate through `spendMeter.ts`, the canon-aware v4 prompt judge-run builds, a `rubric_version` column, median-of-3 judge draws, recorded cost, the same pinned judge as judge-run, samples for more classes. Then `npx tsx scripts/model-benchmark.ts` and `--write-winners`. Table: `model_benchmarks` → `model_policy` (source `benchmark`). Acceptance: every benchmarked class has a winner with ≥ 3 samples per cell at rubric v4 and a recorded cost, written as `source: 'benchmark'`, visible on the Models tab. Cost: per cell 1 produce draw + 3 Opus/high judge draws; the current 2×5 matrix = 10 produce + 30 judge draws; the plan's target (~30 tasks × ~10 combos) = ~300 produce + ~900 judge draws. Dollars unverified. |
| 4 | Media prompts | — | — | in flight 2026-10-22 (parallel builder) — not graded here |

Campaign order and cost: `.ai/directions/2026-10-22-quality-program-campaign.md`. Short form:
an artifact store first (the operator's call), then calibration (it decides the 2026-10-09 drift
question), then the full-map rejudge, then the benchmark after its harness repair.

## Execution status (2026-07-08, Opus)

All four workstreams' **infrastructure is built, committed, tested, and proven live**. What
remains is the compute campaigns (each large) + one user-collaboration point.

| WS | Built | Proven live | Remaining (campaign / steered) |
|----|-------|-------------|-------------------------------|
| WS0 | model-policy registry + `/api/model-policy` + `--model`/`--effort` wiring + provenance + judge_verdicts effort/rubricVersion | policy GET/PUT round-trip; 6 tests; off-state byte-identical | — (done) |
| WS2 | judge/dimensions + judge/rubrics (v2, AAA contract) + scripts/judge-run.ts + calibration math | Icon 2D **80→FAIL 54**, Localization **75→FAIL 50**, items 3D **FAIL 42**, Economy **FAIL 55** | full-map rejudge (items partial); user confirms/expands calibration labels; rubric wording refined after Opus REFUSED an over-harsh v2 draft |
| WS1 | prompts/quality packs (shared judge dimensions) wired into ArchetypeStep.buildPrompt | 4 tests; anti-drift asserted; /layout 200 | media prompts into repo; prompt-improvement loop; regenerate+regate wave rollout |
| WS3 | scripts/model-benchmark.ts + benchmark-db + /api/model-benchmarks + /status **Models tab** | produce-text **opus/med 79 vs sonnet/low 70**; panel renders | full matrix (2×5+), `--write-winners` to make defaults data-driven |

Commits: e20b3872 (WS0) · bfd275fa (WS2) · 2f9a200a-range (WS1) · d7180662 (WS3).
Key lesson: the strict rubric's first wording ("default to a LOWER score / fail correct work")
made Opus refuse — reframed as a high bar applied honestly. Calibration caught it, as designed.
Note: a concurrent session's half-finished DialogueView refactor (missing createTabbedModuleView)
breaks the home/module routes but not /status or the APIs — left untouched per shared-tree rule.

## Problem statement (user)

1. Isolated outputs are basic-but-correct → prompts must reach professional videogame quality (text, 2D, 3D).
2. Need a strict Opus judge in Claude Code CLI that compares against modern-videogame quality and fails mediocrity.
3. "Claude" engine is used blindly — no Sonnet/Opus/Fable/effort choice, no benchmarks, no /status visibility.

## Codebase facts (verified 2026-07-08)

| Area | Fact | Location |
|---|---|---|
| Generation prompt | `canon + "Produce <Step> for <Entity>. <dir>"` — one line, no quality bar | `layout-lab/steps/ArchetypeStep.tsx:82` |
| Prompt infra unused | 6-section `prompt-builder.ts` exists but the catalog lab bypasses it (only `recipe.ts` uses it) | `src/lib/prompts/prompt-builder.ts` |
| Media prompts | Leonardo/Tripo/ElevenLabs prompt tables live in session scratchpad scripts — unversioned | scratchpad `gen2.mjs`, `batch-generate.mjs` |
| Judge harness | Throwaway workflow scripts; not in repo. Verdict models ad-hoc: `sonnet-fleet-w1` (176), `qwen3-vl-4b` (52), `claude-opus-4-8` (26) | `/api/judge-verdicts` |
| Judge leniency | Sonnet fleet 163/180 pass; Qwen passes basic icons 7–9/10 — bar = "coherent", not "pro" | judge_verdicts |
| Model selection | **None.** `buildCliArgs` = `['-p','-','--output-format','stream-json',…]` — no `--model`, no effort | `claude-terminal/cli-service.ts:161` |
| Provenance | Artifacts carry no model/effort/promptVersion; verdicts carry `model` only | `pipeline_artifacts`, `judge_verdicts` |
| Engine spread | Claude 176 · Code 81 · Leonardo 43 · UE Python 11 · UE test 9 · Tripo 8 · ElevenLabs 4 · None 8 | `step-facts.json` |
| Fan-out infra | Workflow `agent()` already supports `{model, effort}` opts — ready for benchmark matrices | (harness) |
| Evidence modal | /status cell → verdict + stored output (text/2D/3D/audio) — the human audit loop exists | `status/EvidenceModal.tsx` |

## Execution order (dependency-driven)

**WS0 (foundations) → WS2 (strict judge = the measuring instrument) → WS3 (model benchmarks,
measured BY the judge) → WS1 (prompt upgrades, validated BY the judge, produced WITH the policy).**
Building prompts before the strict judge would leave no honest way to tell "better."

---

## WS0 — Foundations: model policy registry + provenance (S, ~½ day)

1. **`src/lib/model-policy.ts`** — single source of truth:
   - `TaskClass` = `'produce-text' | 'produce-2d-prompt' | 'produce-3d-prompt' | 'produce-audio-prompt' | 'judge-content' | 'judge-visual' | 'fix-content' | 'author-ue-test' | 'benchmark'`.
   - `ModelChoice` = `{ model: 'haiku'|'sonnet'|'opus'|'fable', effort: 'low'|'medium'|'high'|'xhigh' }`.
   - `getModelPolicy(taskClass): ModelChoice` — seeded with sensible defaults (below), later overwritten by WS3 benchmark winners. Persist overrides in a small DB table (`model_policy`) + `/api/model-policy` (GET/PUT) so /status can render and the benchmark can update it.
   - Seed defaults: produce-text → sonnet/medium · produce-media-prompts → sonnet/low · judge-content → **opus/high** · judge-visual → **opus/high** · fix-content → sonnet/medium · author-ue-test → opus/medium.
2. **Wire `--model` into the CLI engine**: extend `buildCliArgs(opts)` with `{ model?: string }` → pushes `--model <id>` (off-state byte-identical, matching the existing MCP-flag pattern). Thread `taskClass` through `CLITask`/`TaskFactory` → `useModuleCLI`/`CliProduce` dispatch so every spawn resolves its policy. Effort: pass via the CLI's settings flag/env for the spawned session (verify the current CLI flag name during implementation; fall back to `--settings` JSON if no direct flag).
3. **Provenance stamps**: every artifact POST gains `data._provenance = { model, effort, promptVersion, engine, at }` (additive — checkers ignore unknown keys; verified pattern from gap-loop). `judge_verdicts` gains `effort` + `rubricVersion` columns (additive migration).
4. **/status**: EvidenceModal + cell tooltip show provenance (model·effort·promptVersion) — 1-line additions; the modal already renders artifact data.

Acceptance: a Produce run from the lab lands an artifact stamped with the policy's model+effort; verdicts carry rubricVersion; modal displays both.

## WS2 — Strict Opus judge (M, ~1–2 days) — build the instrument first

1. **Repo-resident judge harness** (`src/lib/judge/` + `scripts/judge-run.mjs`, replacing scratchpad workflows):
   - Rubrics per deliverable class in `src/lib/judge/rubrics/` — versioned files (`rubricVersion` stamp):
     - `text-config.md` — internal coherence (keep) **plus** craft: distinctive voice, specificity, no filler, reads like a AAA design doc.
     - `2d-art.md` — judged against named anchors ("shippable in Path of Exile 2 / Diablo IV / Hades II UI?"), silhouette, value hierarchy, material rendering, edge quality, style cohesion across the catalog.
     - `3d-mesh.md` — topology-from-render, proportion, texture resolution honesty, "would pass an AAA outsourcing review?"
     - `animation.md` — reuse anim-critique dims (anticipation/weight/timing/followThrough) with the strict bar.
     - `audio.md` — clarity, character fit, loop cleanliness, mix plausibility.
   - **Strictness contract baked into every rubric**: "You are a lead reviewer at a AAA studio. Default to FAIL when uncertain. 90+ = shippable in a modern videogame; 70–89 = competent placeholder; <70 = FAIL. Cite concrete deficiencies AND an actionable fix direction (this feeds the prompt-improvement loop)." Score bands replace the current pass/fail-at-70 leniency: /status verified-green will require **≥ 90 under rubricVersion ≥ 2** (see §4).
   - Runner spawns Claude Code CLI headless with **policy(judge-content) = Opus + high effort** (via WS0). Visual judging: the CLI judge `Read`s the stored PNG/render directly (Opus vision) — Qwen stays as the cheap pre-gate (≥7 to even reach Opus), Opus is the verdict of record. Judges must keep cross-checking sibling artifacts (proven gap-loop lesson).
2. **Calibration set** (the anti-drift anchor): pick ~20 outputs spanning the map; the user hand-labels each (fail / placeholder / shippable). Tune rubric wording until Opus agrees ≥85% with the labels. Store as `src/lib/judge/calibration.json` — rerun on every rubric change (a vitest guard can assert agreement on the frozen set).
3. **Re-judge the whole map** under rubricVersion 2 (Workflow fan-out, one judge per catalog, Opus/high). Expect a large red wave — that is the honest baseline the prompt program (WS1) will be measured against. Budget note: ~250 verdicts × Opus/high; run in 2–3 batches.
4. **statusModel**: prefer the newest `rubricVersion`; verdicts under old rubrics degrade to "trusted (lenient-judged)" amber, never verified-green. Add the score band to the cell tooltip + EvidenceModal.

Acceptance: calibration agreement ≥85%; full-map rejudge stored; /status shows the honest (redder) picture with per-cell scores.

## WS3 — Model & effort benchmarks (M, ~1–2 days, mostly compute)

1. **Benchmark harness** `scripts/model-benchmark.mjs` (+ `model_benchmarks` table):
   - Task sample: 5 representative steps × each Claude-powered task class (produce-text across 3 catalogs, media-prompt authoring, fix-content, author-ue-test, judge-content itself) — ~30 tasks.
   - Matrix: {haiku, sonnet, opus, fable} × {low, medium, high, xhigh} — pruned to sensible pairs (~10 combos), ×30 tasks ≈ 300 runs. Dispatch via Workflow `agent({model, effort})` fan-out — infra already supports it.
   - Each output judged **blind** by the WS2 Opus judge (outputs shuffled, model identity stripped); record `{taskClass, model, effort, score, tokens, wallMs, cost}`.
   - Winner rule: highest median score; ties broken by cost. Write winners into `model_policy` (WS0) — defaults become data-driven.
   - Also benchmark the judge itself (Sonnet-vs-Opus agreement with the calibration labels) to prove Opus is worth the judging cost.
2. **/status "Models" panel**: policy table (task class → model·effort → benchmark score → cost/run), plus a per-cell provenance chip. Data from `/api/model-policy` + `/api/model-benchmarks`.

Acceptance: policy table fully data-driven with recorded scores/costs; /status displays it; subsequent Produce runs use the winners automatically.

## WS1 — Professional-grade prompt program (L, ~2–4 days, iterative)

1. **Quality prompt packs** `src/lib/prompts/quality/` — versioned (promptVersion), composed into every Produce:
   - Per deliverable class: role framing ("senior <discipline> at a AAA ARPG studio"), named style anchors per catalog (PoE2/D4/Hades-II class references), a concrete quality checklist (the SAME dimensions the judge scores — prompt and rubric are two sides of one contract), negative constraints (no watermark/text/generic-fantasy-filler), and 1–2 few-shot exemplars of judged-≥90 outputs (bootstrap: best current outputs; replace as better ones land).
   - `ArchetypeStep.buildPrompt` becomes `canon + qualityPack(deliverable, catalogId) + step contract + direction` — one edit point covers all generic steps; bespoke Items steps updated to match. Route through the existing `prompt-builder.ts` sections instead of ad-hoc joins.
   - Media prompts move from scratchpad into `src/lib/media-prompts/{leonardo,tripo,elevenlabs}.ts` with the same pack structure (style anchors, camera/lighting language for 2D→3D hero renders, the hard-won gotchas: 3/4 hero render, "no watermark", face-priority).
2. **Prompt-improvement loop** (industrialized, gap-loop pattern): `scripts/prompt-loop.mjs` — for a failing step: generate (policy model) → strict-judge → feed the judge's *actionable fix direction* back into a prompt revision (bounded, e.g. 3 iterations) → keep the best-scoring prompt as the new pack version. Every iteration stamped (promptVersion) so /status can show score-by-prompt-version — measurable prompt evolution.
3. **Rollout by wave**, worst-first from the WS2 baseline: text catalogs (cheap, fast signal) → 2D art (Leonardo prompt packs; regenerate + regate) → 3D (hero-render packs + Tripo settings) → audio. Each wave: regenerate, strict-judge, keep ≥90s, iterate <90s through the loop.

Acceptance per wave: median strict-judge score of touched steps ↑ measurably (target: text ≥85 median, 2D ≥80 median under rubricVersion 2); /status green = genuinely professional.

## Sequencing summary & sizing

| Phase | What | Size | Depends on |
|---|---|---|---|
| WS0 | model-policy + `--model` wiring + provenance | S | — |
| WS2 | strict Opus judge + calibration + full rejudge | M | WS0 |
| WS3 | model/effort benchmark → data-driven policy + /status Models panel | M | WS0, WS2 |
| WS1 | quality prompt packs + improvement loop + wave rollout | L | WS2 (measure), WS3 (produce with winners) |

## Risks / notes for the orchestrator

- **Judge cost**: Opus/high across ~250 cells per full sweep — batch it; keep Qwen/Sonnet as pre-gates so Opus only judges candidates that clear the cheap bar.
- **Rubric drift**: never edit a rubric without rerunning the calibration guard; bump rubricVersion on every change (old verdicts must not silently count as strict).
- **Prompt/rubric coupling**: keep the quality checklist text shared between pack and rubric (one module, imported by both) so they can't diverge.
- **CLI flags**: verify the exact `--model` id strings and the effort mechanism of the installed Claude Code CLI at WS0 time (they change between releases); keep the off-state byte-identical like the MCP-config pattern.
- **Honesty rule carries over**: a red wave after the strict rejudge is the desired truth, not a regression — do not soften the rubric to keep the map green (gap-loop law).
- Session infra ready to reuse: judge fleet workflow shape, replay/regrade path, evidence modal (now the human calibration tool), `agent({model, effort})` fan-out.
