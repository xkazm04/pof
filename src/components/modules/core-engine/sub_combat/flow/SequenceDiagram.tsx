'use client';

import { withOpacity, OPACITY_12 } from '@/lib/chart-colors';
import { SEQ_LANES, SEQ_EVENTS } from '../_shared/data';

/* ── Sequence Diagram SVG ──────────────────────────────────────────────── */

const SEQ_SVG_H = 50 + SEQ_EVENTS.length * 34 + 10;

/* Activation boxes: computed from event flow */
interface SeqActivation { laneIdx: number; y1: number; y2: number }
const SEQ_ACTIVATIONS: SeqActivation[] = (() => {
  const result: SeqActivation[] = [];
  const active: Record<string, number | null> = {};
  for (let i = 0; i < SEQ_EVENTS.length; i++) {
    const y = 50 + i * 34;
    const evt = SEQ_EVENTS[i];
    if (evt.fromLane !== evt.toLane && active[evt.fromLane] != null) {
      const li = SEQ_LANES.findIndex(l => l.id === evt.fromLane);
      result.push({ laneIdx: li, y1: active[evt.fromLane]!, y2: y + 4 });
      active[evt.fromLane] = null;
    }
    if (active[evt.toLane] == null) active[evt.toLane] = y - 4;
  }
  const endY = 50 + (SEQ_EVENTS.length - 1) * 34 + 16;
  for (const [laneId, startY] of Object.entries(active)) {
    if (startY != null) {
      const li = SEQ_LANES.findIndex(l => l.id === laneId);
      result.push({ laneIdx: li, y1: startY, y2: endY });
    }
  }
  return result;
})();

export function SequenceDiagram() {
  return (
    <svg width="400" height={SEQ_SVG_H} viewBox={`0 0 400 ${SEQ_SVG_H}`} className="overflow-visible">
      {/* Lifelines */}
      {SEQ_LANES.map((lane, i) => {
        const x = 60 + i * 100;
        return (
          <g key={lane.id}>
            <line x1={x} y1={30} x2={x} y2={SEQ_SVG_H} stroke={lane.color} strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
            <rect x={x - 38} y={4} width="76" height="22" rx="4" fill={withOpacity(lane.color, OPACITY_12)} stroke={lane.color} strokeWidth="1" />
            <text x={x} y={18} textAnchor="middle" className="text-xs font-mono font-bold" fill={lane.color}>{lane.label}</text>
          </g>
        );
      })}

      {/* Activation boxes */}
      {SEQ_ACTIVATIONS.map((act, i) => {
        const x = 60 + act.laneIdx * 100;
        const lane = SEQ_LANES[act.laneIdx];
        return (
          <rect key={`act-${i}`} x={x - 4} y={act.y1} width={8} height={act.y2 - act.y1} rx={1}
            fill={withOpacity(lane.color, OPACITY_12)} stroke={lane.color} strokeWidth={0.5} strokeOpacity={0.3} />
        );
      })}

      {/* Events */}
      {SEQ_EVENTS.map((evt, i) => {
        const y = 50 + i * 34;
        const fromIdx = SEQ_LANES.findIndex(l => l.id === evt.fromLane);
        const toIdx = SEQ_LANES.findIndex(l => l.id === evt.toLane);
        const fromX = 60 + fromIdx * 100;
        const toX = 60 + toIdx * 100;
        const isSelf = fromIdx === toIdx;
        return (
          <g key={evt.label + i}>
            {isSelf ? (
              <>
                <circle cx={fromX} cy={y} r="4" fill={evt.color} opacity="0.8" />
                <text x={fromX + 10} y={y + 3} className="text-xs font-mono" fill={evt.color}>{evt.label}</text>
              </>
            ) : (
              <>
                <line x1={fromX} y1={y} x2={toX} y2={y} stroke={evt.color} strokeWidth="1.5" />
                <circle cx={fromX} cy={y} r="3" fill={evt.color} />
                <polygon points={`${toX - 6},${y - 3} ${toX},${y} ${toX - 6},${y + 3}`} fill={evt.color} />
                <text x={(fromX + toX) / 2} y={y - 6} textAnchor="middle" className="text-xs font-mono" fill={evt.color}>{evt.label}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
