# Environment — Procedural-Dungeon Driver Panel (folder-05, pof-app §4, piece 1)

**Date:** 2026-05-23
**Spec:** `docs/superpowers/specs/2026-05-23-env-procgen-driver-panel-design.md`
**Plan:** `docs/superpowers/plans/2026-05-23-env-procgen-driver-panel.md`

## What shipped

### UE repo (`xkazm04/pof-exp`)
- **`build_procgen_dungeon.py` parameterized** — `TARGET_ROOMS = int(os.environ.get("PROCGEN_ROOMS", "6"))`, `SEED = int(os.environ.get("PROCGEN_SEED", "1337"))`. Defaults intact.

### PoF app (`xkazm04/pof`, local-only)
- **`src/lib/cli-task.ts`** — new `procgen-dungeon` CLITaskType + `ProcgenDungeonTask` + `TaskFactory.procgenDungeon({roomCount, seed})` + a `buildTaskPrompt` case (modeled on `wbp-starter`) that tells Claude to set `PROCGEN_ROOMS`/`PROCGEN_SEED`, run the script via the full editor `-ExecutePythonScript`, read the `Generated N rooms` log, and submit the count via `@@CALLBACK` → `/api/level-design/procgen-result` (seed carried as a static field).
- **`src/lib/procgen-db.ts` + `src/types/procgen.ts`** — `procgen_runs` table (`recordProcgenRun` / `getLatestProcgenRun`).
- **`src/app/api/level-design/procgen-result/route.ts`** — POST records a run, GET returns the latest.
- **`ProcGenDungeonPanel.tsx`** + a new **"Dungeon (UE)" tab** in `LevelDesignView` — room-count (clamp 2-20) + seed (+ randomize) inputs, a "Generate Dungeon (UE)" button (`useModuleCLI.execute(TaskFactory.procgenDungeon(...))`, disabled while running), and a result line fetched from the route (refetched when a run finishes).

## Verification

- **Script parameterization (proven via direct UE run):** `PROCGEN_ROOMS=8
  PROCGEN_SEED=99 … -ExecutePythonScript=build_procgen_dungeon.py` →
  `[LevelGenerator] Generated 8 rooms (target=8)` + `Baked 8 BlockoutRoom
  actors` + `Persisted after reload: … rooms=8`. With no env vars →
  `Generated 6 rooms`. (Headless exit 3 = benign shutdown; judged by log.)
- **vitest:** `procgen-db.test.ts` (in-memory DB: record + latest) 2/2;
  `cli-task-procgen.test.ts` (factory + `buildTaskPrompt` contains the env vars,
  the `-ExecutePythonScript` run, `@@CALLBACK`, the `roomCount` schema) 2/2.
- **typecheck** clean (filtering the pre-existing `leonardo.ts:208` error);
  **lint** 0 errors on the new files; **full suite** 1001 tests / 108 files green.
- **Live in-app dispatch — NOT driven here.** The click → CLI terminal → Claude
  runs `UnrealEditor.exe` → `@@CALLBACK` → panel-updates round-trip needs the
  running PoF dev server + an interactive CLI session + a UE round-trip, which
  this environment can't drive. **Operator-verified:** open Level Design →
  Dungeon (UE), set room count + seed, click Generate, and confirm the result
  line updates with the room count after the terminal run completes.

## Outcome

Closes the **driver-panel** piece of pof-app §4: from the PoF UI an operator sets
room count + seed and triggers a real `ARPGLevelGenerator` run of
`build_procgen_dungeon.py`; the room count returns via the callback. The
script-driven generator (folder-05 session 3) is now an in-app capability —
wiring unit-tested, the parameterized script proven, the live dispatch
operator-verified.

## Notes / lessons

- **No direct UE-Python execution API in PoF** — UE Python runs only via the
  CLI terminal (Claude runs `UnrealEditor.exe`). The `@@CALLBACK` pattern
  (terminal intercepts the result JSON → POSTs to a route) is how a UE-run's
  result reaches the UI; `wbp-starter` is the precedent task type.
- **`buildCallbackSection` embeds the marker + schema, NOT the callback URL** —
  the URL is registered server-side for `resolveCallback`. (A test that asserted
  the URL in the prompt was wrong; assert the schema token instead.)
- **Shared app repo churns under concurrent sibling commits** — `cli-task.ts`
  changed mid-task (a sibling refactored `buildProjectContextHeader(ctx)` to drop
  the `{ knownAssetDomains }` option); re-read before editing, match the current
  signature, and stage files by name.

## Follow-ups (out of scope)

- The **biome-definition editor** and the **room-template generator** (the
  remaining pof-app §4 pieces).
- A live e2e harness step that drives the in-app dispatch (button → callback →
  panel) once an interactive-CLI test rig exists.
- Surfacing the generated dungeon's screenshot/Gemini check in the panel (reuse
  the harness verification helpers).
