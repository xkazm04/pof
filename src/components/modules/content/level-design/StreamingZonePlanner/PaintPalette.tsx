import { X, Eraser, Link2 } from 'lucide-react';
import { STATUS_ERROR } from '@/lib/chart-colors';
import { ZONE_TYPES } from './constants';
import type { ZoneType, StreamingMode, StreamingOp } from './types';

interface PaintPaletteProps {
  /** The planner's one mode: a palette button enters or leaves it, never stacks on it. */
  mode: StreamingMode;
  selectedZoneId: string | null;
  dispatch: (op: StreamingOp) => void;
}

export function PaintPalette({ mode, selectedZoneId, dispatch }: PaintPaletteProps) {
  const paintType = mode.kind === 'paint' ? mode.zoneType : mode.kind === 'erase' ? 'erase' : null;
  const linkingFrom = mode.kind === 'link' ? mode.from : null;
  return (
    <div className="flex items-center gap-2 flex-wrap bg-[#03030a] p-3 rounded-2xl border border-violet-900/40 shadow-[inset_0_0_40px_rgba(167,139,250,0.05)]">
      <span className="text-xs font-mono text-violet-400/80 font-bold mx-2">Paint Mode</span>
      {(Object.entries(ZONE_TYPES) as [ZoneType, typeof ZONE_TYPES[ZoneType]][]).map(([type, cfg]) => {
        const active = paintType === type;
        return (
          <button
            key={type}
            onClick={() => dispatch(active ? { type: 'cancelMode' } : { type: 'setPaint', zoneType: type })}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors border"
            style={{
              color: active ? cfg.color : 'var(--text-muted)',
              borderColor: active ? `${cfg.color}50` : 'var(--border)',
              backgroundColor: active ? `${cfg.color}15` : 'var(--surface)',
            }}
          >
            <span
              className="w-3 h-3 rounded-sm text-2xs font-bold flex items-center justify-center"
              style={{ backgroundColor: `${cfg.color}25`, color: cfg.color }}
            >
              {cfg.letter}
            </span>
            {cfg.label}
          </button>
        );
      })}
      <div className="w-px h-6 bg-violet-900/40 mx-2" />
      <button
        onClick={() => dispatch(paintType === 'erase' ? { type: 'cancelMode' } : { type: 'setErase' })}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border"
        style={{
          color: paintType === 'erase' ? STATUS_ERROR : 'var(--text-muted)',
          borderColor: paintType === 'erase' ? `${STATUS_ERROR}40` : 'var(--border)',
          backgroundColor: paintType === 'erase' ? `${STATUS_ERROR}10` : 'var(--surface)',
        }}
      >
        <Eraser className="w-3 h-3" />
        Erase
      </button>
      {selectedZoneId && !linkingFrom && (
        <>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={() => dispatch({ type: 'startLink', from: selectedZoneId })}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border text-[#fbbf24] border-[#fbbf2430] bg-[#fbbf2408]"
          >
            <Link2 className="w-3 h-3" />
            Link
          </button>
        </>
      )}
      {linkingFrom && (
        <>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={() => dispatch({ type: 'cancelMode' })}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border text-[#f87171] border-[#f8717130] bg-[#f8717108]"
          >
            <X className="w-3 h-3" />
            Cancel Link
          </button>
        </>
      )}
    </div>
  );
}
