import { CELL_SIZE } from './constants';
import { TransitionLines } from './TransitionLines';
import { ZoneCell } from './ZoneCell';
import type { StreamingZone, ZoneType, TransitionLine } from './types';

interface ZoneGridProps {
  gridSize: number;
  paintType: ZoneType | 'erase' | null;
  linkingFrom: string | null;
  transitionLines: TransitionLine[];
  zones: StreamingZone[];
  zoneAt: (x: number, y: number) => StreamingZone | null;
  handleCellClick: (x: number, y: number) => void;
  deleteTransition: (id: string) => void;
  selectedZoneId: string | null;
}

export function ZoneGrid({
  gridSize,
  paintType,
  linkingFrom,
  transitionLines,
  zones,
  zoneAt,
  handleCellClick,
  deleteTransition,
  selectedZoneId,
}: ZoneGridProps) {
  return (
    <div className="flex-1 min-w-[550px] bg-[#03030a] rounded-2xl border-2 border-surface-deep shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] p-4 relative overflow-hidden flex items-center justify-center">

      {/* Ambient Glows */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/5 blur-[80px] rounded-full pointer-events-none" />
      </div>

      <svg
        width={gridSize * CELL_SIZE + 2}
        height={gridSize * CELL_SIZE + 2}
        className="block"
        style={{
          cursor: paintType ? 'crosshair' : linkingFrom ? 'crosshair' : 'default',
        }}
      >
        {/* Grid dots background */}
        <defs>
          <pattern id="sz-grid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
            {/* Micro tech pattern within cells */}
            <rect width={CELL_SIZE} height={CELL_SIZE} fill="none" stroke="rgba(167,139,250,0.1)" strokeWidth={0.5} />
            <circle cx={CELL_SIZE} cy={CELL_SIZE} r={1.5} fill="rgba(167,139,250,0.3)" />
            <path d={`M ${CELL_SIZE / 2} 0 L ${CELL_SIZE / 2} ${CELL_SIZE} M 0 ${CELL_SIZE / 2} L ${CELL_SIZE} ${CELL_SIZE / 2}`} stroke="rgba(167,139,250,0.05)" strokeWidth={0.5} strokeDasharray="2,2" />
          </pattern>
          {/* Glow Filters */}
          <filter id="sz-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect x={1} y={1} width={gridSize * CELL_SIZE} height={gridSize * CELL_SIZE} fill="url(#sz-grid)" />

        {/* Transition lines */}
        <TransitionLines lines={transitionLines} deleteTransition={deleteTransition} />

        {/* Grid cells — clickable empty areas */}
        {Array.from({ length: gridSize }, (_, y) =>
          Array.from({ length: gridSize }, (_, x) => {
            const zone = zoneAt(x, y);
            if (zone) return null; // drawn separately
            return (
              <rect
                key={`${x}-${y}`}
                x={x * CELL_SIZE + 1}
                y={y * CELL_SIZE + 1}
                width={CELL_SIZE - 1}
                height={CELL_SIZE - 1}
                fill="transparent"
                onClick={() => handleCellClick(x, y)}
                style={{ cursor: paintType ? 'crosshair' : 'default' }}
              />
            );
          })
        )}

        {/* Zone cells */}
        {zones.map((zone) => (
          <ZoneCell
            key={zone.id}
            zone={zone}
            selectedZoneId={selectedZoneId}
            linkingFrom={linkingFrom}
            paintType={paintType}
            handleCellClick={handleCellClick}
          />
        ))}
      </svg>

      {/* Floating Hint Overlay */}
      {linkingFrom && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
          <div className="bg-black/80 backdrop-blur border border-amber-500/50 rounded-full px-4 py-1.5 text-xs uppercase tracking-widest text-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-bounce font-mono">
            Select target node to establish flow pipeline
          </div>
        </div>
      )}
    </div>
  );
}
