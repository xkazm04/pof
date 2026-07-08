# Quality Program — professional-grade outputs, strict gating, model policy

Plan authored 2026-07-08 (Fable analysis pass). Execution: Opus-orchestrated, workstream
by workstream. Goal: move `/status` from "technically correct" to "professional-grade,
strictly judged, produced by the right model at the right thinking budget."

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
