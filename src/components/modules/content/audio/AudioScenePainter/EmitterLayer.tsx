import type { AudioZone, SoundEmitter } from '@/types/audio-scene';
import {
  STATUS_INFO, STATUS_WARNING, STATUS_ERROR,
  withOpacity, OPACITY_20, OPACITY_60,
} from '@/lib/chart-colors';
import { EMITTER_COLORS } from './constants';
import { resolveZoneColor, zoneCentroid } from './helpers';
import type { PaintMode } from './types';

export function EmitterLayer({
  emitters,
  zoneById,
  selectedZoneId,
  selectedEmitterId,
  accentColor,
  paintMode,
  handleEmitterMouseDown,
  deleteEmitter,
}: {
  emitters: SoundEmitter[];
  zoneById: Map<string, AudioZone>;
  selectedZoneId: string | null;
  selectedEmitterId: string | null;
  accentColor: string;
  paintMode: PaintMode;
  handleEmitterMouseDown: (e: React.MouseEvent, emitterId: string) => void;
  deleteEmitter: (emitterId: string) => void;
}) {
  return (
    <>
      {/* Zone ↔ child-emitter connectors — faint dashed leaders from a zone's
          centroid to each of its emitters, revealed while that zone is selected.
          Rendered before the emitters so the lines pass beneath the glyphs. */}
      {emitters.map((em) => {
        if (!em.zoneId) return null;
        const parentZone = zoneById.get(em.zoneId);
        if (!parentZone) return null;
        const centroid = zoneCentroid(parentZone);
        const active = parentZone.id === selectedZoneId;
        return (
          <line
            key={`zone-link-${em.id}`}
            x1={centroid.x} y1={centroid.y}
            x2={em.x} y2={em.y}
            stroke={resolveZoneColor(parentZone)}
            strokeWidth={1}
            strokeDasharray="2,6"
            opacity={active ? 0.25 : 0}
            style={{ pointerEvents: 'none', transition: 'opacity 200ms var(--ease-out)' }}
          />
        );
      })}

      {/* Sound emitters */}
      {emitters.map((em) => {
        const isSelected = selectedEmitterId === em.id;
        const emColor = EMITTER_COLORS[em.type] || STATUS_INFO;
        const parentZone = em.zoneId ? zoneById.get(em.zoneId) : undefined;
        const isChildOfSelectedZone = !!parentZone && parentZone.id === selectedZoneId;
        const parentZoneColor = parentZone ? resolveZoneColor(parentZone) : emColor;

        return (
          <g key={em.id}>
            {/* Attenuation circle */}
            <circle
              cx={em.x} cy={em.y}
              r={em.attenuationRadius}
              fill={`url(#radar-glow)`}
              stroke={`${emColor}30`}
              strokeWidth={1}
              strokeDasharray="2,6"
              style={{ pointerEvents: 'none' }}
            />

            {/* Emitter body */}
            <circle
              cx={em.x} cy={em.y}
              r={10}
              fill="var(--surface-deep)"
              stroke={isSelected ? accentColor : emColor}
              strokeWidth={isSelected ? 2 : 1.5}
              onMouseDown={(e) => handleEmitterMouseDown(e, em.id)}
              style={{ cursor: paintMode === 'select' ? 'pointer' : undefined, filter: isSelected ? `drop-shadow(0 0 10px ${accentColor}50)` : `drop-shadow(0 0 5px ${emColor}40)` }}
            />

            {/* Membership ring — 1px stroke in the parent zone's color, eased in
                while that zone is selected so the emitter reads as a child of it. */}
            <circle
              cx={em.x} cy={em.y}
              r={13}
              fill="none"
              stroke={parentZoneColor}
              strokeWidth={1}
              opacity={isChildOfSelectedZone ? 1 : 0}
              style={{ pointerEvents: 'none', transition: 'opacity 200ms var(--ease-out)' }}
            />

            {/* Inner dot */}
            <circle
              cx={em.x} cy={em.y}
              r={isSelected ? 4 : 3}
              fill={isSelected ? accentColor : emColor}
              style={{ pointerEvents: 'none', transition: 'all 0.3s' }}
            />

            {/* Sound wave arcs (radar ripples) */}
            {em.type === 'ambient' || em.type === 'loop' || em.type === 'music' ? (
              <g style={{ pointerEvents: 'none' }}>
                <circle cx={em.x} cy={em.y} r={16} fill="none" stroke={emColor} strokeWidth={1} opacity={0.4} strokeDasharray="4,8" />
                <circle cx={em.x} cy={em.y} r={24} fill="none" stroke={emColor} strokeWidth={0.5} opacity={0.2} strokeDasharray="2,6" />
              </g>
            ) : null}

            {/* Label */}
            <g style={{ pointerEvents: 'none' }}>
              <rect x={em.x - 30} y={em.y - 28} width={60} height={14} rx={2} fill="var(--surface-deep)" stroke={`${emColor}40`} strokeWidth={1} />
              <text x={em.x} y={em.y - 18} textAnchor="middle" fontSize={7} fill={emColor} fontFamily="monospace" fontWeight={700} style={{ textTransform: 'uppercase' }}>{em.name}</text>
            </g>

            {/* Unzoned indicator — selected emitter has no parent zone to highlight */}
            {isSelected && !em.zoneId && (
              <g className="audio-rel-pill" style={{ pointerEvents: 'none' }}>
                <rect
                  x={em.x - 26} y={em.y - 44}
                  width={52} height={13} rx={6.5}
                  fill={withOpacity(STATUS_WARNING, OPACITY_20)}
                  stroke={withOpacity(STATUS_WARNING, OPACITY_60)}
                  strokeWidth={1}
                />
                <text
                  x={em.x} y={em.y - 34.5}
                  textAnchor="middle" fontSize={7}
                  fill={STATUS_WARNING} fontFamily="monospace" fontWeight={700}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                >Unzoned</text>
              </g>
            )}

            {/* Delete on selection */}
            {isSelected && paintMode === 'select' && (
              <g
                transform={`translate(${em.x + 12},${em.y - 12})`}
                onClick={(e) => { e.stopPropagation(); deleteEmitter(em.id); }}
                style={{ cursor: 'pointer' }}
              >
                <rect x={0} y={0} width={14} height={14} rx={3} fill={`${STATUS_ERROR}20`} stroke={`${STATUS_ERROR}50`} />
                <text x={4} y={10} fontSize={9} fill={STATUS_ERROR} fontFamily="sans-serif" fontWeight={700}>×</text>
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}
