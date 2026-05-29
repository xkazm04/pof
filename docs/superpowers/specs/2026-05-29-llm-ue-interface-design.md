# Trustworthy LLM↔UE Interface ("Spine→Conductor") Design

**Date:** 2026-05-29
**Status:** Design — sections approved in brainstorming; awaiting written-spec review.
**Goal:** A trustworthy closed-loop interface between a Claude Code agent and Unreal Engine, in which **no unit of work can be claimed "done" without a ground-truth observation of the intended result** — so silent false-positives like the player-movement T-pose (every symbolic gate green, rendered result wrong) become structurally impossible.

---

## Motivation (the failure that defines the problem)

The player-movement pipeline ran end-to-end and **both acceptance gates passed**: the AnimBP compiled (`BS_UpToDate`), all assets existed on disk, wiring introspection confirmed `BP_VSPlayer.AnimClass = ABP_VSPlayer` in `ANIMATION_BLUEPRINT` mode, the blend space had 11 samples, the ABP was parented to `UARPGAnimInstance`. Yet in PIE the character **translates but renders in T-pose** — the mesh never deforms.

Every gate verified a **proxy** (compiles / exists / property-set / introspected-wiring). None verified **reality** (does the evaluated skeleton actually deform into a walking pose?). This is not a one-off bug; it is the general failure mode of an LLM acting on a complex external system: *it verifies the cheapest observable proxy for success, not success itself.*

**The law this design enforces:** make ground truth as cheap and as mandatory to observe as the proxies, so the agent's path of least resistance points at reality.

---

## Locked decisions (from brainstorming)

| # | Decision | Rationale |
|---|---|---|
| 1 | **Center of gravity = full closed-loop agent path** | Grounded authoring → mandatory ground-truth verification → safe reproducible execution + rollback, as one coherent system. |
| 2 | **Driver = a Claude Code agent, always** | Interactive (me) is primary; the in-app CLI terminal spawns Claude Code instances that work identically (multimodal, tool-use, same loop). No other/smaller LLM engine is supported, so the interface targets Claude Code's capabilities — including its multimodal "eyes." |
| 3 | **Trust standard = tiered ground-truth, visual mandatory at the end** | Reuse the existing L0–L4 ladder but make T3 (runtime readout) + T4 (a frame the agent *sees*) real and enforced. A feature is never "done" on symbols alone. |
| 4 | **Approach = Spine→Conductor (hybrid)** | Design the full closed-loop abstraction up front; implement it incrementally, T-pose vertical-slice first; extend the existing bridge / acceptance ladder / test-gate-runner rather than rebuild. |

---

## Tiers of Truth

A sharpening of the existing L0–L4 acceptance ladder. The tier names below are the canonical vocabulary for this architecture.

| Tier | Question it answers | Mechanism | T-pose session |
|---|---|---|---|
| **T0 Existence** | Artifact on disk / in registry? | `FPackageName::DoesPackageExist`, asset registry | ✓ passed |
| **T1 Structural** | Parses / compiles / refs resolve? | compile status, load success | ✓ passed |
| **T2 Wiring** | Properties set, nodes connected? | reflection / introspection | ✓ passed — **and lied** |
| **T3 Behavioral** | Does the *evaluated* system produce the intended state? | tick AnimInstance, read component-space bone transforms; pelvis translates; pose ≠ ref pose; numeric, deterministic, headless-capable | ✗ never checked |
| **T4 Perceptual** | Does a *rendered frame*, judged by a seeing agent, look right? | render → PNG → Claude Code agent `Read`s it and judges semantically | ✗ never checked |

**Two load-bearing claims:**
1. **T0–T2 are necessary but never sufficient** for a "feature works" claim. The T-pose proves it: all three green, result wrong.
2. **T4 perception is cheap now** because the driver is a multimodal Claude Code agent — no bespoke vision service is required on the primary path. A headless/cron fallback may call a vision API, but the canonical T4 authority is the agent's own `Read` of the captured frame.

---

## The Conductor loop

Every unit of work runs through this loop, and "done" is **structurally unreachable** without the tier-appropriate observation:

```
Intent (declares a required Tier, e.g. "player visibly walks when moving" -> T4)
  → Ground            ApiGroundingProbe / GetState: learn UE's REAL api + state
  → [Transaction]     snapshot affected .uassets before a risky mutation
  → Act               author / mutate via the bridge
  → Observe           the REQUIRED-tier Observation
                      (T3: RunScenario → EvaluatePose · T4: RunScenario → CaptureFrame → agent Reads PNG)
  → Verdict           judge Observation(s) vs Intent
       pass         → commit, advance
       fail         → rollback to snapshot, diagnose FROM the observation, retry
       inconclusive → escalate (more observation / human)
```

The **Spine** = the observation+verification substrate (T3/T4 made real + the contract forbidding symbol-only "done"). The **Conductor** = the orchestration loop above it. Both are designed now; the Spine is built and proven first.

---

## §2 Observation primitives (the Spine's verbs)

Five typed reads. Each returns the durable `Observation` type and is recorded to `pipeline_artifacts` so a verdict cites its evidence. Verbs 1–3 are the heart (T3/T4 truth); 4–5 are cheap grounding reads that prevent wasted authoring cycles. All ride the existing bridge transports (`/pof/python/run`, `/pof/snapshot/capture`); none requires a new transport.

1. **`EvaluatePose` (T3)** — tick the AnimInstance (PIE or forced evaluation), read `SkeletalMeshComponent.get_component_space_transforms()`. Returns bone transforms + derived metrics: `maxBoneDeltaFromRefPose`, `pelvisLocationOverTime`, `isRefPose` (bool). Enables the verdict *"Speed > 0 yet maxBoneDeltaFromRefPose ≈ 0 → T-POSE, FAIL."*

2. **`CaptureFrame` (T4)** — extends `/pof/snapshot/capture`: run the scenario in PIE with RHI, write PNG(s). The agent then `Read`s the PNG and judges. A cheap precheck (`frameVarianceAcrossWindow`) pre-flags "static = suspected T-pose."

3. **`RunScenario` (T3+T4 driver)** — input a `Scenario` `{map, spawn/possess, inputs[] over a timeline, ticks, observeAt[]}`. Opens PIE, possesses, injects EnhancedInput actions over time, ticks deterministically, captures Observations (pose + frame + metrics) at marked points. Turns *"WASD makes it walk"* into an automated, repeatable truth.

4. **`GetState` (T3, lightweight, non-PIE)** — semantic asset introspection: not "property set" but *meaning* — e.g. "BS_Locomotion: skeleton=X, 11 samples, each sample's anim has N keyframes / M bone-tracks" (would catch empty retargeted clips), "AnimBP compile status + warnings list."

5. **`ApiGroundingProbe`** — first-class query of UE's *real* API/state before authoring: methods on a class, an asset's actual property names+types, assets at a path. Replaces the ~14 ad-hoc `dir()`/`help()` probes this session required.

---

## §3 Verification contract + durable types

**Enforcement:** every Intent declares a **required tier**. The Conductor has no path to "done"/commit until an `Observation` of that tier exists and a `Verdict{status:pass}` cites it. For T4, the verdict requires a logged agent `Read` of the captured PNG.

**Shared shapes (TypeScript + Python):**
- `Observation { kind: 'pose'|'frame'|'state'|'metric'|'api', data, scenarioId?, capturedAt, artifactRef }`
- `Verdict { intentId, tier: T0..T4, status: 'pass'|'fail'|'inconclusive', evidence: Observation[], reason }`
- `Scenario { id, map, spawn, possess, inputs: TimedInput[], ticks, observeAt: number[] }`
- `Transaction { snapshot(assetPaths[]), commit(), rollback() }` — copy affected `.uasset`s to a temp store before a risky mutation; rollback restores them.
- `ApiGroundingProbe { classMethods(class), assetProps(path), assetsAt(path) }`

---

## §4 First proof — the T-pose vertical slice

Close the loop on the live failure to prove the Spine:

1. `GetState` the 10 `_RT` clips → confirm/refute "empty animation" via keyframe/bone-track counts (pinpoints the suspected root cause the symbolic gates missed).
2. Define `Scenario` **"player-walk-forward"**: TestLevel_PlayerMovement, possess BP_VSPlayer, inject `IA_Move=(0,1)` for 1.5s, observe at 0.5/1.0/1.5s.
3. `RunScenario` → `EvaluatePose` trace + `CaptureFrame` PNGs.
4. **Verdict** = T3 `isRefPose` check **+** T4 agent `Read`s the PNGs ("walking or T-pose?"). This is the gate that would have caught the original failure.
5. Fix the root cause (clips or AnimGraph output wiring) → re-run scenario → observe pass. Loop closed on a real failure = Spine proven.

This also upgrades the existing `FVSPlayerMovementPlayableTest` stub into a real T3/T4 gate driven by `RunScenario`.

---

## §5 Decomposition (sub-projects, each its own plan)

Spine-first, Conductor as the target. Each sub-project produces working, testable software on its own.

- **SP1 — Observation Spine.** The 5 verbs + `Observation`/`Verdict` types + recording to `pipeline_artifacts`. Proven by the T-pose vertical slice (§4). *This is the first plan.*
- **SP2 — Verification Contract.** "No done without observation" wired into the acceptance ladder / test-gate-runner; required-tier per intent; the agent-facing API that refuses symbol-only completion.
- **SP3 — Conductor.** Loop orchestration + `Transaction`/rollback + grounding-first authoring (ApiGroundingProbe before Act).
- **SP4 — Scenario library + autonomous driver.** Reusable per-catalog scenarios; the app-spawned Claude Code CLI driving the loop headlessly (the in-app CLIs that "work like the interactive session").

---

## Safety, error handling, reproducibility

- **Transactions** snapshot affected `.uasset`s before risky mutations; rollback on fail. (The session deleted/recreated assets ad-hoc; the Conductor makes mutation reversible.)
- **Editor-lifecycle hardening** baked into a launch helper, capturing this session's hard-won lessons: force-kill → crash-recovery modal hang (clear `Saved/{Autosaves,Crashes,SaveRecovery}` + `Intermediate/DisasterRecovery`, launch `-unattended`); rebuild with `-DisableAdaptiveUnity`; the bridge HTTP server only ticks on a free game thread (a modal blocks it).
- **No silent skips** — every observation/verdict failure carries a diagnosis-grade `reason` (Rule 4 of the catalog pipeline).

## Testing

The Spine is **dogfooded**: its own correctness is proven by catching a *known-bad* (the T-pose) and confirming a *known-good* (a fixed walk). Specifically:
- Python verbs: mocked-`unreal` pytests (the existing `Content/Python/tests/` pattern).
- Contract types + verdict derivation: vitest (the existing acceptance-checker test pattern).
- The §4 vertical slice **is** the integration test — and becomes the permanent `FVSPlayerMovementPlayableTest` T3/T4 gate.

## Out of scope (deferred)

- Non-Claude LLM engines (explicitly unsupported).
- A bespoke vision-service for T4 on the interactive path (the agent's own `Read` is the authority; a cron/headless vision-API fallback is SP4-or-later).
- Full Conductor autonomy (SP3/SP4) — designed here, built after the Spine (SP1) + contract (SP2) are proven.
