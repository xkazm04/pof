'use client';

import { useState, useCallback } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';
import { SCREEN_TYPES } from './constants';
import type { ScreenNode, ScreenType } from './types';

// ── Screen Editor Sub-component ──

export function ScreenEditor({
  screen,
  onUpdate,
  onClose,
}: {
  screen: ScreenNode;
  onUpdate: (patch: Partial<ScreenNode>) => void;
  onClose: () => void;
}) {
  const [newWidget, setNewWidget] = useState('');

  const addWidget = useCallback(() => {
    const name = newWidget.trim();
    if (!name) return;
    onUpdate({ widgets: [...screen.widgets, name] });
    setNewWidget('');
  }, [newWidget, screen.widgets, onUpdate]);

  const removeWidget = useCallback((idx: number) => {
    onUpdate({ widgets: screen.widgets.filter((_, i) => i !== idx) });
  }, [screen.widgets, onUpdate]);

  const cfg = SCREEN_TYPES[screen.type];

  return (
    <div className="p-6 bg-black/60 border border-violet-900/50 rounded-2xl shadow-[0_0_30px_rgba(167,139,250,0.1)_inset] relative z-10 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-violet-900/40">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-inner"
            style={{ backgroundColor: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}40`, textShadow: `0 0 10px ${cfg.color}` }}
          >
            {cfg.icon}
          </div>
          <span className="text-[11px] font-bold uppercase text-white drop-shadow-md">Node Configuration</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg bg-violet-950/40 border border-violet-900/40 text-violet-400 hover:text-white hover:bg-violet-600/30 hover:border-violet-500/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5 flex flex-col">
            <label className="text-[11px] uppercase text-violet-400 font-bold ml-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Identifier String
            </label>
            <input
              type="text"
              value={screen.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full px-4 py-2.5 bg-black/50 border border-violet-900/60 rounded-xl text-xs font-bold text-white outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/50 shadow-inner transition-all"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5 flex flex-col">
            <label className="text-[11px] uppercase text-violet-400 font-bold ml-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Class Designation
            </label>
            <div className="relative">
              <select
                value={screen.type}
                onChange={(e) => onUpdate({ type: e.target.value as ScreenType })}
                className="w-full px-4 py-2.5 bg-black/50 border border-violet-900/60 rounded-xl text-xs font-bold text-white outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/50 shadow-inner appearance-none transition-all cursor-pointer"
                style={{ color: cfg.color }}
              >
                {(Object.entries(SCREEN_TYPES) as [ScreenType, typeof SCREEN_TYPES[ScreenType]][]).map(([key, val]) => (
                  <option key={key} value={key} style={{ backgroundColor: '#0f172a', color: val.color }}>{val.label.toUpperCase()}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-violet-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Widgets */}
        <div className="space-y-2.5 flex flex-col">
          <label className="text-[11px] uppercase text-violet-400 font-bold ml-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Embedded UI Elements <span className="bg-violet-900/50 text-violet-200 px-1.5 py-0.5 rounded text-[11px]">{screen.widgets.length}</span>
          </label>
          <div className="flex-1 bg-black/40 border border-violet-900/50 rounded-xl p-3 flex flex-col gap-3 shadow-inner max-h-[140px] overflow-y-auto global-scrollbar">
            {screen.widgets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {screen.widgets.map((w, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs uppercase font-bold border transition-colors shadow-sm"
                    style={{
                      color: 'white',
                      borderColor: `${cfg.color}40`,
                      backgroundColor: `${cfg.color}15`,
                      textShadow: `0 0 10px ${cfg.color}80`
                    }}
                  >
                    {w}
                    <button
                      onClick={() => removeWidget(i)}
                      className="hover:text-rose-400 hover:bg-rose-950/50 p-0.5 rounded -mr-1 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-violet-900/50 font-mono uppercase text-center my-auto">
                No embedded elements assigned
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newWidget}
              onChange={(e) => setNewWidget(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addWidget(); }}
              placeholder="E.G. PROGRESS_BAR_01"
              className="flex-1 px-3 py-2 bg-black/50 border border-violet-900/60 rounded-lg text-xs font-mono text-white placeholder-violet-900/40 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/50 shadow-inner transition-all uppercase"
            />
            <button
              onClick={addWidget}
              disabled={!newWidget.trim()}
              className="px-4 py-2 rounded-lg text-white font-bold transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center hover:brightness-110 shadow-lg active:scale-95"
              style={{
                backgroundColor: cfg.color,
                boxShadow: `0 0 15px ${cfg.color}40`,
              }}
            >
              <Plus className="w-4 h-4 drop-shadow-md" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
