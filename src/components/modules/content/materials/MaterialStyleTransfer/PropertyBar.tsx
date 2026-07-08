import { Gem } from 'lucide-react';

export function PropertyBar({
  label,
  value,
  max,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: typeof Gem;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-deep border border-border">
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-2xs text-text-muted">{label}</span>
          <span className="text-2xs font-mono" style={{ color }}>
            {value > 1 ? value.toFixed(1) : value.toFixed(2)}
          </span>
        </div>
        <div className="h-1 bg-surface rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-base" style={{ width: `${pct}%`, backgroundColor: `${color}80` }} />
        </div>
      </div>
    </div>
  );
}
