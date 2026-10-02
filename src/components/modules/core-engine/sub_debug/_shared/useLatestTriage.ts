'use client';

import { useDebugSnapshot } from './useDebugSnapshot';
import type { LatestTriage } from './optimizationQueue';

/**
 * The newest capture's triage + its compare against the previous real capture,
 * as a thin selector over the Debug tab's ONE profiling reader
 * ({@link useDebugSnapshot}) — never a second fetch path. The Debug dashboard
 * already holds that reader's state and passes `latest` down; use this hook
 * only from a surface that does not.
 */
export function useLatestTriage(): LatestTriage {
  return useDebugSnapshot().latest;
}
