import { apiSuccess, apiError } from '@/lib/api-utils';
import { runSmokeTest, deriveGameImage, smokeResultNote } from '@/lib/packaging/smoke-test';
import { getBuild, attachSmokeResultToBuild } from '@/lib/packaging/build-history-store';

/**
 * Re-run the post-cook smoke test against ONE recorded build.
 *
 * The request names a build id — the row the cook stream reported as
 * `recorded {buildId}` — and nothing else about it. The exe that is launched, the
 * process image that is watched, and the row that is condemned all come from that
 * row, so they cannot disagree, and no caller-supplied path or name ever reaches
 * spawn or taskkill.
 */
interface SmokeTestRequest {
  buildId: number;
  /** Override the observe window (ms). Default 25s; clamped. */
  observeMs?: number;
}

const MIN_OBSERVE_MS = 1_000;
const MAX_OBSERVE_MS = 120_000;

function isSmokeTestRequest(v: unknown): v is SmokeTestRequest {
  if (!v || typeof v !== 'object') return false;
  const id = (v as Record<string, unknown>).buildId;
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
}

function clampObserve(ms: unknown): number | undefined {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return undefined;
  return Math.min(MAX_OBSERVE_MS, Math.max(MIN_OBSERVE_MS, ms));
}

/** `C:/out/PoF.exe` → `PoF`; null when the recorded path is not an exe. */
function projectNameFromExe(outputPath: string): string | null {
  const m = /([^\\/]+)\.exe$/i.exec(outputPath);
  return m ? m[1] : null;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); } catch {
    return apiError('invalid JSON body', 400);
  }
  if (!isSmokeTestRequest(body)) {
    return apiError(
      'missing required field: buildId (a recorded build id). The smoke test re-runs a build '
      + 'from history; it does not accept an exe path, project name, platform or config.',
      400,
    );
  }
  const { buildId } = body;

  const build = getBuild(buildId);
  if (!build) return apiError(`build #${buildId} is not in build history`, 404);
  // The smoke-test launches a real process — only Win64 builds run on this host.
  if (build.platform !== 'Win64') {
    return apiError(`build #${buildId} is ${build.platform}; smoke-test only runs Win64 builds`, 400);
  }
  if (build.status !== 'success') {
    return apiError(`build #${buildId} is recorded as ${build.status}; only a green build can be smoke-tested`, 409);
  }
  const projectName = build.outputPath ? projectNameFromExe(build.outputPath) : null;
  if (!build.outputPath || !projectName) {
    return apiError(`build #${buildId} has no recorded .exe output path to launch`, 409);
  }

  try {
    const gameImage = deriveGameImage(projectName, build.platform, build.config);
    const result = await runSmokeTest({
      bootstrapExe: build.outputPath,
      gameImage,
      observeMs: clampObserve((body as { observeMs?: unknown }).observeMs),
    });
    const note = smokeResultNote(result);
    // The verdict lands on THIS build — the one that was launched — and a failing
    // smoke condemns it, exactly as the scheduled runner classifies it.
    const attached = attachSmokeResultToBuild(buildId, note, result.status);
    // The FINAL smoke verdict. The cook's SSE stream has already emitted
    // `done: success`, so flipping the row to `failed` without saying so would leave
    // the panel and the DB disagreeing with no way to tell which is true.
    return apiSuccess({
      result,
      recordedToBuildId: attached.build?.id ?? null,
      buildStatus: attached.build?.status ?? null,
      previousStatus: attached.previousStatus,
      statusChanged: attached.statusChanged,
      unrecordedReason: attached.unrecordedReason,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'smoke-test failed');
  }
}
