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
        <caption className="sr-only">
          Harness runs, newest first. Use the A and B buttons in the Compare column to pick two runs to diff.
        </caption>
        <thead className="bg-surface-deep/40 text-text-muted">
          <tr>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">Compare</th>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">Run</th>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">Started</th>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">Status</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium" title="Passing features as a percentage of total">Pass</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium" title="Completed · failed / total build areas">Areas</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Duration</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Cost</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium" title="CLI sessions spawned by this run">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const isA = r.runId === baseId;
            const isB = r.runId === headId;
            const short = r.runId.slice(-8);
            return (
              <tr key={r.runId} className="border-t border-border/20 hover:bg-surface-deep/20">
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    <SlotButton label="A" runLabel={short} slotName="base" active={isA} onClick={() => onPick('A', r.runId)} />
                    <SlotButton label="B" runLabel={short} slotName="head" active={isB} onClick={() => onPick('B', r.runId)} />
                  </div>
                </td>
                <td className="px-2 py-1.5 font-mono text-text">{short}</td>
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

function SlotButton(props: {
  label: 'A' | 'B';
  runLabel: string;
  slotName: 'base' | 'head';
  active: boolean;
  onClick: () => void;
}) {
  const { label, runLabel, slotName, active, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Run ${runLabel} as compare ${slotName} (${label})`}
      title={`Use run ${runLabel} as compare ${slotName} (${label})`}
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
