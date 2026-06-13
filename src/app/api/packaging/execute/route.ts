import { cookExecutor, type CookEvent } from '@/lib/packaging/cook-executor';
import { getProfile } from '@/lib/packaging/build-profiles-db';
import { insertBuild, lastGreenSizeBytes, updateBuildNotes } from '@/lib/packaging/build-history-store';
import { evaluateBuildSize } from '@/lib/packaging/size-budgets';
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
            if (lastEvent.type === 'done') {
              // Same size-budget / regression gate the scheduled runner applies,
              // evaluated against the last green build for this platform. Capture
              // the baseline BEFORE inserting this build (as the scheduled runner
              // does) — otherwise the just-recorded green row becomes its own
              // baseline and the gate would always self-compare to 0% growth.
              // Skip the lookup when the cook produced no measurable size.
              const lastGreen = lastEvent.sizeBytes && lastEvent.sizeBytes > 0
                ? lastGreenSizeBytes(profile.platform)
                : null;
              const rec = insertBuild({
                platform: profile.platform,
                config: profile.config,
                status: 'success',
                sizeBytes: lastEvent.sizeBytes,
                durationMs: lastEvent.durationMs,
                outputPath: lastEvent.exePath,
                cookTimeMs: lastEvent.durationMs,
              });
              // A passing build records exactly as before; a regression gets the
              // note recorded and surfaces a final SSE event for the UI.
              const regression = lastEvent.sizeBytes && lastEvent.sizeBytes > 0
                ? evaluateBuildSize(profile.platform, lastEvent.sizeBytes, lastGreen)
                : null;
              if (regression) {
                updateBuildNotes(rec.id, regression.note);
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'size-regression', note: regression.note })}\n\n`),
                );
              }
            } else {
              insertBuild({
                platform: profile.platform,
                config: profile.config,
                // 'cancelled' (user abort / client gone) must not pollute the
                // failure stats — BuildRecord has carried the status all along.
                status: lastEvent.status,
                durationMs: Date.now() - startedAt,
                errorSummary: lastEvent.message,
              });
            }
          } catch { /* don't crash stream on persistence error */ }
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
