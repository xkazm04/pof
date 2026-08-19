import { apiSuccess, apiError } from '@/lib/api-utils';
import { runSmokeTest, deriveGameImage, smokeResultNote } from '@/lib/packaging/smoke-test';
import { attachSmokeResultToLatestBuild } from '@/lib/packaging/build-history-store';

interface SmokeTestRequest {
  /** Full path to the staged bootstrap exe (`<StageDir>\<ProjectName>.exe`). */
  exePath: string;
  projectName: string;
  platform: string;
  config: string;
  /** Project the build belongs to — scopes which build the note is attached to. */
  projectPath?: string;
  /** Override the observe window (ms). Default 25s. */
  observeMs?: number;
}

function isSmokeTestRequest(v: unknown): v is SmokeTestRequest {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.exePath === 'string'
    && typeof o.projectName === 'string'
    && typeof o.platform === 'string'
    && typeof o.config === 'string';
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); } catch {
    return apiError('invalid JSON body', 400);
  }
  if (!isSmokeTestRequest(body)) {
    return apiError('missing required fields: exePath, projectName, platform, config', 400);
  }
  const { exePath, projectName, platform, config, projectPath, observeMs } = body;

  // The smoke-test launches a real process — only Win64 builds run on this host.
  if (platform !== 'Win64') {
    return apiError(`smoke-test only supported for Win64 builds (got ${platform})`, 400);
  }

  try {
    const gameImage = deriveGameImage(projectName, platform, config);
    const result = await runSmokeTest({ bootstrapExe: exePath, gameImage, observeMs });
    const note = smokeResultNote(result);
    // Scoped: a smoke result must land on THIS project's latest matching build, not
    // whichever project cooked most recently.
    const updated = attachSmokeResultToLatestBuild(platform, config, note, projectPath ?? null);
    return apiSuccess({ result, recordedToBuildId: updated?.id ?? null });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'smoke-test failed');
  }
}
