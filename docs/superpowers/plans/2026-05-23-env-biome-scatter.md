# Biome → Scatter Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author a `BiomeDefinition` + place a real `AARPGVegetationScatter` over the VerticalSlice arena floor so greybox props populate it (no-collision), surfaced as a PoF "Scatter (UE)" tab that dispatches the run and shows the instance count.

**Architecture:** Mirrors the procgen driver panel: a UE Python script (`scatter_biome_ue.py`) authors the biome + places/generates the scatter actor + forces instances no-collision; a `biome-scatter` CLITask runs it via `-ExecutePythonScript` and reports the instance count through a `@@CALLBACK` → `/api/level-design/scatter-result` (backed by a `scatter_runs` table); a `BiomeScatterPanel` (new tab) dispatches via `useModuleCLI` and displays the latest run.

**Tech Stack:** UE 5.7 editor Python (`unreal`), TypeScript (Next.js 16 / React 19), better-sqlite3, vitest, Playwright, the `useModuleCLI` + `CLITask` + `@@CALLBACK` pattern.

**Spec:** `docs/superpowers/specs/2026-05-23-env-biome-scatter-design.md`

---

## Established facts (verified)

- `UARPGBiomeDefinition` props (Python snake_case): `biome_id` (FName),
  `biome_display_name` (FText), `vegetation` (array), `scatter_layers` (array of
  `unreal.BiomeScatterLayer`), `global_density_multiplier`. `FBiomeScatterLayer`:
  `layer_name`, `meshes` (TArray<TSoftObjectPtr<UStaticMesh>>),
  `density_per100_sq`, `min_scale`/`max_scale`, `min_slope_angle`/`max_slope_angle`,
  `min_spacing`, `b_align_to_surface`.
- `AARPGVegetationScatter` props: `biome_definition`, `scatter_bounds`
  (UBoxComponent), `random_seed`, `local_density_multiplier`,
  `b_generate_in_editor`, `b_generate_on_begin_play`, `trace_channel`,
  `exclusion_volumes`. Methods: `generate_vegetation()`, `clear_vegetation()`,
  `get_total_instance_count()`.
- The `b`-bool-prefix is dropped in UE Python (`bGenerateInEditor` →
  `generate_in_editor`). Verify each `set_editor_property` name; a wrong one
  raises.
- `DataAssetFactory`: `factory.set_editor_property("data_asset_class", unreal.ARPGBiomeDefinition)`;
  `asset_tools.create_asset(name, folder, unreal.ARPGBiomeDefinition, factory)`.
  **create_asset returns None if the path is occupied** → load-or-create (don't
  delete+create), per `build_procgen_dungeon.py`.
- `cli-task.ts`: `CLITaskType` union (~L146), `ProcgenDungeonTask` interface +
  the `procgen-dungeon` `buildTaskPrompt` case + `TaskFactory.procgenDungeon`
  are the exact templates to copy. `buildProjectContextHeader(ctx)` takes ctx
  only (no options).
- `procgen-db.ts` / `procgen-result/route.ts` / `ProcGenDungeonPanel.tsx` /
  `LevelDesignView.tsx` (TabId union ~L43, tab bar, `procgenCli`/`dungeonCli`
  hooks, the `Boxes` lucide import) are the exact templates for Parts 3-4.
- Conventions: `@/` imports; `logger`; no hardcoded hex; API envelope; relative
  `/api/...`; `getAppOrigin()`. App repo local-only; UE repo pushable. **Stage by
  name, never `git add -A`** (shared tree). **Never broad-kill processes** — for
  UE screenshots kill only my own PID; leave the dev server for the user. The
  pre-existing `leonardo.ts:208` typecheck error is unrelated (filter it).
- Run headless UE via the full editor; exit 3 on shutdown is benign (judge by
  log). Functional tests via `UnrealEditor-Cmd … -ExecCmds="Automation RunTests
  …;Quit" -nullrhi -abslog="<own path>"`.

---

## File Structure

- Create: `Content/Python/scatter_biome_ue.py` (UE repo) — biome + scatter placement.
- Modify: `src/types/procgen.ts` — add `ScatterRun`.
- Create: `src/lib/scatter-db.ts` — `scatter_runs` table.
- Create: `src/app/api/level-design/scatter-result/route.ts` — POST/GET.
- Modify: `src/lib/cli-task.ts` — `biome-scatter` task type + factory + prompt case.
- Create: `src/components/modules/content/level-design/BiomeScatterPanel.tsx`.
- Modify: `src/components/modules/content/level-design/LevelDesignView.tsx` — tab + dispatch.
- Tests: `src/__tests__/lib/scatter-db.test.ts`, `src/__tests__/lib/cli-task-scatter.test.ts`.
- Create (verify): `e2e/biome-scatter-panel.spec.ts`.

---

## Task 1: UE — `scatter_biome_ue.py`

**Files:**
- Create: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\scatter_biome_ue.py`

- [ ] **Step 1: Write the script**

```python
"""
scatter_biome_ue.py
===================
Author a BiomeDefinition (placeholder engine meshes) + place an
AARPGVegetationScatter over the VerticalSlice arena floor and generate
no-collision greybox props. Env params: SCATTER_DENSITY, SCATTER_SEED.

Run via the FULL editor:
    UnrealEditor.exe <uproject> -ExecutePythonScript="<abs path>" -unattended -nopause -nosplash
"""
import os
import unreal

BIOME_PATH = "/Game/Level/Biomes/BD_ArenaRubble"
LEVEL_PATH = "/Game/Maps/VerticalSlice"
DENSITY = float(os.environ.get("SCATTER_DENSITY", "1.0"))
SEED = int(os.environ.get("SCATTER_SEED", "1337"))

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset_lib = unreal.EditorAssetLibrary


def _log(m):
    unreal.log("[scatter_biome] " + m)


def make_biome():
    folder = "/Game/Level/Biomes"
    if asset_lib.does_asset_exist(BIOME_PATH):
        biome = asset_lib.load_asset(BIOME_PATH)
    else:
        factory = unreal.DataAssetFactory()
        factory.set_editor_property("data_asset_class", unreal.ARPGBiomeDefinition)
        biome = asset_tools.create_asset("BD_ArenaRubble", folder, unreal.ARPGBiomeDefinition, factory)
    if biome is None:
        raise RuntimeError("failed to create/load biome " + BIOME_PATH)

    cube = asset_lib.load_asset("/Engine/BasicShapes/Cube")
    cyl = asset_lib.load_asset("/Engine/BasicShapes/Cylinder")

    layer = unreal.BiomeScatterLayer()
    layer.set_editor_property("layer_name", unreal.Name("rubble"))
    layer.set_editor_property("meshes", [cube, cyl])
    layer.set_editor_property("density_per100_sq", 0.15)
    layer.set_editor_property("min_scale", 0.3)
    layer.set_editor_property("max_scale", 0.7)
    layer.set_editor_property("min_slope_angle", 0.0)
    layer.set_editor_property("max_slope_angle", 60.0)
    layer.set_editor_property("min_spacing", 150.0)
    layer.set_editor_property("b_align_to_surface", True)

    biome.set_editor_property("biome_id", unreal.Name("ArenaRubble"))
    biome.set_editor_property("scatter_layers", [layer])
    biome.set_editor_property("global_density_multiplier", 1.0)
    asset_lib.save_asset(BIOME_PATH)
    n = len(biome.get_editor_property("scatter_layers"))
    _log("Biome BD_ArenaRubble: %d scatter layer(s)" % n)
    return biome


def main():
    _log("=== Biome scatter START (density=%.2f seed=%d) ===" % (DENSITY, SEED))
    biome = make_biome()

    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    les.load_level(LEVEL_PATH)
    aes = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

    # Idempotent: remove any prior scatter actor.
    for a in aes.get_all_level_actors():
        if isinstance(a, unreal.ARPGVegetationScatter):
            aes.destroy_actor(a)

    scatter = aes.spawn_actor_from_class(unreal.ARPGVegetationScatter, unreal.Vector(0.0, 0.0, 200.0))
    scatter.set_actor_label("Arena_Scatter")
    scatter.set_editor_property("biome_definition", biome)
    scatter.set_editor_property("random_seed", SEED)
    scatter.set_editor_property("local_density_multiplier", DENSITY)
    # Bounds box spans above + through the floor for downward visibility traces.
    bounds = scatter.get_editor_property("scatter_bounds")
    bounds.set_box_extent(unreal.Vector(1000.0, 1000.0, 200.0))

    scatter.generate_vegetation()
    count = scatter.get_total_instance_count()
    _log("Scattered %d instances" % count)
    if count <= 0:
        unreal.log_warning("[scatter_biome] 0 instances — check bounds/trace/floor")

    # Force no-collision so the player passes through (VSFunctionalTest safe).
    for comp in scatter.get_components_by_class(unreal.HierarchicalInstancedStaticMeshComponent):
        comp.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    _log("Scatter HISM set to NO_COLLISION")

    les.save_current_level()
    les.load_level(LEVEL_PATH)
    persisted = sum(1 for a in aes.get_all_level_actors() if isinstance(a, unreal.ARPGVegetationScatter))
    _log("Persisted after reload: scatter actors=%d" % persisted)
    _log("=== Biome scatter COMPLETE ===")


if __name__ == "__main__":
    main()
    try:
        if unreal.is_editor():
            unreal.SystemLibrary.quit_editor()
    except Exception:
        pass
```

- [ ] **Step 2: Run it (controller/operator runs UE)**

```powershell
$env:SCATTER_DENSITY=1; $env:SCATTER_SEED=7
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecutePythonScript="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\scatter_biome_ue.py" -unattended -nopause -nosplash
Remove-Item Env:\SCATTER_DENSITY; Remove-Item Env:\SCATTER_SEED
```
Check the newest `…\PoF\Saved\Logs\PoF*.log`: expect `Biome BD_ArenaRubble: 1 scatter layer(s)`, `Scattered N instances` with **N > 0**, `Scatter HISM set to NO_COLLISION`, `Persisted after reload: scatter actors=1`, `COMPLETE`.
- If `set_editor_property`/struct/enum names raise (no "Biome …" line, or a Traceback), fix the offending name (read-back the asset's props to find it) and re-run.
- If `Scattered 0 instances`: raise the bounds Z / lower `min_spacing` / raise `density_per100_sq`, re-run, until N > 0.
- (Exit 3 on shutdown is benign — judge by the log.)

- [ ] **Step 3: Commit (UE repo)**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Content/Python/scatter_biome_ue.py
git commit -m "feat(env): biome scatter script — populate the arena floor with props

Authors BD_ArenaRubble (placeholder engine meshes) + places an
AARPGVegetationScatter over the VerticalSlice arena and generates no-collision
greybox props. Env params SCATTER_DENSITY / SCATTER_SEED.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: PoF — scatter-db + result route (TDD)

**Files:**
- Modify: `src/types/procgen.ts`
- Create: `src/lib/scatter-db.ts`, `src/app/api/level-design/scatter-result/route.ts`
- Test: `src/__tests__/lib/scatter-db.test.ts`

- [ ] **Step 1: Add the `ScatterRun` type**

Append to `src/types/procgen.ts`:
```typescript
export interface ScatterRun {
  id: number;
  instanceCount: number;
  seed: number;
  createdAt: string;
}
```

- [ ] **Step 2: Write the failing db test**

Create `src/__tests__/lib/scatter-db.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { recordScatterRun, getLatestScatterRun } from '@/lib/scatter-db';

describe('scatter-db', () => {
  it('returns null when no runs recorded', () => {
    expect(getLatestScatterRun()).toBeNull();
  });

  it('records runs and returns the most recent', () => {
    recordScatterRun({ instanceCount: 40, seed: 7 });
    recordScatterRun({ instanceCount: 73, seed: 9 });
    const latest = getLatestScatterRun();
    expect(latest?.instanceCount).toBe(73);
    expect(latest?.seed).toBe(9);
    expect(typeof latest?.createdAt).toBe('string');
  });
});
```

- [ ] **Step 3: Run it — confirm FAIL:** `npx vitest run src/__tests__/lib/scatter-db.test.ts`

- [ ] **Step 4: Implement `src/lib/scatter-db.ts`**

```typescript
import { getDb } from '@/lib/db';
import type { ScatterRun } from '@/types/procgen';

function ensureScatterTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS scatter_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_count INTEGER NOT NULL,
      seed INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function rowToRun(row: Record<string, unknown>): ScatterRun {
  return {
    id: row.id as number,
    instanceCount: row.instance_count as number,
    seed: row.seed as number,
    createdAt: row.created_at as string,
  };
}

export function recordScatterRun(input: { instanceCount: number; seed: number }): ScatterRun {
  ensureScatterTable();
  const db = getDb();
  const info = db
    .prepare('INSERT INTO scatter_runs (instance_count, seed) VALUES (?, ?)')
    .run(input.instanceCount, input.seed);
  const row = db
    .prepare('SELECT * FROM scatter_runs WHERE id = ?')
    .get(info.lastInsertRowid) as Record<string, unknown>;
  return rowToRun(row);
}

export function getLatestScatterRun(): ScatterRun | null {
  ensureScatterTable();
  const row = getDb()
    .prepare('SELECT * FROM scatter_runs ORDER BY id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : null;
}
```

- [ ] **Step 5: Run the test — confirm PASS** (2 passed).

- [ ] **Step 6: Implement `src/app/api/level-design/scatter-result/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { recordScatterRun, getLatestScatterRun } from '@/lib/scatter-db';

// GET /api/level-design/scatter-result → latest run (or null)
export async function GET() {
  try {
    return apiSuccess(getLatestScatterRun());
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}

// POST /api/level-design/scatter-result  Body: { instanceCount, seed }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const instanceCount = Number(body.instanceCount);
    const seed = Number(body.seed);
    if (!Number.isFinite(instanceCount) || !Number.isFinite(seed)) {
      return apiError('instanceCount and seed are required numbers', 400);
    }
    return apiSuccess(recordScatterRun({ instanceCount, seed }), 201);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500);
  }
}
```

- [ ] **Step 7: Typecheck + commit**

`npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS" || echo OK` → `OK`.
```bash
cd "C:/Users/kazda/kiro/pof"
git add src/types/procgen.ts src/lib/scatter-db.ts src/app/api/level-design/scatter-result/route.ts src/__tests__/lib/scatter-db.test.ts
git commit -m "feat(level-design): scatter-result route + scatter_runs table

POST records a scatter run (instanceCount, seed); GET returns the latest. Backs
the Scatter (UE) panel's result display.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: PoF — `biome-scatter` CLITask (TDD)

**Files:**
- Modify: `src/lib/cli-task.ts`
- Test: `src/__tests__/lib/cli-task-scatter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/cli-task-scatter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

describe('biome-scatter task', () => {
  it('TaskFactory.scatterBiome builds a typed task', () => {
    const t = TaskFactory.scatterBiome('level-design', { density: 1.5, seed: 7 }, 'http://localhost:3000', 'Scatter (UE)');
    expect(t.type).toBe('biome-scatter');
    expect(t.density).toBe(1.5);
    expect(t.seed).toBe(7);
  });

  it('buildTaskPrompt embeds the params, the run command, and a callback', () => {
    const t = TaskFactory.scatterBiome('level-design', { density: 1.5, seed: 7 }, 'http://localhost:3000', 'Scatter (UE)');
    const p = buildTaskPrompt(t, ctx);
    expect(p).toContain('SCATTER_DENSITY');
    expect(p).toContain('1.5');
    expect(p).toContain('SCATTER_SEED');
    expect(p).toContain('scatter_biome_ue.py');
    expect(p).toContain('-ExecutePythonScript');
    expect(p).toContain('@@CALLBACK');
    expect(p).toContain('instanceCount');
    expect(p).toContain('Scatter the arena');
  });
});
```

- [ ] **Step 2: Run it — confirm FAIL.**

- [ ] **Step 3: Add the task type** — in `src/lib/cli-task.ts`, add `'biome-scatter'` to the `CLITaskType` union (after `'procgen-dungeon'`):
```typescript
  | 'procgen-dungeon'
  | 'biome-scatter';
```
After the `ProcgenDungeonTask` interface, add:
```typescript
/**
 * Biome-scatter task — runs scatter_biome_ue.py via the full editor to populate
 * the arena floor with props and reports the instance count through a callback.
 */
export interface BiomeScatterTask extends CLITask {
  type: 'biome-scatter';
  density: number;
  seed: number;
  appOrigin: string;
}
```

- [ ] **Step 4: Add the `buildTaskPrompt` case** — before `default:`:
```typescript
    case 'biome-scatter': {
      const st = task as BiomeScatterTask;
      const header = buildProjectContextHeader(ctx);
      const cbId = registerCallback({
        url: `${st.appOrigin}/api/level-design/scatter-result`,
        method: 'POST',
        staticFields: { moduleId: task.moduleId, seed: st.seed },
        schemaHint: '  "instanceCount": <number of instances the scatter reported>',
      });
      return `${header}

## Task: Scatter the arena floor with props (AARPGVegetationScatter)

Run the placement script \`scatter_biome_ue.py\` to author the biome + scatter
greybox props onto \`/Game/Maps/VerticalSlice\`'s arena floor, with:
- Density multiplier: **${st.density}**
- Seed: **${st.seed}**

Steps:
1. Find the \`.uproject\` under \`${ctx.projectPath}\` and the script at
   \`${ctx.projectPath}/Content/Python/scatter_biome_ue.py\`.
2. Run it via the FULL editor with the params as environment variables — NOT
   \`-run=pythonscript\`. PowerShell:
   \`$env:SCATTER_DENSITY=${st.density}; $env:SCATTER_SEED=${st.seed}; & "<UnrealEditor.exe>" "<.uproject>" -ExecutePythonScript="<the script path above>" -unattended -nopause -nosplash\`
3. The headless editor exits non-zero on a benign shutdown crash — judge by the
   LOG. In the newest \`Saved/Logs/PoF*.log\`, find \`[scatter_biome] Scattered N instances\`.
4. Submit the instance count via the callback below.

${buildCallbackSection(getCallback(cbId)!)}`;
    }
```

- [ ] **Step 5: Add the factory method** — in `TaskFactory`, after `procgenDungeon`:
```typescript
  /** Create a task that runs scatter_biome_ue.py via the editor */
  scatterBiome(
    moduleId: SubModuleId,
    params: { density: number; seed: number },
    appOrigin: string,
    label: string,
  ): BiomeScatterTask {
    return {
      type: 'biome-scatter',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      density: params.density,
      seed: params.seed,
      appOrigin,
    };
  },
```

- [ ] **Step 6: Run the test — confirm PASS** (2 passed).

- [ ] **Step 7: Typecheck + commit**

`npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS" || echo OK` → `OK`.
```bash
git add src/lib/cli-task.ts src/__tests__/lib/cli-task-scatter.test.ts
git commit -m "feat(cli-task): biome-scatter task type + TaskFactory.scatterBiome

Runs scatter_biome_ue.py via -ExecutePythonScript and reports the instance count
through a @@CALLBACK to /api/level-design/scatter-result.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: PoF — `BiomeScatterPanel` + new tab

**Files:**
- Create: `src/components/modules/content/level-design/BiomeScatterPanel.tsx`
- Modify: `src/components/modules/content/level-design/LevelDesignView.tsx`

- [ ] **Step 1: Create the panel**

Create `src/components/modules/content/level-design/BiomeScatterPanel.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { Trees, Loader2, Dice5 } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { tryApiFetch } from '@/lib/api-utils';
import type { ScatterRun } from '@/types/procgen';

interface BiomeScatterPanelProps {
  onGenerate: (density: number, seed: number) => void;
  isGenerating: boolean;
}

export function BiomeScatterPanel({ onGenerate, isGenerating }: BiomeScatterPanelProps) {
  const [density, setDensity] = useState(1);
  const [seed, setSeed] = useState(1337);
  const [lastRun, setLastRun] = useState<ScatterRun | null>(null);

  useEffect(() => {
    if (isGenerating) return;
    let cancelled = false;
    void (async () => {
      const r = await tryApiFetch<ScatterRun | null>('/api/level-design/scatter-result');
      if (!cancelled && r.ok) setLastRun(r.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [isGenerating]);

  const clampedDensity = Math.max(0.1, Math.min(3, density));

  return (
    <div className="w-full h-full overflow-y-auto p-6 space-y-6 bg-[#03030a] text-violet-100 font-mono">
      <div className="flex items-center gap-3 border-b border-violet-900/30 pb-4">
        <div className="w-11 h-11 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center">
          <Trees className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase">Biome Scatter (UE)</h3>
          <p className="text-xs text-violet-400/60 uppercase tracking-wider mt-0.5">Drive AARPGVegetationScatter → props on the arena floor</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="block text-xs font-bold text-violet-400 uppercase tracking-widest">Density ×</span>
          <input
            type="number" min={0.1} max={3} step={0.1} value={density}
            onChange={(e) => setDensity(Number(e.target.value))}
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
        onClick={() => onGenerate(clampedDensity, seed)}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40"
        style={{
          backgroundColor: `${MODULE_COLORS.content}20`,
          color: MODULE_COLORS.content,
          border: `1px solid ${MODULE_COLORS.content}60`,
        }}
      >
        {isGenerating ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Scattering…</>
        ) : (
          <><Trees className="w-5 h-5" /> Scatter Props (UE)</>
        )}
      </button>

      <div className="text-xs px-3 py-2 rounded-lg border border-violet-900/40 bg-violet-950/20">
        {lastRun
          ? `Last scatter: ${lastRun.instanceCount} instances (seed ${lastRun.seed}) at ${lastRun.createdAt}`
          : 'No scatter yet. Set density + seed and scatter — props are placed (no-collision) on the arena floor.'}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the tab in `LevelDesignView.tsx`**

Add to the panel imports (near the `ProcGenDungeonPanel` import):
```typescript
import { BiomeScatterPanel } from './BiomeScatterPanel';
```
Add `Trees` to the existing `lucide-react` import (the line that has `Boxes`).
Extend the `TabId` union — add `| 'scatter-ue'`:
```typescript
type TabId = 'overview' | 'roadmap' | 'flow' | 'procgen' | 'narrative' | 'sync' | 'arc' | 'streaming' | 'dungeon-ue' | 'scatter-ue';
```
After the `dungeonCli` / `handleGenerateDungeon` block, add:
```typescript
  const scatterCli = useModuleCLI({
    moduleId: 'level-design',
    sessionKey: 'level-design-scatter-ue',
    label: 'Scatter (UE)',
    accentColor: MODULE_COLORS.content,
  });

  const handleScatter = useCallback((density: number, seed: number) => {
    scatterCli.execute(
      TaskFactory.scatterBiome('level-design', { density, seed }, getAppOrigin(), 'Scatter (UE)'),
    );
  }, [scatterCli]);
```
Add a tab button after the Dungeon (UE) `TabButton`:
```tsx
              <TabButton label="Scatter (UE)" icon={Trees} active={activeTab === 'scatter-ue'} onClick={() => setActiveTab('scatter-ue')} accent={MODULE_COLORS.content} />
```
Add the tab content after the `activeTab === 'dungeon-ue'` block:
```tsx
              {activeTab === 'scatter-ue' && (
                <BiomeScatterPanel
                  onGenerate={handleScatter}
                  isGenerating={scatterCli.isRunning}
                />
              )}
```

- [ ] **Step 3: Typecheck + lint**

`npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS" || echo OK` → `OK`.
`npx eslint src/components/modules/content/level-design/BiomeScatterPanel.tsx src/components/modules/content/level-design/LevelDesignView.tsx` → expect 0 errors (the 4 pre-existing `ctx`/useCallback warnings on LevelDesignView are unrelated). The `useEffect` async-IIFE pattern (no setState synchronously in the effect) matches `ProcGenDungeonPanel`.

- [ ] **Step 4: Commit (by name)**

```bash
git add src/components/modules/content/level-design/BiomeScatterPanel.tsx src/components/modules/content/level-design/LevelDesignView.tsx
git commit -m "feat(level-design): Scatter (UE) tab — drive AARPGVegetationScatter from the UI

A panel with density + seed inputs + a Scatter button that dispatches the
biome-scatter CLITask (runs scatter_biome_ue.py) and shows the latest run's
instance count from /api/level-design/scatter-result.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Verify + findings

**Files:**
- Create: `e2e/biome-scatter-panel.spec.ts`
- Create: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-biome-scatter.md`

- [ ] **Step 1: Full suite** — `npm run test 2>&1 | tail -6` → all pass (incl. `scatter-db.test.ts` + `cli-task-scatter.test.ts`).

- [ ] **Step 2: Confirm the UE run + props** (Task 1 Step 2 already proved `Scattered N>0 instances`). Capture a real-launch screenshot of VerticalSlice (kill ONLY the UE PID I started — `Start-Process -PassThru` → `taskkill /PID <pid> /T`; NEVER `/IM`) and run the Gemini arena-check / a "are greybox boxes/props scattered across the floor?" prompt. Confirm props visible.

- [ ] **Step 3: VSFunctionalTest regression**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF" && rm -f /c/Users/kazda/kiro/pof/_vs.log; "/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" "/Game/Maps/VerticalSlice" -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi -abslog="C:/Users/kazda/kiro/pof/_vs.log" >/dev/null 2>&1; echo "exit=$?"; grep -E "Result=\{|#2 movement|TEST COMPLETE" /c/Users/kazda/kiro/pof/_vs.log | tail -3; rm -f /c/Users/kazda/kiro/pof/_vs.log
```
Expected: `Result={Success}`, `#2 movement … PASS` — no-collision scatter didn't break movement.

- [ ] **Step 4: Live panel spec (CI-safe; reuses the driver-panel nav)**

Create `e2e/biome-scatter-panel.spec.ts` (self-seeds a run via the API; opens project → Content → Level Design → select/create a doc → "Scatter (UE)" tab; asserts the panel heading + result line + button; does NOT click Scatter):
```typescript
import { test, expect } from '@playwright/test';

test('Scatter (UE) panel renders + reads the latest run from the API', async ({ page, request }) => {
  await request.post('/api/level-design/scatter-result', { data: { instanceCount: 57, seed: 4242 } });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByText(/Unreal Projects[\\/]+PoF/).first().click();
  await page.waitForTimeout(2500);
  await page.getByTestId('pof-sidebar-nav-item-content').click();
  await page.waitForTimeout(800);
  await page.getByTestId('pof-sidebar-l2-nav-item-level-design').click();
  await page.waitForTimeout(1500);

  const existing = page.getByText('ProcGen Smoke').first();
  if (await existing.count()) {
    await existing.click();
  } else {
    const input = page.getByPlaceholder(/New level design/i);
    await input.fill('ProcGen Smoke');
    await input.press('Enter');
    await page.waitForTimeout(1000);
    await page.getByText('ProcGen Smoke').first().click();
  }
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: 'Scatter (UE)' }).first().click();

  await expect(page.getByText('Biome Scatter (UE)')).toBeVisible();
  await expect(page.getByText(/57 instances \(seed 4242\)/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Scatter Props/ })).toBeVisible();
});
```
Run (against the running dev server): `npx playwright test e2e/biome-scatter-panel.spec.ts --project=chromium --reporter=line` → 1 passed. (If no dev server is running, start one with `npm run dev` in the background; do NOT kill node by name afterward — leave it for the user.)

- [ ] **Step 5: Write findings** — `docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-biome-scatter.md`: the scatter script (instance count proven), the `biome-scatter` task + route + db, the panel + tab, the VSFunctionalTest result, the Gemini "props visible" verdict, and the e2e spec. Note it closes pof-app §4 (biome) + game.md §4 (props); the live CLI→UE→callback completion is operator-verified.

- [ ] **Step 6: Commit (app repo, local + findings)**

```bash
cd "C:/Users/kazda/kiro/pof"
git add e2e/biome-scatter-panel.spec.ts docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-biome-scatter.md docs/superpowers/plans/2026-05-23-env-biome-scatter.md
git commit -m "docs(env): biome -> scatter findings + e2e spec (folder-05 §4)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final validation

- [ ] **Confirm DoD:** (1) `scatter_biome_ue.py` authors the biome + places a no-collision scatter, proven by `Scattered N>0 instances`; (2) `biome-scatter` task + factory + prompt; (3) `scatter-db` + route + `ScatterRun`; (4) `BiomeScatterPanel` in a new Scatter (UE) tab dispatching the task + showing the latest run; (5) vitest (db + prompt) green + typecheck/lint + full suite green + VSFunctionalTest green + Gemini props-visible; (6) findings committed. **If scatter places 0 instances or VSFunctionalTest breaks, report it — don't declare success.**

---

## Self-review notes (addressed during writing)

- **Spec coverage:** Part 1 (scatter script)→Task 1; Part 2 (task type)→Task 3; Part 3 (route+db)→Task 2; Part 4 (panel+tab)→Task 4; Verification→Task 5. DoD→Final validation.
- **Type/name consistency:** `ScatterRun` (id/instanceCount/seed/createdAt) used by db, route, panel; `recordScatterRun`/`getLatestScatterRun` consistent; `TaskFactory.scatterBiome(moduleId,{density,seed},appOrigin,label)` + `BiomeScatterTask` fields consistent across cli-task, test, `handleScatter`; the script logs exactly `Scattered N instances` (the prompt's read target); callback URL `/api/level-design/scatter-result` consistent across the prompt, route, and panel fetch; `seed` is a callback static field, `instanceCount` the reported result.
- **No placeholders:** full code in every code step.
- **No-collision** enforced (Task 1 step 4) + gated by the VSFunctionalTest re-run (Task 5 step 3).
- **API-name risk** (`BiomeScatterLayer` fields, `DataAssetFactory`, `generate_vegetation`, `get_total_instance_count`, `set_box_extent`, `HierarchicalInstancedStaticMeshComponent`, `NO_COLLISION`) guarded by read-back + the run-and-fix loop in Task 1 step 2 (load-or-create avoids the create-after-delete None gotcha).
- **Process-kill safety:** Task 5 step 2 + step 4 explicitly say kill only my own PID, never `/IM`, and leave the dev server for the user.
- `biome-scatter` excluded from `WIRING_TASK_TYPES` (runs a script).
