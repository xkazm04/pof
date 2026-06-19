# UE Experiment Lab — design spec

**Date:** 2026-06-19 · **Status:** approved (design) · **Effort:** L · **Branch:** TBD (off `feature/research-skill` or a fresh `feature/ue-experiment-lab`)

## Goal

Close the **theory → output** loop. PoF's research loop produces *knowledge* (gotchas, eval criteria, presets, specs) but nothing *runs* a concept on the engine. This adds an **ad-hoc experiment runner**: type/seed a UE 5.8 action (Python), run it on the connected project headless, and **see the captured output** (screenshot + logs + optional Gemini verdict) in the PoF app. It makes any researched concept *executable and observable* — "realize any experiment."

## Decisions (from brainstorming)

- **Launch model:** headless launch **per experiment** (fresh editor, clean state, fully autonomous). No persistent editor for v1.
- **Experiment unit:** **ad-hoc run-and-observe** — `{ python, capture?, verify? }`. No structured/registered experiment specs in v1.
- **Results surface:** an **in-app UI view** (Experiment Lab) showing concept + run + output.
- **API:** **job-based** (start → poll), because a launch takes minutes.
- **Reuse, don't rebuild:** `src/lib/ue-launch/*` (launch + python + capture + markers) and `/api/verify/visual` (Gemini L4). No new verdict/scenario abstractions.

## Precondition (verified)

- **UE 5.8 is installed:** `C:\Program Files\Epic Games\UE_5.8\…\UnrealEditor-Cmd.exe` present → **live runs are possible** (a real end-to-end acceptance closes the build). Resolution via `POF_UE_ENGINE` (default `5.8`) / `POF_UE_CMD`. `POF_UE_UPROJECT` must point at the PoF `.uproject`.

## Architecture (3 units)

```
ExperimentLab.tsx ──POST /api/experiment/run──▶ runExperiment(spec)
   ▲  (poll)                                        │ launchEditor (headless 5.8)
   └──GET /api/experiment/status/[id]◀── jobStore   │ buildPythonExecFile(probe) → run user python
                                                     │ buildCaptureArgs (-RenderOffScreen) → PNG
                                                     │ extractLogMarker(log, 'RESULT') / LogPython lines
                                                     └ optional POST /api/verify/visual → Gemini verdict
```

### Unit 1 — `src/lib/ue-experiment/runner.ts` (backend core)
```ts
export interface ExperimentSpec {
  python: string;               // the user's unreal.* probe body (single-quotes only)
  capture?: boolean;            // render a -RenderOffScreen frame
  verify?: { mode: string; prompt: string };  // optional Gemini check on the frame
  timeoutMs?: number;
}
export interface ExperimentResult {
  logs: string[];               // LogPython: lines
  markers: Record<string, string>;  // KEY=VALUE pulled from the log
  screenshotPath?: string;
  verdict?: { status: 'pass' | 'fail'; detail: string };
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}
export function buildExperimentArgs(spec, paths): string[]   // pure, testable
export function parseExperimentLog(log: string): { logs; markers }  // pure, testable
export async function runExperiment(spec: ExperimentSpec, deps?: RunnerDeps): Promise<ExperimentResult>
```
- Writes `spec.python` to a probe file; uses `buildPythonExecFile` + (if `capture`) `buildCaptureArgs` else plain exec; `launchEditor` with `-RenderOffScreen` (NOT `-nullrhi`) when capturing; reads the abslog via `extractLogMarker` + `LogPython:` parsing; if `verify`, POSTs the PNG to `/api/verify/visual`.
- **Injectable spawn seam** (`RunnerDeps`, mirroring `ue-launch`'s pure-builder/deps pattern) so the arg-building + log-parsing are unit-tested with **no real editor**.
- Resolves the 5.8 binary via `resolveEditorBinary`; **missing engine → a clean `ExperimentResult` error** ("UE 5.8 editor not found"), never a crash.

### Unit 2 — `src/app/api/experiment/{run,status/[id]}/route.ts`
- `POST /api/experiment/run` → validate spec, create a job in a module-global `experimentJobs` store (pattern from `cli-service.ts:activeExecutions`), kick `runExperiment` async, return `{ jobId }`. `{success,data}` envelope.
- `GET /api/experiment/status/[id]` → `{ status: 'running'|'done'|'error', result? }`.
- Server-side only (spawns the editor). Screenshot returned as a served path / data-url for the UI.

### Unit 3 — `ExperimentLab` view (`src/components/.../experiment-lab/`)
- Python/concept editor (reuse `CodeViewer`/`LabTextarea`), `capture` toggle, optional `verify` prompt, **"Run on UE 5.8"** button → POST run → poll status → render the **results panel**: screenshot, `LogPython` output, markers, Gemini verdict, duration, exit/timeout state.
- **Seed-from-finding picker:** a dropdown of `UE_GOTCHAS` (and later research findings) pre-fills the probe + a suggested `verify` prompt → a researched concept becomes a **one-click live experiment** (the research-loop bridge).
- Mount: follow the existing module/nav pattern (precise wiring decided in implementation by reading `navigationStore` / the module registry); reuse existing UI primitives.

## Data flow / error handling

- Long-running launch → job start/poll (no hung request). Timeout → `timedOut: true` + partial logs.
- Capture requires `-RenderOffScreen`; bare `Quit` doesn't exit headless 5.8 (poll log + SIGKILL — already handled by `launchEditor`).
- Python: single-quotes only, one `py` prefix, `;`-joined (the `ue-launch/python.ts` rules) — the UI hints this; the runner doesn't rewrite user code (just wraps a result marker).

## Testing

- **Unit:** `buildExperimentArgs` (capture vs no-capture, engine resolution, timeout) + `parseExperimentLog` (markers, LogPython filtering, error/timeout) via the spawn seam — no editor.
- **API:** route with a mocked `runExperiment` (job created, status transitions, envelope).
- **UI:** renders; "Run" dispatches; a result renders (screenshot + logs + verdict); seed-from-finding fills the editor.
- **Live acceptance (manual, possible now):** seed a simple probe (e.g. `unreal.log('RESULT=' + unreal.SystemLibrary.get_engine_version())`, capture on) → run → confirm a real screenshot + version marker + (if verify) a Gemini verdict appear in the UI.

## Non-goals

- No persistent/KeepAlive editor (v1 is per-run). No structured experiment registry / GateScenario model. No new verdict engine (reuse Gemini visual + log markers). No catalog-pipeline wiring. No multi-experiment batch UI.

## Research-loop connection

The seed-from-finding picker is the bridge: every `UE_GOTCHAS` entry (and, later, research findings/specs) can be **run on the live engine and seen** — turning the research output from theory into observed output, and giving a place to "realize any experiment."
