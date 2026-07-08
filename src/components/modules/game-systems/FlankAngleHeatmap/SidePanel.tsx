'use client';

import { Dispatch, SetStateAction } from 'react';
import { Info } from 'lucide-react';
import { ACCENT_VIOLET, STATUS_WARNING, OPACITY_10 } from '@/lib/chart-colors';
import { eqsFloat } from '@/lib/ai-director/eqs-defaults';
import { ATTACK_DISTANCE, NUMBER_OF_POINTS } from './constants';
import type { RingPoint } from './helpers';

interface SidePanelProps {
  forwardDeg: number;
  points: RingPoint[];
  setHoveredPoint: Dispatch<SetStateAction<number | null>>;
}

export function SidePanel({ forwardDeg, points, setHoveredPoint }: SidePanelProps) {
  return (
    <div className="flex-1 p-4 border-t sm:border-t-0 sm:border-l border-border/40 space-y-3 min-w-0">
      {/* Parameters */}
      <div>
        <h4 className="text-xs font-bold text-text mb-2">Generator + Test Parameters</h4>
        <div className="space-y-1.5">
          {[
            { label: 'AttackDistance', value: eqsFloat(ATTACK_DISTANCE), desc: 'Ring radius' },
            { label: 'NumberOfPoints', value: String(NUMBER_OF_POINTS), desc: 'Evenly spaced' },
            { label: 'Forward', value: `${forwardDeg.toFixed(0)}°`, desc: 'Drag to rotate' },
          ].map((p) => (
            <div key={p.label} className="flex items-baseline gap-2">
              <span className="text-2xs font-mono shrink-0" style={{ color: ACCENT_VIOLET }}>{p.label}</span>
              <span className="text-2xs font-mono font-bold text-text">{p.value}</span>
              <span className="text-2xs text-text-muted ml-auto">{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Algorithm */}
      <div>
        <h4 className="text-xs font-bold text-text mb-1.5">Scoring Algorithm</h4>
        <div className="text-2xs text-text-muted leading-relaxed space-y-1">
          <p className="font-mono" style={{ color: ACCENT_VIOLET }}>
            for each generated point:
          </p>
          <div className="pl-3 space-y-0.5">
            <p><span className="font-mono text-text">Dir</span> = normalize(Point - Target)</p>
            <p><span className="font-mono text-text">Dot</span> = dot(TargetForward, Dir)</p>
            <p><span className="font-mono text-text">Angle</span> = acos(clamp(Dot, -1, 1))</p>
            <p><span className="font-mono text-text">Score</span> = Angle in degrees (0-180)</p>
          </div>
          <p className="mt-1">
            <span className="font-mono text-text">SetWorkOnFloatValues(true)</span> → UE5 normalizes 0-180 to 0.0-1.0
          </p>
        </div>
      </div>

      {/* Score distribution */}
      <div>
        <h4 className="text-xs font-bold text-text mb-1.5">Current Scores</h4>
        <div className="space-y-1">
          {points.map((pt, i) => (
            <div
              key={i}
              className="flex items-center gap-2"
              onPointerEnter={() => setHoveredPoint(i)}
              onPointerLeave={() => setHoveredPoint(null)}
              data-testid={`flank-score-row-${i}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: pt.color }}
              />
              <span className="text-2xs font-mono text-text-muted w-8 shrink-0">
                P{i + 1}
              </span>
              <div className="flex-1 h-3 bg-surface-deep/50 rounded-sm overflow-hidden border border-border/30">
                <div
                  className="h-full rounded-sm"
                  style={{
                    backgroundColor: pt.color,
                    width: `${(pt.flankDeg / 180) * 100}%`,
                    opacity: 0.7,
                  }}
                />
              </div>
              <span
                className="text-2xs font-mono font-bold w-8 text-right shrink-0"
                style={{ color: pt.color }}
              >
                {Math.round(pt.flankDeg)}°
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Nav projection note */}
      <div
        className="flex items-start gap-2 px-3 py-2 rounded-lg text-2xs"
        style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
        data-testid="flank-angle-nav-note"
      >
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Higher scores are <strong>preferred</strong> by default (behind = better flanking).
          The EQS normalizes 0-180° to 0.0-1.0, then <code className="font-mono">PathExists</code> filters
          unreachable points.
        </span>
      </div>

      {/* Interaction hint */}
      <div className="text-2xs text-text-muted italic">
        Drag the cyan arrow handle to rotate the target&apos;s forward direction and watch scores update in real-time.
      </div>
    </div>
  );
}
