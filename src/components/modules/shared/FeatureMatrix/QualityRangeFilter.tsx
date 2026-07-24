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
      role="group"
      aria-label="Filter by quality rating"
      title={`Show only features rated ${min} to ${max} stars`}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all"
      style={{
        backgroundColor: isActive ? statusBg(STATUS_WARNING) : 'transparent',
        border: isActive ? `1px solid ${statusBorder(STATUS_WARNING)}` : '1px solid var(--border)',
      }}
    >
      <Star
        className="w-3 h-3 flex-shrink-0"
        style={{ color: STATUS_WARNING, fill: isActive ? STATUS_WARNING : 'none' }}
        aria-hidden="true"
      />
      <select
        value={min}
        aria-label="Minimum quality rating (stars)"
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          onMinChange(v);
          if (v > max) onMaxChange(v);
        }}
        className="bg-transparent text-text text-xs outline-none cursor-pointer [&>option]:bg-surface-hover"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <span className="text-text-muted" aria-hidden="true">-</span>
      <select
        value={max}
        aria-label="Maximum quality rating (stars)"
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
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
