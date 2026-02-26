import { apiSuccess, apiError } from '@/lib/api-utils';
import type { PofTestSpec, PofTestResult } from '@/types/pof-bridge';

const DEFAULT_POF_PORT = 30040;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = parseInt(searchParams.get('port') || String(DEFAULT_POF_PORT), 10);

  try {
    const body = await request.json() as { action: string; spec?: PofTestSpec; filter?: string; flags?: string[] };

    let url: string;
    if (body.action === 'run-automation') {
      url = `http://127.0.0.1:${port}/pof/test/run-automation`;
    } else {
      url = `http://127.0.0.1:${port}/pof/test/run`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body.action === 'run-automation' ? { filter: body.filter, flags: body.flags } : body.spec),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return apiError(`Test runner error: ${text.slice(0, 200)}`, res.status);
    }

    const data = await res.json();
    return apiSuccess(data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to reach PoF Bridge plugin');
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = parseInt(searchParams.get('port') || String(DEFAULT_POF_PORT), 10);
  const testId = searchParams.get('testId');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const url = testId
      ? `http://127.0.0.1:${port}/pof/test/results/${encodeURIComponent(testId)}`
      : `http://127.0.0.1:${port}/pof/test/results`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return apiError(`Test results error: ${text.slice(0, 200)}`, res.status);
    }

    const data = await res.json() as PofTestResult | { results: PofTestResult[] };
    return apiSuccess(data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to reach PoF Bridge plugin');
  }
}
