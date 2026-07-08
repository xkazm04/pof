import { Radar as RadarIcon } from 'lucide-react';
import type { EvaluatorReport, ModuleScore } from '@/types/evaluator';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_STALE, OPACITY_8, OPACITY_30 } from '@/lib/chart-colors';
import { EVAL_ACCENT, RADAR_CX, RADAR_CY, RADAR_R, RADAR_RINGS } from './constants';
import { polarToXY, scoreColor } from './helpers';

type RadarDatum = ModuleScore & { angle: number; label: string };
type PrevRadarDatum = ModuleScore & { angle: number };

export function HealthRadarChart({
  lastScan,
  radarData,
  prevRadarData,
  radarPath,
  prevRadarPath,
  showHistoryOverlay,
  selectedModule,
  setSelectedModule,
  healthPulseColor,
}: {
  lastScan: EvaluatorReport;
  radarData: RadarDatum[];
  prevRadarData: PrevRadarDatum[] | null;
  radarPath: string;
  prevRadarPath: string;
  showHistoryOverlay: boolean;
  selectedModule: string | null;
  setSelectedModule: (v: string | null) => void;
  healthPulseColor: string;
}) {
  return (
    <SurfaceCard level={3} className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <RadarIcon className="w-3.5 h-3.5 text-[#ef4444]" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Module Health Radar
        </span>
        {showHistoryOverlay && prevRadarData && (
          <span className="text-2xs text-[#8b5cf6] ml-auto">
            Purple = previous scan
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${RADAR_CX * 2} ${RADAR_CY * 2}`}
        className="w-full max-w-sm mx-auto"
        style={{ maxHeight: 300 }}
      >
        {/* Background rings */}
        {Array.from({ length: RADAR_RINGS }, (_, i) => {
          const r = ((i + 1) / RADAR_RINGS) * RADAR_R;
          return (
            <circle
              key={i}
              cx={RADAR_CX}
              cy={RADAR_CY}
              r={r}
              fill="none"
              stroke="var(--border)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Axis lines */}
        {radarData.map((d) => {
          const { x, y } = polarToXY(d.angle, RADAR_R);
          return (
            <line
              key={`axis-${d.moduleId}`}
              x1={RADAR_CX}
              y1={RADAR_CY}
              x2={x}
              y2={y}
              stroke="var(--border)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Previous scan overlay */}
        {showHistoryOverlay && prevRadarPath && (
          <polygon
            points={prevRadarPath}
            fill={`${STATUS_STALE}${OPACITY_8}`}
            stroke={`${STATUS_STALE}${OPACITY_30}`}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {/* Current scan polygon */}
        <polygon
          points={radarPath}
          fill={`${EVAL_ACCENT}12`}
          stroke={`${EVAL_ACCENT}60`}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Module nodes (clickable) */}
        {radarData.map((d) => {
          const r = (d.score / 100) * RADAR_R;
          const { x, y } = polarToXY(d.angle, r);
          const labelPos = polarToXY(d.angle, RADAR_R + 16);
          const isSelected = selectedModule === d.moduleId;
          const color = scoreColor(d.score);

          return (
            <g key={d.moduleId} className="cursor-pointer" onClick={() => setSelectedModule(isSelected ? null : d.moduleId)}>
              {/* Hit area */}
              <circle cx={x} cy={y} r={12} fill="transparent" />
              {/* Dot */}
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 5 : 4}
                fill={isSelected ? color : `${color}80`}
                stroke={isSelected ? color : 'none'}
                strokeWidth={isSelected ? 2 : 0}
              />
              {/* Score badge on selected */}
              {isSelected && (
                <>
                  <rect
                    x={x - 12}
                    y={y - 20}
                    width={24}
                    height={14}
                    rx={4}
                    fill="var(--surface-deep)"
                    stroke={color}
                    strokeWidth={0.5}
                  />
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    className="text-2xs font-bold"
                    fill={color}
                  >
                    {d.score}
                  </text>
                </>
              )}
              {/* Label */}
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-2xs font-medium"
                fill={isSelected ? 'var(--text)' : 'var(--text-muted)'}
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {/* Center score */}
        <text
          x={RADAR_CX}
          y={RADAR_CY - 6}
          textAnchor="middle"
          className="text-[18px] font-bold"
          fill={healthPulseColor}
        >
          {lastScan.overallScore}
        </text>
        <text
          x={RADAR_CX}
          y={RADAR_CY + 10}
          textAnchor="middle"
          className="text-2xs"
          fill="var(--text-muted)"
        >
          overall
        </text>
      </svg>
    </SurfaceCard>
  );
}
