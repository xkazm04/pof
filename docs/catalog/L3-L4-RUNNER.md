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

## Trigger — operator-driven API

`POST /api/pipeline-artifacts/drain` — body `{ tier?: 'L3'|'L4'|'all', catalogId?, entityId?, executor?: 'bridge'|'spawn', port?, allowSpawn? }` → runs `drainAll`, returns a `DrainSummary` (`ran/passed/failed/skipped` + per-job results). `GET` lists the currently-deferred jobs so the UI shows what's drainable.

Run it **when no other UE session is busy** (the editor is single-instance; the bridge serializes through it). The `/layout` rollup carries a **"Run deferred gates"** button that POSTs the drain for the open entity and re-hydrates.

## Why judged by markers, not exit code
Headless `UnrealEditor-Cmd` exits non-zero on a benign shutdown null-deref (`PillarsOfFortuneBridge` teardown) — see [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md) §L3. The spawn executor parses the abslog; the bridge executor reads the plugin's structured result and sidesteps the issue entirely.
