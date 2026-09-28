'use client';

import { Wand2, Loader2 } from 'lucide-react';
import type { ConsistencyViolation, ViolationType } from '@/lib/asset-code-oracle';
import { REMEDIABLE_TYPES, remedyLabel } from '@/lib/asset-oracle/oracleRemedy';
import { STATUS_INFO, STATUS_SUCCESS, STATUS_ERROR, statusBg, statusBorder } from '@/lib/chart-colors';
import type { RemedyRun } from './useAssetCodeOracle';

/**
 * One "Fix N <type>" button per violation type the CLI can remedy without a
 * delete. Each click is ONE CLI run; its completion re-runs the analysis, and
 * the outcome line says how many of the targeted keys the rescan still reports.
 */
export function RemedyBar({
  violations, onFix, running, remedy,
}: {
  violations: ConsistencyViolation[];
  onFix: (type: ViolationType) => void;
  running: boolean;
  remedy: RemedyRun | null;
}) {
  const counts = REMEDIABLE_TYPES
    .map((type) => ({ type, count: violations.filter((v) => v.type === type).length }))
    .filter((c) => c.count > 0);
  if (counts.length === 0 && !remedy) return null;

  const ids = new Set(violations.map((v) => v.id));
  const remaining = remedy ? remedy.keys.filter((k) => ids.has(k)).length : 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {counts.map(({ type, count }) => (
        <button
          key={type}
          onClick={() => onFix(type)}
          disabled={running}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-medium transition-all disabled:opacity-50 hover:brightness-110"
          style={{ color: STATUS_INFO, backgroundColor: statusBg(STATUS_INFO), border: `1px solid ${statusBorder(STATUS_INFO)}` }}
        >
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          {remedyLabel(type, count)}
        </button>
      ))}
      {remedy && (
        <span className="text-2xs text-text-muted" role="status">
          {remedy.success === null ? (
            <>{remedy.label}: running in the CLI; the oracle re-scans when it finishes.</>
          ) : (
            <>
              {remedy.label}:{' '}
              <span style={{ color: remaining === 0 ? STATUS_SUCCESS : STATUS_ERROR }}>
                {remaining === 0
                  ? `all ${remedy.keys.length} resolved on the rescan`
                  : `${remaining} of ${remedy.keys.length} still reported on the rescan${remedy.success ? '' : ' (the CLI run failed; see its terminal)'}`}
              </span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
