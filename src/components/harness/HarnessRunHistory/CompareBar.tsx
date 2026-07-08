import { useMemo } from 'react';
import { ArrowRight, GitCompareArrows, Loader2 } from 'lucide-react';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import type { HarnessRunSummary } from '@/lib/harness-runs-db';

export function CompareBar(props: {
  baseId: string | null;
  headId: string | null;
  runs: HarnessRunSummary[];
  onCompare: () => void;
  canCompare: boolean;
  loading: boolean;
}) {
  const { baseId, headId, runs, onCompare, canCompare, loading } = props;
  const baseRun = useMemo(() => runs.find((r) => r.runId === baseId), [runs, baseId]);
  const headRun = useMemo(() => runs.find((r) => r.runId === headId), [runs, headId]);

  return (
    <div className="flex items-center gap-2 p-2 rounded border border-border/40 bg-surface-deep/30">
      <SlotChip slot="A" run={baseRun} />
      <ArrowRight className="w-3 h-3 text-text-muted" />
      <SlotChip slot="B" run={headRun} />
      <button
        type="button"
        onClick={onCompare}
        disabled={!canCompare || loading}
        className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: canCompare ? STATUS_SUCCESS : 'transparent', color: canCompare ? STATUS_SUCCESS : undefined }}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitCompareArrows className="w-3 h-3" />}
        Compare
      </button>
    </div>
  );
}

function SlotChip({ slot, run }: { slot: 'A' | 'B'; run: HarnessRunSummary | undefined }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="w-5 h-5 inline-flex items-center justify-center rounded-full border border-border/60 text-[10px] text-text-muted">
        {slot}
      </span>
      {run ? (
        <span className="font-mono">{run.runId.slice(-8)}</span>
      ) : (
        <span className="text-text-muted italic">pick a row</span>
      )}
    </div>
  );
}
