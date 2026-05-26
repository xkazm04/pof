# L3/L4 live-UE runner — draining deferred Test Gates

The chassis reaches **config-complete (L0–L2)** entirely in parallel; **L3 runtime** and **L4 visual** checks are persisted as `status:'deferred'` and drained later by a **single serialized runner** (the locked contract — see [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md) §"The live-UE step"). This doc is the runner's contract.

## What it does

1. **Collect** — query `pipeline_artifacts WHERE status='deferred'` (optionally filtered by tier/catalog/entity). Each row becomes a `GateJob`. For **L3** the UE automation test name is recovered from the deferred `reason` (`runtimeDeferred(testName,…)` writes `live-UE runner not yet run: <testName>`).
2. **Run** — one job at a time (the implicit lease), via a tier-matched **executor**.
3. **Write back** — the verdict (`pass`/`fail`) upserts the same artifact, preserving its `data`/`ueAssets`/`tier`, setting `status` + `reason` to the verdict detail. The Test Gate flips `deferred → pass/fail`; the rollup updates.

`deferred` stays a first-class state: an unavailable executor or a job missing its test name is **skipped** (stays deferred), never failed.

## Executor seam (`src/lib/test-gate-runner/`)

```ts
interface GateExecutor {
  readonly id: string;        // 'bridge' | 'spawn' | 'visual-bridge'
  readonly tier: 'L3' | 'L4'; // which tier it services
  available(): Promise<boolean>;
  run(job: GateJob): Promise<GateVerdict>;  // { status:'pass'|'fail', detail, raw? }
}
```

`drainAll(executors, filter?, opts?)` serializes jobs and, per job, picks the first executor whose `tier` matches and is `available()`. Three executors ship:

| Executor | Tier | Mechanism | Default |
|----------|------|-----------|---------|
| **bridge** (`bridgeExecutor.ts`) | L3 | POSTs `filter=<testName>` to the running editor's **PoF Bridge plugin** (`127.0.0.1:30040/pof/test/run-automation`), polls results, maps `passed/failed`. Safest on the shared tree — no spawn, no `PoF.log` clobber, no lease juggling. | **yes** |
| **spawn** (`spawnExecutor.ts`) | L3 | Assembles + runs headless `UnrealEditor-Cmd … -ExecCmds="Automation RunTests <testName>;Quit" -nullrhi … -abslog=<unique>`, judges by **`-abslog` markers (`Result={Success}` / `[gate] RESULT=PASS`), not exit code**. Real code, **gated OFF by default** (needs `POF_UE_EDITOR_CMD` + `POF_UE_UPROJECT` env + explicit `allowSpawn`) — spawning UE collides with other sessions on the shared tree. | off |
| **visual-bridge** (`visualExecutor.ts`) | L4 | Requests a HighResShot via the bridge, then runs the existing `/api/verify/visual` Gemini check → records to `visual_verifications` + writes the artifact verdict. Honestly **skips** (stays deferred) when no screenshot source is reachable — this is the known "missing render gate". | yes (best-effort) |

The seam means the **mode is chosen at call time**, not baked in (the contract's "configurable (both)"). An always-on worker is just a loop that calls `drainAll` on an interval — not built yet; the operator-triggered API is.

## Plugin contract — ground truth (verified against the C++)

The executors are aligned to what the PoF Bridge plugin actually does (`PofHttpServer.cpp` / `PofTestRunner.h`), not assumptions:

- **`GET /pof/test/results`** returns `{ results: [{ testId, status: "passed"|"failed", startTime, endTime, durationMs }] }` — `status` is binary (every non-`Passed` enum maps to `"failed"`). `interpretAutomationResult` parses exactly this and correlates to our test by matching `testId` against the automation name.
- **`POST /pof/test/run-automation`** — was a stub; **now implemented** (pof-exp `5d5f513`, **needs an editor rebuild to take effect**). It parses `{filter}`, runs the matching registered automation test via `UPofTestRunner::RunAutomationTest` (`FAutomationTestFramework::StartTestByName`/`StopTest` — synchronous for our `IMPLEMENT_SIMPLE_AUTOMATION_TEST` gates), stores the `FPofTestResult`, and returns `{status:"passed"|"failed",testId}` or `{status:"not_found"}` (no matching test → the bridge executor skips fast, the gate stays `deferred`, never a false fail). **`spawn` remains the alternative** — it runs `Automation RunTests <name>` headlessly exactly as the project's own VS*Tests are run (`Source/PoF/Test/README`, `VSGenFireballEffectTest.cpp:18`), no running editor needed.
- **`POST /pof/snapshot/capture`** — was a stub; **now wired** (same commit, needs rebuild) to `UPofSnapshotCapture::CapturePreset` (optional `{id,location,rotation,fov}` body → returns `{status:"captured",filePath,width,height}`), enabling autonomous L4 capture. L4 also runs with an **operator-supplied `screenshotPath`** (drain body) through the real `/api/verify/visual` Gemini check.
- **abslog markers** (spawn): the UE automation controller emits `Result={Success}` / `Result={Failure}`; some project Python gates emit `[gate] RESULT=PASS/FAIL`. `parseAbslogVerdict` matches all, judged by markers not exit code (headless exits non-zero on the benign shutdown null-deref).

> **Verified live (2026-05-26):** rebuilt the editor (UE 5.7, `PoFEditor`) — the plugin C++ compiles + links clean — started it headless (`-nullrhi`, bridge on `:30040`) and exercised the handlers against the real `FVSGenFireballEffectTest`: `POST /pof/test/run-automation {"filter":"GenFireball"}` → `{"status":"passed","testId":"FVSGenFireballEffectTest"}`; `GET /pof/test/results` returned it in the exact shape `interpretAutomationResult` parses; an unmatched filter → `{"status":"not_found"}` (gate stays deferred); `snapshot/capture` is wired (returns captured/failed, not the old stub). The spawn path was also confirmed: `Automation RunTests …GenFireball;Quit -nullrhi` → abslog `Result={Success}`. One bug was caught + fixed live — `GetValidTestNames` needs `SetRequestedTestFilter(EAutomationTestFlags_FilterMask)` first or it returns empty in a fresh editor (pof-exp `757ba25`).

## Trigger — operator-driven API

`POST /api/pipeline-artifacts/drain` — body `{ tier?: 'L3'|'L4'|'all', catalogId?, entityId?, executor?: 'bridge'|'spawn', port?, allowSpawn? }` → runs `drainAll`, returns a `DrainSummary` (`ran/passed/failed/skipped` + per-job results). `GET` lists the currently-deferred jobs so the UI shows what's drainable.

Run it **when no other UE session is busy** (the editor is single-instance; the bridge serializes through it). The `/layout` rollup carries a **"Run deferred gates"** button that POSTs the drain for the open entity and re-hydrates.

## Why judged by markers, not exit code
Headless `UnrealEditor-Cmd` exits non-zero on a benign shutdown null-deref (`PillarsOfFortuneBridge` teardown) — see [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md) §L3. The spawn executor parses the abslog; the bridge executor reads the plugin's structured result and sidesteps the issue entirely.
