import { cookExecutor } from '@/lib/packaging/cook-executor';
import { getProfile } from '@/lib/packaging/build-profiles-db';
import { insertBuild, lastGreenBaseline } from '@/lib/packaging/build-history-store';
import { evaluateBuildSize } from '@/lib/packaging/size-budgets';
import { autoIncrementOnSuccess } from '@/lib/packaging/version-manager';
import type { FinalizeDeps } from '@/lib/packaging/finalize-build';
import { startCookJob, cookJobEventStream, COOK_SSE_HEADERS } from '@/lib/packaging/cook-jobs';
import { apiError } from '@/lib/api-utils';

interface ExecuteRequest {
  profileId: string;
  projectPath: string;
  projectName: string;
  ueVersion: string;
  mapName?: string;
}

function isExecuteRequest(v: unknown): v is ExecuteRequest {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.profileId === 'string'
    && typeof o.projectPath === 'string'
    && typeof o.projectName === 'string'
    && typeof o.ueVersion === 'string';
}

/**
 * Start an interactive cook JOB and stream it. The cook is owned by the job registry
 * (`src/lib/packaging/cook-jobs.ts`), not by this request: the client going away only
 * detaches (reattach via `GET /api/packaging/cook-jobs`), and only an explicit
 * `DELETE /api/packaging/cook-jobs?jobId=` cancels. The SSE body is unchanged (the
 * cook events, then `recorded`/`record-error` and the size events), each now carrying
 * a `seq`; the job id rides the `X-Cook-Job-Id` header. A project that already has a
 * cook (interactive or nightly) is refused with 409 naming that job.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); } catch {
    return apiError('invalid JSON body', 400);
  }
  if (!isExecuteRequest(body)) {
    return apiError('missing required fields', 400);
  }
  const { profileId, projectPath, projectName, ueVersion } = body;

  const profile = getProfile(profileId);
  if (!profile) {
    return apiError('profile not found', 404);
  }

  const started = startCookJob(
    { kind: 'interactive', profile, projectPath, projectName, ueVersion },
    { executor: cookExecutor, finalizeDeps: finalizeDeps() },
  );
  if (!started.ok) return apiError(started.error, 409);

  const stream = cookJobEventStream(started.data.jobId, 0, req.signal);
  if (!stream) return apiError('cook job vanished before it could be streamed', 500);
  return new Response(stream, {
    status: 200,
    headers: { ...COOK_SSE_HEADERS, 'X-Cook-Job-Id': started.data.jobId },
  });
}

/**
 * Real store wiring for the shared finalizer (`finalize-build.ts`). Each dep is a
 * thunk so a store export is only touched when the finalizer actually needs it (an
 * unmeasured cook never reads the baseline).
 */
function finalizeDeps(): FinalizeDeps {
  return {
    lastGreenBaseline: (platform, projectId) => lastGreenBaseline(platform, projectId),
    evaluateBuildSize: (platform, sizeBytes, lastGreen, baseline) =>
      evaluateBuildSize(platform, sizeBytes, lastGreen, undefined, baseline),
    nextVersion: (projectId) => autoIncrementOnSuccess(projectId),
    insertBuild: (input) => insertBuild(input),
  };
}
