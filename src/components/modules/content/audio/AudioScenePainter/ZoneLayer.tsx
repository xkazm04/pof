import type { AudioZone } from '@/types/audio-scene';
import { STATUS_ERROR } from '@/lib/chart-colors';
import { ZONE_COLORS } from './constants';
import type { PaintMode } from './types';

export function ZoneLayer({
  zones,
  selectedZoneId,
  highlightedParentZoneId,
  accentColor,
  paintMode,
  handleZoneMouseDown,
  handleResizeStart,
  deleteZone,
}: {
  zones: AudioZone[];
  selectedZoneId: string | null;
  highlightedParentZoneId: string | null;
  accentColor: string;
  paintMode: PaintMode;
  handleZoneMouseDown: (e: React.MouseEvent, zoneId: string) => void;
  handleResizeStart: (e: React.MouseEvent, zoneId: string, handle: string) => void;
  deleteZone: (zoneId: string) => void;
}) {
  return (
    <>
      {zones.map((zone) => {
        const isSelected = selectedZoneId === zone.id;
        const zoneColor = zone.color || ZONE_COLORS[zone.reverbPreset] || 'var(--text-muted)';
        const isParentOfSelectedEmitter = highlightedParentZoneId === zone.id;

        return (
          <g key={zone.id}>
            {/* Attenuation radius (outer glow) */}
            {zone.shape === 'circle' ? (
              <circle
                cx={zone.x} cy={zone.y}
                r={zone.attenuationRadius}
                fill={`url(#radar-glow)`}
                stroke={`${zoneColor}20`}
                strokeWidth={1}
                strokeDasharray="4,8"
              />
            ) : (
              <rect
                x={zone.x - 30} y={zone.y - 30}
                width={zone.width + 60} height={zone.height + 60}
                rx={12}
                fill={`url(#radar-glow)`}
                stroke={`${zoneColor}20`}
                strokeWidth={1}
                strokeDasharray="4,8"
              />
            )}

            {/* Zone body */}
            {zone.shape === 'circle' ? (
              <circle
                data-zone-id={zone.id}
                cx={zone.x} cy={zone.y}
                r={zone.width / 2}
                fill={`${zoneColor}10`}
                stroke={isSelected ? accentColor : `${zoneColor}60`}
                strokeWidth={isSelected ? 2 : 1.5}
                onMouseDown={(e) => handleZoneMouseDown(e, zone.id)}
                style={{ cursor: paintMode === 'select' ? 'pointer' : undefined, filter: isSelected ? `drop-shadow(0 0 10px ${accentColor}40)` : 'none' }}
              />
            ) : (
              <rect
                data-zone-id={zone.id}
                x={zone.x} y={zone.y}
                width={zone.width} height={zone.height}
                rx={2}
                fill={`${zoneColor}10`}
                stroke={isSelected ? accentColor : `${zoneColor}60`}
                strokeWidth={isSelected ? 2 : 1.5}
                onMouseDown={(e) => handleZoneMouseDown(e, zone.id)}
                style={{ cursor: paintMode === 'select' ? 'pointer' : undefined, filter: isSelected ? `drop-shadow(0 0 10px ${accentColor}40)` : 'none' }}
              />
            )}

            {/* Parent-zone highlight — soft ring shown while a child emitter is selected.
                Always mounted; stroke-opacity toggles so it eases in/out over 200ms. */}
            {zone.shape === 'circle' ? (
              <circle
                cx={zone.x} cy={zone.y}
                r={zone.width / 2}
                fill="none"
                stroke={zoneColor}
                strokeWidth={4}
                strokeOpacity={isParentOfSelectedEmitter ? 0.4 : 0}
                style={{
                  pointerEvents: 'none',
                  filter: `drop-shadow(0 0 12px ${zoneColor})`,
                  transition: 'stroke-opacity 200ms var(--ease-out)',
                }}
              />
            ) : (
              <rect
                x={zone.x} y={zone.y}
                width={zone.width} height={zone.height}
                rx={2}
                fill="none"
                stroke={zoneColor}
                strokeWidth={4}
                strokeOpacity={isParentOfSelectedEmitter ? 0.4 : 0}
                style={{
                  pointerEvents: 'none',
                  filter: `drop-shadow(0 0 12px ${zoneColor})`,
                  transition: 'stroke-opacity 200ms var(--ease-out)',
                }}
              />
            )}

            {/* Zone label */}
            <g style={{ pointerEvents: 'none' }}>
              {zone.shape === 'circle' ? (
                <>
                  <rect x={zone.x - 40} y={zone.y - zone.width / 2 - 16} width={80} height={14} rx={2} fill="var(--surface-deep)" stroke={`${zoneColor}40`} strokeWidth={1} />
                  <text x={zone.x} y={zone.y - zone.width / 2 - 6} textAnchor="middle" fontSize={8} fill={zoneColor} fontFamily="monospace" fontWeight={700} style={{ textTransform: 'uppercase' }}>{zone.name}</text>
                </>
              ) : (
                <>
                  <rect x={zone.x + 8} y={zone.y + 8} width={Math.max(80, zone.name.length * 6 + 10)} height={14} rx={2} fill="var(--surface-deep)" stroke={`${zoneColor}40`} strokeWidth={1} />
                  <text x={zone.x + 12} y={zone.y + 18} fontSize={8} fill={zoneColor} fontFamily="monospace" fontWeight={700} style={{ textTransform: 'uppercase' }}>{zone.name}</text>

                  <text x={zone.x + 12} y={zone.y + 32} fontSize={7} fill={`${zoneColor}80`} fontFamily="monospace" style={{ textTransform: 'uppercase' }}>[{zone.reverbPreset}]</text>
                </>
              )}
            </g>

            {/* Selection controls */}
            {isSelected && paintMode === 'select' && (
              <>
                {/* Corner brackets for rect */}
                {zone.shape === 'rect' && (
                  <>
                    <path d={`M ${zone.x - 4} ${zone.y + 10} L ${zone.x - 4} ${zone.y - 4} L ${zone.x + 10} ${zone.y - 4}`} fill="none" stroke={accentColor} strokeWidth={2} />
                    <path d={`M ${zone.x + zone.width - 10} ${zone.y - 4} L ${zone.x + zone.width + 4} ${zone.y - 4} L ${zone.x + zone.width + 4} ${zone.y + 10}`} fill="none" stroke={accentColor} strokeWidth={2} />
                    <path d={`M ${zone.x - 4} ${zone.y + zone.height - 10} L ${zone.x - 4} ${zone.y + zone.height + 4} L ${zone.x + 10} ${zone.y + zone.height + 4}`} fill="none" stroke={accentColor} strokeWidth={2} />
                    <path d={`M ${zone.x + zone.width - 10} ${zone.y + zone.height + 4} L ${zone.x + zone.width + 4} ${zone.y + zone.height + 4} L ${zone.x + zone.width + 4} ${zone.y + zone.height - 10}`} fill="none" stroke={accentColor} strokeWidth={2} />
                  </>
                )}

                {/* Delete button */}
                <g
                  transform={zone.shape === 'circle'
                    ? `translate(${zone.x + zone.width / 2 - 8},${zone.y - zone.width / 2 - 24})`
                    : `translate(${zone.x + zone.width - 24},${zone.y + 8})`}
                  onClick={(e) => { e.stopPropagation(); deleteZone(zone.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect x={0} y={0} width={16} height={16} rx={4} fill={`${STATUS_ERROR}20`} stroke={`${STATUS_ERROR}50`} />
                  <text x={5} y={12} fontSize={10} fill={STATUS_ERROR} fontFamily="sans-serif" fontWeight={700}>×</text>
                </g>

                {/* Resize handle (rect only) */}
                {zone.shape === 'rect' && (
                  <rect
                    x={zone.x + zone.width - 8}
                    y={zone.y + zone.height - 8}
                    width={16} height={16}
                    fill="transparent"
                    style={{ cursor: 'se-resize' }}
                    onMouseDown={(e) => handleResizeStart(e, zone.id, 'se')}
                  />
                )}
              </>
            )}
          </g>
        );
      })}
    </>
  );
}
