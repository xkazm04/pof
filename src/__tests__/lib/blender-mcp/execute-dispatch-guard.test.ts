/**
 * Script History is only a record if EVERY dispatch is recorded.
 *
 * The Blender pipeline module ships a panel presented as the record of what PoF
 * ran in the user's Blender. It is fed by exactly one function — `executeViaMCP`
 * in `lib/blender-mcp/dispatch.ts` — but 13 call sites fetched `/api/blender-mcp/execute`
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
const WRAPPER = ['lib/blender-mcp/dispatch.ts'];

/**
 * Call sites still fetching the route directly. EMPTY: all seven former residuals
 * (material-lab, PostProcessStackBuilder, MaterialPatternCatalog, ProceduralLevelWizard,
 * LevelFlowEditor, state-machine-shared, AIComboChoreographer) dispatch through
 * `executeViaMCP` now. The list only exists so a future, reasoned residual has a place
 * to be named; the stale-entry check below still keeps it honest.
 */
const UNMIGRATED: string[] = [];

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

  it('has no residuals left: every dispatch is recorded in Script History', () => {
    expect(UNMIGRATED).toHaveLength(0);
    expect(dispatchers).toEqual(WRAPPER);
  });

  it('no non-UI module imports the dispatcher from the ScriptRunner component', () => {
    // executeViaMCP lives in lib/blender-mcp/dispatch.ts; ScriptRunner.tsx only re-exports it.
    const viaComponent = walk(SRC)
      .filter((f) => /import[^;]*executeViaMCP[^;]*from\s+['"]@\/components\/modules\/visual-gen\/blender-pipeline\/ScriptRunner['"]/.test(fs.readFileSync(f, 'utf-8')))
      .map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    expect(viaComponent).toEqual([]);
  });

  it('Auto-Rig dispatches through executeViaMCP — its armature is recorded and its receipt read', () => {
    const autoRig = 'components/modules/visual-gen/auto-rig/AutoRigView/index.tsx';
    expect(dispatchers).not.toContain(autoRig);
    expect(fs.readFileSync(path.join(SRC, autoRig), 'utf-8')).toMatch(/executeViaMCP\(/);
  });

  it('the Scene Composer no longer dispatches raw — it was the worst offender', () => {
    // Its delete/duplicate discarded the Result entirely, and its export
    // claimed success from a bare transport OK.
    expect(
      dispatchers.filter((f) => f.includes('scene-composer')),
    ).toEqual([]);
  });
});
