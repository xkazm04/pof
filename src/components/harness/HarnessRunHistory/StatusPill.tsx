import { OPACITY_15, withOpacity } from '@/lib/chart-colors';
import type { HarnessRunSummary } from '@/lib/harness-runs-db';
import { STATUS_TONE } from './constants';

export function StatusPill({ status }: { status: HarnessRunSummary['status'] }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border"
      style={{ color: tone, background: withOpacity(tone, OPACITY_15), borderColor: tone }}
    >
      {status}
    </span>
  );
}
