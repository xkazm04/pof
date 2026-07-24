import type { Dispatch, SetStateAction } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  withOpacity, OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { EditorAttribute, EditorEffect, QueuedEffect } from './types';
import { CAT_COLORS } from './constants';

export function QueueAndOverrides({
  accent,
  effects,
  attributes,
  simDuration,
  queue,
  addQueueItem,
  removeQueueItem,
  updateQueueItem,
  expandedAttrs,
  setExpandedAttrs,
  overrides,
  setOverrides,
}: {
  accent: string;
  effects: EditorEffect[];
  attributes: EditorAttribute[];
  simDuration: number;
  queue: QueuedEffect[];
  addQueueItem: () => void;
  removeQueueItem: (id: string) => void;
  updateQueueItem: (id: string, updates: Partial<QueuedEffect>) => void;
  expandedAttrs: boolean;
  setExpandedAttrs: Dispatch<SetStateAction<boolean>>;
  overrides: Record<string, number>;
  setOverrides: Dispatch<SetStateAction<Record<string, number>>>;
}) {
  return (
    <div className="space-y-3">
      {/* Effect Queue */}
      <SurfaceCard level={3} className="p-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Effect Queue</span>
          <button
            onClick={addQueueItem}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: `${withOpacity(accent, OPACITY_10)}`, color: accent, border: `1px solid ${withOpacity(accent, OPACITY_20)}` }}
          >
            <Plus className="w-2.5 h-2.5" /> Add
          </button>
        </div>
        <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
          {queue.length === 0 && (
            <div className="text-xs text-text-muted italic py-2 text-center">No effects queued. Add effects to simulate.</div>
          )}
          {queue.map((item) => {
            const eff = effects.find(e => e.id === item.effectId);
            return (
              <div key={item.id} className="flex items-center gap-1.5 text-xs font-mono">
                <input
                  type="number" value={item.triggerTime} min={0} max={simDuration} step={0.5}
                  onChange={(e) => updateQueueItem(item.id, { triggerTime: Number(e.target.value) })}
                  className="w-12 bg-surface-deep border border-border/30 rounded px-1 py-0.5 text-text text-center focus:outline-none"
                />
                <span className="text-text-muted">s</span>
                <select
                  value={item.effectId}
                  onChange={(e) => updateQueueItem(item.id, { effectId: e.target.value })}
                  className="flex-1 bg-surface-deep border border-border/30 rounded px-1 py-0.5 text-text focus:outline-none min-w-0"
                  style={{ color: eff?.color }}
                >
                  {effects.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <button onClick={() => removeQueueItem(item.id)} className="text-text-muted hover:text-red-400 flex-shrink-0">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Attribute Overrides */}
      <SurfaceCard level={3} className="p-2.5">
        <button
          onClick={() => setExpandedAttrs(!expandedAttrs)}
          className="flex items-center justify-between w-full mb-1"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Initial Values</span>
          <motion.div animate={{ rotate: expandedAttrs ? 180 : 0 }}>
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </motion.div>
        </button>
        <AnimatePresence>
          {expandedAttrs && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-0.5 max-h-[250px] overflow-y-auto custom-scrollbar">
                {attributes.filter(a => a.category !== 'meta').map((attr) => {
                  const val = overrides[attr.name] ?? attr.defaultValue;
                  return (
                    <div key={attr.id} className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[attr.category] }} />
                      <span className="truncate flex-1 text-text-muted" title={attr.name}>
                        {attr.name}
                      </span>
                      <input
                        type="number"
                        value={val}
                        step={attr.defaultValue < 1 ? 0.01 : 1}
                        onChange={(e) => setOverrides(prev => ({ ...prev, [attr.name]: Number(e.target.value) }))}
                        className="w-16 bg-surface-deep border border-border/30 rounded px-1 py-0.5 text-text text-right focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SurfaceCard>
    </div>
  );
}
