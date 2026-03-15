import { apiSuccess, apiError } from '@/lib/api-utils';
import type { PofHotPatchRequest, PofHotPatchResult, PofCompileStatus, PofPatchPhase } from '@/types/pof-bridge';

const DEFAULT_POF_PORT = 30040;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = parseInt(searchParams.get('port') || String(DEFAULT_POF_PORT), 10);

  try {
    const body = await request.json() as PofHotPatchRequest;

    if (!body.filePath || !body.fileContent) {
      return apiError('filePath and fileContent are required', 400);
    }

    const controller = new AbortController();
    // Hot-patch can take a while: file write + compile + verification
    const timeoutMs = 180_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`http://127.0.0.1:${port}/pof/compile/hot-patch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return apiError(`Hot-patch error: ${text.slice(0, 200)}`, res.status);
    }

    const data = await res.json() as PofHotPatchResult;
    return apiSuccess(data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to reach PoF Bridge plugin');
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = parseInt(searchParams.get('port') || String(DEFAULT_POF_PORT), 10);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`http://127.0.0.1:${port}/pof/compile/hot-patch/status`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return apiError('Failed to get hot-patch status', res.status);
    }

    const data = await res.json() as { status: PofCompileStatus; patchPhase: PofPatchPhase };
    return apiSuccess(data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to reach PoF Bridge plugin');
  }
}
