import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { resolvePofPort } from '@/lib/pof-bridge/constants';
import { proxyToPofBridge, pofProxyError } from '@/lib/pof-bridge/proxy';
import type { PofCompileRequest, PofCompileResult, PofCompileStatus } from '@/types/pof-bridge';

/** An hour is past any Live Coding compile, and keeps the proxy deadline a valid timer value. */
const MAX_COMPILE_TIMEOUT_SECONDS = 3600;

export async function POST(request: Request) {
  const denied = requireOperator(request);
  if (denied) return denied;
  const port = resolvePofPort(new URL(request.url).searchParams);
  const raw = await readJsonObject(request);
  if (!raw) return apiError(MALFORMED_BODY_ERROR, 400);
  const body = raw as PofCompileRequest;
  if (body.waitForComplete !== undefined && typeof body.waitForComplete !== 'boolean') {
    return apiError('waitForComplete must be a boolean', 400);
  }
  const seconds: unknown = body.timeoutSeconds;
  if (seconds !== undefined && (typeof seconds !== 'number' || !(seconds > 0) || seconds > MAX_COMPILE_TIMEOUT_SECONDS)) {
    return apiError(`timeoutSeconds must be a number in (0, ${MAX_COMPILE_TIMEOUT_SECONDS}]`, 400);
  }

  logger.info('[pof-bridge]', 'compile', `port ${port}`);
  // Allow longer timeout for compilation.
  const timeoutMs = (body.timeoutSeconds ?? 120) * 1000 + 5000;
  const result = await proxyToPofBridge<PofCompileResult>('compile/live', {
    port,
    method: 'POST',
    body,
    timeoutMs,
  });
  if (!result.ok) return pofProxyError(result, 'Compile error');
  return apiSuccess(result.data);
}

export async function GET(request: Request) {
  const port = resolvePofPort(new URL(request.url).searchParams);

  const result = await proxyToPofBridge<{ status: PofCompileStatus }>('compile/status', {
    port,
    timeoutMs: 5000,
  });
  if (!result.ok) return pofProxyError(result, 'Failed to get compile status');
  return apiSuccess(result.data);
}
