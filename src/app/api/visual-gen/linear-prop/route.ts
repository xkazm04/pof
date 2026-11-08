import { NextRequest } from 'next/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { generateLinearProp, toObj, type Vec3 } from '@/lib/visual-gen/generators/linear-prop';
import { resolveLinearPropConfig } from '@/lib/visual-gen/linear-prop-routing';

/**
 * POST /api/visual-gen/linear-prop
 *
 * Compute a rope / cable / chain / wire between two anchors instead of buying one from a
 * 3D generator. This is the alternative `POST /api/visual-gen/generate` names when it
 * refuses a linear subject — a refusal that pointed nowhere would just be a wall.
 *
 * Body: { from, to, slack?, radius?, segments?, sides?, name?, outDir? }
 *
 * Synchronous, unlike every other generation route here: it is closed-form geometry, so
 * there is no minutes-long job to poll and no credit to spend. The anchors are required
 * and are never defaulted — they are the whole reason this asset is computed rather than
 * generated, and inventing them would hand back exactly the rope-that-reaches-nothing
 * this path exists to avoid.
 */

/** Stated on every response: the point of this route is what it does NOT cost. */
export const LINEAR_PROP_COST = 'no provider credit spent — computed locally in closed form';

/** The tube is built in memory before anything can refuse it, so its size is capped first. */
const MAX_SEGMENTS = 1024;
const MAX_SIDES = 64;

const isVec3 = (v: unknown): v is Vec3 =>
  typeof v === 'object' &&
  v !== null &&
  ['x', 'y', 'z'].every((k) => Number.isFinite((v as Record<string, unknown>)[k] as number));

export async function POST(request: NextRequest) {
  try {
    const raw = await readJsonObject(request);
    if (!raw) return apiError(MALFORMED_BODY_ERROR, 400);
    const body = raw as {
      from?: unknown;
      to?: unknown;
      slack?: number;
      radius?: number;
      segments?: number;
      sides?: number;
      name?: string;
      outDir?: string;
    };

    // Named separately: "from is missing" and "from.y is the string 'high'" are different
    // mistakes, and a single "invalid anchors" would send the caller looking at the wrong one.
    for (const [key, value] of [['from', body.from], ['to', body.to]] as const) {
      if (value === undefined) return apiError(`${key} anchor is required — the anchors ARE the asset and cannot be defaulted`, 400);
      if (!isVec3(value)) return apiError(`${key} anchor must be { x, y, z } with three finite numbers`, 400);
    }

    for (const key of ['slack', 'radius'] as const) {
      if (body[key] !== undefined && !Number.isFinite(body[key])) return apiError(`${key} must be a finite number`, 400);
    }
    if (body.segments !== undefined && (!Number.isInteger(body.segments) || body.segments > MAX_SEGMENTS)) {
      return apiError(`segments must be an integer of at most ${MAX_SEGMENTS}`, 400);
    }
    if (body.sides !== undefined && (!Number.isInteger(body.sides) || body.sides > MAX_SIDES)) {
      return apiError(`sides must be an integer of at most ${MAX_SIDES}`, 400);
    }
    for (const key of ['name', 'outDir'] as const) {
      if (body[key] !== undefined && typeof body[key] !== 'string') return apiError(`${key} must be a string`, 400);
    }

    const config = resolveLinearPropConfig({
      from: body.from as Vec3,
      to: body.to as Vec3,
      slack: body.slack,
      radius: body.radius,
      segments: body.segments,
      sides: body.sides,
    });

    const result = generateLinearProp(config);
    // The generator's own refusals (degenerate radius, coincident anchors, too few sides)
    // are surfaced verbatim rather than re-worded — it is the thing that measured them.
    if (!result.ok || !result.mesh) return apiError(result.reason ?? 'the prop could not be computed', 400);

    const slug = (body.name?.trim() || 'linear-prop').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    const dir = (body.outDir?.trim() || join(process.cwd(), 'generated', 'linear-prop')).replace(/\\/g, '/');
    mkdirSync(dir, { recursive: true });
    const objPath = join(dir, `${slug}_${Date.now()}.obj`).replace(/\\/g, '/');
    writeFileSync(objPath, toObj(result.mesh), 'utf8');

    return apiSuccess({
      objPath,
      lengthM: result.mesh.lengthM,
      vertices: result.mesh.positions.length / 3,
      triangles: result.mesh.indices.length / 3,
      config,
      cost: LINEAR_PROP_COST,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to compute the linear prop', 500);
  }
}
