// @vitest-environment node
/** A degenerate-face check that threw is no measurement; it must not print as zero defects. */
import { describe, it, expect } from 'vitest';
import { parseCritiqueMetrics } from '@/lib/visual-gen/mesh-critique';
import { pythonAvailable, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';
import { drive, pyStr } from '@/__tests__/scripts/visualGenQualityDriver';

const SCRIPT = scriptPath('pof_mesh_critique.py');

function critique(nondegenerate: string) {
  return drive([
    'fake("numpy")',
    'class Summed:',
    '    def sum(self): return 3',
    'class Mask:',
    '    def __invert__(self): return Summed()',
    'class Mesh:',
    '    vertices = [0] * 8; faces = [0] * 12; is_watertight = True; is_winding_consistent = True',
    '    face_adjacency = []; euler_number = 2; extents = [1.0, 1.0, 1.0]; volume = 1.0; area = 6.0',
    '    def nondegenerate_faces(self):',
    `        ${nondegenerate}`,
    'graph = types.SimpleNamespace(connected_components=lambda adj, min_len=1: [list(range(12))])',
    'fake("trimesh", load=lambda p, force=None: Mesh(), graph=graph)',
    `run(${pyStr(SCRIPT)}, ["--mesh", "x.glb"])`,
  ].join('\n'));
}

describe.skipIf(!pythonAvailable)('pof_mesh_critique degenerate faces', () => {
  it('a check that threw does not read as a clean mesh', () => {
    const r = critique('raise RuntimeError("no such api")');
    expect(r.stdout).not.toContain('POF_CRITIQUE_DEGENERATE_FACES=0');
    const parsed = parseCritiqueMetrics(r.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain('DEGENERATE_FACES');
  });

  it('a check that ran reports its count', () => {
    const r = critique('return Mask()');
    expect(r.stdout).toContain('POF_CRITIQUE_DEGENERATE_FACES=3');
    expect(parseCritiqueMetrics(r.stdout).metrics?.degenerateFaces).toBe(3);
  });
});
