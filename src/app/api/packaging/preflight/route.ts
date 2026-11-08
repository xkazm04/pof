import path from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
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

const CHECK_KINDS = ['fast', 'build-verify-editor', 'build-verify-shipping', 'asset-validation'] as const;
type CheckKind = (typeof CHECK_KINDS)[number];

/**
 * The dispatch below ends in an `else` that spawns UnrealBuildTool, so an
 * unrecognised `check` must be refused here — otherwise a typo starts a real
 * 10-minute editor compile.
 */
function isCheckKind(v: unknown): v is CheckKind {
  return typeof v === 'string' && (CHECK_KINDS as readonly string[]).includes(v);
}

interface PreflightRequest {
  projectPath: string;
  projectName: string;
  ueVersion: string;
  /**
   * The maps the selected build profile will cook (`cookSettings.mapsToInclude`)
   * — the same list UAT receives as `-map=A+B`. Empty/absent means the profile
   * cooks all maps, and the map-exists check falls back to `GameDefaultMap`.
   */
  mapsToInclude?: string[];
  check?: CheckKind;
}

/**
 * UE project names are letters, digits and underscore. projectName is spliced into
 * the .uproject path and the UBT target argument, so anything else (`..\x`, a leading
 * `-` read by UBT as a flag, a path separator) is refused before a process is spawned.
 */
const PROJECT_NAME_RE = /^[A-Za-z0-9_]+$/;

function isPreflightRequest(v: unknown): v is PreflightRequest {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.projectPath === 'string'
    && typeof o.projectName === 'string'
    && PROJECT_NAME_RE.test(o.projectName)
    && typeof o.ueVersion === 'string'
    && (o.mapsToInclude === undefined || (Array.isArray(o.mapsToInclude) && o.mapsToInclude.every((m) => typeof m === 'string')));
}

const UBT_TIMEOUT_MS = 10 * 60 * 1000;
// The DataValidation commandlet boots the editor + scans all content; give it
// more headroom than a UBT compile.
const EDITOR_CMD_TIMEOUT_MS = 15 * 60 * 1000;

function timeoutDetail(what: string, ms: number): string {
  return `${what} timed out after ${Math.round(ms / 60000)} min and was killed — this is a timeout, not a compile or content error.`;
}

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
  // Starts a process (or retargets one) — operator-guarded like every spawn route.
  const denied = requireOperator(req);
  if (denied) return denied;
  let body: unknown;
  try { body = await req.json(); } catch {
    return apiError('invalid JSON body', 400);
  }
  if (!isPreflightRequest(body)) {
    return apiError('missing or invalid fields: projectPath, projectName (letters, digits, underscore), ueVersion', 400);
  }
  const request = body as PreflightRequest;
  if (request.check !== undefined && !isCheckKind(request.check)) {
    return apiError(`unknown check — expected one of: ${CHECK_KINDS.join(', ')}`, 400);
  }
  const check: CheckKind = request.check ?? 'fast';

  try {
    let results: PreflightCheckResult[];

    if (check === 'fast') {
      results = (await runFastPreflight(request.projectPath, request.projectName, request.mapsToInclude)).results;
    } else if (check === 'asset-validation') {
      const { output, spawnError, timedOut } = await runAssetValidation(request, req.signal);
      if (timedOut) {
        const detail = timeoutDetail('The DataValidation commandlet', EDITOR_CMD_TIMEOUT_MS);
        results = [{ id: 'asset-validation', label: 'Asset validation', status: 'fail', detail, issues: [detail] }];
      } else if (spawnError) {
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
      const { output, spawnError, timedOut } = await runBuildVerify(request, target, ubtConfig, req.signal);
      if (timedOut) {
        const detail = timeoutDetail('UnrealBuildTool', UBT_TIMEOUT_MS);
        results = [{
          id: isShipping ? 'build-verify-shipping' : 'build-verify-editor',
          label,
          status: 'fail',
          detail,
          issues: [detail],
        }];
      } else if (spawnError) {
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
