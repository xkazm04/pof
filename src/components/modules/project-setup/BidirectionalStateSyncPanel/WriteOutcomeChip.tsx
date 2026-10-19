import { STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING, ACCENT_CYAN, OPACITY_15 } from '@/lib/chart-colors';
import type { WriteOutcomeLabel } from './conflictResolution';

const COLOR: Record<WriteOutcomeLabel, string> = {
  sent: ACCENT_CYAN,
  applying: STATUS_WARNING,
  applied: STATUS_SUCCESS,
  conflict: STATUS_ERROR,
  'not sent': STATUS_ERROR,
};

/** Where the last write on this property stands: text, not colour alone. */
export function WriteOutcomeChip({ outcome }: { outcome: WriteOutcomeLabel }) {
  const color = COLOR[outcome];
  return (
    <span
      data-testid="write-outcome-chip"
      className="px-1 py-0.5 rounded text-2xs font-bold flex-shrink-0"
      style={{ color, backgroundColor: `${color}${OPACITY_15}` }}
    >
      {outcome}
    </span>
  );
}
