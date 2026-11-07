/**
 * Every script emitter writes numbers into Python through `pyNum`, which throws on
 * NaN / ±Infinity. Emitters that interpolated `${n}` raw shipped `nan` / `Infinity` into
 * the script — not Python literals, so Blender raised a NameError mid-script, after some
 * of the scene had already been changed, and the operator saw a Python traceback instead
 * of the bad input. Half the folder already used `pyNum`; this sweeps the rest.
 */
import { describe, it, expect } from 'vitest';
import { createMaterialScript } from '@/lib/blender-mcp/scripts/create-material';
import { createArmatureScript } from '@/lib/blender-mcp/scripts/create-armature';
import { comboAnimationScript } from '@/lib/blender-mcp/scripts/combo-animation';
import { dungeonToGeometryScript } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { worldAlignedUvScript } from '@/lib/blender-mcp/scripts/uv-projection';
import { dissolveShaderScript } from '@/lib/blender-mcp/scripts/shader-patterns/dissolve';
import { fireShaderScript } from '@/lib/blender-mcp/scripts/shader-patterns/fire';
import { waterShaderScript } from '@/lib/blender-mcp/scripts/shader-patterns/water';

const BAD = [NaN, Infinity, -Infinity];

const EMITTERS: Record<string, (n: number) => string> = {
  'create-material': (n) =>
    createMaterialScript({ name: 'M', baseColor: [n, 0, 0], metallic: 0, roughness: 0.5, normalStrength: 1, aoStrength: 1 }),
  'create-material scalar': (n) =>
    createMaterialScript({ name: 'M', baseColor: [1, 1, 1], metallic: n, roughness: 0.5, normalStrength: 1, aoStrength: 1 }),
  'create-armature': (n) =>
    createArmatureScript({ armatureName: 'R', bones: [{ name: 'B', head: [0, 0, n], tail: [0, 0, 1] }] }),
  'combo-animation': (n) =>
    comboAnimationScript({ comboName: 'C', hits: [{ time: n, type: 'light', damage: 1, rootMotion: 0 }], totalDuration: 1 }),
  'combo-animation duration': (n) => comboAnimationScript({ comboName: 'C', hits: [], totalDuration: n }),
  'dungeon-to-geometry': (n) => dungeonToGeometryScript({ grid: [['floor']], cellSize: n, wallHeight: 3 }),
  'uv-projection': (n) => worldAlignedUvScript({ tileMeters: n }),
  dissolve: (n) => dissolveShaderScript({ threshold: n }),
  'dissolve edge': (n) => dissolveShaderScript({ edgeColor: [n, 0, 0] }),
  fire: (n) => fireShaderScript({ intensity: n }),
  water: (n) => waterShaderScript({ waveScale: n }),
};

describe('script emitters refuse non-finite numbers', () => {
  for (const [id, emit] of Object.entries(EMITTERS)) {
    it(`${id}: throws instead of writing nan/Infinity into Python`, () => {
      for (const n of BAD) expect(() => emit(n)).toThrow(RangeError);
    });
    it(`${id}: a finite value still emits`, () => {
      expect(emit(0.5)).toContain('import bpy');
    });
  }
});
