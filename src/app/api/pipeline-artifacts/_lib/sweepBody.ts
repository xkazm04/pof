import { apiError } from '@/lib/api-utils';
import type { Result } from '@/types/result';

/**
 * Read the body of a disk-truth sweep POST (bind-icons, verify-static, verify-packaging,
 * drain-python). Their scope is `{ catalogId?, entityId? }` and an ABSENT scope means
 * "every catalog", so the parse decides how wide the write is.
 *
 * They used to read `req.json().catch(() => ({}))`: a truncated or malformed single-entity
 * body became `{}` and the sweep re-graded and rewrote EVERY catalog's artifacts. The drain
 * route closed the same hole (`/api/pipeline-artifacts/drain`); this is its parity:
 *   - an empty body is the explicit global sweep → `{}`
 *   - unparseable JSON, or JSON that is not an object → a 400, and nothing runs.
 */
export async function readSweepBody(req: Request): Promise<Result<Record<string, unknown>, ReturnType<typeof apiError>>> {
  const text = await req.text();
  if (!text.trim()) return { ok: true, data: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: apiError('sweep body is not valid JSON — refusing rather than widening to every catalog', 400) };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: apiError('sweep body must be a JSON object', 400) };
  }
  return { ok: true, data: parsed as Record<string, unknown> };
}
