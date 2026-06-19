# L4 autonomous visual capture

PoF's **L4 gate** verifies a UE change by *reading a rendered frame* (Gemini vision) —
the ground-truth "does it actually look right" check. It used to require an operator to
hand it a screenshot (`visualExecutor`: *"render gate still manual — supply a
screenshotPath"*). **Now PoF captures the frame itself**: it launches a headless UE 5.8
editor, renders, and returns the PNG — no operator, no human-opened editor, no `:30040`
bridge. Built 2026-06-19; all unit-tested; each behaviour live-verified.

## Pipeline

```
buildExecutors({ autoCapture })           // test-gate-runner/executors.ts
  └─ selectScreenshotResolver → makeUeCaptureResolver(job)   // captureResolver.ts
       └─ resolveScenario(job)             // scenarioRegistry.ts — per-gate action (or none)
       └─ captureScenarioFrame(...)        // ue-launch/capture.ts
            └─ headless UE 5.8 launch → shot_NN.png
  visualExecutor (L4)                      // visualExecutor.ts — the screenshotResolver seam
    └─ POST /api/verify/visual → Gemini → pass / fail
```

**Key files**
- `src/lib/ue-launch/` — the reusable launcher. `captureScenarioFrame` (the `-game -PoFScenario` path, used by L4), `captureFrame` (a plain editor screenshot primitive), `buildScenarioInbox`, `pickActionShot`, `newestShot`, `resolveEditorBinary`, `buildLaunchArgs`, `buildPythonExecFile`.
- `src/lib/test-gate-runner/captureResolver.ts` — `makeUeCaptureResolver`: `resolveScenario(job)` → `captureScenarioFrame` (the `screenshotResolver` shape `visualExecutor` wants).
- `src/lib/test-gate-runner/executors.ts` — `ExecutorConfig.autoCapture` + `selectScreenshotResolver` (precedence: explicit resolver → `screenshotPath` → `autoCapture` → deferred). **Off unless a caller passes `autoCapture`.**
- `src/lib/test-gate-runner/scenarioRegistry.ts` — per-gate `GateScenario`s (the `abilities` archetype activates the entity's ability; pipelines register more).
- UE project: `Source/PoF/Testing/ScenarioController.cpp` — writes `shot_<NN>.png` (the on-screen viewport) per sample.

## The headless-launch recipe (hard-won — each line cost a failed run)

- **Run Python from a FILE**, not inline: `-ExecCmds=py exec(open('<probe>').read())` (`buildPythonExecFile`). Inline `-ExecCmds=py …` with multiple statements / quotes is fragile (mangled three times).
- **Editor screenshot** (generic, no scene): `UnrealEditor.exe <proj> -RenderOffScreen -unattended -nopause -nosplash -NoLiveCoding -EnablePlugins=PythonScriptPlugin -ExecCmds=py exec(...)` where the probe calls `unreal.AutomationLibrary.take_high_res_screenshot(W, H, '<abs forward-slash path>')`. **Do NOT `load_map`** — it breaks the async screenshot (no file is ever written).
- **Scenario capture** (per-gate, lit — what L4 uses): `UnrealEditor.exe <proj> <map> -game -PoFScenario=<inbox> -RenderOffScreen -windowed -ResX=W -ResY=H -unattended -nopause -nosplash -NoLiveCoding`. The `ScenarioController` spawns + possesses the pawn, drives the inbox `inputs`, samples, and writes `shot_<NN>.png`.
  - Inbox: `{ out_dir, total_seconds, num_samples, settle, inputs: [ {event:'activate_ability', event_arg:'Ability.<Pascal>', start, duration} | {action:'/Game/Input/Actions/IA_Move', value:[x,y], start, duration} ] }`. `out_dir` is required.
- **Render on a LIT map.** In `-game` the map is a real command-line arg. Use a lit gameplay map (`/Game/Maps/VerticalSlice`) — **not** the scenario's L3 map (often dark/headless, e.g. `TestHarness`). `captureScenarioFrame` map precedence is `opts.map → scenario.map → default`, and the resolver always passes a lit map.
- **Use the viewport `shot_NN.png`** — *not* the SceneCapture2D `frame_NN.png` chase cams (the controller's own comment: they render "black/edge-on").
- **A headless editor does not exit on `Quit`** (idles). Poll the output dir / log for the result (`shot_*.png` / `DONE` / `[scenario] FINISH`) then kill; a `-game` scenario self-`RequestExit`s.
- **Result selection** (`pickActionShot`): the action-active sample — first `montage_playing===true`, else max `anim_speed`, else the last — falls back to `newestShot`. Sample idx ↔ `shot_<idx>.png` are aligned.
- **Bash-only gotcha (Node `spawn` is unaffected):** Git Bash MSYS converts a leading-slash arg like `/Game/Maps/X` into `C:/Program Files/Git/Game/...`. For live bash verifies use `MSYS_NO_PATHCONV=1` **and** a Windows-form uproject (`C:/…`). `Failed to find Class /Script/PoF.UARPGGameInstance` is benign (falls back to a generic GameInstance; the scenario still runs).

## Status — what works

- **Generic per-level capture:** a lit, framed gameplay frame (VerticalSlice + the player). ✓ live.
- **Per-gate action capture:** drives the registered scenario's inputs on a lit map → a lit, framed frame. ✓ live (scenario armed → pawn possessed → samples captured).
- **End-to-end autonomy:** launch → render → frame → resolver → Gemini seam, zero operator. ✓

## Open followup — "specific ability visibly firing" (content, not code)

The capture *tooling* is complete. The one gap is making a **specific action visible in the frame**: the lit map's pawn (`BP_VSPlayer`) doesn't have arbitrary abilities (Fireball didn't fire on VerticalSlice — `montage` all-false, `mana` flat), and the ability-capable pawn lives on the *dark* `TestHarness`. So a per-gate frame is currently a lit, framed character that may be **idle** rather than mid-action. Closing it is **game-content/map work**, not capture code — pick one:
- Grant the relevant abilities to `BP_VSPlayer` (or use an ability-capable pawn on a lit map), **or**
- Light `TestHarness` (the ability-capable map), **or**
- Add per-catalog lit capture maps via the resolver's `mapFor`.

See [followups.md](followups.md) for the full backlog.
