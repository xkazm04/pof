import { Star } from 'lucide-react';
import { STATUS_WARNING, statusBg, statusBorder } from '@/lib/chart-colors';

export function QualityRangeFilter({
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  min: number;
  max: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}) {
  const isActive = min > 1 || max < 5;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all"
      style={{
        backgroundColor: isActive ? statusBg(STATUS_WARNING) : 'transparent',
        border: isActive ? `1px solid ${statusBorder(STATUS_WARNING)}` : '1px solid var(--border)',
      }}
    >
      <Star className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_WARNING, fill: isActive ? STATUS_WARNING : 'none' }} />
      <select
        value={min}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          onMinChange(v);
          if (v > max) onMaxChange(v);
        }}
        className="bg-transparent text-text text-xs outline-none cursor-pointer [&>option]:bg-surface-hover"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <span className="text-text-muted">-</span>
      <select
        value={max}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          onMaxChange(v);
          if (v < min) onMinChange(v);
        }}
        className="bg-transparent text-text text-xs outline-none cursor-pointer [&>option]:bg-surface-hover"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}
