import {
  STATUS_SUCCESS, STATUS_ERROR,
  OVERLAY_WHITE,
  withOpacity, OPACITY_10, OPACITY_30,
} from '@/lib/chart-colors';

/* ══════════════════════════════════════════════════════════════════════════
   SVG SPARKLINE
   ══════════════════════════════════════════════════════════════════════════ */

export function Sparkline({ data, color, width = 200, height = 40, label, currentIdx }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  label: string;
  currentIdx: number | null;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const currentVal = currentIdx != null ? data[currentIdx] : data[data.length - 1];
  const startVal = data[0];
  const delta = currentVal - startVal;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-mono font-bold truncate" style={{ color }}>{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono font-bold" style={{ color }}>
              {currentVal % 1 === 0 ? currentVal : currentVal.toFixed(1)}
            </span>
            {delta !== 0 && (
              <span
                className="text-xs font-mono"
                style={{ color: delta > 0 ? STATUS_SUCCESS : STATUS_ERROR }}
              >
                {delta > 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible block">
          {/* Fill area */}
          <polygon
            points={`0,${height} ${points} ${width},${height}`}
            fill={`${withOpacity(color, OPACITY_10)}`}
          />
          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {/* Current position dot */}
          {currentIdx != null && (() => {
            const x = (currentIdx / (data.length - 1)) * width;
            const y = height - ((data[currentIdx] - min) / range) * (height - 4) - 2;
            return (
              <circle cx={x} cy={y} r={3} fill={color} stroke="var(--surface)" strokeWidth={1.5}>
                <animate attributeName="r" values="3;4;3" dur="1.5s" repeatCount="indefinite" />
              </circle>
            );
          })()}
          {/* Min/max labels */}
          <text x={width + 2} y={4} fill={withOpacity(OVERLAY_WHITE, OPACITY_30)} fontSize={9} fontFamily="monospace">
            {max % 1 === 0 ? max : max.toFixed(1)}
          </text>
          <text x={width + 2} y={height} fill={withOpacity(OVERLAY_WHITE, OPACITY_30)} fontSize={9} fontFamily="monospace">
            {min % 1 === 0 ? min : min.toFixed(1)}
          </text>
        </svg>
      </div>
    </div>
  );
}
