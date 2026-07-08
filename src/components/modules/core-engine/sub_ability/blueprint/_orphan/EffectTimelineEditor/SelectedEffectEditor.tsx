'use client';

import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EditorEffect, EffectDuration } from '@/lib/gas-codegen';
import { SegmentedControl } from '../../../../unique-tabs/_shared';
import { DURATION_OPTIONS } from '../types';

export function SelectedEffectEditor({
  sel, updateEffect, removeEffect,
}: {
  sel: EditorEffect | undefined;
  updateEffect: (id: string, updates: Partial<EditorEffect>) => void;
  removeEffect: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {sel && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
          <div className="p-2.5 rounded-lg border border-border/40 bg-surface-deep/50 space-y-3">
            <div className="flex items-center justify-between">
              <input
                value={sel.name} onChange={(e) => updateEffect(sel.id, { name: e.target.value })}
                className="bg-transparent text-xs font-mono font-bold text-text border-b border-border/40 focus:border-current focus:outline-none w-40 pb-0.5"
                style={{ color: sel.color }}
              />
              <button onClick={() => removeEffect(sel.id)} className="text-text-muted hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-2xs text-text-muted font-bold uppercase tracking-wider mb-1">Duration Type</label>
                <SegmentedControl
                  options={DURATION_OPTIONS}
                  activeId={sel.duration}
                  onChange={(id) => updateEffect(sel.id, { duration: id as EffectDuration })}
                  accent={sel.color}
                />
              </div>
              {sel.duration === 'duration' && (
                <div>
                  <label className="block text-2xs text-text-muted font-bold uppercase tracking-wider mb-1">Seconds</label>
                  <input type="number" value={sel.durationSec} min={0} step={0.5}
                    onChange={(e) => updateEffect(sel.id, { durationSec: Number(e.target.value) })}
                    className="w-16 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-text focus:outline-none focus:border-current"
                    style={{ color: sel.color }}
                  />
                </div>
              )}
              <div>
                <label className="block text-2xs text-text-muted font-bold uppercase tracking-wider mb-1">Cooldown</label>
                <input type="number" value={sel.cooldownSec} min={0} step={0.5}
                  onChange={(e) => updateEffect(sel.id, { cooldownSec: Number(e.target.value) })}
                  className="w-16 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-text focus:outline-none focus:border-current"
                />
              </div>
            </div>

            {/* Modifiers */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-2xs text-text-muted font-bold uppercase tracking-wider">Modifiers</label>
                <button
                  onClick={() => updateEffect(sel.id, { modifiers: [...sel.modifiers, { attribute: 'Health', operation: 'add', magnitude: 0 }] })}
                  className="text-2xs text-text-muted hover:text-text"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-1.5">
                {sel.modifiers.map((m, mi) => (
                  <div key={mi} className="flex items-center gap-2 text-2xs font-mono">
                    <input
                      value={m.attribute}
                      onChange={(e) => {
                        const mods = [...sel.modifiers];
                        mods[mi] = { ...m, attribute: e.target.value };
                        updateEffect(sel.id, { modifiers: mods });
                      }}
                      className="bg-surface-deep border border-border/30 rounded px-1 py-0.5 text-text w-28 focus:outline-none"
                    />
                    <select
                      value={m.operation}
                      onChange={(e) => {
                        const mods = [...sel.modifiers];
                        mods[mi] = { ...m, operation: e.target.value as 'add' | 'multiply' };
                        updateEffect(sel.id, { modifiers: mods });
                      }}
                      className="bg-surface-deep border border-border/30 rounded px-1 py-0.5 text-text-muted focus:outline-none"
                    >
                      <option value="add">+</option>
                      <option value="multiply">{'\u00D7'}</option>
                    </select>
                    <input
                      type="number" value={m.magnitude} step={1}
                      onChange={(e) => {
                        const mods = [...sel.modifiers];
                        mods[mi] = { ...m, magnitude: Number(e.target.value) };
                        updateEffect(sel.id, { modifiers: mods });
                      }}
                      className="bg-surface-deep border border-border/30 rounded px-1 py-0.5 text-text w-16 focus:outline-none"
                    />
                    <button onClick={() => {
                      const mods = sel.modifiers.filter((_, j) => j !== mi);
                      updateEffect(sel.id, { modifiers: mods });
                    }} className="text-text-muted hover:text-red-400"><Trash2 className="w-2.5 h-2.5" /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Granted tags */}
            <div>
              <label className="block text-2xs text-text-muted font-bold uppercase tracking-wider mb-1">Granted Tags</label>
              <input
                value={sel.grantedTags.join(', ')}
                onChange={(e) => updateEffect(sel.id, { grantedTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                placeholder="State.Stunned, ..."
                className="w-full bg-surface-deep border border-border/30 rounded px-1.5 py-0.5 text-2xs font-mono text-text focus:outline-none"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
