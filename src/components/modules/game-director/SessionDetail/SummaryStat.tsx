import { Target } from 'lucide-react';

export function SummaryStat({
  icon: Icon,
  label,
  value,
  color,
  muted = false,
}: {
  icon: typeof Target;
  label: string;
  value: number | string;
  color: string;
  /**
   * True when the value is a "not measured" placeholder rather than a figure.
   * It is de-emphasised so an absent measurement never reads with the same
   * weight as a real one.
   */
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3" style={{ color }} />
      <span className="text-2xs text-text-muted">{label}</span>
      <span className={muted ? 'text-2xs italic text-text-muted' : 'text-xs font-semibold text-text'}>
        {value}
      </span>
    </div>
  );
}
