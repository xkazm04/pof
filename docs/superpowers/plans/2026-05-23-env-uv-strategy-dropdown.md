# UV-Strategy Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the operator pick a UV-unwrap strategy (cube / smart / world-aligned) in the level-design module so the Blender geometry export unwraps accordingly, defaulting to world-aligned (no grid).

**Architecture:** A reusable `uvStrategyScript(strategy)` emitter wraps session-1's `worldAlignedUvScript` and emits cube/smart loops; `ProceduralLevelWizard` gains a dropdown (state `uvStrategy`) and appends the chosen UV step to the Blender export script in `handleExportToBlender`.

**Tech Stack:** TypeScript, React 19 (Next.js 16), vitest, the existing `src/lib/blender-mcp/scripts/` emitter pattern.

**Spec:** `docs/superpowers/specs/2026-05-23-env-uv-strategy-dropdown-design.md`

---

## Established facts (verified)

- `src/lib/blender-mcp/scripts/uv-projection.ts` exports
  `worldAlignedUvScript({ tileMeters, objectNames? })` — already loops every
  mesh and emits `co.x, co.y` / `/ TILE`. (Session 1; has a passing test.)
- `ProceduralLevelWizard.tsx`: imports at the top (lines 1-17); state block
  (lines 155-168); `handleExportToBlender` (lines 187-241) builds
  `combinedCode = geometryCode + '\n\n' + metadataCode` (line 223) then POSTs
  to `/api/blender-mcp/execute`; its `useCallback` deps are `[size, constraints]`
  (line 241); the "Export to Blender" button JSX is at lines 478-503.
- Blender 4.2 op signatures proven in `build_arena.py`:
  `bpy.ops.uv.cube_project(cube_size=2.0)`,
  `bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)`.
- Conventions: `@/` imports; no hardcoded hex (use `@/lib/chart-colors` tokens
  already imported in the wizard); `logger` not console. App repo only —
  commit local, do NOT push (`xkazm04/pof`).
- Pre-existing `src/lib/leonardo.ts:208` typecheck error is unrelated — filter
  it when checking typecheck.

---

## File Structure

- Create: `src/lib/blender-mcp/scripts/uv-strategy.ts` — `UVStrategy` type + `uvStrategyScript` emitter.
- Create: `src/__tests__/lib/blender-mcp/uv-strategy.test.ts` — vitest (the tests.md "UV-strategy prompt test").
- Modify: `src/components/modules/content/level-design/ProceduralLevelWizard.tsx` — import, `uvStrategy` state, dropdown JSX, wire into `handleExportToBlender`.

---

## Task 1: The `uvStrategyScript` emitter (TDD)

**Files:**
- Create: `src/lib/blender-mcp/scripts/uv-strategy.ts`
- Test: `src/__tests__/lib/blender-mcp/uv-strategy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/blender-mcp/uv-strategy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { uvStrategyScript } from '@/lib/blender-mcp/scripts/uv-strategy';

describe('uvStrategyScript', () => {
  it('cube strategy emits cube_project with the tile size', () => {
    const s = uvStrategyScript('cube', { tileMeters: 2 });
    expect(s).toContain('bpy.ops.uv.cube_project(cube_size=2)');
    expect(s).toContain("obj.type == 'MESH'");
    expect(s).toContain('UV strategy applied: cube');
  });

  it('smart strategy emits smart_project', () => {
    const s = uvStrategyScript('smart');
    expect(s).toContain('bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)');
    expect(s).toContain("obj.type == 'MESH'");
    expect(s).toContain('UV strategy applied: smart');
  });

  it('world-aligned delegates to worldAlignedUvScript (world-space projection)', () => {
    const s = uvStrategyScript('world-aligned', { tileMeters: 4 });
    expect(s).toContain('TILE = 4');
    expect(s).toContain('co.x, co.y');
    expect(s).toContain('/ TILE');
  });

  it('defaults the tile size per strategy when omitted', () => {
    expect(uvStrategyScript('cube')).toContain('cube_size=2');
    expect(uvStrategyScript('world-aligned')).toContain('TILE = 4');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/lib/blender-mcp/uv-strategy.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/blender-mcp/scripts/uv-strategy"`.

- [ ] **Step 3: Write the emitter**

Create `src/lib/blender-mcp/scripts/uv-strategy.ts`:

```typescript
import { worldAlignedUvScript } from '@/lib/blender-mcp/scripts/uv-projection';

export type UVStrategy = 'cube' | 'smart' | 'world-aligned';

/**
 * Emit Blender Python that UV-unwraps every mesh object with the chosen
 * strategy:
 * - `cube` — fast cube projection; expect a repeating tiling grid.
 * - `smart` — per-face smart unwrap; fewer repeats, more seams.
 * - `world-aligned` — world-space planar projection (one repeat per
 *   `tileMeters`); uniform real-world scale, no grid. Delegates to
 *   `worldAlignedUvScript`.
 */
export function uvStrategyScript(
  strategy: UVStrategy,
  params: { tileMeters?: number } = {},
): string {
  if (strategy === 'world-aligned') {
    return worldAlignedUvScript({ tileMeters: params.tileMeters ?? 4 });
  }

  const op =
    strategy === 'smart'
      ? 'bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)'
      : `bpy.ops.uv.cube_project(cube_size=${params.tileMeters ?? 2})`;

  return `
import bpy

for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    ${op}
    bpy.ops.object.mode_set(mode='OBJECT')

print("UV strategy applied: ${strategy}")
`.trim();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/lib/blender-mcp/uv-strategy.test.ts`
Expected: PASS — 4 passed.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS" || echo OK`
Expected: `OK`.

- [ ] **Step 6: Commit (app repo — local only, do NOT push)**

```bash
git add src/lib/blender-mcp/scripts/uv-strategy.ts src/__tests__/lib/blender-mcp/uv-strategy.test.ts
git commit -m "feat(blender-mcp): uvStrategyScript emitter (cube/smart/world-aligned)

Reusable UV-unwrap emitter; world-aligned delegates to worldAlignedUvScript,
cube/smart emit a per-mesh edit-mode unwrap loop. The non-grid world-aligned
strategy is the intended default for level/arena export.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Dropdown in `ProceduralLevelWizard` + wire the export

**Files:**
- Modify: `src/components/modules/content/level-design/ProceduralLevelWizard.tsx`

- [ ] **Step 1: Import the emitter + type**

Find the import block (the `dungeon-to-geometry` imports near line 13):

```typescript
import { dungeonToGeometryScript } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
```

Add after it:

```typescript
import { uvStrategyScript } from '@/lib/blender-mcp/scripts/uv-strategy';
import type { UVStrategy } from '@/lib/blender-mcp/scripts/uv-strategy';
```

- [ ] **Step 2: Add the `uvStrategy` state**

Find the export-related state (line 166-168):

```typescript
  const [blenderExporting, setBlenderExporting] = useState(false);
  const [blenderResult, setBlenderResult] = useState<{ message: string; isError: boolean } | null>(null);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);
```

Add the strategy state after `blenderResult`:

```typescript
  const [blenderExporting, setBlenderExporting] = useState(false);
  const [blenderResult, setBlenderResult] = useState<{ message: string; isError: boolean } | null>(null);
  const [uvStrategy, setUvStrategy] = useState<UVStrategy>('world-aligned');
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);
```

- [ ] **Step 3: Append the UV step in `handleExportToBlender`**

Find (line 223):

```typescript
      const metadataCode = levelMetadataScript({ spawnPoints });
      const combinedCode = geometryCode + '\n\n' + metadataCode;
```

Replace with (append the chosen UV step):

```typescript
      const metadataCode = levelMetadataScript({ spawnPoints });
      const combinedCode =
        geometryCode + '\n\n' + metadataCode + '\n\n' + uvStrategyScript(uvStrategy);
```

Then find the `useCallback` dependency array at the end of `handleExportToBlender` (line 241):

```typescript
  }, [size, constraints]);
```

Replace with:

```typescript
  }, [size, constraints, uvStrategy]);
```

- [ ] **Step 4: Add the dropdown JSX above the Export-to-Blender button**

Find the start of the "Export to Blender" button (line 478-481):

```tsx
        {/* Export to Blender */}
        <button
          onClick={handleExportToBlender}
          disabled={!blenderConnected || blenderExporting}
```

Insert the UV-strategy control immediately before the `{/* Export to Blender */}` comment:

```tsx
        {/* UV strategy (applied to the exported geometry) */}
        <div className="mt-3 space-y-1.5">
          <label className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-widest">
            UV Strategy
          </label>
          <select
            value={uvStrategy}
            onChange={(e) => setUvStrategy(e.target.value as UVStrategy)}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-[#0a0a19] border border-violet-900/50 text-violet-100 outline-none focus:border-violet-500/70"
          >
            <option value="world-aligned">World-aligned (uniform scale, no grid)</option>
            <option value="smart">Smart project (per-face, fewer repeats)</option>
            <option value="cube">Cube project (fast, expect tiling grid)</option>
          </select>
          <p className="text-[10px] text-violet-400/50 leading-snug">
            {uvStrategy === 'world-aligned'
              ? 'World-space projection: textures tile by world distance, no per-face seams.'
              : uvStrategy === 'smart'
              ? 'Per-face unwrap: less obvious tiling, more seams.'
              : 'Cube projection: fastest, but textures read as a repeating grid.'}
          </p>
        </div>

        {/* Export to Blender */}
        <button
          onClick={handleExportToBlender}
          disabled={!blenderConnected || blenderExporting}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS" || echo OK`
Expected: `OK`.
Run: `npx eslint src/components/modules/content/level-design/ProceduralLevelWizard.tsx`
Expected: `0 errors` (no hardcoded-hex warnings on the new lines — the `select`/`div` use existing violet utility classes + the `#0a0a19`/`#03030a`-style classes already used throughout this file via `className`, not inline hex props that the lint rule targets).

(Note: this file already uses `bg-[#03030a]` Tailwind arbitrary values in className strings; the `no-restricted-syntax` hex rule targets JS string/property hex values, not Tailwind classes — confirm the eslint run is clean; if a class triggers it, switch to a token from `@/lib/chart-colors` or an existing utility.)

- [ ] **Step 6: Commit (app repo — local only, do NOT push)**

```bash
git add src/components/modules/content/level-design/ProceduralLevelWizard.tsx
git commit -m "feat(level-design): UV-strategy dropdown wired to the Blender export

A cube/smart/world-aligned dropdown (default world-aligned) in the procedural
wizard's export section; handleExportToBlender appends the chosen UV step to
the exported geometry script.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Verify (suite + dev server)

**Files:** findings doc.

- [ ] **Step 1: Full test suite**

Run: `npm run test 2>&1 | tail -6`
Expected: all test files pass (incl. the new `uv-strategy.test.ts`), no regression.

- [ ] **Step 2: Dev-server UI check**

Start the dev server (`npm run dev`), open the app, navigate to the
**Level Design** module → **Procgen** tab, and confirm the **UV Strategy**
dropdown renders with the 3 options, defaults to "World-aligned", and the
helper text changes when you switch options. (The "Export to Blender" button
is disabled unless Blender MCP is connected — that's expected; the dropdown
state + helper text are what to verify here.) If the UI can't be driven in
this environment, say so explicitly rather than claiming it works.

- [ ] **Step 3: Write the findings doc**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-uv-strategy-dropdown.md`:
the emitter (3 variants + defaults), the dropdown wiring, the test result, and
the dev-server check outcome. Note that this closes pof-app §1 + the tests.md
UV-strategy test, and that the §4 driver panel / biome editor remain.

- [ ] **Step 4: Commit the findings (app repo — local only)**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-uv-strategy-dropdown.md docs/superpowers/plans/2026-05-23-env-uv-strategy-dropdown.md
git commit -m "docs(env): UV-strategy dropdown findings (folder-05 pof-app §1)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final validation

- [ ] **Confirm the definition of done:** (1) `uv-strategy.ts` emitter with 3
  variants (world-aligned delegates); (2) the dropdown exists + is wired into
  the export; (3) `uv-strategy.test.ts` green + typecheck/lint clean + full
  suite green; (4) findings committed. Any unchecked item: return to its task.

---

## Self-review notes (addressed during writing)

- **Spec coverage:** Part 1 (emitter) → Task 1; Part 2 (dropdown) → Task 2 Steps
  2,4; Part 3 (wire export) → Task 2 Step 3; Verification (vitest = the tests.md
  UV-strategy test, typecheck/lint, dev-server) → Task 1 + Task 3. DoD → Final
  validation.
- **Type/name consistency:** `UVStrategy` type + `uvStrategyScript(strategy,
  {tileMeters?})` defined in Task 1, imported/used identically in Task 2; the
  test asserts `cube_size=2` / `smart_project(...)` / `TILE = 4` matching the
  emitter; `uvStrategy` state default `'world-aligned'` consistent across Steps
  2-4.
- **No placeholders:** every step has full code/commands.
- **Lint caveat** flagged in Task 2 Step 5 (Tailwind arbitrary-value classes vs
  the no-hex rule) with a fallback.
- **Reuse:** world-aligned delegates to the existing tested `worldAlignedUvScript`
  (DRY); cube/smart use the Blender 4.2 signatures proven in `build_arena.py`.
