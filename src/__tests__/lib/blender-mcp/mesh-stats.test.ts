/**
 * Measure before commissioning: the scene's meshes in TRIANGLES, over the one
 * receipt envelope (`POF_RESULT=`, kind 'mesh-stats'), and LOD generation that
 * decimates to triangle targets and prints one 'lod' receipt per level.
 *
 * Tests never run Blender: `printedReceipt` evaluates the script's own
 * pyReceipt line with the values Python would have computed.
 */
import { describe, it, expect } from 'vitest';
import { meshStatsScript, readMeshStats } from '@/lib/blender-mcp/scripts/mesh-stats';
import { generateLodsScript } from '@/lib/blender-mcp/scripts/generate-lods';
import { RECEIPT_MARKER } from '@/lib/blender-mcp/receipt';
import { gradeLodReceipt } from '@/lib/visual-gen/lod-plan';
import { printedReceipt } from './printedReceipt';

const SWORD = { name: 'SM_Sword', tris: 38412, verts: 19530, polys: 19206 };

describe('readMeshStats', () => {
  it('reads the mesh-stats receipt through the envelope, and nothing else confirms', () => {
    const out = `noise\n${printedReceipt(meshStatsScript(), { meshes: [SWORD] })}`;
    expect(readMeshStats(out)).toEqual({ state: 'confirmed', meshes: [SWORD] });
    const none = readMeshStats('Blender printed nothing useful');
    expect(none.state).toBe('unconfirmed');
    expect(none).toHaveProperty('reason');
    // A bespoke marker is not a receipt.
    expect(readMeshStats(`POF_MESHSTATS=${JSON.stringify([SWORD])}`).state).toBe('unconfirmed');
  });

  it('still reads a receipt quote-escaped inside a stringified {executed, result} reply', () => {
    const reply = JSON.stringify({ executed: true, result: printedReceipt(meshStatsScript(), { meshes: [SWORD] }) });
    expect(readMeshStats(reply)).toEqual({ state: 'confirmed', meshes: [SWORD] });
  });
});

describe('meshStatsScript', () => {
  it('counts only MESH objects in triangles, prints one receipt, and changes nothing', () => {
    const code = meshStatsScript();
    expect(code).toMatch(/\.type != 'MESH'|\.type == 'MESH'/);
    expect(code).toMatch(/"tris": len\([^)]*loop_triangles\)/);
    expect(code).not.toMatch(/"tris": len\([^)]*polygons\)/);
    expect(code.split('\n').filter((l) => l.includes(RECEIPT_MARKER))).toHaveLength(1);
    expect(code).toContain('"kind": "mesh-stats"');
    for (const mutation of ['.new(', '.remove(', 'select_set', 'objects.link', 'bpy.ops']) {
      expect(code).not.toContain(mutation);
    }
  });
});

describe('generateLodsScript', () => {
  it('decimates to triangle targets over the measured source and receipts each level', () => {
    const code = generateLodsScript({ objectName: 'SM_Sword', targetTris: [19206, 9603] });
    expect(code).toContain('targets = [19206, 9603]');
    expect(code).toMatch(/mod\.ratio = min\(1\.0, target \/ src_tris\)/);
    expect(code).toMatch(/src_tris = pof_tris\(obj\)/);
    expect(code).toContain('loop_triangles');
    expect(code).not.toMatch(/faces/);
    expect(code).not.toContain('POF_LOD=');
    expect(code.split('\n').filter((l) => l.includes(RECEIPT_MARKER))).toHaveLength(1);
    expect(code).toContain('"kind": "lod"');

    // The one pyReceipt line, as Python prints it per level, is what the grader reads.
    const level = (n: number, target: number, tris: number) =>
      printedReceipt(code, { level: n, 'lod.name': `SM_Sword_LOD${n}`, target, tris, 'len(lod.data.polygons)': Math.round(tris / 2) });
    const out = level(1, 19206, 19800) + level(2, 9603, 9600);
    const grade = gradeLodReceipt(out, [{ level: 1, targetTris: 19206 }, { level: 2, targetTris: 9603 }]);
    expect(grade.levels.map((l) => l.state)).toEqual(['honoured', 'honoured']);
    expect(grade.levels[0]).toMatchObject({ name: 'SM_Sword_LOD1', tris: 19800 });
  });

  it('escapes the object name through py() and still raises on a missing object', () => {
    const code = generateLodsScript({ objectName: 'SM_"Sword', targetTris: [100] });
    expect(code).toContain('bpy.data.objects.get("SM_\\"Sword")');
    expect(code).toMatch(/if not obj or obj\.type != 'MESH':\n\s+raise ValueError/);
    // The receipt is printed after the raise, so a missing object can never print one.
    expect(code.indexOf('raise ValueError')).toBeLessThan(code.indexOf(RECEIPT_MARKER));
  });
});
