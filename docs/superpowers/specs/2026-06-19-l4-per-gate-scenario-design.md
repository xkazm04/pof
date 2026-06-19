# L4 per-gate action scenarios

**Date:** 2026-06-19 · **Status:** approved · **Follows:** `2026-06-19-l4-scenario-capture-design.md` (generic spawn-and-settle frame).

## Goal

Capture the entity **performing the gate-relevant action** (activate an ability / walk) rather than just standing spawned — so the L4 Gemini check sees the meaningful moment for the gate.

## Reuse (the key insight)

`src/lib/test-gate-runner/scenarioRegistry.ts` **already** maps a job → a per-gate `GateScenario` (`resolveScenario(job)`): map, `totalSeconds`/`numSamples`/`settle`, `inputs`, `assert`. The built-in `abilities` scenario fires `{ event: 'activate_ability', eventArg: abilityTagFor(entityId), start: 0.5 }` on `/Game/Maps/TestHarness` over 2.5s / 8 samples. The `ScenarioController` already writes `shot_<Idx>.png` per sample. So we **reuse the L3 scenarios** and just render them (`-RenderOffScreen`) — no new action profiles invented.

## Components (`src/lib/ue-launch/capture.ts`)

- **`buildScenarioInbox(outDir, { totalSeconds?, numSamples?, settle?, inputs? })`** — extended to serialize `inputs` (the `{key,action,value,event,event_arg,start,duration}` mapping `spawnExecutor` uses). Pure.
- **`pickActionShot(outDir)`** — read `observations.json`; return `shot_<idx>.png` for the sample where the action is **active**: first `montage_playing===true`, else max `anim_speed`, else the last sample. Falls back to `newestShot` (no observations / missing shot file). Sample idx ↔ `shot_<idx>.png` are aligned (the controller fires both per sample). Pure(+fs).
- **`captureScenarioFrame(opts)`** gains `scenario?: GateScenario`: when present, the inbox carries its `inputs`/timing and the map is `scenario.map`; the result is `pickActionShot(outDir)`. When absent, the generic spawn-and-settle (still via `pickActionShot`, which falls back to `newestShot`).

## Wiring (`captureResolver.ts`)

`makeUeCaptureResolver` calls `resolveScenario({ catalogId, entityId, step, testName })`; if a scenario is found it passes `scenario` to `captureScenarioFrame` (the action runs); otherwise the generic frame (map from `mapFor`/default). The registry is the existing one (`registerBuiltinScenarios` seeds `abilities`; pipelines add more).

## Decision (approved)

**Shot selection = `pickActionShot`** (action-active sample), not plain `newestShot` — an ability's montage plays ~0.5–1.5s but the last sample (t=2.5) is often post-action, so `newestShot` misses the peak. `pickActionShot` returns the mid-ability frame.

## Verification

- **vitest/TDD (pure):** `buildScenarioInbox` serializes `inputs` (`event_arg` snake_case); `pickActionShot` (montage sample → that shot; no montage → max `anim_speed`; missing observations/shot → `newestShot`); `captureScenarioFrame` with a `scenario` (injected run writes `observations.json` + `shot_NN.png` → returns the action shot); resolver passes a resolved scenario (real registry — `abilities` job → scenario present; non-registered catalog → generic + `mapFor`).
- **Live (autonomous):** one abilities-gate capture on a real ability entity (`catalogId: 'abilities'`, e.g. `entityId: 'fireball'`) → the character activates the ability; I `Read` the resulting shot to confirm it shows the action.

## Non-goals / notes

- No new per-catalog action profiles — reuse only what the registry defines (the `abilities` archetype is the proof case).
- **Lit-map caveat:** the `abilities` scenario uses `TestHarness` (may be dim); if the captured frame is too dark for a useful visual check, switching that scenario to a lit harness map (or a `mapFor` lit override) is a follow-up — out of scope here.
- No change to `ScenarioController.cpp`, `scenarioRegistry` definitions, or `visualExecutor`.
