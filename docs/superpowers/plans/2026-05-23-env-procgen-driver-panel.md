# Procedural-Dungeon Driver Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Dungeon (UE)" panel in the level-design module that dispatches a CLI task to run `build_procgen_dungeon.py` with operator-chosen room-count + seed and shows the resulting room count.

**Architecture:** A new `procgen-dungeon` CLITask type (built by `TaskFactory.procgenDungeon`) whose prompt tells Claude-in-the-terminal to run the env-parameterized UE script via `-ExecutePythonScript` and report room count through a `@@CALLBACK`; the callback POSTs to `/api/level-design/procgen-result` (backed by a tiny `procgen-db` table); a `ProcGenDungeonPanel` (in a new tab) dispatches via `useModuleCLI` and displays the latest persisted run.

**Tech Stack:** TypeScript, React 19 (Next.js 16), better-sqlite3, vitest, the existing `useModuleCLI` + `CLITask` + `@@CALLBACK` dispatch pattern, UE 5.7 Python.

**Spec:** `docs/superpowers/specs/2026-05-23-env-procgen-driver-panel-design.md`

---

## Established facts (verified)

- `src/lib/cli-task.ts`: `CLITaskType` union (line 148), `CLITask` (160), `buildTaskPrompt` switch (234), `TaskFactory` (479). `wbp-starter` (444-470) is the precedent for a UE `-ExecutePythonScript` task; `checklist` (243-274) shows `registerCallback` + `buildCallbackSection`. `WIRING_TASK_TYPES` (158) = checklist/quick-action/feature-fix only.
- `src/lib/api-utils.ts`: `apiSuccess<T>(data, status?)`, `apiError(msg, status?)`.
- `src/lib/constants.ts`: `getAppOrigin()`.
- `src/lib/level-design-db.ts` pattern: each fn calls a lazy `ensureXTable()` (idempotent `CREATE TABLE IF NOT EXISTS`); `getDb()` from `@/lib/db`; snake_case columns + `rowToX` mapper.
- `LevelDesignView.tsx`: `TabId` union (line 43), tab bar `ScrollableTabBar` (461-470), tab content conditionals (474+), `procgenCli = useModuleCLI({...})` (120-125), `getAppOrigin` already imported (40).
- `build_procgen_dungeon.py` (UE repo) hard-codes `TARGET_ROOMS = 6`, `SEED = 1337`; `import os` is NOT yet present (uses `unreal` only) — add it.
- Conventions: `@/` imports; `logger` not console; no hardcoded hex (`@/lib/chart-colors`); API envelope; relative `/api/...` client URLs. App repo local-only (do NOT push); UE repo pushable. Shared app repo — stage files BY NAME, never `git add -A`.

---

## File Structure

- Modify: `Content/Python/build_procgen_dungeon.py` (UE repo) — env-var params.
- Create: `src/lib/procgen-db.ts` — `procgen_runs` table + `recordProcgenRun` / `getLatestProcgenRun`.
- Create: `src/app/api/level-design/procgen-result/route.ts` — POST/GET.
- Create: `src/types/procgen.ts` — `ProcgenRun` type (shared by db, route, panel).
- Modify: `src/lib/cli-task.ts` — `procgen-dungeon` task type + `TaskFactory.procgenDungeon` + `buildTaskPrompt` case.
- Create: `src/components/modules/content/level-design/ProcGenDungeonPanel.tsx`.
- Modify: `src/components/modules/content/level-design/LevelDesignView.tsx` — tab + dispatch handler.
- Tests: `src/__tests__/lib/procgen-db.test.ts`, `src/__tests__/lib/cli-task-procgen.test.ts`.

---

## Task 1: UE repo — parameterize `build_procgen_dungeon.py`

**Files:**
- Modify: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\build_procgen_dungeon.py`

- [ ] **Step 1: Read env vars for the params**

Find the constants block:
```python
LEVEL_PATH = "/Game/Maps/ProcGenDungeon"
TARGET_ROOMS = 6
SEED = 1337
ROOM = 800.0
```
Replace with (read from env, keep defaults):
```python
import os

LEVEL_PATH = "/Game/Maps/ProcGenDungeon"
TARGET_ROOMS = int(os.environ.get("PROCGEN_ROOMS", "6"))
SEED = int(os.environ.get("PROCGEN_SEED", "1337"))
ROOM = 800.0
```
(If `import os` already exists at the top of the file, don't duplicate it — put the env reads with the constants and keep a single `import os`.)

- [ ] **Step 2: Run a parameterized verification (controller/operator runs UE)**

```powershell
$env:PROCGEN_ROOMS=8; $env:PROCGEN_SEED=99
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecutePythonScript="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\build_procgen_dungeon.py" -unattended -nopause -nosplash
Remove-Item Env:\PROCGEN_ROOMS; Remove-Item Env:\PROCGEN_SEED
```
Then check the newest `PoF*.log` under `…\PoF\Saved\Logs\`:
`grep -E "Generated [0-9]+ rooms|Baked [0-9]+ BlockoutRoom"` → expect `Generated 8 rooms` + `Baked 8 BlockoutRoom actors`. Re-run with no env vars → expect `Generated 6 rooms` (defaults intact). (Headless exit is non-zero on shutdown — judge by the log.)

- [ ] **Step 3: Commit (UE repo)**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Content/Python/build_procgen_dungeon.py
git commit -m "feat(procgen): parameterize build_procgen_dungeon.py via env vars

PROCGEN_ROOMS / PROCGEN_SEED override the room count + seed (defaults 6 / 1337),
so PoF can drive the generator with operator-chosen params.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: PoF — `procgen-db` + the result route (TDD)

**Files:**
- Create: `src/types/procgen.ts`, `src/lib/procgen-db.ts`, `src/app/api/level-design/procgen-result/route.ts`
- Test: `src/__tests__/lib/procgen-db.test.ts`

- [ ] **Step 1: The shared type**

Create `src/types/procgen.ts`:
```typescript
export interface ProcgenRun {
  id: number;
  roomCount: number;
  seed: number;
  createdAt: string;
}
```

- [ ] **Step 2: Write the failing db test**

Create `src/__tests__/lib/procgen-db.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';

// In-memory DB so the test never touches ~/.pof/pof.db.
vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { recordProcgenRun, getLatestProcgenRun } from '@/lib/procgen-db';

describe('procgen-db', () => {
  it('returns null when no runs recorded', () => {
    expect(getLatestProcgenRun()).toBeNull();
  });

  it('records runs and returns the most recent', () => {
    recordProcgenRun({ roomCount: 6, seed: 1337 });
    recordProcgenRun({ roomCount: 8, seed: 99 });
    const latest = getLatestProcgenRun();
    expect(latest?.roomCount).toBe(8);
    expect(latest?.seed).toBe(99);
    expect(typeof latest?.createdAt).toBe('string');
  });
});
```

- [ ] **Step 3: Run it — confirm FAIL** (`@/lib/procgen-db` not found):
`npx vitest run src/__tests__/lib/procgen-db.test.ts`

- [ ] **Step 4: Implement `procgen-db.ts`**

Create `src/lib/procgen-db.ts`:
```typescript
import { getDb } from '@/lib/db';
import type { ProcgenRun } from '@/types/procgen';

function ensureProcgenTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS procgen_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_count INTEGER NOT NULL,
      seed INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function rowToRun(row: Record<string, unknown>): ProcgenRun {
  return {
    id: row.id as number,
    roomCount: row.room_count as number,
    seed: row.seed as number,
    createdAt: row.created_at as string,
  };
}

export function recordProcgenRun(input: { roomCount: number; seed: number }): ProcgenRun {
  ensureProcgenTable();
  const db = getDb();
  const info = db
    .prepare('INSERT INTO procgen_runs (room_count, seed) VALUES (?, ?)')
    .run(input.roomCount, input.seed);
  const row = db
    .prepare('SELECT * FROM procgen_runs WHERE id = ?')
    .get(info.lastInsertRowid) as Record<string, unknown>;
  return rowToRun(row);
}

export function getLatestProcgenRun(): ProcgenRun | null {
  ensureProcgenTable();
  const row = getDb()
    .prepare('SELECT * FROM procgen_runs ORDER BY id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : null;
}
```

- [ ] **Step 5: Run the test — confirm PASS:**
`npx vitest run src/__tests__/lib/procgen-db.test.ts` → 2 passed.

- [ ] **Step 6: Implement the route**

Create `src/app/api/level-design/procgen-result/route.ts`:
```typescript
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { recordProcgenRun, getLatestProcgenRun } from '@/lib/procgen-db';

// GET /api/level-design/procgen-result → latest run (or null)
export async function GET() {
  try {
    return apiSuccess(getLatestProcgenRun());
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

// POST /api/level-design/procgen-result  Body: { roomCount, seed }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomCount = Number(body.roomCount);
    const seed = Number(body.seed);
    if (!Number.isFinite(roomCount) || !Number.isFinite(seed)) {
      return apiError('roomCount and seed are required numbers', 400);
    }
    return apiSuccess(recordProcgenRun({ roomCount, seed }), 201);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
```

- [ ] **Step 7: Typecheck + commit (app repo, local)**

Run: `npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS" || echo OK` → `OK`.
```bash
git add src/types/procgen.ts src/lib/procgen-db.ts src/app/api/level-design/procgen-result/route.ts src/__tests__/lib/procgen-db.test.ts
git commit -m "feat(level-design): procgen-result route + procgen_runs table

POST records a generator run (roomCount, seed); GET returns the latest. Backs
the Dungeon (UE) panel's result display via the @@CALLBACK pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: PoF — `procgen-dungeon` CLITask type (TDD)

**Files:**
- Modify: `src/lib/cli-task.ts`
- Test: `src/__tests__/lib/cli-task-procgen.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/cli-task-procgen.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

describe('procgen-dungeon task', () => {
  it('TaskFactory.procgenDungeon builds a typed task', () => {
    const t = TaskFactory.procgenDungeon('level-design', { roomCount: 8, seed: 99 }, 'http://localhost:3000', 'Dungeon (UE)');
    expect(t.type).toBe('procgen-dungeon');
    expect(t.roomCount).toBe(8);
    expect(t.seed).toBe(99);
  });

  it('buildTaskPrompt embeds the params, the run command, and a callback', () => {
    const t = TaskFactory.procgenDungeon('level-design', { roomCount: 8, seed: 99 }, 'http://localhost:3000', 'Dungeon (UE)');
    const p = buildTaskPrompt(t, ctx);
    expect(p).toContain('PROCGEN_ROOMS');
    expect(p).toContain('8');
    expect(p).toContain('PROCGEN_SEED');
    expect(p).toContain('build_procgen_dungeon.py');
    expect(p).toContain('-ExecutePythonScript');
    expect(p).toContain('@@CALLBACK');
    expect(p).toContain('/api/level-design/procgen-result');
  });
});
```

- [ ] **Step 2: Run it — confirm FAIL** (`procgenDungeon` not a function):
`npx vitest run src/__tests__/lib/cli-task-procgen.test.ts`

- [ ] **Step 3: Add the task type**

In `src/lib/cli-task.ts`, add `'procgen-dungeon'` to the `CLITaskType` union (line 148-155):
```typescript
export type CLITaskType =
  | 'checklist'
  | 'quick-action'
  | 'ask-claude'
  | 'feature-fix'
  | 'feature-review'
  | 'module-scan'
  | 'wbp-starter'
  | 'procgen-dungeon';
```

After the `WBPStarterTask` interface (ends line 223), add:
```typescript
/**
 * Procgen-dungeon task — runs the env-parameterized build_procgen_dungeon.py via
 * the full editor and reports the generated room count through a callback.
 */
export interface ProcgenDungeonTask extends CLITask {
  type: 'procgen-dungeon';
  roomCount: number;
  seed: number;
  appOrigin: string;
}
```

- [ ] **Step 4: Add the `buildTaskPrompt` case**

In `buildTaskPrompt`'s switch, add a case before `default:` (after the `wbp-starter` case ends at line 470):
```typescript
    case 'procgen-dungeon': {
      const pt = task as ProcgenDungeonTask;
      const header = buildProjectContextHeader(ctx, { knownAssetDomains });
      const cbId = registerCallback({
        url: `${pt.appOrigin}/api/level-design/procgen-result`,
        method: 'POST',
        staticFields: { moduleId: task.moduleId, seed: pt.seed },
        schemaHint: '  "roomCount": <number of rooms the generator reported>',
      });
      return `${header}

## Task: Generate a procedural dungeon with ARPGLevelGenerator

Run the existing placement script \`build_procgen_dungeon.py\` to bake a fresh
multi-room dungeon into \`/Game/Maps/ProcGenDungeon\` with these parameters:
- Room count: **${pt.roomCount}**
- Seed: **${pt.seed}**

Steps:
1. Find the \`.uproject\` under \`${ctx.projectPath}\` and the script at
   \`${ctx.projectPath}/Content/Python/build_procgen_dungeon.py\`.
2. Run it via the FULL editor with the params as environment variables — NOT
   \`-run=pythonscript\`. PowerShell:
   \`$env:PROCGEN_ROOMS=${pt.roomCount}; $env:PROCGEN_SEED=${pt.seed}; & "<UnrealEditor.exe>" "<.uproject>" -ExecutePythonScript="<the script path above>" -unattended -nopause -nosplash\`
3. The headless editor exits non-zero on a benign shutdown crash — judge success
   by the LOG, not the exit code. In the newest \`Saved/Logs/PoF*.log\`, find the
   line \`[LevelGenerator] ... Generated N rooms\` and \`Baked N BlockoutRoom actors\`.
4. Submit the generated room count via the callback below.

${buildCallbackSection(getCallback(cbId)!)}`;
    }
```

- [ ] **Step 5: Add the `TaskFactory.procgenDungeon` method**

In the `TaskFactory` object, after `wbpStarter` (ends line 564), add:
```typescript
  /** Create a task that runs the parameterized build_procgen_dungeon.py via the editor */
  procgenDungeon(
    moduleId: SubModuleId,
    params: { roomCount: number; seed: number },
    appOrigin: string,
    label: string,
  ): ProcgenDungeonTask {
    return {
      type: 'procgen-dungeon',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      roomCount: params.roomCount,
      seed: params.seed,
      appOrigin,
    };
  },
```

- [ ] **Step 6: Run the test — confirm PASS:**
`npx vitest run src/__tests__/lib/cli-task-procgen.test.ts` → 2 passed.

- [ ] **Step 7: Typecheck + commit (app repo, local)**

Run: `npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS" || echo OK` → `OK`.
```bash
git add src/lib/cli-task.ts src/__tests__/lib/cli-task-procgen.test.ts
git commit -m "feat(cli-task): procgen-dungeon task type + TaskFactory.procgenDungeon

Builds a prompt that runs the env-parameterized build_procgen_dungeon.py via
-ExecutePythonScript and reports the room count through a @@CALLBACK to
/api/level-design/procgen-result.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: PoF — `ProcGenDungeonPanel` + new tab

**Files:**
- Create: `src/components/modules/content/level-design/ProcGenDungeonPanel.tsx`
- Modify: `src/components/modules/content/level-design/LevelDesignView.tsx`

- [ ] **Step 1: Create the panel component**

Create `src/components/modules/content/level-design/ProcGenDungeonPanel.tsx`:
```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Boxes, Loader2, Dice5 } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { tryApiFetch } from '@/lib/api-utils';
import type { ProcgenRun } from '@/types/procgen';

interface ProcGenDungeonPanelProps {
  /** Dispatch a generation run with the chosen params. */
  onGenerate: (roomCount: number, seed: number) => void;
  /** True while a generation task is running. */
  isGenerating: boolean;
}

export function ProcGenDungeonPanel({ onGenerate, isGenerating }: ProcGenDungeonPanelProps) {
  const [roomCount, setRoomCount] = useState(6);
  const [seed, setSeed] = useState(1337);
  const [lastRun, setLastRun] = useState<ProcgenRun | null>(null);

  const refetch = useCallback(async () => {
    const r = await tryApiFetch<ProcgenRun | null>('/api/level-design/procgen-result');
    if (r.ok) setLastRun(r.data);
  }, []);

  // Refetch on mount and whenever a run finishes (isGenerating true -> false).
  useEffect(() => {
    if (!isGenerating) void refetch();
  }, [isGenerating, refetch]);

  const clampedRooms = Math.max(2, Math.min(20, roomCount));

  return (
    <div className="w-full h-full overflow-y-auto p-6 space-y-6 bg-[#03030a] text-violet-100 font-mono">
      <div className="flex items-center gap-3 border-b border-violet-900/30 pb-4">
        <div className="w-11 h-11 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center">
          <Boxes className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase">Procedural Dungeon (UE)</h3>
          <p className="text-xs text-violet-400/60 uppercase tracking-wider mt-0.5">Drive ARPGLevelGenerator → /Game/Maps/ProcGenDungeon</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="block text-xs font-bold text-violet-400 uppercase tracking-widest">Room count</span>
          <input
            type="number" min={2} max={20} value={roomCount}
            onChange={(e) => setRoomCount(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg text-xs bg-[#0a0a19] border border-violet-900/50 text-violet-100 outline-none focus:border-violet-500/70"
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-bold text-violet-400 uppercase tracking-widest">Seed</span>
          <div className="flex gap-2">
            <input
              type="number" value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#0a0a19] border border-violet-900/50 text-violet-100 outline-none focus:border-violet-500/70"
            />
            <button
              type="button"
              onClick={() => setSeed(Math.floor(Math.random() * 100000))}
              title="Randomize seed"
              className="px-3 rounded-lg border border-violet-900/50 text-violet-400 hover:text-violet-200"
            >
              <Dice5 className="w-4 h-4" />
            </button>
          </div>
        </label>
      </div>

      <button
        onClick={() => onGenerate(clampedRooms, seed)}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40"
        style={{
          backgroundColor: `${MODULE_COLORS.content}20`,
          color: MODULE_COLORS.content,
          border: `1px solid ${MODULE_COLORS.content}60`,
        }}
      >
        {isGenerating ? (<><Loader2 className="w-5 h-5 animate-spin" /> Generating…</>) : (<><Boxes className="w-5 h-5" /> Generate Dungeon (UE)</>)}
      </button>

      <div className="text-xs px-3 py-2 rounded-lg border border-violet-900/40 bg-violet-950/20">
        {lastRun
          ? `Last run: ${lastRun.roomCount} rooms (seed ${lastRun.seed}) at ${lastRun.createdAt}`
          : 'No runs yet. Set params and generate — the dungeon is baked into /Game/Maps/ProcGenDungeon.'}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the dispatch + tab in `LevelDesignView`**

Add the `TaskFactory` import near the other `@/lib` imports (top of file):
```typescript
import { TaskFactory } from '@/lib/cli-task';
import { ProcGenDungeonPanel } from './ProcGenDungeonPanel';
```

Extend the `TabId` union (line 43):
```typescript
type TabId = 'overview' | 'roadmap' | 'flow' | 'procgen' | 'narrative' | 'sync' | 'arc' | 'streaming' | 'dungeon-ue';
```

After the `procgenCli` / `handleGenerateProcgen` block (line 130), add:
```typescript
  const dungeonCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-procgen-ue',
    label: 'Dungeon (UE)',
    accentColor: MODULE_COLORS.content,
  });

  const handleGenerateDungeon = useCallback((roomCount: number, seed: number) => {
    dungeonCli.execute(
      TaskFactory.procgenDungeon('level-design', { roomCount, seed }, getAppOrigin(), 'Dungeon (UE)'),
    );
  }, [dungeonCli]);
```

Add a tab button after the Procgen `TabButton` (line 465). Reuse the `Boxes` icon (add to the existing `lucide-react` import in this file if not present):
```tsx
              <TabButton label="Dungeon (UE)" icon={Boxes} active={activeTab === 'dungeon-ue'} onClick={() => setActiveTab('dungeon-ue')} accent={MODULE_COLORS.content} />
```

Add the tab content after the `activeTab === 'procgen'` block (line 542):
```tsx
              {activeTab === 'dungeon-ue' && (
                <ProcGenDungeonPanel
                  onGenerate={handleGenerateDungeon}
                  isGenerating={dungeonCli.isRunning}
                />
              )}
```

(If `Boxes` is not already imported from `lucide-react` in `LevelDesignView.tsx`, add it to that import statement.)

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS" || echo OK` → `OK`.
Run: `npx eslint src/components/modules/content/level-design/ProcGenDungeonPanel.tsx src/components/modules/content/level-design/LevelDesignView.tsx` → `0 errors`.
(If the `bg-[#03030a]`/`bg-[#0a0a19]` Tailwind arbitrary-value classes trip the no-hex eslint rule, they're already used across this module's files — confirm the run is clean; the rule targets JS hex values, not Tailwind classes.)

- [ ] **Step 4: Commit (app repo, local — stage by name)**

```bash
git add src/components/modules/content/level-design/ProcGenDungeonPanel.tsx src/components/modules/content/level-design/LevelDesignView.tsx
git commit -m "feat(level-design): Dungeon (UE) tab — drive ARPGLevelGenerator from the UI

A panel with room-count + seed inputs + a Generate button that dispatches the
procgen-dungeon CLITask (runs build_procgen_dungeon.py) and shows the latest
run's room count from /api/level-design/procgen-result.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Verify + findings

**Files:** findings doc.

- [ ] **Step 1: Full suite + lint**

Run: `npm run test 2>&1 | tail -6` → all pass (incl. `procgen-db.test.ts` + `cli-task-procgen.test.ts`).

- [ ] **Step 2: Confirm the parameterized UE run** (from Task 1 Step 2 — re-run if not already done): `Generated 8 rooms` with `PROCGEN_ROOMS=8`, `Generated 6 rooms` with no env var.

- [ ] **Step 3: Dev-server / live-dispatch note (honest)**

The live click→terminal→UE→callback→panel round-trip needs the running PoF app + an interactive CLI session + a UE round-trip, which is NOT drivable headlessly here. State this explicitly. Verified instead: the parameterized script (direct run), the prompt-builder + callback route + db (vitest), typecheck/lint/suite. Recommend the operator: open Level Design → Dungeon (UE), set room count + seed, Generate, and confirm the result line updates.

- [ ] **Step 4: Write findings**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-procgen-driver-panel.md`: the script param change (proven), the `procgen-dungeon` task type + callback route + db, the panel + tab, the test results, and the honest live-dispatch gap. Note this closes pof-app §4's driver-panel piece; biome editor + room-template generator remain.

- [ ] **Step 5: Commit (app repo, local + UE repo if Task 1 not yet committed)**

```bash
cd "C:/Users/kazda/kiro/pof"
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-procgen-driver-panel.md docs/superpowers/plans/2026-05-23-env-procgen-driver-panel.md
git commit -m "docs(env): procgen-dungeon driver panel findings (folder-05 pof-app §4)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final validation

- [ ] **Confirm DoD:** (1) script env-parameterized + proven (`Generated 8 rooms`); (2) `procgen-dungeon` task type + `TaskFactory.procgenDungeon` + prompt case; (3) `procgen-db` + route POST/GET; (4) `ProcGenDungeonPanel` in a new Dungeon (UE) tab dispatching the task + showing the latest run; (5) vitest (db + prompt) green + typecheck/lint + full suite green; (6) findings committed. Live dispatch is operator-verified (documented). Any unchecked → return to its task.

---

## Self-review notes (addressed during writing)

- **Spec coverage:** Part 1 (script param)→Task 1; Part 2 (task type)→Task 3; Part 3 (route+db)→Task 2; Part 4 (panel+tab)→Task 4; Verification→Task 5. DoD→Final validation.
- **Type/name consistency:** `ProcgenRun` (id/roomCount/seed/createdAt) used by db, route, panel; `recordProcgenRun`/`getLatestProcgenRun` consistent across db, route, test; `TaskFactory.procgenDungeon(moduleId,{roomCount,seed},appOrigin,label)` + `ProcgenDungeonTask` fields consistent across cli-task, the test, and `handleGenerateDungeon`; callback URL `/api/level-design/procgen-result` consistent across the task prompt, the route path, and the panel fetch; `seed` is a callback static field (authoritative from client), `roomCount` is the reported result.
- **No placeholders:** full code in every code step.
- **No UV param** anywhere (correct — procgen is greybox).
- **Shared-repo hygiene:** every commit stages files by name.
- **Honest gap:** Task 5 Step 3 documents the un-drivable live dispatch rather than claiming it.
- **`procgen-dungeon` excluded from `WIRING_TASK_TYPES`** (it runs a script, doesn't author wiring) — no change needed to that set (it lists only checklist/quick-action/feature-fix).
