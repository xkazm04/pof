import { NextRequest } from 'next/server';
import { existsSync } from 'node:fs';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { startViewGateJob, type ViewGateMemberSpec } from '@/lib/visual-gen/view-gate-job-store';

/**
 * POST /api/visual-gen/view-gate
 *
 * Render a generated mesh from N yaws and LOOK at it — the tier `mesh-critique.ts` could
 * never reach. Trimesh grades verts, faces, watertightness and components; a single
 * image→3D reconstructs the side it was shown and invents the rest, so a smeared back
 * face is watertight, single-component and passes. This route is where that stops.
 *
 * Body: { meshPath, subject?, referencePath? } or
 *       { members: [{ meshPath, name?, subject?, referencePath? }], … },
 *       views?, resolution?, outDir?
 *
 * A member that supplies `referencePath` — the image the asset was generated FROM — is
 * additionally asked whether it DEPICTS that reference (`reference-conformance.ts`).
 * That answer is reported beside the damage verdict and never folded into it: the
 * comparison has not been calibrated on a known-good control, and this gate's own
 * history is that an uncalibrated vision prompt condemns everything.
 *
 * Starts a job (poll GET /api/visual-gen/view-gate/status?jobId=...). Two or more
 * members additionally get an ADVISORY colour-coherence grade — a number to read, never
 * a gate, until its threshold is calibrated on a known-good kit (`kit-coherence.ts`).
 */

/**
 * Ceiling on kit size. Each member costs a Blender orbit plus one VLM call PER VIEW, so
 * an uncapped kit is an uncapped bill against the same vision quota `qwen.ts`'s fallback
 * chain exists to nurse. Split a larger kit across jobs.
 */
export const MAX_KIT_MEMBERS = 12;

/** Blender renders resolution-squared pixels per view; the default is 512. */
const MIN_RESOLUTION = 64;
const MAX_RESOLUTION = 2048;

const isOptionalString = (v: unknown): boolean => v === undefined || typeof v === 'string';

/** The refusal for the first field that is the wrong shape, or null. Pure. */
function invalidField(body: Record<string, unknown>): string | null {
  const { members, meshPath, subject, referencePath, views, resolution, outDir } = body;
  if (members !== undefined) {
    if (!Array.isArray(members)) return 'members must be an array';
    for (const m of members) {
      if (typeof m !== 'object' || m === null || Array.isArray(m)) return 'each member must be an object';
      for (const field of ['meshPath', 'name', 'subject', 'referencePath']) {
        if (!isOptionalString((m as Record<string, unknown>)[field])) return `member ${field} must be a string`;
      }
    }
  }
  if (!isOptionalString(meshPath)) return 'meshPath must be a string';
  if (!isOptionalString(subject)) return 'subject must be a string';
  if (!isOptionalString(referencePath)) return 'referencePath must be a string';
  if (!isOptionalString(outDir)) return 'outDir must be a string';
  // A non-numeric count would otherwise fall back to the default without saying so.
  if (views !== undefined && !(typeof views === 'number' && Number.isFinite(views))) return 'views must be a number';
  if (resolution !== undefined && !(Number.isInteger(resolution) && (resolution as number) >= MIN_RESOLUTION && (resolution as number) <= MAX_RESOLUTION)) {
    return `resolution must be an integer from ${MIN_RESOLUTION} to ${MAX_RESOLUTION}`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = requireOperator(request);
  if (denied) return denied;

  try {
    const parsed = await readJsonObject(request);
    if (!parsed) return apiError(MALFORMED_BODY_ERROR, 400);
    const invalid = invalidField(parsed);
    if (invalid) return apiError(invalid, 400);
    const body = parsed as {
      meshPath?: string;
      subject?: string;
      referencePath?: string;
      members?: ViewGateMemberSpec[];
      views?: number;
      resolution?: number;
      outDir?: string;
    };

    const members: ViewGateMemberSpec[] = body.members?.length
      ? body.members
      : body.meshPath?.trim()
        ? [{
            meshPath: body.meshPath.trim(),
            ...(body.subject ? { subject: body.subject } : {}),
            ...(body.referencePath ? { referencePath: body.referencePath.trim() } : {}),
          }]
        : [];

    if (members.length === 0) return apiError('meshPath (or a non-empty members array) is required', 400);
    if (members.length > MAX_KIT_MEMBERS) {
      return apiError(
        `a view-gate job takes at most ${MAX_KIT_MEMBERS} members (got ${members.length}): each member ` +
          'is a Blender render plus one vision call per view. Split the kit across jobs.',
        400,
      );
    }

    const bad = members.find((m) => !m.meshPath?.trim() || !existsSync(m.meshPath));
    if (bad) {
      // Named, not merely counted — a caller with a 12-member kit needs to know which one.
      return apiError(`mesh not found at ${bad.meshPath || '(empty meshPath)'}`, 400);
    }

    // A reference that is not on disk is refused UP FRONT rather than degrading to an
    // `unmeasured` conformance an hour later: the caller asked a question, and silently
    // returning "could not see" for a typo'd path reads as a defect in the asset.
    const badRef = members.find((m) => m.referencePath?.trim() && !existsSync(m.referencePath));
    if (badRef) {
      return apiError(`reference image not found at ${badRef.referencePath}`, 400);
    }

    const jobId = startViewGateJob({
      members,
      views: body.views,
      resolution: body.resolution,
      outDir: body.outDir,
    });
    return apiSuccess({ jobId, members: members.length }, 202);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to start view-gate job', 500);
  }
}
