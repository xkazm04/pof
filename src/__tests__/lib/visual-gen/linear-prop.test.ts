import { describe, it, expect } from 'vitest';
import {
  LINEAR_PROP_SUBJECTS,
  routeShape,
  sagDepth,
  centerlinePoints,
  polylineLength,
  generateLinearProp,
  toObj,
  type LinearPropConfig,
} from '@/lib/visual-gen/generators/linear-prop';

const CFG: LinearPropConfig = {
  from: { x: 0, y: 3, z: 0 },
  to: { x: 4, y: 3, z: 0 },
  slack: 0,
  radius: 0.03,
  segments: 16,
  sides: 6,
};

describe('shape routing — when generation is the wrong tool', () => {
  it('routes a rope between two anchors to the procedural path', () => {
    const r = routeShape('rope');
    expect(r.route).toBe('procedural');
    expect(r.reason).toBeTruthy();
  });

  it('routes the whole linear-prop family, however it is phrased', () => {
    for (const s of ['cable', 'chain', 'wire', 'a hanging ROPE bridge']) {
      expect(routeShape(s).route).toBe('procedural');
    }
  });

  it('leaves a subject with real shape identity to the generator', () => {
    for (const s of ['dragon skull', 'treasure chest', 'anchor']) {
      expect(routeShape(s).route).toBe('generate');
    }
  });

  it('names the family it recognises so the list is auditable', () => {
    expect(LINEAR_PROP_SUBJECTS.length).toBeGreaterThan(2);
  });
});

describe('centerline', () => {
  it('emits one point per segment boundary', () => {
    expect(centerlinePoints(CFG)).toHaveLength(17);
  });

  it('lands exactly on both anchors', () => {
    const pts = centerlinePoints(CFG);
    expect(pts[0]).toEqual(CFG.from);
    expect(pts[pts.length - 1]).toEqual(CFG.to);
  });

  it('runs straight when there is no slack', () => {
    const pts = centerlinePoints(CFG);
    expect(polylineLength(pts)).toBeCloseTo(4, 6);
    for (const p of pts) expect(p.y).toBeCloseTo(3, 9);
  });

  it('sags DOWNWARD under slack — a rope hangs, it does not bow up', () => {
    const pts = centerlinePoints({ ...CFG, slack: 0.1 });
    const mid = pts[Math.floor(pts.length / 2)];
    expect(mid.y).toBeLessThan(3);
  });

  it('spends the slack it was given as extra length', () => {
    const len = polylineLength(centerlinePoints({ ...CFG, slack: 0.1 }));
    expect(len / 4).toBeGreaterThan(1.05);
    expect(len / 4).toBeLessThan(1.15);
  });

  it('sags further the more slack it is given', () => {
    expect(sagDepth(4, 0.2)).toBeGreaterThan(sagDepth(4, 0.05));
    expect(sagDepth(4, 0)).toBe(0);
  });
});

describe('tube mesh', () => {
  it('emits a ring per centerline point and two triangles per quad', () => {
    const m = generateLinearProp(CFG);
    expect(m.ok).toBe(true);
    expect(m.mesh!.positions).toHaveLength(17 * 6 * 3);
    // 16 quad rings x 6 sides x 2 tris, plus a (sides - 2) fan capping each end.
    expect(m.mesh!.indices).toHaveLength((16 * 6 * 2 + 2 * (6 - 2)) * 3);
  });

  it('centres each ring on the centerline, at the requested radius', () => {
    const m = generateLinearProp(CFG);
    const p = m.mesh!.positions;
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < 6; j++) { cx += p[j * 3]; cy += p[j * 3 + 1]; cz += p[j * 3 + 2]; }
    expect(cx / 6).toBeCloseTo(0, 6);
    expect(cy / 6).toBeCloseTo(3, 6);
    expect(cz / 6).toBeCloseTo(0, 6);
    const d = Math.hypot(p[0] - 0, p[1] - 3, p[2] - 0);
    expect(d).toBeCloseTo(0.03, 6);
  });

  it('indexes only vertices it emitted', () => {
    const m = generateLinearProp(CFG);
    const max = m.mesh!.positions.length / 3;
    for (const i of m.mesh!.indices) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(max);
    }
  });

  it('reports the real-world length so the texel budget can size its map', () => {
    const m = generateLinearProp({ ...CFG, slack: 0.1 });
    expect(m.mesh!.lengthM).toBeGreaterThan(4);
  });

  it('closes both ends, so the tube is watertight for the Tier-1 gate', () => {
    // Every undirected edge of a closed manifold is shared by exactly two triangles.
    // This proves watertightness without leaving the test process.
    const m = generateLinearProp(CFG).mesh!;
    const seen = new Map<string, number>();
    for (let i = 0; i < m.indices.length; i += 3) {
      const t = [m.indices[i], m.indices[i + 1], m.indices[i + 2]];
      for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const k = a < b ? `${a}_${b}` : `${b}_${a}`;
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
    }
    const open = [...seen.values()].filter((n) => n !== 2);
    expect(open).toHaveLength(0);
  });

  it('winds its faces OUTWARD — an inside-out tube renders as a hole', () => {
    // Signed volume of a closed mesh is positive only when the normals face out.
    // trimesh reported -0.037 on the first capped build: watertight, consistently
    // wound, and inverted. No unit assertion above could see it.
    const m = generateLinearProp(CFG).mesh!;
    const at = (i: number) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
    let v6 = 0;
    for (let i = 0; i < m.indices.length; i += 3) {
      const [a, b, c] = [at(m.indices[i]), at(m.indices[i + 1]), at(m.indices[i + 2])];
      v6 += a[0] * (b[1] * c[2] - b[2] * c[1])
          - a[1] * (b[0] * c[2] - b[2] * c[0])
          + a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    expect(v6 / 6).toBeGreaterThan(0);
  });

  it('refuses a degenerate tube instead of emitting broken geometry', () => {
    expect(generateLinearProp({ ...CFG, sides: 2 }).ok).toBe(false);
    expect(generateLinearProp({ ...CFG, segments: 0 }).ok).toBe(false);
    expect(generateLinearProp({ ...CFG, radius: 0 }).ok).toBe(false);
    expect(generateLinearProp({ ...CFG, to: { ...CFG.from } }).ok).toBe(false);
  });

  it('says why it refused', () => {
    expect(generateLinearProp({ ...CFG, sides: 2 }).reason).toMatch(/side/i);
  });
});

describe('OBJ output', () => {
  it('writes every vertex and face', () => {
    const obj = toObj(generateLinearProp(CFG).mesh!);
    expect(obj.split('\n').filter((l) => l.startsWith('v ')).length).toBe(17 * 6);
    expect(obj.split('\n').filter((l) => l.startsWith('f ')).length).toBe(16 * 6 * 2 + 2 * (6 - 2));
  });

  it('uses 1-based indices, as the OBJ format requires', () => {
    const obj = toObj(generateLinearProp(CFG).mesh!);
    const faces = obj.split('\n').filter((l) => l.startsWith('f '));
    const idx = faces.flatMap((l) => l.slice(2).trim().split(/\s+/).map(Number));
    expect(Math.min(...idx)).toBe(1);
    expect(Math.max(...idx)).toBe(17 * 6);
  });
});
