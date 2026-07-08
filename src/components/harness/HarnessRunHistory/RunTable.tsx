import { ACCENT_RED, OPACITY_15, STATUS_SUCCESS, withOpacity } from '@/lib/chart-colors';
import type { HarnessRunSummary } from '@/lib/harness-runs-db';
import { StatusPill } from './StatusPill';
import { fmtDuration, fmtPct, fmtUsd } from './helpers';

export function RunTable(props: {
  runs: HarnessRunSummary[];
  baseId: string | null;
  headId: string | null;
  onPick: (slot: 'A' | 'B', id: string) => void;
}) {
  const { runs, baseId, headId, onPick } = props;
  return (
    <div className="overflow-x-auto rounded border border-border/40">
      <table className="w-full text-xs">
        <thead className="bg-surface-deep/40 text-text-muted">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Compare</th>
            <th className="px-2 py-1.5 text-left font-medium">Run</th>
            <th className="px-2 py-1.5 text-left font-medium">Started</th>
            <th className="px-2 py-1.5 text-left font-medium">Status</th>
            <th className="px-2 py-1.5 text-right font-medium">Pass</th>
            <th className="px-2 py-1.5 text-right font-medium">Areas</th>
            <th className="px-2 py-1.5 text-right font-medium">Duration</th>
            <th className="px-2 py-1.5 text-right font-medium">Cost</th>
            <th className="px-2 py-1.5 text-right font-medium">Sess.</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const isA = r.runId === baseId;
            const isB = r.runId === headId;
            return (
              <tr key={r.runId} className="border-t border-border/20 hover:bg-surface-deep/20">
                <td className="px-2 py-1.5 flex gap-1">
                  <SlotButton label="A" active={isA} onClick={() => onPick('A', r.runId)} />
                  <SlotButton label="B" active={isB} onClick={() => onPick('B', r.runId)} />
                </td>
                <td className="px-2 py-1.5 font-mono text-text">{r.runId.slice(-8)}</td>
                <td className="px-2 py-1.5 text-text-muted">{new Date(r.startedAt).toLocaleString()}</td>
                <td className="px-2 py-1.5"><StatusPill status={r.status} /></td>
                <td className="px-2 py-1.5 text-right text-text tabular-nums">
                  {fmtPct(r.passRate, 0)}
                  <span className="text-text-muted"> · {r.passingFeatures}/{r.totalFeatures}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span style={{ color: STATUS_SUCCESS }}>{r.completedAreas}</span>
                  {r.failedAreas > 0 && <> <span style={{ color: ACCENT_RED }}>·{r.failedAreas}</span></>}
                  <span className="text-text-muted">/{r.totalAreas}</span>
                </td>
                <td className="px-2 py-1.5 text-right text-text-muted tabular-nums">{fmtDuration(r.durationMs)}</td>
                <td className="px-2 py-1.5 text-right text-text tabular-nums">{fmtUsd(r.spentUsd)}</td>
                <td className="px-2 py-1.5 text-right text-text-muted tabular-nums">{r.sessions}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SlotButton({ label, active, onClick }: { label: 'A' | 'B'; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="w-5 h-5 inline-flex items-center justify-center rounded-full border text-[10px] focus-ring"
      style={{
        borderColor: active ? STATUS_SUCCESS : undefined,
        color: active ? STATUS_SUCCESS : undefined,
        background: active ? withOpacity(STATUS_SUCCESS, OPACITY_15) : undefined,
      }}
    >
      {label}
    </button>
  );
}
