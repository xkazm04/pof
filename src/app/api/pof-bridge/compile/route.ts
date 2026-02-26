import { apiSuccess, apiError } from '@/lib/api-utils';
import type { PofCompileRequest, PofCompileResult, PofCompileStatus } from '@/types/pof-bridge';

const DEFAULT_POF_PORT = 30040;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = parseInt(searchParams.get('port') || String(DEFAULT_POF_PORT), 10);

  try {
    const body = await request.json() as PofCompileRequest;

    const controller = new AbortController();
    // Allow longer timeout for compilation
    const timeoutMs = (body.timeoutSeconds ?? 120) * 1000 + 5000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`http://127.0.0.1:${port}/pof/compile/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return apiError(`Compile error: ${text.slice(0, 200)}`, res.status);
    }

    const data = await res.json() as PofCompileResult;
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

    const res = await fetch(`http://127.0.0.1:${port}/pof/compile/status`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return apiError('Failed to get compile status', res.status);
    }

    const data = await res.json() as { status: PofCompileStatus };
    return apiSuccess(data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to reach PoF Bridge plugin');
  }
}
