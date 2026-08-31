/**
 * Linear props — rope, cable, chain, wire — generated procedurally instead of bought
 * from a 3D generator.
 *
 * The pro workflow states the rule plainly: *"Instead of going and generating the rope
 * alone, I just created the primitive curve … that will be five times faster than doing
 * that with AI"* (Stefan 3D AI, `wknRD5g-vvk` [27:21]). The deeper advice is about which
 * question to ask a tool — *"don't only ask it to do some stuff, ask what is the fastest
 * way to approach this"*.
 *
 * PoF's shape of that failure is worse than slow. A rope has **no shape identity to
 * recover**: it is fully determined by its two anchors, its slack and its radius. Sending
 * it to an image→3D generator spends a credit, returns a mesh normalised to a ~1 m box
 * that does not reach either anchor, and lands in `mesh-critique` as a floater-ridden
 * blob no amount of retopology can fix. The numbers ARE the asset, so generating one is
 * strictly worse than computing it.
 *
 * `routeShape` is the decision; the generator is the alternative it routes to, so the
 * refusal is never a dead end. Output is plain vertex/index data (the `generators/`
 * convention — `terrain.ts` emits a heightmap, `vegetation.ts` emits scatter points),
 * plus an OBJ serialiser so the result can reach Blender or UE without a provider.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LinearPropConfig {
  /** Anchor the prop starts at, in metres (glTF axes, +Y up). */
  from: Vec3;
  /** Anchor it ends at. */
  to: Vec3;
  /** Extra length beyond the straight line, as a fraction. 0 is taut. */
  slack: number;
  /** Tube radius in metres. */
  radius: number;
  /** Divisions along the length. */
  segments: number;
  /** Divisions around the circumference. */
  sides: number;
}

/** Subjects whose geometry is fully determined by their anchors — never worth generating. */
export const LINEAR_PROP_SUBJECTS = ['rope', 'cable', 'chain', 'wire', 'cord', 'string'] as const;

export interface ShapeRoute {
  route: 'procedural' | 'generate';
  reason: string;
}

/**
 * Which tool a subject belongs to. Pure — a naming decision, made before a credit is
 * spent rather than after a bad mesh comes back.
 */
export function routeShape(subject: string): ShapeRoute {
  const s = (subject ?? '').toLowerCase();
  const hit = LINEAR_PROP_SUBJECTS.find((k) => new RegExp(`\\b${k}s?\\b`).test(s));
  if (hit) {
    return {
      route: 'procedural',
      reason:
        `a ${hit} has no shape identity to recover — its geometry is its two anchors, its ` +
        'slack and its radius, so generating one spends a credit to get back a ~1 m blob ' +
        'that reaches neither anchor. Compute it with generateLinearProp instead',
    };
  }
  return { route: 'generate', reason: 'the subject has shape identity a generator has to supply' };
}

const dist = (a: Vec3, b: Vec3): number => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

/**
 * How far the middle hangs below the chord, for a given chord length and slack.
 *
 * A parabolic sag, not a true catenary: for a parabola of sag `h` over chord `L` the arc
 * length is `L(1 + 8h²/3L²)`, which inverts in closed form. Over the slack a game prop
 * uses the two curves differ by well under a percent, and the parabola needs no root
 * find — but it IS an approximation, and is named one rather than sold as a catenary.
 */
export function sagDepth(chordLength: number, slack: number): number {
  if (!(chordLength > 0) || !(slack > 0)) return 0;
  return chordLength * Math.sqrt((3 * slack) / 8);
}

/** Total length of a polyline, in metres. Pure. */
export function polylineLength(points: Vec3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/**
 * The prop's centerline: `segments + 1` points from anchor to anchor, sagging under
 * gravity (−Y) by {@link sagDepth}. Both endpoints are exact, so the prop actually meets
 * what it connects — the property a generated mesh cannot offer.
 */
export function centerlinePoints(config: LinearPropConfig): Vec3[] {
  const { from, to, segments } = config;
  const chord = dist(from, to);
  const h = sagDepth(chord, config.slack);
  const pts: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // 4t(1−t) is the unit parabola: 0 at both anchors, 1 at the middle.
    const sag = h * 4 * t * (1 - t);
    pts.push({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t - sag,
      z: from.z + (to.z - from.z) * t,
    });
  }
  return pts;
}

export interface TubeMesh {
  /** Flat xyz triples. */
  positions: number[];
  /** Flat triangle indices into `positions`. */
  indices: number[];
  /** Vertices per ring. */
  sides: number;
  /** Centerline length in metres — hand this to `texel-density.ts` to size a map. */
  lengthM: number;
}

export interface LinearPropResult {
  ok: boolean;
  mesh?: TubeMesh;
  reason?: string;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z);
  return l > 0 ? { x: v.x / l, y: v.y / l, z: v.z / l } : { x: 0, y: 0, z: 0 };
};

/**
 * Sweep a circular cross-section along the centerline. Pure — no Blender, no provider,
 * no file. Refuses rather than emitting geometry that cannot be a tube.
 */
export function generateLinearProp(config: LinearPropConfig): LinearPropResult {
  const { radius, segments, sides } = config;
  if (!(sides >= 3)) {
    return { ok: false, reason: `a tube needs at least 3 sides around its circumference, got ${sides}` };
  }
  if (!(segments >= 1)) {
    return { ok: false, reason: `a tube needs at least 1 segment along its length, got ${segments}` };
  }
  if (!(radius > 0)) {
    return { ok: false, reason: `a tube needs a positive radius, got ${radius}` };
  }
  if (!(dist(config.from, config.to) > 0)) {
    return { ok: false, reason: 'the two anchors are the same point — there is no line to sweep along' };
  }

  const pts = centerlinePoints(config);
  const positions: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    // Local tangent, one-sided at the ends.
    const tangent = norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
    // Any reference not parallel to the tangent gives a stable enough frame for a prop.
    const ref = Math.abs(tangent.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const right = norm(cross(tangent, ref));
    const up = norm(cross(right, tangent));
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const c = Math.cos(a) * radius;
      const s = Math.sin(a) * radius;
      positions.push(
        pts[i].x + right.x * c + up.x * s,
        pts[i].y + right.y * c + up.y * s,
        pts[i].z + right.z * c + up.z * s,
      );
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = 0; j < sides; j++) {
      const jn = (j + 1) % sides;
      const a = i * sides + j;
      const b = i * sides + jn;
      const c = (i + 1) * sides + jn;
      const d = (i + 1) * sides + j;
      // Wound so the face normal points AWAY from the centerline. The mirror of this
      // (a, b, c / a, c, d) is watertight and consistently wound too — and inside out:
      // trimesh graded the first build at volume -0.037, and only the artifact showed it.
      indices.push(a, c, b, a, d, c);
    }
  }

  // Cap both ends with a triangle fan. An open tube is a manifold with boundary, which
  // the Tier-1 gate reports as WATERTIGHT=0 — a real defect on an asset that costs two
  // triangles per end to avoid. The start fan is wound in reverse so both caps face out.
  const last = (pts.length - 1) * sides;
  for (let j = 1; j <= sides - 2; j++) {
    indices.push(0, j, j + 1);
    indices.push(last, last + j + 1, last + j);
  }

  return { ok: true, mesh: { positions, indices, sides, lengthM: polylineLength(pts) } };
}

/** Serialise to Wavefront OBJ — 1-based indices, as the format requires. */
export function toObj(mesh: TubeMesh): string {
  const lines: string[] = ['# generated by PoF generators/linear-prop.ts'];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    lines.push(`v ${mesh.positions[i]} ${mesh.positions[i + 1]} ${mesh.positions[i + 2]}`);
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    lines.push(`f ${mesh.indices[i] + 1} ${mesh.indices[i + 1] + 1} ${mesh.indices[i + 2] + 1}`);
  }
  return lines.join('\n');
}
