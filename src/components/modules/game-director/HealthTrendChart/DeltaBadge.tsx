import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';

export function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 1) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono"
        style={{ color: 'var(--text-muted)' }}
      >
        <Minus className="w-2.5 h-2.5" />
        flat
      </span>
    );
  }
  const positive = delta > 0;
  const color = positive ? STATUS_SUCCESS : STATUS_ERROR;
  const Arrow = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono"
      style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
    >
      <Arrow className="w-2.5 h-2.5" />
      {positive ? '+' : ''}{delta.toFixed(0)} pts
    </span>
  );
}
