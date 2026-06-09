import path from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getEnginePath } from '@/lib/prompt-context';
import {
  parseUbtResult,
  buildVerifyCheckResult,
  parseAssetValidation,
  assetValidationCheckResult,
  overallStatus,
  type PreflightCheckResult,
} from '@/lib/packaging/preflight';
import { runFastPreflight } from '@/lib/packaging/preflight-runner';
import { spawnCapture, type SpawnCaptureResult } from '@/lib/packaging/process-utils';

type CheckKind = 'fast' | 'build-verify-editor' | 'build-verify-shipping' | 'asset-validation';

interface PreflightRequest {
  projectPath: string;
  projectName: string;
  ueVersion: string;
  /** Optional level the operator selected to cook (e.g. `/Game/Maps/VerticalSlice`). */
  mapName?: string;
  check?: CheckKind;
}

function isPreflightRequest(v: unknown): v is PreflightRequest {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.projectPath === 'string'
    && typeof o.projectName === 'string'
    && typeof o.ueVersion === 'string';
}

const UBT_TIMEOUT_MS = 10 * 60 * 1000;
// The DataValidation commandlet boots the editor + scans all content; give it
// more headroom than a UBT compile.
const EDITOR_CMD_TIMEOUT_MS = 15 * 60 * 1000;

function runBuildVerify(
  req: PreflightRequest,
  target: string,
  config: 'Development' | 'Shipping',
  signal: AbortSignal,
): Promise<SpawnCaptureResult> {
  const enginePath = getEnginePath(req.ueVersion);
  const ubt = path.join(enginePath, 'Engine', 'Binaries', 'DotNET', 'UnrealBuildTool', 'UnrealBuildTool.exe');
  const uproject = path.join(req.projectPath, `${req.projectName}.uproject`);
  return spawnCapture(
    ubt,
    [target, 'Win64', config, `-Project=${uproject}`, '-WaitMutex', '-NoHotReload', '-NoXGE'],
    { signal, timeoutMs: UBT_TIMEOUT_MS },
  );
}

/**
 * Run UE's DataValidation commandlet headlessly to audit content before a cook.
 * `-NullRHI` keeps it off the GPU; output is parsed for content defects.
 */
function runAssetValidation(
  req: PreflightRequest,
  signal: AbortSignal,
): Promise<SpawnCaptureResult> {
  const enginePath = getEnginePath(req.ueVersion);
  const editorCmd = path.join(enginePath, 'Engine', 'Binaries', 'Win64', 'UnrealEditor-Cmd.exe');
  const uproject = path.join(req.projectPath, `${req.projectName}.uproject`);
  return spawnCapture(
    editorCmd,
    [uproject, '-run=DataValidation', '-unattended', '-nopause', '-nosplash', '-NullRHI'],
    { signal, timeoutMs: EDITOR_CMD_TIMEOUT_MS },
  );
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); } catch {
    return apiError('invalid JSON body', 400);
  }
  if (!isPreflightRequest(body)) {
    return apiError('missing required fields: projectPath, projectName, ueVersion', 400);
  }
  const request = body as PreflightRequest;
  const check: CheckKind = request.check ?? 'fast';

  try {
    let results: PreflightCheckResult[];

    if (check === 'fast') {
      results = (await runFastPreflight(request.projectPath, request.projectName)).results;
    } else if (check === 'asset-validation') {
      const { output, spawnError } = await runAssetValidation(request, req.signal);
      if (spawnError) {
        results = [{
          id: 'asset-validation',
          label: 'Asset validation',
          status: 'fail',
          detail: `Could not run the DataValidation commandlet: ${spawnError}`,
          issues: [spawnError],
        }];
      } else {
        results = [assetValidationCheckResult(parseAssetValidation(output))];
      }
    } else {
      const isShipping = check === 'build-verify-shipping';
      const target = isShipping ? request.projectName : `${request.projectName}Editor`;
      const ubtConfig = isShipping ? 'Shipping' : 'Development';
      const label = isShipping ? 'Build verify (Shipping)' : 'Build verify (Editor)';
      const { output, spawnError } = await runBuildVerify(request, target, ubtConfig, req.signal);
      if (spawnError) {
        results = [{
          id: isShipping ? 'build-verify-shipping' : 'build-verify-editor',
          label,
          status: 'fail',
          detail: `Could not run UnrealBuildTool: ${spawnError}`,
          issues: [spawnError],
        }];
      } else {
        results = [buildVerifyCheckResult(
          isShipping ? 'build-verify-shipping' : 'build-verify-editor',
          label,
          parseUbtResult(output),
        )];
      }
    }

    return apiSuccess({ results, overall: overallStatus(results) });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'pre-flight failed');
  }
}
