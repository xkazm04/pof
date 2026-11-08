// @vitest-environment node
/** The filmstrip writes one file per tile whatever the strip path's extension looks like. */
import { describe, it, expect } from 'vitest';
import { BLENDER_FAKES, pythonAvailable, runPy, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';

function tiles(stripPath: string): string[] {
  const body = [
    'paths = []',
    'bpy.ops.render.render.side_effect = lambda **k: paths.append(bpy.context.scene.render.filepath)',
    'class B(list):',
    '    def __getitem__(self, k): return m.MagicMock()',
    'bpy.context.scene.frame_start = 1; bpy.context.scene.frame_end = 12',
    `load(${JSON.stringify(scriptPath('ardy/pof_bvh_blender.py'))}, ["in.bvh", "out.fbx", ${JSON.stringify(stripPath)}], name="__main__")`,
    'print("PATHS=" + "|".join(paths))',
  ].join('\n');
  const r = runPy(['-c', `${BLENDER_FAKES}${body}`]);
  const line = /PATHS=(.*)/.exec(r.stdout)?.[1].trim() ?? '';
  return line ? line.split('|') : [];
}

describe.skipIf(!pythonAvailable)('pof_bvh_blender filmstrip tiles', () => {
  it.each(['/o/strip.png', '/o/strip.PNG', '/o/strip', '/o/a.png.d/strip'])('%s writes six distinct tile files', (strip) => {
    const t = tiles(strip);
    expect(t).toHaveLength(6);
    expect(new Set(t).size).toBe(6);
  });

  it('keeps the historical name for an ordinary .png path', () => {
    expect(tiles('/o/strip.png')[0]).toBe('/o/strip_0.png');
  });

  it('does not rewrite a .png earlier in a directory name', () => {
    expect(tiles('/o/a.png.d/strip.png')[0]).toBe('/o/a.png.d/strip_0.png');
  });
});
