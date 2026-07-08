'use client';

import { Link, Unlink, X } from 'lucide-react';
import { SCREEN_TYPES } from './constants';
import type { ScreenNode, ScreenTransition } from './types';

interface TransitionListProps {
  screens: ScreenNode[];
  transitions: ScreenTransition[];
  toggleBidirectional: (id: string) => void;
  deleteTransition: (id: string) => void;
}

export function TransitionList({ screens, transitions, toggleBidirectional, deleteTransition }: TransitionListProps) {
  return (
    <div className="p-5 bg-black/40 border border-violet-900/40 rounded-2xl shadow-inner relative z-10">
      <div className="flex items-center gap-2 text-xs uppercase text-violet-400 font-bold mb-4">
        <Unlink className="w-3.5 h-3.5" />
        Active Routing Pathways
      </div>
      <div className="space-y-2">
        {transitions.map((tr) => {
          const fromScr = screens.find((s) => s.id === tr.fromId);
          const toScr = screens.find((s) => s.id === tr.toId);
          if (!fromScr || !toScr) return null;
          return (
            <div
              key={tr.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/60 border border-violet-900/50 shadow-sm"
            >
              <div className="flex-1 flex items-center justify-between text-[11px] font-bold tracking-wider uppercase bg-violet-950/20 rounded-md px-3 py-1.5 border border-violet-900/30">
                <span className="text-white drop-shadow-md" style={{ color: SCREEN_TYPES[fromScr.type].color }}>{fromScr.name}</span>
                <div className="flex flex-col items-center flex-1 px-4">
                  <span className="text-[11px] text-violet-400/60 font-mono mb-0.5 truncate max-w-[120px]">{tr.trigger}</span>
                  <div className="w-full h-px bg-violet-900/40 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black px-1 text-violet-500">{tr.bidirectional ? '⟷' : '→'}</div>
                  </div>
                </div>
                <span className="text-white drop-shadow-md" style={{ color: SCREEN_TYPES[toScr.type].color }}>{toScr.name}</span>
              </div>
              <button
                onClick={() => toggleBidirectional(tr.id)}
                className="p-2 rounded-lg border transition-all hover:bg-white/5 active:scale-95"
                style={{
                  color: tr.bidirectional ? '#6ee7b7' : 'rgba(156,163,175,0.7)',
                  borderColor: tr.bidirectional ? 'rgba(52,211,153,0.4)' : 'rgba(49,46,129,0.5)',
                  backgroundColor: tr.bidirectional ? 'rgba(52,211,153,0.1)' : 'rgba(0,0,0,0.4)',
                }}
                title="Toggle Route Bind"
              >
                <Link className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteTransition(tr.id)}
                className="p-2 rounded-lg border border-rose-900/50 bg-rose-950/20 text-rose-500 hover:bg-rose-900/40 hover:text-rose-400 transition-all active:scale-95"
                title="Sever Route"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
