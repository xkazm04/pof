/**
 * Script History is only a record if EVERY dispatch is recorded.
 *
 * The Blender pipeline module ships a panel presented as the record of what PoF
 * ran in the user's Blender. It is fed by exactly one function — `executeViaMCP`
 * in `ScriptRunner.tsx` — but 13 call sites fetched `/api/blender-mcp/execute`
 * directly, so after sending a material or creating an armature the panel still
 * read "No scripts have been run yet". Several of those call sites also threw
 * the `Result` away, making a failed script indistinguishable from a good one.
 *
 * This guard pins the dispatch surface: any file that fetches the execute route
 * must be the wrapper, the route itself, or a KNOWN, reasoned residual. A NEW
 * raw fetch fails here. The residual list is only allowed to shrink — an entry
 * that no longer fetches the route must be deleted from it, which is what keeps
 * this file from rotting into a rubber stamp.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../..');
const ROUTE = '/api/blender-mcp/execute';

/** The one dispatcher. */
const WRAPPER = ['components/modules/visual-gen/blender-pipeline/ScriptRunner.tsx'];

/**
 * Call sites still fetching the route directly. Each is OUTSIDE the write set
 * of the lot that introduced this guard (wave 23 / Lot KC owns `blender-mcp`,
 * `scene-composer` and `ScriptRunner`), so migrating them would have meant
 * editing files another parallel session may hold uncommitted work in.
 *
 * Migrating one is mechanical: replace the `tryApiFetch(ROUTE, …)` call with
 * `executeViaMCP('<human script name>', code)` — same `Result`, plus a row in
 * the panel — and delete its line here.
 */
const UNMIGRATED = [
  'components/modules/visual-gen/procedural-engine/useProceduralStore.ts',
  'components/modules/visual-gen/material-lab/useMaterialStore.ts',
  'components/modules/visual-gen/auto-rig/AutoRigView/index.tsx',
  'components/modules/content/materials/PostProcessStackBuilder/index.tsx',
  'components/modules/content/materials/MaterialPatternCatalog/index.tsx',
  'components/modules/content/level-design/ProceduralLevelWizard/useProceduralLevelWizard.ts',
  'components/modules/content/level-design/LevelFlowEditor/useLevelFlowEditor.ts',
  'components/modules/content/animations/shared/state-machine-shared.ts',
  'components/modules/content/animations/AIComboChoreographer/useAIComboChoreographer.ts',
];

/**
 * A DISPATCH is the route string passed to a fetch call — `fetch(`,
 * `apiFetch(`, `tryApiFetch<T>(`. Merely naming the route in a comment or in a
 * feature description is not one, and this must stay quote-style agnostic so a
 * new call site cannot slip through by using a template literal.
 */
function dispatchesExecute(source: string): boolean {
  let at = source.indexOf(ROUTE);
  while (at !== -1) {
    const lead = source.slice(Math.max(0, at - 60), at);
    if (/etch\s*(<[^<>]*>)?\s*\(\s*['"`]?$/.test(lead)) return true;
    at = source.indexOf(ROUTE, at + 1);
  }
  return false;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const dispatchers = walk(SRC)
  .filter((f) => dispatchesExecute(fs.readFileSync(f, 'utf-8')))
  .map((f) => path.relative(SRC, f).split(path.sep).join('/'))
  .sort();

describe('every /api/blender-mcp/execute dispatch goes through executeViaMCP', () => {
  it('has no dispatcher outside the wrapper and the known residuals', () => {
    const allowed = new Set([...WRAPPER, ...UNMIGRATED]);
    const rogue = dispatchers.filter((f) => !allowed.has(f));
    expect(
      rogue,
      'New raw fetch of /api/blender-mcp/execute — dispatch through ' +
        "executeViaMCP('<name>', code) instead so the script is recorded and " +
        'its failure is surfaced',
    ).toEqual([]);
  });

  it('keeps the residual list honest — every entry still fetches the route', () => {
    const stale = UNMIGRATED.filter((f) => !dispatchers.includes(f));
    expect(
      stale,
      'These no longer fetch the execute route; delete them from UNMIGRATED',
    ).toEqual([]);
  });

  it('the Scene Composer no longer dispatches raw — it was the worst offender', () => {
    // Its delete/duplicate discarded the Result entirely, and its export
    // claimed success from a bare transport OK.
    expect(
      dispatchers.filter((f) => f.includes('scene-composer')),
    ).toEqual([]);
  });
});
