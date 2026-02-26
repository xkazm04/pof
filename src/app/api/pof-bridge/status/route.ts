import { apiSuccess, apiError } from '@/lib/api-utils';
import type { PofBridgeStatus } from '@/types/pof-bridge';

const DEFAULT_POF_PORT = 30040;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const port = parseInt(searchParams.get('port') || String(DEFAULT_POF_PORT), 10);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`http://127.0.0.1:${port}/pof/status`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return apiError(`Plugin returned ${res.status}`, res.status);
    }

    const data = await res.json() as PofBridgeStatus;
    return apiSuccess(data);
  } catch {
    return apiSuccess({ connected: false });
  }
}
