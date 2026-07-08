import { X } from 'lucide-react';
import { TRANSITION_STYLES } from './constants';
import type { StreamingZone, ZoneTransition, TransitionStyle } from './types';

interface TransitionListProps {
  transitions: ZoneTransition[];
  zones: StreamingZone[];
  deleteTransition: (id: string) => void;
  updateTransition: (id: string, patch: Partial<ZoneTransition>) => void;
}

export function TransitionList({ transitions, zones, deleteTransition, updateTransition }: TransitionListProps) {
  return (
    <div className="bg-[#03030a] rounded-xl border border-violet-900/30 shadow-[inset_0_0_20px_rgba(167,139,250,0.05)] p-4 flex-1 overflow-y-auto">
      <div className="text-xs uppercase font-mono tracking-widest text-violet-400 mb-3 font-bold border-b border-violet-900/30 pb-2">
        Zone Pipelines ({transitions.length})
      </div>
      <div className="space-y-3">
        {transitions.map((tr) => {
          const from = zones.find((z) => z.id === tr.fromId);
          const to = zones.find((z) => z.id === tr.toId);
          if (!from || !to) return null;
          const styleCfg = TRANSITION_STYLES[tr.style];
          return (
            <div
              key={tr.id}
              className="flex flex-col gap-2 p-2.5 rounded-lg bg-surface-deep/50 border border-violet-900/20 text-xs shadow-inner"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-xs truncate max-w-[140px]">
                  <span className="text-violet-200 capitalize font-bold">{from.name}</span>
                  <span className="text-violet-500">→</span>
                  <span className="text-violet-200 capitalize font-bold">{to.name}</span>
                </div>
                <button
                  onClick={() => deleteTransition(tr.id)}
                  className="text-text-muted hover:text-red-400 transition-colors p-1 bg-surface rounded hover:bg-surface-hover"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={tr.style}
                  onChange={(e) => updateTransition(tr.id, { style: e.target.value as TransitionStyle })}
                  className="flex-1 text-xs bg-black/40 border border-violet-900/40 rounded px-1.5 py-1 text-violet-200 outline-none uppercase font-mono tracking-wide"
                  style={{
                    color: styleCfg.color,
                  }}
                >
                  {(Object.entries(TRANSITION_STYLES) as [TransitionStyle, { label: string }][]).map(([key, v]) => (
                    <option key={key} value={key}>{v.label}</option>
                  ))}
                </select>

                <span className="text-[11px] text-violet-400 font-mono tracking-wider uppercase px-2 py-1 rounded bg-violet-900/20">{tr.triggerType}</span>
              </div>

              {/* Condition */}
              {tr.condition && (
                <div className="text-[11px] text-amber-400/90 truncate bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded font-mono mt-1">
                  REQ: {tr.condition}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
