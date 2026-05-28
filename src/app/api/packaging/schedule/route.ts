import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getSchedule, setSchedule, getScheduleState, isRunning,
} from '@/lib/packaging/build-schedule-store';
import { tickScheduler, startScheduledRun } from '@/lib/packaging/scheduled-build-runner';
import { getGitHead } from '@/lib/packaging/git-head';
import { nextRunAt, isDueAt, describeSchedule, parseTimeOfDay, type BuildSchedule } from '@/lib/packaging/build-scheduler';

/** GET — full scheduler status for the UI. `projectPath` query enables the HEAD read. */
export async function GET(request: Request) {
  try {
    const schedule = getSchedule();
    const state = getScheduleState();
    const now = new Date();
    const projectPath = new URL(request.url).searchParams.get('projectPath') ?? schedule.projectPath;
    const currentHead = projectPath ? await getGitHead(projectPath) : null;

    return apiSuccess({
      schedule,
      state,
      running: isRunning(),
      describe: describeSchedule(schedule),
      nextRunAt: nextRunAt(schedule, now)?.toISOString() ?? null,
      dueNow: isDueAt(schedule, state.lastRunAt, now),
      currentHead,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'failed to read schedule', 500);
  }
}

/** Build a validated partial schedule from an untrusted body. Returns null on bad input. */
function sanitizeSchedulePatch(body: Record<string, unknown>): Partial<BuildSchedule> | null {
  const patch: Partial<BuildSchedule> = {};

  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') return null;
    patch.enabled = body.enabled;
  }
  if ('time' in body) {
    if (typeof body.time !== 'string' || !parseTimeOfDay(body.time)) return null;
    patch.time = body.time;
  }
  if ('days' in body) {
    if (!Array.isArray(body.days) || body.days.some((d) => typeof d !== 'number' || d < 0 || d > 6)) return null;
    patch.days = body.days as number[];
  }
  if ('profileId' in body) {
    if (body.profileId !== null && typeof body.profileId !== 'string') return null;
    patch.profileId = body.profileId as string | null;
  }
  if ('skipIfUnchanged' in body) {
    if (typeof body.skipIfUnchanged !== 'boolean') return null;
    patch.skipIfUnchanged = body.skipIfUnchanged;
  }
  for (const key of ['projectPath', 'projectName', 'ueVersion'] as const) {
    if (key in body) {
      if (typeof body[key] !== 'string') return null;
      patch[key] = body[key] as string;
    }
  }
  return patch;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError('invalid JSON body', 400);
  }
  const action = (body.action as string) ?? 'save';

  try {
    switch (action) {
      case 'save': {
        const patch = sanitizeSchedulePatch(body);
        if (!patch) return apiError('invalid schedule fields', 400);
        const schedule = setSchedule(patch);
        return apiSuccess({ schedule, describe: describeSchedule(schedule), nextRunAt: nextRunAt(schedule, new Date())?.toISOString() ?? null });
      }
      case 'run-now': {
        // Capture the live build target from the request before running.
        const ctxPatch = sanitizeSchedulePatch({
          projectPath: body.projectPath, projectName: body.projectName, ueVersion: body.ueVersion,
        });
        const schedule = ctxPatch && Object.keys(ctxPatch).length > 0 ? setSchedule(ctxPatch) : getSchedule();
        const result = startScheduledRun(schedule, true);
        return apiSuccess(result);
      }
      case 'tick': {
        const result = tickScheduler();
        return apiSuccess(result);
      }
      default:
        return apiError(`unknown action: ${action}`, 400);
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'schedule request failed', 500);
  }
}
