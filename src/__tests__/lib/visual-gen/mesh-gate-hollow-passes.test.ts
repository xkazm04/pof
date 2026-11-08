/**
 * Mesh quality gates must not read "nothing was measured" as a clean result. Each block
 * pins one way a gate could pass, or go silent, without a measurement behind it.
 */
import { describe, it, expect } from 'vitest';
import { parseCritiqueMetrics, scoreMesh } from '@/lib/visual-gen/mesh-critique';

describe('parseCritiqueMetrics refuses counts it cannot read', () => {
  const block = (over: Record<string, string>) => {
    const fields: Record<string, string> = {
      VERTS: '5000', FACES: '9000', WATERTIGHT: '1', WINDING_CONSISTENT: '1', COMPONENTS: '1',
      EULER: '2', BBOX: '1,1,1', AREA: '6', DEGENERATE_FACES: '0', DONE: 'ok', ...over,
    };
    return Object.entries(fields).map(([k, v]) => `POF_CRITIQUE_${k}=${v}`).join('\n');
  };

  it('a NaN count would otherwise clear every comparison and score 100', () => {
    const m = { verts: NaN, faces: NaN, watertight: true, windingConsistent: true, components: 1, euler: 2, bbox: [1, 1, 1] as [number, number, number], volume: null, area: 6, degenerateFaces: 0 };
    expect(scoreMesh(m).verdict).toBe('pass'); // the hazard the parser has to stop at the door
  });

  it.each(['VERTS', 'FACES', 'COMPONENTS', 'DEGENERATE_FACES'])('%s=nan is no measurement', (key) => {
    const r = parseCritiqueMetrics(block({ [key]: 'nan' }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain(key);
  });

  it('an unreadable bounding box is no measurement', () => {
    const r = parseCritiqueMetrics(block({ BBOX: 'nan,nan,nan' }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('BBOX');
  });

  it('a finished block with no FACES or COMPONENTS line is no measurement', () => {
    const noFaces = block({}).replace('POF_CRITIQUE_FACES=9000\n', '');
    const noComponents = block({}).replace('POF_CRITIQUE_COMPONENTS=1\n', '');
    expect(parseCritiqueMetrics(noFaces).ok).toBe(false);
    expect(parseCritiqueMetrics(noComponents).ok).toBe(false);
  });

  it('still parses an ordinary block', () => {
    expect(parseCritiqueMetrics(block({})).ok).toBe(true);
  });
});
