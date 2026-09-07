# Weak-verifier ensembles — spec

> Source: **"Aggregating LLM-Based Weak Verifiers for Spatial Layout Generation"** (arXiv
> 2606.05268) and **BlenderGym** (arXiv 2504.01786). Written by `/research` 2026-09-07.
> Status: **spec, not built.** L/XL — do not half-ship.

## The problem this attacks

`step-facts.json` records **316 of 342** pipeline checkers as *shape-only*: they prove an
artifact has the right JSON shape, not that its content is right. The two escapes PoF uses
today are (a) a strong LLM judge (`judge_verdicts`, one score per artifact) and (b) hand-written
checkers combined with `allOf` in `catalog/acceptance/combinators.ts` — an unweighted
conjunction where any one checker's opinion is absolute.

Both have a known ceiling. A single strong judge is a single point of calibration failure, and
an unweighted AND cannot express "this signal is usually right, that one fires spuriously".

## What the papers actually show

**Weak-verifier aggregation (2606.05268).** Instead of one strong judge, have the LLM SYNTHESIZE
many small verifier *programs* in a domain-specific language, each an incomplete check, then
learn aggregation weights over them with weak-supervision techniques. Reported: **up to 7× F1**
over direct LLM judgment on 3D room layouts and 2D poster design, and **up to +66.2%** layout
quality (human-evaluated) when the ensemble is used to *guide* generation rather than only to
grade it. The weights are fitted from **~10 human-labeled examples** — deliberately sparse.

**Verifier scaling (BlenderGym, 2504.01786).** Three findings that constrain how PoF should
spend critique compute:

1. Verification compute genuinely pays — scaling verification queries improved all three of
   their metrics monotonically.
2. **A scaled small VLM beat an unscaled frontier one.** "Scaled InternVL2-8B outperform
   unscaled or slightly scaled GPT-4o and Claude 3.5 Sonnet in all three metrics." Model
   *choice* is not the lever; sampling policy is.
3. **Under a fixed budget, breadth beats verifier depth**: "when total inference compute is
   limited, generating a variety of candidates benefits more than stronger verification."
   Only as total compute grows does a higher verifier ratio win.

## Why this fits PoF unusually well

PoF already has both halves the method needs and has never connected them:

- The **~10 human labels** exist. `src/lib/judge/calibration.ts` `CALIBRATION` holds **3**
  provisional human-labeled targets with a written intent to reach "~20 spanning the map".
  That set is the training signal for aggregation weights, not just a scorecard.
- The **many weak checkers** exist. `catalog/acceptance/` holds `dataCheckers`, `graphCheckers`,
  `linkCheckers`, `wiringCheckers`, `ueStaticCheckers`, `itemsBespokeCheckers`,
  `contentInvariant`, `staticVerify` — dozens of partial signals, currently combined by
  `allOf` (hard conjunction) with no weighting and no measured per-checker reliability.

The delta is therefore **not** "write verifiers" — it is *weighted aggregation of the verifiers
already written, fitted to the calibration set*, plus LLM synthesis of new ones where a step
has no checker at all.

## A calibration caveat worth acting on first (cheap)

`CALIBRATION_THRESHOLD = 0.85`. BlenderGym measured **inter-HUMAN alignment at 0.79** on its
edit-preference task, with the best VLM at 0.66. Those are a different task shape (pairwise edit
preference, not band agreement on an artifact), so this is **not** proof that 0.85 is
unreachable — but it is a reason to stop treating 0.85 as obviously achievable. **Measure PoF's
own inter-human agreement on the calibration set before defending the threshold**; a threshold
set above the human ceiling can only ever be met by a judge that agrees with one labeler's
idiosyncrasies. This is a one-session experiment, not a build.

**SHIPPED (follow-up, 2026-09-07) — and it found a sharper defect than the ceiling caveat.**
Chasing the ceiling question surfaced that `evaluateCalibration` would declare `enforced-pass`
off **a single confirmed label**: one agreeing label read *"CALIBRATED — 100% agreement over 1
confirmed target(s)"*, and `judge-run.ts --calibrate` exits 0 on it. A green manufactured from
one coin flip, in the module whose entire purpose is refusing unearned greens.

Two changes, 8 tests:

- **`CALIBRATION_MIN_CONFIRMED = 10`** and a new `undersampled` standing. Below the floor the
  rate is still *reported* (an honest "not proven", the same shape as `provisional`) but the
  threshold is not enforced. The floor has an argument behind it rather than a preference: one
  disagreement in a set of n moves the rate by 100/n points, so under ten labels a single flip
  swings it by more than the whole margin between the 85% threshold and the ~79% indicative
  human ceiling. Ten is the floor for *enforcement*; `CALIBRATION`'s own docstring still asks
  for ~20, which is what makes DRIFT between runs legible too.
- **`CALIBRATION_HUMAN_CEILING_NOTE`**, attached to enforced verdicts only — the one place a
  threshold is actually applied to a number. It states plainly that agreement is scored as if
  the human label were ground truth, that PoF's own inter-human agreement is **not measured**,
  and that 0.79 is a signpost from a different task rather than a bound.

Two existing tests had to widen from 2 confirmed labels to 10. Their *intent* was right and is
preserved; the fixtures encoded the defect. **The ceiling experiment is still open** — the floor
makes an unearned pass impossible, it does not tell us what the reachable rate is.

## Build order (when this is picked up)

1. **Measure.** For each existing checker, compute its agreement with the calibration labels on
   the artifacts it covers. Cheap, uses only data already on disk. Output: a per-checker
   reliability number. Expect some checkers to be near-random — that alone is a finding.
2. **Weighted combinator.** Add `weightedOf(...)` beside `allOf` in `combinators.ts`, returning
   a score plus the per-checker contributions. Must be PURE and must never silently upgrade a
   hard invariant — a real blocking invariant stays in `allOf`; weighting applies to the
   *soft* signals that currently either abstain or over-fire.
3. **Fit.** Learn the weights from the calibration set (a small logistic fit is sufficient at
   ~20 labels; do not reach for anything heavier at this data scale).
4. **Synthesize.** Only then, have the LLM propose new verifier programs for steps with no
   checker — as code in the existing checker signature, reviewed and committed, never as
   runtime-generated code.
5. **Sampling policy.** Document the breadth-over-depth rule in `best-of-n.ts` and apply it:
   under a fixed spend, prefer more candidates over more critique passes per candidate.

## Honesty constraints (non-negotiable)

- A weighted score is **not** a gate pass. `raises-tier` still requires an L3/L4 runtime
  observation; this method hardens *checkers*, it does not manufacture ground truth.
- The ensemble must report its **basis** the way `scoreBreakdown` already does — which
  verifiers fired, which abstained. A bare aggregate number repeats the exact failure
  `scoreBreakdown` was written to fix.
- Fitting weights to 3 provisional labels would be overfitting theatre. **Expand CALIBRATION to
  ~20 confirmed labels first**; that expansion is a prerequisite, not a step.

## Not applicable (checked, 2026-09-07)

BlenderGym's **position-bias** warning — "certain VLMs, such as Qwen, consistently favor the
second edit candidate in the pair, regardless of how we permute them" — does **not** bite PoF
today. PoF grades candidates *independently and numerically* (`best-of-n.ts` `scoreBreakdown`,
then a sort), and a repo sweep found no VLM pairwise-selection prompt anywhere. Record the
hazard here so that if a "which of these two is better?" prompt is ever introduced — the
obvious shape for a gallery A/B — the bias is known in advance and the order is randomized
with the choice checked under permutation. PoF uses Qwen-VL, the exact family the paper names.
