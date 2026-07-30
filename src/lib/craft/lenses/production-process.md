---
lensId: production-process
lensVersion: 1
ceiling: A4
appliesTo: catalog pipelines as declared step sequences plus the app's human-review surfaces (per-catalog process lens)
---

# Production Process — craft lens

Gauges a content pipeline — not any step's content — against the stage-gate shape a AAA team uses to take content from concept to ship: concept review → pre-production/quality-bar proof → content reviews → QA/integration → sign-off. Each criterion is checkable against the pipeline's declared steps and the app's review surfaces; where a AAA team would seat a human (art-director pick, table read, mix review, balance review) and the app offers no operator surface, the finding is classed `ux`.

## Benchmark anchors

- **A4 AAA-PARITY** — Naughty Dog / Cerny-method productions (pre-production ends only at a *publishable first playable* that proves the quality bar before mass production); Valve's *Half-Life* (the Cabal: standing cross-discipline review owning every content chunk); Bungie's *Destiny* (embedded user research gating design milestones with structured playtest questions); Pixar-style dailies culture (work shown unfinished, daily, to a director who picks).
- **A3 AA** — mid-size studios running a textbook milestone ladder (first playable → alpha → beta → gold, cert pass) with named exit criteria but thinner in-flight review cadence.
- **A2 INDIE** — *Stardew Valley*-scale process: one owner playing every role, review is self-review, gates are informal "feels done" moments — shippable, but nothing is independently checked.
- **A1 HOBBY** — a straight line from prompt to output with no gates: nothing is reviewed, nothing proves a quality bar, ship is whenever generation stops.

## Criteria

### concept-gate-macro-design — A concept/macro review precedes production
The pipeline's first stage produces a reviewable concept artifact (macro design: what this content is, its role, its constraints) and the app surfaces it for operator approval **before** downstream generation steps can meaningfully run. Cerny's Method makes the macro design the contract that production executes; a pipeline whose first step already emits final-form content has skipped the gate every AAA greenlight process starts with.
Source: "Method" — Mark Cerny, D.I.C.E. Summit 2002.

### quality-bar-proof-before-scale — A vertical-slice gate proves the bar before mass production
Before the pipeline fans out to bulk content (many entities, many variants), one representative piece must be driven to full target quality and be inspectable end-to-end — Cerny's *publishable first playable*, scaled to a catalog. Gaugeable as: does the pipeline declare a slice/exemplar stage whose acceptance is stricter than later bulk steps, with an operator surface to judge "is this the bar?"; a pipeline that grades every entity identically from the start has no bar-setting gate.
Source: "Method" — Mark Cerny, D.I.C.E. Summit 2002.

### cross-artifact-content-review — Content reviews check the piece against its siblings
AAA content review is cross-discipline and cross-artifact: the Cabal reviewed each Half-Life chunk against the whole game's systems, story, and standards, in a standing forum. The pipeline analog: a declared step (or acceptance layer) that judges an artifact against its **sibling artifacts** for coherence — with the operator able to see the contradiction, not just a verdict. A pipeline of isolated per-step checks, each blind to the row's other outputs, fails this gate.
Source: "The Cabal: Valve's Design Process for Creating Half-Life" — Ken Birdwell, Valve, Game Developer magazine, 1999.

### director-pick-surface — Creative selection is a human surface, not an auto-pick
Where content is generative (art, audio, names, variants), a AAA process seats a director who sees candidates side-by-side and **chooses** — the dailies model: show alternatives early, let the director pick and redirect. Gaugeable as: does each generative step expose a candidate-comparison surface with human selection recorded as human (vs. machine auto-picking the first output)? An auto-selected candidate presented as final, with no pick surface, is a missing review gate (`ux`).
Source: *Creativity, Inc.* — Ed Catmull, Random House, 2014 (Pixar dailies practice).

### structured-playtest-gate — A playtest/verification stage asks defined questions
Bungie gated Destiny's design milestones on structured user research — each study built around explicit questions with defined pass signals, from character-read tests to endgame raids. The pipeline analog: a declared runtime-verification stage (harness run, headless UE gate) whose acceptance names **what question the run answers** and carries the observed evidence, with the operator able to inspect it. A pipeline whose "verified" is a config-only check, or whose runtime gate states no question/evidence, fails.
Source: "User Research on Destiny" — Bungie, GDC 2015 (GDC Vault).

### milestone-ladder-exit-criteria — Named milestones with explicit exit criteria
Professional production ladders content through named gates — first playable, alpha (feature complete), beta (content complete), gold/cert — each with written exit criteria a build must meet before advancing. Gaugeable as: does the pipeline's step/acceptance ladder map to named tiers with per-tier criteria the operator can read (what does "pass at this tier" require?), and is skipping a tier impossible without a recorded reason? An undifferentiated pass/fail with no tier semantics fails.
Source: *The Game Production Handbook* — Heather Maxwell Chandler, Jones & Bartlett Learning (3rd ed., 2013).

### balance-change-review-loop — Tuning changes flow through propose → test → evaluate
At Bungie a 0.2-second tuning change was a proposal with a rationale, tested, evaluated against the whole sandbox, and only then kept — balance changes are reviewed events, not silent edits. The pipeline analog: re-produces and fixes are re-graded through the same acceptance as the original produce, the prior version is retained and diffable, and the operator surface shows what changed and why the verdict moved. Silent overwrites that destroy history, or fixes that bypass re-grading, fail.
Source: "Design in Detail: Changing the Time Between Shots for the Sniper Rifle from 0.5 to 0.7 Seconds for Halo 3" — Jaime Griesemer, Bungie, GDC 2010.

### signoff-provenance — Every gate records who or what approved it
Disciplined production makes acceptance auditable: sprint reviews and a definition of done mean each increment's approval is a recorded event with an owner, not an ambient state. The pipeline analog: each step's verdict carries provenance — which checker, which judge, human vs. machine selection, staleness — visible to the operator; a "pass" whose approver, basis, and currency cannot be named from the stored record fails, however green it renders.
Source: *Agile Game Development with Scrum* — Clinton Keith, Addison-Wesley, 2010.

### lockdown-change-control — Late-stage content is locked, changes are triaged
Shipping teams enter content lockdown: past a declared point, changes go through triage (is this worth the risk?) rather than open editing — the documented endgame of every case in Schreier's production histories, from ship-room bug triage to gold-master cuts. The pipeline analog: a declared final/ship stage after which re-produce is gated (warned, reasoned, or leased) rather than one-click, with the operator owning the exception. A pipeline where a "shipped" artifact is silently regenerable fails.
Source: *Blood, Sweat, and Pixels* — Jason Schreier, Harper Paperbacks, 2017.

## Scoring guidance

- **A4** — the pipeline declares all five stage-gate phases and the app seats a human surface at every gate a AAA team would staff: concept approval, bar-setting slice, sibling-aware review, director picks, evidence-bearing verification, provenance on every verdict, lockdown at ship.
- **A3** — a real milestone ladder with exit criteria and QA/verification, but ≥2 named AAA review surfaces missing or machine-only (e.g. auto-pick with no gallery, verification without stated questions, no lockdown).
- **A2** — a linear produce→accept chain that works, but review is whatever one operator happens to look at: no concept gate, no bar-proof slice, sibling coherence unchecked.
- **A1** — prompt-to-output with no reviewable intermediates: acceptance absent, manual, or fabricated.

**Disqualifiers** (caps the pipeline at A1 regardless of other strengths):
1. Any step whose acceptance is a manual toggle or an unverified self-report (a fabricated pass is possible).
2. No human-review surface anywhere between concept and ship (pure machine conveyor) — also classed `ux`.
3. No verification stage of any kind before the pipeline's terminal step (nothing distinguishes generated from working).
4. Re-produce destroys the prior artifact with no retained history or re-grade (silent overwrite of an approved thing).
5. A "shipped"/terminal status reachable while upstream gates are pending or failed.

## Ceiling statement

This lens is uncapped at A4: the stage-gate shape is structural, and a pipeline that declares every gate and seats the operator at every surface a AAA team would staff earns parity — the LLM-market bet is that the machine fills the seats between the gates, not that the gates disappear.
