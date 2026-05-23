---
date: 2026-05-23
status: draft
sub_project: Environment — procedural-dungeon driver panel (improvements folder 05, pof-app §4, first piece)
parent_initiative: PoF ARPG vertical slice — improvements synthesis
predecessor_docs:
  - docs/improvements/05-environment/pof-app.md   # §4 surface ARPGLevelGenerator + room-template pipeline
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-procgen-dungeon.md  # the UE generator + build_procgen_dungeon.py
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-uv-strategy-dropdown.md  # the prior pof-app §1 piece
---

# Environment — Procedural-Dungeon Driver Panel (PoF App)

## Context

Folder-05 session 3 built a working UE `ARPGLevelGenerator` + a placement script
`build_procgen_dungeon.py` (run via `UnrealEditor.exe -ExecutePythonScript`)
that bakes a walkable greybox dungeon. pof-app §1 (UV-strategy dropdown) shipped.
This is the first pof-app §4 piece: **surface the real generator in the PoF UI** —
a panel that dispatches the script with operator-chosen params and shows the result.

### How PoF dispatches UE work (verified)

- **No direct UE-Python execution API** (unlike Blender's `/api/blender-mcp/execute`).
  UE Python runs ONLY via the CLI terminal — Claude-in-the-terminal runs
  `UnrealEditor.exe -ExecutePythonScript`.
- Dispatch pattern: `useModuleCLI` (`src/hooks/useModuleCLI.ts`) + a `CLITask`
  (`src/lib/cli-task.ts`). A task's prompt can embed a `@@CALLBACK:<id>` marker;
  the terminal intercepts the result JSON, merges static fields, and POSTs it to
  an API route (`resolveCallback`). The UI learns the outcome by reading what the
  route persisted.
- The `wbp-starter` task type (`cli-task.ts:444-470`) is the precedent: a task
  that instructs Claude to run `UnrealEditor.exe -ExecutePythonScript` for a UE
  asset job. (It has no callback; checklist/feature-fix tasks show the callback
  pattern.)
- `build_procgen_dungeon.py` currently hard-codes `TARGET_ROOMS = 6`, `SEED = 1337`.

## Goals

1. An operator picks **room count + seed** in a PoF panel and clicks "Generate
   Dungeon (UE)"; PoF dispatches a CLI task that runs `build_procgen_dungeon.py`
   with those params.
2. The generator's result (room count) returns to the panel via the callback.
3. Reuse the established dispatch + callback pattern (no new long-lived service).

## Non-goals

- **No UV-strategy param** — the procgen dungeon is greybox `ARPGBlockoutRoom`
  cubes (no Blender UV unwrap), so UV strategy is irrelevant here.
- No biome-definition editor, no room-template generator (later §4 pieces).
- No new `/api/unreal-mcp/execute` socket service (rejected approach C).
- The live click→terminal→UE→callback→UI round-trip is **not headlessly
  verifiable** in this dev environment — it needs the running app + an
  interactive CLI session. This session builds + unit-tests the wiring and
  proves the parameterized script directly; the live dispatch is operator-verified.

## Decision record (from brainstorming)

1. **Scope = the driver panel** (chosen over the biome editor / room-template
   generator as the first §4 piece).
2. **Approach A** — a new `procgen-dungeon` CLITask type using the existing
   `@@CALLBACK` dispatch pattern (over B: a callback-less `quickAction`; over C:
   a new UE socket service).
3. **New "Dungeon (UE)" tab** in `LevelDesignView` (user-approved; keeps it
   distinct from the existing design→codegen Procgen wizard).
4. **Env-var parameterization** of the script (`PROCGEN_ROOMS` / `PROCGEN_SEED`),
   over argv or prompt-driven constant edits.

## Design

### Part 1 — UE repo: parameterize `build_procgen_dungeon.py`

Replace the hard-coded constants:

```python
import os
TARGET_ROOMS = int(os.environ.get("PROCGEN_ROOMS", "6"))
SEED = int(os.environ.get("PROCGEN_SEED", "1337"))
```

Defaults unchanged when the env vars are unset. (`os` is already imported.) The
generator already logs `Generated N rooms`; the count assertion already runs.

### Part 2 — PoF: `procgen-dungeon` CLITask type

In `src/lib/cli-task.ts`:
- Add `'procgen-dungeon'` to `CLITaskType`.
- `interface ProcgenDungeonTask extends CLITask { type: 'procgen-dungeon';
  roomCount: number; seed: number; appOrigin: string; }`.
- `TaskFactory.procgenDungeon(moduleId, { roomCount, seed }, appOrigin, label)`.
- A `buildTaskPrompt` case `'procgen-dungeon'` (modeled on `wbp-starter` +
  the checklist callback): a project-context header, then a Task section telling
  Claude to:
  1. set `PROCGEN_ROOMS=<roomCount>` and `PROCGEN_SEED=<seed>` for the run;
  2. run `build_procgen_dungeon.py` via the FULL editor
     (`& "<UnrealEditor.exe>" "<.uproject in ctx.projectPath>"
     -ExecutePythonScript="<…/Content/Python/build_procgen_dungeon.py>"
     -unattended -nopause -nosplash`) — NOT `-run=pythonscript`;
  3. read the log line `[LevelGenerator] … Generated N rooms`;
  4. submit via `@@CALLBACK` — `registerCallback({ url:
     '${appOrigin}/api/level-design/procgen-result', method: 'POST',
     staticFields: { moduleId }, schemaHint: '"roomCount": <int>,\n  "seed": <int>' })`.

  (`procgen-dungeon` is NOT in `WIRING_TASK_TYPES` — it runs a script, doesn't
  author wiring.)

### Part 3 — PoF: the callback route + persistence

- `src/lib/procgen-db.ts` — a minimal table `procgen_runs (id, room_count, seed,
  created_at)` following the existing `*-db.ts` pattern (better-sqlite3, the
  shared `~/.pof/pof.db`). Functions: `recordProcgenRun({ roomCount, seed })`,
  `getLatestProcgenRun()`.
- `src/app/api/level-design/procgen-result/route.ts`:
  - `POST { roomCount, seed }` → `recordProcgenRun(...)` → `apiSuccess(run)`.
  - `GET` → `apiSuccess(getLatestProcgenRun())` (or `null`).
  Uses `apiSuccess`/`apiError` from `@/lib/api-utils`.

### Part 4 — PoF: `ProcGenDungeonPanel` + a new tab

- `src/components/modules/content/level-design/ProcGenDungeonPanel.tsx`:
  - Inputs: room count (number, default 6, clamp 2-20) + seed (number, default
    1337). Local state.
  - A "Generate Dungeon (UE)" button → `useModuleCLI({ moduleId: 'level-design',
    sessionKey: 'level-design-procgen-ue', label: 'Dungeon (UE)', accentColor,
    onComplete })`; on click `execute(TaskFactory.procgenDungeon('level-design',
    { roomCount, seed }, getAppOrigin(), 'Dungeon (UE)'))`. Disabled while
    `isRunning`.
  - Result area: the latest run from `GET /api/level-design/procgen-result`
    (via `useCRUD` or a fetch), refetched in `onComplete`. Shows "Last run: N
    rooms (seed S) at <time>", or a hint if none yet.
  - Styled to the module's existing violet/mono aesthetic; reuse
    `@/lib/chart-colors` / existing tokens.
- `LevelDesignView.tsx`: add a `Dungeon (UE)` tab (following the existing
  add-a-tab pattern: a `TabButton` + a conditional render of `ProcGenDungeonPanel`).

## Verification (of this session)

- **UE script param (I can run this):** `PROCGEN_ROOMS=8 PROCGEN_SEED=99
  UnrealEditor.exe … -ExecutePythonScript=build_procgen_dungeon.py` → confirm
  `Generated 8 rooms` + `Baked 8 BlockoutRoom actors` (proves env-var
  parameterization; defaults still work when unset).
- **PoF vitest:**
  - `buildTaskPrompt` for a `procgen-dungeon` task — asserts the prompt contains
    the env-var instructions (`PROCGEN_ROOMS`, the room count + seed values),
    the `-ExecutePythonScript` run with `build_procgen_dungeon.py`, and a
    `@@CALLBACK` block with the `/api/level-design/procgen-result` URL.
  - the callback route — POST `{roomCount, seed}` persists; GET returns the
    latest (use the existing API-route test pattern / a temp DB).
- typecheck + lint clean; full `npm run test` green.
- **Honest gap:** the live in-app dispatch (button → CLI terminal → Claude runs
  UE → callback → panel updates) is NOT driven headlessly here (no browser /
  interactive CLI). Operator-verified. Say so plainly; do not claim it.

## Cross-cutting

- Repos: `build_procgen_dungeon.py` → UE repo (`xkazm04/pof-exp`). Everything
  else → app repo (`xkazm04/pof`), local-only, do NOT push.
- **Shared app repo** ([[ue-shared-concurrency]]): concurrent sibling commits
  interleave — stage files by name (never `git add -A`); reviewers diff single
  commits (`git show <sha>`), not ranges.
- Conventions: `@/` imports; `logger` not console; no hardcoded hex
  (`@/lib/chart-colors`); `UI_TIMEOUTS` for timing; API envelope via
  `apiSuccess`/`apiError`; relative `/api/...` URLs client-side, `getAppOrigin()`
  for the callback's absolute URL.

## Definition of done

1. `build_procgen_dungeon.py` reads `PROCGEN_ROOMS` / `PROCGEN_SEED` (defaults
   6 / 1337); proven by a direct parameterized run (`Generated 8 rooms`).
2. `procgen-dungeon` CLITask type + `TaskFactory.procgenDungeon` +
   `buildTaskPrompt` case (run command + env + `@@CALLBACK`).
3. `procgen-db.ts` + `/api/level-design/procgen-result` (POST/GET).
4. `ProcGenDungeonPanel` rendered in a new "Dungeon (UE)" tab; "Generate" button
   dispatches the task; the result area shows the latest run.
5. vitest (prompt + route) green; typecheck + lint clean; full suite green.
6. Findings doc; committed (script → UE repo, app → app repo local).

**Success criterion:** from the PoF level-design UI, an operator sets room
count + seed and triggers a real `ARPGLevelGenerator` run of
`build_procgen_dungeon.py`, and the resulting room count returns to the panel —
turning the script-driven generator into an in-app capability. (Live dispatch
operator-verified; all wiring unit-tested + the parameterized script proven.)

## Risks & mitigations

- **Live dispatch unverifiable here.** Mitigation: unit-test the prompt/task +
  callback route; prove the parameterized script by direct run; clearly mark the
  live round-trip as operator-verified.
- **Callback→UI timing.** The panel must refetch after the run completes.
  Mitigation: refetch in `useModuleCLI`'s `onComplete`; the GET returns the
  latest persisted run.
- **`useModuleCLI` API drift.** Mitigation: model the panel exactly on the
  existing `procgenCli` usage in `LevelDesignView` (`useModuleCLI` + `execute`/
  `sendPrompt` + `isRunning`).
- **DB table footprint.** One tiny table; follows the existing `*-db.ts`
  pattern. If over-kill, the route could keep only the latest row.
- **Param sanity** (room count too high → slow/failed generation). Mitigation:
  clamp room count 2-20 in the input.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews + approves.
3. `writing-plans` → implementation plan.
4. Execute: script param → task type → route+db → panel+tab → verify.
