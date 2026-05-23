---
date: 2026-05-23
status: draft
sub_project: Environment — UV-strategy dropdown (improvements folder 05, pof-app §1)
parent_initiative: PoF ARPG vertical slice — improvements synthesis
predecessor_docs:
  - docs/improvements/05-environment/pof-app.md   # §1 UV strategy is a checklist choice
  - docs/improvements/05-environment/tests.md      # PoF-app "UV-strategy prompt test"
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-arena-polish.md  # uv-projection.ts
---

# Environment — UV-Strategy Dropdown (PoF App)

## Context

Folder-05's game-side work (sessions 1-3) is done. This is the first PoF-app
UI-surfacing piece (pof-app §1). The `level-design` module's
`ProceduralLevelWizard` can export grid geometry to Blender
(`handleExportToBlender`, ProceduralLevelWizard.tsx:187-241) via
`dungeonToGeometryScript` + `/api/blender-mcp/execute` — but the exported
geometry gets **no UV unwrap**, so any texture applied later tiles by Blender's
default. Session 1 built a reusable world-aligned-UV emitter
(`src/lib/blender-mcp/scripts/uv-projection.ts`, `worldAlignedUvScript`).

This session surfaces the UV strategy as an operator choice: a dropdown that
makes the export script unwrap with cube / smart / world-aligned UVs.

## Goals

1. The operator picks a UV strategy (cube / smart / world-aligned) in the
   level-design UI; the Blender export script unwraps accordingly.
2. World-aligned (the no-grid strategy from session 1) is the default.
3. A reusable emitter so future exporters (the later §4 driver panel) can
   reuse the same strategy logic.

## Non-goals

- No procedural-dungeon driver panel, no biome editor (later §4 sessions).
- No UE round-trip — this only changes the Blender export script.
- No change to `dungeon-to-geometry.ts` (geometry stays decoupled from UVs).
- No new shared `UVStrategySelect` component yet (YAGNI — inline in the wizard;
  extract when the §4 driver panel needs it).

## Decision record (from brainstorming)

1. **Scope = the UV-strategy dropdown only** (chosen over the driver panel and
   biome editor as the small, self-contained first UI piece).
2. **Approach A** — a `uvStrategyScript` emitter wrapping the existing
   `worldAlignedUvScript`, a dropdown in `ProceduralLevelWizard`'s export
   section, wired into `handleExportToBlender`. (Over B: param inside
   `dungeon-to-geometry.ts` — rejected, couples geometry+UV; over C: extract a
   shared component now — YAGNI.)

## Design

### Part 1 — `uvStrategyScript` emitter

Create `src/lib/blender-mcp/scripts/uv-strategy.ts`:

```ts
import { worldAlignedUvScript } from '@/lib/blender-mcp/scripts/uv-projection';

export type UVStrategy = 'cube' | 'smart' | 'world-aligned';

/** Emit Blender Python that UV-unwraps all mesh objects with the chosen strategy. */
export function uvStrategyScript(
  strategy: UVStrategy,
  params: { tileMeters?: number } = {},
): string { ... }
```

- `world-aligned` → `return worldAlignedUvScript({ tileMeters: params.tileMeters ?? 4 })`
  (already loops every mesh; produces the uniform no-grid projection).
- `cube` → a loop over `bpy.data.objects` (mesh only) doing edit-mode
  `bpy.ops.uv.cube_project(cube_size=<tileMeters ?? 2>)`.
- `smart` → the same loop with
  `bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)`.
- Each variant ends with `print("UV strategy applied: <strategy>")`.

### Part 2 — Dropdown in `ProceduralLevelWizard`

- New state: `const [uvStrategy, setUvStrategy] = useState<UVStrategy>('world-aligned')`.
- A small labeled control in the export area (near the "Export to Blender"
  button), styled to the existing violet/mono aesthetic — a native `<select>`
  with the 3 options + a one-line helper describing the active choice
  (cube = fast, expect a tiling grid; smart = per-face, fewer repeats, more
  seams; world-aligned = uniform real-world scale, no grid).

### Part 3 — Wire the export

In `handleExportToBlender`, after building `combinedCode`
(geometry + metadata), append the UV step:

```ts
const combinedCode = geometryCode + '\n\n' + metadataCode
  + '\n\n' + uvStrategyScript(uvStrategy);
```

`handleExportToBlender`'s `useCallback` deps gain `uvStrategy`.

## Verification (of this session)

- **vitest** `src/__tests__/lib/blender-mcp/uv-strategy.test.ts` — the
  emitter's three variants emit the right Blender op + divisor:
  `cube` → `cube_project`, `smart` → `smart_project`, `world-aligned` →
  `co.x, co.y` / `/ TILE` (delegated). This *is* tests.md's "UV-strategy
  prompt test" (asserts three valid Blender-script variants).
- `npm run typecheck` clean (filter the pre-existing `leonardo.ts` error);
  `npm run lint` 0 errors on the touched files.
- **Dev server** — the dropdown renders in the Procgen tab, changes state,
  and (if Blender is connected) the export appends the chosen UV step. If the
  UI can't be driven, say so rather than claim it.

## Cross-cutting

- App repo only (`xkazm04/pof`); commit local, do NOT push.
- Follow conventions: `@/` imports, `logger` not console, no hardcoded hex
  (use `chart-colors`), `UI_TIMEOUTS` for any timing. The dropdown reuses the
  module's existing color tokens.

## Definition of done

1. `uv-strategy.ts` emitter (3 variants, world-aligned delegates to
   `worldAlignedUvScript`).
2. `ProceduralLevelWizard` has a UV-strategy dropdown (default world-aligned),
   wired into the Blender export.
3. `uv-strategy.test.ts` green (3 variants); typecheck + lint clean; full
   `npm run test` green (no regression).
4. Findings doc; committed (app repo, local).

**Success criterion:** an operator can choose cube / smart / world-aligned in
the level-design UI and the Blender export script unwraps accordingly, with
world-aligned (no-grid) the default — closing pof-app §1 and its test.

## Risks & mitigations

- **Wrong Blender op args** (`smart_project` / `cube_project` param names vary
  by Blender version). Mitigation: session-1's `build_arena.py` already uses
  `cube_project(cube_size=...)` and `smart_project(angle_limit=, island_margin=)`
  successfully on Blender 4.2 — reuse those exact signatures.
- **Dropdown styling clutter** — keep it a single compact control; reuse the
  module's tokens.
- **No live Blender to end-to-end test the export** — the vitest on the
  emitter is the gate; the dev-server check confirms the UI; an actual Blender
  unwrap is the same code path session 1 proved.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews + approves.
3. `writing-plans` → implementation plan.
4. Execute: emitter (TDD) → dropdown + wire → verify.
