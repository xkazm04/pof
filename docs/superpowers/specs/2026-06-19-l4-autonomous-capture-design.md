# L4 autonomous frame capture — productize the UE autonomy

**Date:** 2026-06-19 · **Status:** approved · **Builds on:** `src/lib/ue-launch` (autonomous UE launcher), the ue58-mcp Phase-0/2 capture proof, and `src/lib/test-gate-runner/visualExecutor.ts` (the L4 gate).

## Goal

Make PoF's **L4 visual verification run end-to-end with no operator**: `buildExecutors` → autonomously capture a rendered frame (headless UE 5.8) → existing Gemini check reads it. Closes the documented "render gate still manual — supply a screenshotPath" gap by implementing the `screenshotResolver` seam `visualExecutor` already exposes.

## Decisions (approved)

- **Capture mechanism:** `UnrealEditor.exe <uproject> <map> -game -RenderOffScreen -ResX -ResY -ExecCmds="HighResShot WxH"` — a real *gameplay* frame (what the L4 modes verify), reusing the proven `launchAndScreenshot` pattern + the 5.8 `-game -RenderOffScreen` recipe. The game-mode "newest screenshot" race is handled by `pickNewestPng(dir, startedAt)`.
- **Integration:** no change to `visualExecutor`/`/api/verify/visual`. A new capture lives in `ue-launch`; `buildExecutors` gains an `autoCapture` config that builds the resolver. Off unless configured (backward-compatible).

## Components

### `src/lib/ue-launch/capture.ts` (new)
- `buildCaptureArgs({ uproject, map, resX, resY }): string[]` — pure. `[uproject, map, '-game', '-RenderOffScreen', '-ResX=<x>', '-ResY=<y>', '-ExecCmds=HighResShot <x>x<y>', '-unattended', '-nopause', '-nosplash', '-NoLiveCoding']`.
- `pickNewestPng(dir, sinceMs?): string | null` — pure(+fs). Newest `.png` by mtime in `dir`, optionally only files modified at/after `sinceMs`. Returns null if none (dodges returning a stale screenshot).
- `captureFrame(opts: { uproject, map?, engine?, resX?, resY?, settleMs?, screenshotDir? }, deps?: { run?, now? }): Promise<string | null>` — resolves the **windowed** editor binary (`resolveEditorBinary({ engine, windowed: true })`), records `startedAt`, spawns + watchdog'd run, settles, then returns `pickNewestPng(screenshotDir, startedAt)`. `screenshotDir` defaults to `<uproject dir>/Saved/Screenshots/WindowsEditor`. The process run is injectable (like `launchEditor`) so orchestration is unit-tested without UE.

### `src/lib/test-gate-runner/captureResolver.ts` (new)
- `makeUeCaptureResolver({ uproject, engine?, mapFor? }): (job: GateJob) => Promise<string | null>` — returns `captureFrame({ uproject, engine, map: mapFor?.(job) ?? '/Game/Maps/VerticalSlice' })`. Matches the `screenshotResolver` signature `visualExecutor` expects.

### `src/lib/test-gate-runner/executors.ts` (edit)
- `ExecutorConfig` gains `autoCapture?: { uproject: string; engine?: string; mapFor?: (job: GateJob) => string }`.
- In `buildExecutors`, the L4 resolver precedence becomes: explicit `screenshotResolver` → `screenshotPath` trivial resolver → **`autoCapture` → `makeUeCaptureResolver(...)`** → undefined (stays deferred). Backward-compatible.

## Verification

- **vitest/TDD (pure):** `buildCaptureArgs` (flags, res), `pickNewestPng` (newest / sinceMs filter / empty dir), `captureFrame` orchestration (injected run writes a PNG into a temp dir → returns it; run timeout → null), `makeUeCaptureResolver` (job→map default + `mapFor`), `buildExecutors` (autoCapture yields an L4 executor whose resolver is wired; precedence honored).
- **Live (autonomous):** one headless `captureFrame` run proving a real PNG is produced (the Phase-0/2 spike already produced a 71 KB frame this way).
- **Full Gemini round-trip:** covered by existing `visualExecutor` tests (mocked fetch); a true live run needs `GEMINI_API_KEY` — noted, not required here.

## Non-goals

- No change to `visualExecutor.ts` / `/api/verify/visual` / the Gemini prompt logic.
- No camera/scenario framing (generic spawn frame is the first cut; per-gate camera/`-PoFScenario` framing is a follow-up).
- Not on by default — only when a caller passes `autoCapture` (the drain route can opt in later).
- No coupling to the `:30040` bridge (this is the bridge-free autonomous path).

## Risks

- **Newest-PNG race / wrong file** — mitigated by `pickNewestPng(dir, startedAt)` (only files written during this capture).
- **`-RenderOffScreen` cold start is slow** (~2–5 min full editor) — `captureFrame` watchdog + generous `settleMs`; it's an L4 (deferred-tier) op, latency-tolerant.
- **Empty/uninteresting frame** — a generic spawn frame may not show the entity of interest; acceptable first cut, camera framing is the noted follow-up.
