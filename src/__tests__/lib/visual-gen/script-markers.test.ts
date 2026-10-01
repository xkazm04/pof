/**
 * The POF_<P>_* stdout-marker contract of the locally SPAWNED generator / mesh scripts is
 * declared once (`SCRIPT_MARKERS`) and pinned to the script sources in both directions.
 *
 * Before this, both sides were maintained by hand: 11 keys the scripts print had no
 * reader, the worst being `BAKE_<MAP>_ERROR` — the one report of a failed bake — so a run
 * whose AO bake threw came back ok with the AO path simply absent, indistinguishable from
 * "AO never requested". (Distinct from the Blender-MCP `POF_RESULT=` receipt envelope in
 * `src/lib/blender-mcp/receipt.ts`, which covers code sent to a LIVE Blender.)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { SCRIPT_MARKERS, readMarkerBlock, type ScriptId, type ScriptMarkerContract } from '@/lib/visual-gen/script-markers';
import { parseMeshFinishOutput } from '@/lib/visual-gen/mesh-finish';
import { parseTrellisOutput } from '@/lib/visual-gen/trellis-runner';
import { parseTriposrOutput } from '@/lib/visual-gen/triposr-runner';

const SCRIPT_DIR = join(process.cwd(), 'scripts', 'visual-gen');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** `%s` / `%d` / `{map}` / `{n}` all mean "a slot" — compare shapes, not spellings. */
const slot = (k: string) => k.replace(/%[sd]|\{[^}]*\}/g, '{}');

/** Every marker key a script's SOURCE can print, as slot-normalised shapes. */
function emittedKeys(src: string, prefix: string): Set<string> {
  const keys = new Set<string>();
  // print("POF_X_KEY=" + v) / print(f"POF_X_KEY={v}") / print("POF_X_%d=..." % i).
  // Anchored on the opening quote so a docstring mention is not a print.
  const printed = new RegExp(`(?:\\bf)?["']${escapeRe(prefix)}([A-Za-z0-9_%{}]+?)=`, 'g');
  for (const line of src.split(/\r?\n/)) {
    if (/%\s*\(key,\s*value\)/.test(line)) continue; // the marker() helper itself
    for (const m of line.matchAll(printed)) keys.add(slot(m[1]));
  }
  // marker("KEY", v) / marker(\n "KEY", v) / marker("A" if c else "B", v) / marker("BAKE_%s" % k, v)
  const called = /\bmarker\(\s*"([^"]+)"(?:\s+if\s+[^"]+?\s+else\s+"([^"]+)")?/g;
  for (const m of src.matchAll(called)) {
    keys.add(slot(m[1]));
    if (m[2]) keys.add(slot(m[2]));
  }
  return keys;
}

describe('SCRIPT_MARKERS — declared vocabulary equals what each script prints', () => {
  const ids = Object.keys(SCRIPT_MARKERS) as ScriptId[];

  it('declares the six locally spawned scripts', () => {
    expect(ids.map((id) => SCRIPT_MARKERS[id].script).sort()).toEqual([
      'pof_hunyuan.py', 'pof_mesh_finish.py', 'pof_mesh_split.py',
      'pof_mesh_views.py', 'pof_trellis.py', 'pof_triposr.py',
    ]);
  });

  it.each(ids)('%s: printed keys == declared keys, both directions', (id) => {
    const c: ScriptMarkerContract = SCRIPT_MARKERS[id];
    const src = readFileSync(join(SCRIPT_DIR, c.script), 'utf8');
    // A script printing through a marker() helper must print the declared prefix there.
    if (/\bdef marker\(/.test(src)) expect(src).toContain(`"${c.prefix}%s=`);
    const emitted = emittedKeys(src, c.prefix);
    const declared = new Set([...Object.keys(c.keys), ...Object.keys(c.templates ?? {})].map(slot));
    const printedButUndeclared = [...emitted].filter((k) => !declared.has(k)).sort();
    const declaredButNeverPrinted = [...declared].filter((k) => !emitted.has(k)).sort();
    expect({ printedButUndeclared, declaredButNeverPrinted }).toEqual({
      printedButUndeclared: [], declaredButNeverPrinted: [],
    });
  });
});

describe('readMarkerBlock', () => {
  it('surfaces a key the declaration does not know instead of dropping it', () => {
    const b = readMarkerBlock('trellis', 'POF_T2_NEWTHING=1\nPOF_T2_DONE=/o/m.glb');
    expect(b.undeclared).toEqual(['NEWTHING']);
    expect(b.get('DONE')).toBe('/o/m.glb');
  });

  it('reads markers only at line start', () => {
    const b = readMarkerBlock('trellis', 'xPOF_T2_DONE=/y');
    expect(b.get('DONE')).toBeUndefined();
    expect(b.undeclared).toEqual([]);
  });

  it('refuses a reader for a key the script does not declare', () => {
    const b = readMarkerBlock('trellis', 'POF_T2_DONE=/o/m.glb');
    expect(() => b.get('NOT_A_KEY')).toThrow(/not declared/);
  });
});

describe('parsers project the declared block', () => {
  it('mesh-finish: a failed bake is data on the result, not a silently missing map', () => {
    const p = parseMeshFinishOutput(
      'POF_MESHFINISH_BAKE_NORMAL=/o/x_normal.png\nPOF_MESHFINISH_BAKE_AO_ERROR=Circular dependency for image\nPOF_MESHFINISH_DONE=/o/x.glb',
    );
    expect(p.normalMapPath).toBe('/o/x_normal.png');
    expect(p.aoMapPath).toBeUndefined();
    expect(p.bakeFailed).toEqual([{ map: 'ao', reason: 'Circular dependency for image' }]);
  });

  it('trellis: a failed preview names itself and every diagnostic key is kept', () => {
    const p = parseTrellisOutput(
      'POF_T2_PREVIEW_PBR_ERROR=RuntimeError(nvdiffrast)\nPOF_T2_PREVIEW_ERROR=ImportError(pyglet)\nPOF_T2_DONE=/o/m.glb',
    );
    expect(p.ok).toBe(true);
    expect(p.previewPath).toBeUndefined();
    expect(p.previewError).toContain('pyglet');
    expect(Object.keys(p.diagnostics ?? {})).toEqual(expect.arrayContaining(['PREVIEW_PBR_ERROR', 'PREVIEW_ERROR']));
  });

  it('triposr: a failed CLIP fidelity pass names itself instead of reading as "not requested"', () => {
    const p = parseTriposrOutput('POF_TRIPOSR_CLIP_ERROR=OSError(clip)\nPOF_TRIPOSR_DONE=/o/m.glb');
    expect(p.fidelityError).toContain('OSError');
    expect(p.clipMax).toBeUndefined();
  });
});
