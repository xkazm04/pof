import type { BurnChartPoint } from '@/types/project-health';
import { ACCENT_EMERALD, STATUS_INFO, STATUS_NEUTRAL, OPACITY_20 } from '@/lib/chart-colors';

// ── Simple Chart Components (CSS-based, no chart library) ───────────────────

export function BarChartSimple({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-text-muted">{d.value}</span>
          <div className="w-full bg-surface rounded-t relative" style={{ height: '100%' }}>
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t transition-all"
              style={{ height: `${(d.value / max) * 100}%`, backgroundColor: color, minHeight: d.value > 0 ? 4 : 0 }}
            />
          </div>
          <span className="text-xs text-text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LineChartSimple({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const h = 120;

  return (
    <div className="relative" style={{ height: h + 24 }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((pct) => (
        <div
          key={pct}
          className="absolute left-0 right-0 border-t border-border/30"
          style={{ top: h - (pct / 100) * h }}
        />
      ))}
      {/* Points and lines */}
      <svg className="absolute inset-0" viewBox={`0 0 ${data.length * 60} ${h}`} preserveAspectRatio="none">
        {/* Line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={data
            .map((d, i) => `${i * 60 + 30},${h - ((d.value - min) / range) * (h - 16) - 8}`)
            .join(' ')}
        />
        {/* Dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={i * 60 + 30}
            cy={h - ((d.value - min) / range) * (h - 16) - 8}
            r="3"
            fill={color}
          />
        ))}
      </svg>
      {/* Labels */}
      <div className="absolute left-0 right-0 flex justify-around" style={{ top: h + 4 }}>
        {data.map((d) => (
          <span key={d.label} className="text-xs text-text-muted">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function AreaChartSimple({ data, total }: { data: { label: string; completed: number; ideal: number }[]; total: number }) {
  if (data.length === 0) return null;
  const h = 120;
  const w = data.length * 60;
  const safeTotal = total || 1;

  return (
    <div className="relative" style={{ height: h + 24 }}>
      <svg className="absolute inset-0" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Ideal line (dashed) */}
        <polyline
          fill="none"
          stroke={STATUS_NEUTRAL}
          strokeWidth="1.5"
          strokeDasharray="4,3"
          points={data.map((d, i) => `${i * 60 + 30},${h - (d.ideal / safeTotal) * (h - 16) - 8}`).join(' ')}
        />
        {/* Completed area */}
        <polygon
          fill={`${ACCENT_EMERALD}${OPACITY_20}`}
          stroke={ACCENT_EMERALD}
          strokeWidth="2"
          points={[
            `${30},${h - 8}`,
            ...data.map((d, i) => `${i * 60 + 30},${h - (d.completed / safeTotal) * (h - 16) - 8}`),
            `${(data.length - 1) * 60 + 30},${h - 8}`,
          ].join(' ')}
        />
      </svg>
      <div className="absolute left-0 right-0 flex justify-around" style={{ top: h + 4 }}>
        {data.map((d) => (
          <span key={d.label} className="text-xs text-text-muted">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function BurndownChart({ data, total }: { data: BurnChartPoint[]; total: number }) {
  if (data.length === 0) return null;
  const h = 120;
  const w = data.length * 60;
  const safeTotal = total || 1;

  return (
    <div className="relative" style={{ height: h + 24 }}>
      <svg className="absolute inset-0" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Ideal burndown (dashed) */}
        <polyline
          fill="none"
          stroke={STATUS_NEUTRAL}
          strokeWidth="1.5"
          strokeDasharray="4,3"
          points={data.map((d, i) => `${i * 60 + 30},${(d.idealRemaining / safeTotal) * (h - 16) + 8}`).join(' ')}
        />
        {/* Actual remaining */}
        <polyline
          fill="none"
          stroke={STATUS_INFO}
          strokeWidth="2"
          points={data.map((d, i) => `${i * 60 + 30},${(d.remaining / safeTotal) * (h - 16) + 8}`).join(' ')}
        />
        {/* Dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={i * 60 + 30}
            cy={(d.remaining / safeTotal) * (h - 16) + 8}
            r="3"
            fill={STATUS_INFO}
          />
        ))}
      </svg>
      <div className="absolute left-0 right-0 flex justify-around" style={{ top: h + 4 }}>
        {data.map((d) => (
          <span key={d.weekLabel} className="text-xs text-text-muted">{d.weekLabel}</span>
        ))}
      </div>
      {/* Legend */}
      <div className="absolute top-1 right-1 flex items-center gap-3">
        <span className="text-xs text-text-muted flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-400 inline-block rounded" /> Actual
        </span>
        <span className="text-xs text-text-muted flex items-center gap-1">
          <span className="w-3 h-0.5 bg-gray-500 inline-block rounded border-dashed" style={{ borderTop: `1.5px dashed ${STATUS_NEUTRAL}` }} /> Ideal
        </span>
      </div>
    </div>
  );
}
