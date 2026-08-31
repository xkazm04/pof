import { NextRequest } from 'next/server';
import { existsSync } from 'node:fs';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { startViewGateJob, type ViewGateMemberSpec } from '@/lib/visual-gen/view-gate-job-store';

/**
 * POST /api/visual-gen/view-gate
 *
 * Render a generated mesh from N yaws and LOOK at it — the tier `mesh-critique.ts` could
 * never reach. Trimesh grades verts, faces, watertightness and components; a single
 * image→3D reconstructs the side it was shown and invents the rest, so a smeared back
 * face is watertight, single-component and passes. This route is where that stops.
 *
 * Body: { meshPath, subject? } or { members: [{ meshPath, name?, subject? }], … },
 *       views?, resolution?, outDir?
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      meshPath?: string;
      subject?: string;
      members?: ViewGateMemberSpec[];
      views?: number;
      resolution?: number;
      outDir?: string;
    };

    const members: ViewGateMemberSpec[] = body.members?.length
      ? body.members
      : body.meshPath?.trim()
        ? [{ meshPath: body.meshPath.trim(), ...(body.subject ? { subject: body.subject } : {}) }]
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
