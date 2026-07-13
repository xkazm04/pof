/**
 * Recover the UE test name a deferred L3 artifact embedded in its reason. The
 * reason contract (prefix + builder + parser) lives once in `@/types/observation`
 * so `acceptance/deferred.ts` (the writer) and this reader can never drift.
 */
import { parseRuntimeDeferredTestName } from '@/types/observation';

export function parseTestName(reason?: string): string | null {
  return parseRuntimeDeferredTestName(reason);
}
