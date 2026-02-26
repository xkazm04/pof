import { apiSuccess, apiError } from '@/lib/api-utils';
import type { PofSnapshotCaptureRequest, PofSnapshotDiffReport } from '@/types/pof-bridge';

const DEFAULT_POF_PORT = 30040;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = parseInt(searchParams.get('port') || String(DEFAULT_POF_PORT), 10);

  try {
    const body = await request.json() as { action: string } & PofSnapshotCaptureRequest & { presetIds?: string[] };

    let url: string;
    let reqBody: unknown;

    if (body.action === 'baseline') {
      url = `http://127.0.0.1:${port}/pof/snapshot/baseline`;
      reqBody = { presetIds: body.presetIds };
    } else {
      url = `http://127.0.0.1:${port}/pof/snapshot/capture`;
      reqBody = body;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return apiError(`Snapshot error: ${text.slice(0, 200)}`, res.status);
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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`http://127.0.0.1:${port}/pof/snapshot/diff`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return apiError(`Snapshot diff error: ${text.slice(0, 200)}`, res.status);
    }

    const data = await res.json() as PofSnapshotDiffReport;
    return apiSuccess(data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to reach PoF Bridge plugin');
  }
}
