# L3/L4 live-UE runner — draining deferred Test Gates

The chassis reaches **config-complete (L0–L2)** entirely in parallel; **L3 runtime** and **L4 visual** checks are persisted as `status:'deferred'` and drained later by a **single serialized runner** (the locked contract — see [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md) §"The live-UE step"). This doc is the runner's contract.

## What it does

1. **Collect** — query `pipeline_artifacts WHERE status='deferred'` (optionally filtered by tier/catalog/entity). Each row becomes a `GateJob`. For **L3** the UE automation test name is recovered from the deferred `reason` (`runtimeDeferred(testName,…)` writes `live-UE runner not yet run: <testName>`).
2. **Run** — one job at a time (the implicit lease), via a tier-matched **executor**.
3. **Write back** — the verdict (`pass`/`fail`) upserts the same artifact, preserving its `data`/`ueAssets`/`tier`, setting `status` + `reason` to the verdict detail. The Test Gate flips `deferred → pass/fail`; the rollup updates.
4. **Announce** — when the verdict actually *moves*, `drainOne` emits `gate.verdict.changed` on the event bus (carrying `from`/`to`/`regression`). A skip leaves the row deferred and emits nothing.

`deferred` stays a first-class state: an unavailable executor or a job missing its test name is **skipped** (stays deferred), never failed.

## Notifications (opt-in webhook)

A long unattended drain shouldn't be a black box. The `gate.verdict.changed` event feeds a server-side notifier (`src/lib/notify/gate-notifier.ts`, registered once in `src/instrumentation.ts` next to the nightly-build cron) that POSTs to an outbound webhook — Slack (`{text}`), Discord (`{content}`), or a generic JSON envelope.

Configured exactly like the nightly-build job: a `settings`-table row (`gate_notify`) holding `{ enabled, webhookUrl, target, mode }`, **disabled by default**. `mode` picks the threshold — `all` (every change), `failures` (any change landing on fail — deferred→fail or pass→fail), or `regressions` (only pass→fail). Managed via `GET`/`POST /api/notify/gate` (actions `save` / `test`) and the **Gate Notifications** panel under the build module's unattended-operations settings. Dispatch is fire-and-forget: a slow or failing webhook never blocks the drain. The pure `classifyVerdictChange`/`shouldNotify` (`src/lib/notify/verdict-change.ts`) define what counts.

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
| **spawn** (`spawnExecutor.ts`) | L3 | Assembles + runs headless `UnrealEditor-Cmd … -ExecCmds="Automation RunTests <testName>;Quit" -nullrhi … -abslog=<unique>`, judges by **`-abslog` markers (`Result={Success}` / `[gate] RESULT=PASS`), not exit code**. Both `run` branches — automation (`runAutomation`) and behavioural scenario (`runScenario`) — share one **SIGKILL watchdog** (`spawnAndWait`, default 180s via `automationTimeoutMs`/`scenarioTimeoutMs`) so a headless editor that never quits can't hang the drain worker. Real code, **gated OFF by default** (needs `POF_UE_EDITOR_CMD` + `POF_UE_UPROJECT` env + explicit `allowSpawn`) — spawning UE collides with other sessions on the shared tree. | off |
| **visual-bridge** (`visualExecutor.ts`) | L4 | Requests a HighResShot via the bridge, then runs the existing `/api/verify/visual` Gemini check → records to `visual_verifications` + writes the artifact verdict. Honestly **skips** (stays deferred) when no screenshot source is reachable — this is the known "missing render gate". | yes (best-effort) |

The seam means the **mode is chosen at call time**, not baked in (the contract's "configurable (both)").

## Triggers — operator drain + always-on worker

Both modes ship:
- **Operator drain** — `POST/GET /api/pipeline-artifacts/drain` (one-shot, executor/tier/limit/screenshotPath configurable).
- **Always-on worker** — `worker.ts` + `POST/GET /api/pipeline-artifacts/drain/worker` (`{action:'start'|'stop', intervalMs, cooldownMs, …}`). A serialized interval loop over `drainJobs` (no overlapping ticks) with a **skip-cooldown** (default 5 min) so jobs that can't yet run (`not_found`/unavailable/no test name) aren't re-attempted every tick. Defaults to the bridge (L3); L4 stays manual (needs a screenshot).

## Plugin contract — ground truth (verified against the C++)

The executors are aligned to what the PoF Bridge plugin actually does (`PofHttpServer.cpp` / `PofTestRunner.h`), not assumptions:

- **`GET /pof/test/results`** returns `{ results: [{ testId, status: "passed"|"failed", startTime, endTime, durationMs }] }` — `status` is binary (every non-`Passed` enum maps to `"failed"`). `interpretAutomationResult` parses exactly this and correlates to our test by matching `testId` against the automation name.
- **`POST /pof/test/run-automation`** — was a stub; **now implemented** (pof-exp `5d5f513`, **needs an editor rebuild to take effect**). It parses `{filter}`, runs the matching registered automation test via `UPofTestRunner::RunAutomationTest` (`FAutomationTestFramework::StartTestByName`/`StopTest` — synchronous for our `IMPLEMENT_SIMPLE_AUTOMATION_TEST` gates), stores the `FPofTestResult`, and returns `{status:"passed"|"failed",testId}` or `{status:"not_found"}` (no matching test → the bridge executor skips fast, the gate stays `deferred`, never a false fail). **`spawn` remains the alternative** — it runs `Automation RunTests <name>` headlessly exactly as the project's own VS*Tests are run (`Source/PoF/Test/README`, `VSGenFireballEffectTest.cpp:18`), no running editor needed.
- **`POST /pof/snapshot/capture`** — was a stub; **now wired** (same commit, needs rebuild) to `UPofSnapshotCapture::CapturePreset` (optional `{id,location,rotation,fov}` body → returns `{status:"captured",filePath,width,height}`), enabling autonomous L4 capture. L4 also runs with an **operator-supplied `screenshotPath`** (drain body) through the real `/api/verify/visual` Gemini check.
- **abslog markers** (spawn): the UE automation controller emits `Result={Success}` / `Result={Failure}`; some project Python gates emit `[gate] RESULT=PASS/FAIL`. `parseAbslogVerdict` matches all, judged by markers not exit code (headless exits non-zero on the benign shutdown null-deref).

> **Verified live (2026-05-26):** rebuilt the editor (UE 5.7, `PoFEditor`) — the plugin C++ compiles + links clean — started it headless (`-nullrhi`, bridge on `:30040`) and exercised the handlers against the real `FVSGenFireballEffectTest`: `POST /pof/test/run-automation {"filter":"GenFireball"}` → `{"status":"passed","testId":"FVSGenFireballEffectTest"}`; `GET /pof/test/results` returned it in the exact shape `interpretAutomationResult` parses; an unmatched filter → `{"status":"not_found"}` (gate stays deferred); `snapshot/capture` is wired (returns captured/failed, not the old stub). The spawn path was also confirmed: `Automation RunTests …GenFireball;Quit -nullrhi` → abslog `Result={Success}`. One bug was caught + fixed live — `GetValidTestNames` needs `SetRequestedTestFilter(EAutomationTestFlags_FilterMask)` first or it returns empty in a fresh editor (pof-exp `757ba25`). The **full app-side loop** was then verified through the real API (dev server + editor): seed a deferred L3 gate → `POST /api/pipeline-artifacts/drain` → `{ran:1,passed:1}` → the artifact flips to `status:"pass"`; and the **worker** auto-drained a seeded gate on its 5s tick before being stopped. Test rows cleaned from the DB afterward.

> **Re-verified live on UE 5.8 (2026-06-21) — spawn path + full drain flow.** The spawn path runs headlessly on the current engine: `UnrealEditor-Cmd PoF.uproject -ExecCmds="Automation RunTests <name>;Quit" -nullrhi -abslog=…` launches, finds + runs the test, and emits the `Result={Success}`/`{Fail}` markers `parseAbslogVerdict` keys on. The **full drain flow** was exercised end-to-end through the real production code by `src/__tests__/lib/test-gate-runner/live-drain.integration.test.ts` (env-gated — `POF_UE_EDITOR_CMD`+`POF_UE_UPROJECT`+`POF_RUN_UE_GATES` — skipped by default): seed a deferred L3 gate → `drainAll([makeSpawnExecutor({allowSpawn:true})])` → UE runs `GenFireball` (the no-map `Project.…GenFireball.EffectConfig` config test) → `Result={Success}` → the artifact flips **deferred→pass** in SQLite. ⚠️ **Name caveat (found live):** `Automation RunTests <name>` matches the **registered** name (dotted path) or a substring, **not** the C++ class name — a full class name (`VSCombatDamageFormulaTest`) → "No automation tests matched"; the AnimBP test ran but failed a real `Manny skeleton must exist` assertion (mechanism OK, asset unavailable under `-nullrhi`). **Name alignment DONE (2026-06-21):** of the 30 `runtimeDeferred` gates, the **4 whose UE test already exists** were realigned from the C++ class name to the resolving **registered-name substring** — `characters` → `PoF.CharacterVael.NPCConfig`, `currency` → `PoF.Currency.WalletRules`, `spellbook` → `PoF.GenFireball.EffectConfig`, `status-effect` → `PoF.StatusBurning.EffectConfig`. The other 26 defer to **not-yet-built** tests (the runner correctly skips → stays deferred); each adopts the same convention when its C++ test lands. **Convention:** `runtimeDeferred(name,…)` `name` must be the registered automation name (or a distinctive dotted substring like `PoF.<Topic>.<Subtopic>`), **not** the `FVS…Test` class name.

## Trigger — operator-driven API

`POST /api/pipeline-artifacts/drain` — body `{ tier?: 'L3'|'L4'|'all', catalogId?, entityId?, executor?: 'bridge'|'spawn', port?, allowSpawn? }` → runs `drainAll`, returns a `DrainSummary` (`ran/passed/failed/skipped` + per-job results). `GET` lists the currently-deferred jobs so the UI shows what's drainable.

Run it **when no other UE session is busy** (the editor is single-instance; the bridge serializes through it). The `/layout` rollup carries a **"Run deferred gates"** button that POSTs the drain for the open entity and re-hydrates.

**Server-side in-flight lock.** The POST handler holds a module-level set keyed by `catalogId|entityId` (or `*|*` for global drains) and rejects an overlapping request with **409** + a `drain already in flight for <scope>` message. Mirrors the worker's `tickInFlight` guard. This makes the gate runner safe regardless of how many UI surfaces (extra tabs, retried requests, direct API calls) trigger it: only one drain per scope can be live against the shared, non-reentrant editor. Released in a `finally` so a thrown drain doesn't strand the lock. Drains for *different* scopes (different entity, different catalog) are not blocked.

## Why judged by markers, not exit code
Headless `UnrealEditor-Cmd` exits non-zero on a benign shutdown null-deref (`PillarsOfFortuneBridge` teardown) — see [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md) §L3. The spawn executor parses the abslog; the bridge executor reads the plugin's structured result and sidesteps the issue entirely.
