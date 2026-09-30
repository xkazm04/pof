/**
 * Since-last-scan diff for the Asset-Code Oracle.
 *
 * Violation ids are stable keys (`<type>:<subject>`, see `@/lib/asset-code-oracle`),
 * so a scan can be compared with the keys recorded for the previous one: each
 * current violation is `new` or `persisting`, and a previous key the current scan
 * no longer reports is `resolved`. With no previous keys (first scan, or a scan
 * recorded before keys were stored) there is nothing to compare against —
 * `hasPrevious` is false and nothing is tagged.
 */

export type OracleDiffStatus = 'new' | 'persisting';

export interface OracleScanDiff {
  /** False when there are no previous keys to compare against. */
  hasPrevious: boolean;
  /** Per current violation id; empty when `hasPrevious` is false. */
  status: Record<string, OracleDiffStatus>;
  /** Previous keys the current scan no longer reports (previous order). */
  resolved: string[];
  newCount: number;
}

export const EMPTY_ORACLE_DIFF: OracleScanDiff = { hasPrevious: false, status: {}, resolved: [], newCount: 0 };

export function diffOracleScans(
  prevKeys: readonly string[] | null | undefined,
  current: ReadonlyArray<{ id: string }>,
): OracleScanDiff {
  if (!prevKeys) return { hasPrevious: false, status: {}, resolved: [], newCount: 0 };
  const prev = new Set(prevKeys);
  const now = new Set<string>();
  const status: Record<string, OracleDiffStatus> = {};
  let newCount = 0;
  for (const { id } of current) {
    now.add(id);
    const s: OracleDiffStatus = prev.has(id) ? 'persisting' : 'new';
    if (s === 'new' && status[id] !== 'new') newCount++;
    status[id] = s;
  }
  const resolved = [...prev].filter((k) => !now.has(k));
  return { hasPrevious: true, status, resolved, newCount };
}
