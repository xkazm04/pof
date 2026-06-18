# L4 per-level framing — scenario-based capture

**Date:** 2026-06-19 · **Status:** approved · **Follows:** `2026-06-19-l4-autonomous-capture-design.md` (generic editor frame). **Reuses:** the UE-project `ScenarioController` Observation Spine (proven on 5.8 by the 5.7→5.8 upgrade).

## Goal

The L4 autonomous capture currently renders the **empty editor view** (`load_map` breaks the editor screenshot). Route capture through the existing **`-game -PoFScenario -RenderOffScreen` Observation Spine** so the frame shows the **actual loaded level + spawned player** — a meaningful frame for the Gemini visual check.

## Mechanism (confirmed in the UE project)

`Source/PoF/Testing/ScenarioController.cpp` already captures per sample:
- `CaptureViewport(Idx)` → `FScreenshotRequest::RequestScreenshot(<out_dir>/shot_<NN>.png)` — the **on-screen viewport** frame (what the player sees).
- `CaptureView(...)` → SceneCapture2D chase/side cams → `frame_<NN>.png`.

The scenario **inbox** (JSON) needs only `out_dir` (required); optional `total_seconds`, `num_samples`, `settle`, `inputs` (the proven shape `spawnExecutor` writes). In `-game` mode the **map is a working command-line arg** (unlike the editor's broken `load_map`).

## Decisions (approved)

- **Return `shot_<NN>.png`** (viewport) — most representative for the L4 hud/character/lighting modes. (`frame_<NN>.png` chase cam is the easy alternative.)
- **Minimal no-input inbox** — `{ out_dir, total_seconds: 3, num_samples: 1, settle: 1.5, inputs: [] }`: the GameMode spawns the player, it settles, one sample captures. Per-gate action scenarios (walk/attack) are a further follow-up.
- **`captureScenarioFrame` is a sibling** to the editor `captureFrame` (kept as a primitive). The resolver switches to the scenario one.

## Components (`src/lib/ue-launch/capture.ts`)

- `buildScenarioInbox(outDir, opts?): string` — the capture-only inbox JSON. Pure.
- `buildScenarioArgs({ uproject, map, inboxPath, resX, resY }): string[]` — `[uproject, map, '-game', '-PoFScenario=<inbox>', '-RenderOffScreen', '-windowed', '-ResX=…', '-ResY=…', '-unattended', '-nopause', '-nosplash', '-NoLiveCoding']` (mirrors `spawnExecutor.buildScenarioArgs` but `-RenderOffScreen`, not `-nullrhi`). Pure.
- `newestShot(dir): string | null` — newest `shot_<NN>.png` by mtime. Pure(+fs).
- `captureScenarioFrame(opts: { uproject, map?, engine?, resX?, resY?, settleMs?, outDir? }, deps?: { run?, now? }): Promise<string | null>` — make a temp `out_dir`, write the inbox, run `-game -RenderOffScreen` (windowed editor binary), then return `newestShot(outDir)`. Injectable run (unit-tested without UE).

## Wiring

- `makeUeCaptureResolver` switches to `captureScenarioFrame`, and **re-gains `mapFor?: (job) => string`** (default `/Game/Maps/VerticalSlice`) — safe now (map is a `-game` arg).
- `ExecutorConfig.autoCapture` re-gains `mapFor?`.

## Verification

- **vitest/TDD (pure):** `buildScenarioInbox` (has `out_dir`, no inputs), `buildScenarioArgs` (`-game` + `-PoFScenario` + `-RenderOffScreen`, no `-nullrhi`), `newestShot` (newest `shot_*`, ignores `frame_*`/non-png/empty), `captureScenarioFrame` orchestration (injected run writes `shot_00.png` into the temp out_dir → returned; nothing → null), resolver/`autoCapture` `mapFor` mapping.
- **Live (autonomous):** one `-game -RenderOffScreen` scenario run producing a `shot_NN.png`, which I `Read` to confirm it shows the level + player (not the empty editor view).

## Non-goals

- No change to `ScenarioController.cpp` (C++) or `visualExecutor`/`/api/verify/visual`.
- No per-gate action scenarios yet (generic spawn-and-settle frame is this cut).
- The editor `captureFrame` stays (a no-RHI-scene primitive); the resolver just prefers the scenario one.

## Risks

- **GameMode must spawn a pawn in the target map** (VerticalSlice does — `BP_VSGameMode` → `BP_VSPlayer`). For a map without a player-spawning GameMode, the frame is just the level (still useful).
- **Scenario cold start + render** is slow (~1–3 min) — watchdog + generous `settleMs`; it's an L4 (deferred) op.
- **`shot_NN.png` timing** — read the newest after the run completes (the controller writes during sampling, before `RequestExit`).
