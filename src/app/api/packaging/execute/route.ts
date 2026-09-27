import { cookExecutor, type CookEvent } from '@/lib/packaging/cook-executor';
import { getProfile } from '@/lib/packaging/build-profiles-db';
import { insertBuild, lastGreenBaseline } from '@/lib/packaging/build-history-store';
import { evaluateBuildSize } from '@/lib/packaging/size-budgets';
import { autoIncrementOnSuccess } from '@/lib/packaging/version-manager';
import { finalizeCook, type FinalizeDeps } from '@/lib/packaging/finalize-build';
import { apiError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

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

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let lastEvent: CookEvent | null = null;

      try {
        for await (const ev of cookExecutor({
          profile,
          projectPath,
          projectName,
          ueVersion,
          signal: req.signal,
        })) {
          lastEvent = ev;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
          if (ev.type === 'done' || ev.type === 'error') break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const fallback: CookEvent = { type: 'error', message, status: 'failed', t: Date.now() - startedAt };
        lastEvent = fallback;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallback)}\n\n`));
      } finally {
        if (lastEvent && (lastEvent.type === 'done' || lastEvent.type === 'error')) {
          try {
            // One finalizer for the interactive and nightly cooks (`finalize-build.ts`):
            // baseline captured before the insert and scoped to this project, growth
            // judged against the baseline RECORD, and bump-per-green-cook versioning.
            const ev = lastEvent;
            const done = ev.type === 'done';
            const fin = finalizeCook(
              ev.type === 'done'
                ? { kind: 'done', exePath: ev.exePath, durationMs: ev.durationMs, sizeBytes: ev.sizeBytes }
                : { kind: 'error', status: ev.status, message: ev.message, durationMs: Date.now() - startedAt },
              { projectPath, platform: profile.platform, config: profile.config },
              finalizeDeps(),
            );
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'recorded',
                buildId: fin.buildId,
                version: fin.version,
                versionRule: done ? 'bump-per-green-cook' : 'no version — only a green cook carries one',
              })}\n\n`),
            );
            if (fin.baselineNote != null) {
              // State the reference on EVERY measured cook, pass or fail. Without this,
              // a first-ever build (no baseline) and a build that genuinely did not
              // grow are the same silence.
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'size-baseline',
                  baseline: fin.baseline,
                  note: fin.baselineNote,
                })}\n\n`),
              );
            }
            if (fin.regression) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'size-regression', note: fin.regression.note })}\n\n`),
              );
            }
          } catch (persistErr) {
            // A cook the app FAILED TO RECORD must not read as a recorded green
            // build. This block used to be a bare `catch {}`: the insert threw, the
            // user was told the cook succeeded, and no row existed anywhere. The
            // stream stays alive (the cook really did happen) but says so.
            const message = persistErr instanceof Error ? persistErr.message : String(persistErr);
            logger.error('[packaging/execute] failed to record build to history', persistErr);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'record-error',
                message,
                note:
                  'The cook finished, but writing it to build history FAILED — no row exists for '
                  + 'this build. It will not appear in history, stats, or the size baseline.',
              })}\n\n`),
            );
          }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Real store wiring for {@link finalizeCook}. Each dep is a thunk so a store export is
 * only touched when the finalizer actually needs it (an unmeasured cook never reads
 * the baseline).
 */
function finalizeDeps(): FinalizeDeps {
  return {
    lastGreenBaseline: (platform, projectId) => lastGreenBaseline(platform, projectId),
    evaluateBuildSize: (platform, sizeBytes, lastGreen, baseline) =>
      evaluateBuildSize(platform, sizeBytes, lastGreen, undefined, baseline),
    nextVersion: () => autoIncrementOnSuccess(),
    insertBuild: (input) => insertBuild(input),
  };
}
