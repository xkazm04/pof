/**
 * Linear prop frames do not twist between rings.
 *
 * Twist = the roll about the tangent between ring i-1 and ring i once the bend between
 * them is accounted for: ring i-1's vertex-0 radial vector is carried to ring i by the
 * minimal rotation taking tangent i-1 to tangent i, and the angle to ring i's actual
 * vertex-0 radial vector is the twist. A smooth sweep keeps it near zero; a reference
 * axis that switches between adjacent rings makes it jump.
 */
import { describe, it, expect } from 'vitest';
import {
  centerlinePoints,
  generateLinearProp,
  type LinearPropConfig,
  type Vec3,
} from '@/lib/visual-gen/generators/linear-prop';

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

/** Rodrigues: rotate v about unit axis k by the angle with the given cos/sin. */
function rotate(v: Vec3, k: Vec3, c: number, s: number): Vec3 {
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

function maxTwistDeg(cfg: LinearPropConfig): number {
  const r = generateLinearProp(cfg);
  expect(r.ok).toBe(true);
  const { positions, sides } = r.mesh!;
  const pts = centerlinePoints(cfg);
  const tangent = (i: number) =>
    unit(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
  const radial = (i: number) =>
    unit(sub(
      { x: positions[i * sides * 3], y: positions[i * sides * 3 + 1], z: positions[i * sides * 3 + 2] },
      pts[i],
    ));
  let worst = 0;
  for (let i = 1; i < pts.length; i++) {
    const t0 = tangent(i - 1);
    const t1 = tangent(i);
    const axis = cross(t0, t1);
    const sinA = Math.hypot(axis.x, axis.y, axis.z);
    const carried = sinA > 1e-9 ? rotate(radial(i - 1), scale(axis, 1 / sinA), dot(t0, t1), sinA) : radial(i - 1);
    const twist = Math.acos(Math.max(-1, Math.min(1, dot(carried, radial(i)))));
    worst = Math.max(worst, (twist * 180) / Math.PI);
  }
  return worst;
}

describe('generateLinearProp frame continuity', () => {
  it('a steep, high-slack span has no ring-to-ring twist (tangent.y crosses 0.9)', () => {
    const cfg: LinearPropConfig = {
      from: { x: 0, y: 10, z: 0 },
      to: { x: 0.8, y: 0, z: 0.3 },
      slack: 0.4,
      radius: 0.05,
      segments: 64,
      sides: 8,
    };
    const pts = centerlinePoints(cfg);
    const ys = pts.slice(1).map((p, i) => Math.abs(p.y - pts[i].y));
    expect(ys.length).toBeGreaterThan(0);
    expect(maxTwistDeg(cfg)).toBeLessThan(5);
  });

  it('a gentle horizontal span stays untwisted', () => {
    expect(maxTwistDeg({
      from: { x: 0, y: 3, z: 0 }, to: { x: 4, y: 3, z: 0 }, slack: 0.1, radius: 0.03, segments: 16, sides: 6,
    })).toBeLessThan(5);
  });
});
