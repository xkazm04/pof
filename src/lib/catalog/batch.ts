import type { GenerationStep } from '@/lib/catalog/recipe';

export type DispatchResult = { ok: true } | { ok: false; error: string };
export interface BatchEntryResult { entityId: string; ok: boolean; error?: string }

/**
 * Run a generation step across many entities as a queue — exactly one dispatch
 * in flight at a time (the SP-B single-dispatch lesson). Each entity's result is
 * recorded; a failure (returned or thrown) does not abort the rest.
 */
export async function runBatch(
  entityIds: string[],
  step: GenerationStep,
  dispatch: (entityId: string, step: GenerationStep) => Promise<DispatchResult>,
): Promise<BatchEntryResult[]> {
  const results: BatchEntryResult[] = [];
  for (const entityId of entityIds) {
    try {
      const r = await dispatch(entityId, step);
      results.push(r.ok ? { entityId, ok: true } : { entityId, ok: false, error: r.error });
    } catch (e) {
      results.push({ entityId, ok: false, error: e instanceof Error ? e.message : 'dispatch threw' });
    }
  }
  return results;
}
