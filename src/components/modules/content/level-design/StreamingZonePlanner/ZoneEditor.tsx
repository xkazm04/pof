import { X, ChevronDown } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ZONE_TYPES, PRIORITY_COLORS } from './constants';
import type { StreamingZone, ZoneType, LoadPriority } from './types';

// ── Zone Editor ──

export function ZoneEditor({
  zone,
  onUpdate,
  onClose,
}: {
  zone: StreamingZone;
  onUpdate: (patch: Partial<StreamingZone>) => void;
  onClose: () => void;
}) {
  const cfg = ZONE_TYPES[zone.type];

  return (
    <SurfaceCard level={2} className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
          >
            {cfg.letter}
          </span>
          <span className="text-xs font-semibold text-text">Edit Zone</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Name */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Name</label>
          <input
            type="text"
            value={zone.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text outline-none focus:border-status-amber-strong transition-colors"
          />
        </div>

        {/* Type */}
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-widest font-mono text-violet-400 font-bold mb-1 block">ZONE TYPE</label>
          <div className="relative">
            <select
              value={zone.type}
              onChange={(e) => onUpdate({ type: e.target.value as ZoneType })}
              className="w-full px-3 py-2 bg-black/40 border border-violet-900/40 rounded-lg text-xs font-mono text-violet-100 outline-none focus:border-violet-500 appearance-none transition-colors"
            >
              {(Object.entries(ZONE_TYPES) as [ZoneType, typeof ZONE_TYPES[ZoneType]][]).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-violet-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Load priority */}
        <div className="space-y-1 col-span-2 mt-2">
          <label className="text-[11px] uppercase tracking-widest font-mono text-violet-400 font-bold block mb-1">LOAD PRIORITY</label>
          <div className="flex gap-2">
            {(['low', 'normal', 'high', 'always'] as LoadPriority[]).map((p) => {
              const active = zone.loadPriority === p;
              const pColor = PRIORITY_COLORS[p];
              return (
                <button
                  key={p}
                  onClick={() => onUpdate({ loadPriority: p, alwaysLoaded: p === 'always' })}
                  className="flex-1 py-1.5 rounded-lg text-xs uppercase font-mono font-bold transition-all border shadow-sm"
                  style={{
                    color: active ? pColor : 'var(--text-muted)',
                    borderColor: active ? `${pColor}50` : 'var(--border)',
                    backgroundColor: active ? `${pColor}20` : 'rgba(0,0,0,0.3)',
                    boxShadow: active ? `inset 0 0 10px ${pColor}20` : 'none',
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preload radius */}
        <div className="space-y-1 col-span-2 pt-2 border-t border-violet-900/30">
          <label className="text-[11px] uppercase tracking-widest font-mono text-violet-400 font-bold block mb-1">PRELOAD SECS / RADIUS</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              value={zone.preloadRadius}
              onChange={(e) => onUpdate({ preloadRadius: Math.max(0, Math.min(4, Number(e.target.value) || 0)) })}
              min={0} max={4} step={1}
              className="flex-1 accent-violet-500"
            />
            <div className="w-8 h-8 rounded-lg bg-black/40 border border-violet-900/40 flex items-center justify-center text-xs font-mono font-bold text-violet-300">
              {zone.preloadRadius}
            </div>
          </div>
          <p className="text-xs text-violet-500/60 font-mono mt-1">Adjacent cell load threshold</p>
        </div>
      </div>

      {/* Always loaded toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={zone.alwaysLoaded}
          onChange={(e) => onUpdate({ alwaysLoaded: e.target.checked, loadPriority: e.target.checked ? 'always' : zone.loadPriority })}
          className="accent-[#f59e0b] w-3 h-3"
        />
        <span className="text-xs text-[#d0d4e8]">Always loaded (persistent zone)</span>
      </label>

      {/* Grid position */}
      <div className="flex items-center gap-4 text-2xs text-text-muted">
        <span>Grid: ({zone.gridX}, {zone.gridY})</span>
        <span className="text-[#2a2a4a]">|</span>
        <span>Priority: <span style={{ color: PRIORITY_COLORS[zone.loadPriority] }}>{zone.loadPriority}</span></span>
      </div>
    </SurfaceCard>
  );
}
