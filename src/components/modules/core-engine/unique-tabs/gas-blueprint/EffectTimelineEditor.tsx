'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCollectionEditor } from '@/hooks/useCollectionEditor';
import type { EditorEffect, EffectDuration } from '@/lib/gas-codegen';
import { SegmentedControl } from '../_shared';
import { ACCENT, DURATION_OPTIONS } from './types';
import { ACCENT_RED, ACCENT_EMERALD_DARK, MODULE_COLORS, STATUS_STALE, OVERLAY_WHITE } from '@/lib/chart-colors';

export function EffectTimelineEditor({
  effects, onChange, onSelectItem,
}: {
  effects: EditorEffect[];
  onChange: (effs: EditorEffect[]) => void;
  onSelectItem?: (label: string | null) => void;
}) {
  const [selectedEffect, setSelectedEffectRaw] = useState<string | null>(null);
  const [playheadTime, setPlayheadTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<SVGSVGElement>(null);
  const setSelectedEffect = useCallback((id: string | null) => {
    setSelectedEffectRaw(id);
    const eff = id ? effects.find(e => e.id === id) : null;
    onSelectItem?.(eff ? eff.name : null);
  }, [effects, onSelectItem]);

  const maxTime = useMemo(() => {
    let t = 10;
    for (const e of effects) {
      const end = (e.durationSec || 0) + (e.cooldownSec || 0);
      if (end > t) t = end + 2;
    }
    return t;
  }, [effects]);

  // Convert mouse X to time value
  const xToTime = useCallback((clientX: number): number => {
    const svg = timelineRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const svgWidth = rect.width;
    const viewBoxWidth = 400;
    const scale = viewBoxWidth / svgWidth;
    const svgX = (clientX - rect.left) * scale;
    const t = ((svgX - 40) / 350) * maxTime;
    return Math.max(0, Math.min(maxTime, t));
  }, [maxTime]);

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    setPlayheadTime(xToTime(e.clientX));
  }, [xToTime]);

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setPlayheadTime(xToTime(e.clientX));
  }, [isDragging, xToTime]);

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Determine which effects are active at playhead time
  const activeAtPlayhead = useMemo(() => {
    if (playheadTime === null) return new Set<string>();
    const active = new Set<string>();
    for (const eff of effects) {
      if (eff.duration === 'instant') {
        if (playheadTime < 0.3) active.add(eff.id);
      } else if (eff.duration === 'infinite') {
        active.add(eff.id);
      } else {
        if (playheadTime <= eff.durationSec) active.add(eff.id);
      }
    }
    return active;
  }, [effects, playheadTime]);

  const activeEffectDetails = useMemo(() => {
    if (playheadTime === null) return [];
    return effects.filter(e => activeAtPlayhead.has(e.id));
  }, [effects, activeAtPlayhead, playheadTime]);

  const effectFactory = useCallback((): EditorEffect => ({
    id: `e-${Date.now()}`,
    name: `GE_New_${effects.length + 1}`,
    duration: 'instant',
    durationSec: 0,
    cooldownSec: 0,
    color: [ACCENT_RED, ACCENT_EMERALD_DARK, MODULE_COLORS.core, STATUS_STALE, MODULE_COLORS.content][effects.length % 5],
    modifiers: [],
    grantedTags: [],
  }), [effects.length]);

  const { add: addEffectRaw, remove: removeEffectRaw, update: updateEffect } = useCollectionEditor(effects, onChange, effectFactory);

  const addEffect = useCallback(() => {
    const newEff = addEffectRaw();
    setSelectedEffect(newEff.id);
  }, [addEffectRaw, setSelectedEffect]);

  const removeEffect = useCallback((id: string) => {
    removeEffectRaw(id);
    if (selectedEffect === id) setSelectedEffect(null);
  }, [removeEffectRaw, selectedEffect, setSelectedEffect]);

  const sel = effects.find(e => e.id === selectedEffect);

  return (
    <div className="space-y-2">
      {/* Timeline visualization */}
      <div className="relative overflow-x-auto custom-scrollbar">
        <svg
          ref={timelineRef}
          width="100%" height={80 + effects.length * 28} viewBox={`0 0 400 ${80 + effects.length * 28}`}
          preserveAspectRatio="xMinYMin" className="overflow-visible cursor-crosshair"
          onMouseDown={handleTimelineMouseDown}
          onMouseMove={handleTimelineMouseMove}
          onMouseUp={handleTimelineMouseUp}
          onMouseLeave={handleTimelineMouseUp}
        >
          {/* Time axis */}
          <line x1={40} y1={20} x2={390} y2={20} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          {Array.from({ length: Math.ceil(maxTime) + 1 }, (_, i) => {
            const x = 40 + (i / maxTime) * 350;
            return (
              <g key={i}>
                <line x1={x} y1={18} x2={x} y2={22} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                <text x={x} y={14} fill="rgba(255,255,255,0.3)" fontSize={7} fontFamily="monospace" textAnchor="middle">{i}s</text>
              </g>
            );
          })}

          {/* Effect blocks */}
          {effects.map((eff, i) => {
            const y = 32 + i * 28;
            const isSelected = selectedEffect === eff.id;
            const isActive = playheadTime !== null ? activeAtPlayhead.has(eff.id) : true;
            const blockOpacity = playheadTime !== null ? (isActive ? 1 : 0.25) : (isSelected ? 1 : 0.7);

            if (eff.duration === 'instant') {
              const x = 40;
              return (
                <g key={eff.id} className="cursor-pointer" onClick={() => setSelectedEffect(eff.id)} opacity={blockOpacity}>
                  <circle cx={x + 4} cy={y + 10} r={6} fill={eff.color}
                    stroke={isSelected ? OVERLAY_WHITE : isActive && playheadTime !== null ? eff.color : 'none'}
                    strokeWidth={1.5}
                    style={isActive && playheadTime !== null ? { filter: `drop-shadow(0 0 4px ${eff.color})` } : undefined}
                  />
                  <text x={x + 16} y={y + 13} fill={eff.color} fontSize={8} fontFamily="monospace">{eff.name}</text>
                </g>
              );
            }

            const blockW = Math.max(20, (eff.durationSec / maxTime) * 350);
            return (
              <g key={eff.id} className="cursor-pointer" onClick={() => setSelectedEffect(eff.id)} opacity={blockOpacity}>
                <rect x={40} y={y} width={blockW} height={20} rx={3}
                  fill={`${eff.color}${isActive && playheadTime !== null ? '50' : '30'}`}
                  stroke={isSelected ? OVERLAY_WHITE : `${eff.color}60`} strokeWidth={isSelected ? 1.5 : 0.8}
                  style={isActive && playheadTime !== null ? { filter: `drop-shadow(0 0 3px ${eff.color}60)` } : undefined}
                />
                <text x={44} y={y + 13} fill={eff.color} fontSize={8} fontFamily="monospace">{eff.name}</text>
                {eff.duration === 'duration' && (
                  <text x={40 + blockW - 4} y={y + 13} fill="rgba(255,255,255,0.4)" fontSize={7} fontFamily="monospace" textAnchor="end">
                    {eff.durationSec}s
                  </text>
                )}
                {eff.duration === 'infinite' && (
                  <text x={40 + blockW - 4} y={y + 13} fill="rgba(255,255,255,0.4)" fontSize={7} fontFamily="monospace" textAnchor="end">{'\u221E'}</text>
                )}
                {/* Cooldown zone */}
                {eff.cooldownSec > 0 && (
                  <rect x={40 + blockW} y={y + 2} width={Math.max(8, (eff.cooldownSec / maxTime) * 350)} height={16} rx={2}
                    fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} strokeDasharray="3 2" />
                )}
              </g>
            );
          })}

          {/* Playhead */}
          {playheadTime !== null && (() => {
            const px = 40 + (playheadTime / maxTime) * 350;
            const svgH = 80 + effects.length * 28;
            return (
              <g>
                <line x1={px} y1={8} x2={px} y2={svgH - 4} stroke={ACCENT} strokeWidth={1.5} opacity={0.9} />
                {/* Playhead handle */}
                <polygon
                  points={`${px - 5},6 ${px + 5},6 ${px},13`}
                  fill={ACCENT} stroke="none"
                />
                {/* Time label on handle */}
                <text x={px} y={4} fill={ACCENT} fontSize={7} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                  {playheadTime.toFixed(1)}s
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Active effects badge */}
        {playheadTime !== null && activeEffectDetails.length > 0 && (
          <div className="absolute top-0 right-0 mt-1 mr-1 p-1.5 rounded-lg border border-border/40 bg-surface-deep/90 backdrop-blur-sm max-w-[160px]">
            <div className="text-[11px] font-mono font-bold text-text-muted uppercase tracking-wider mb-1">
              Active @ {playheadTime.toFixed(1)}s
            </div>
            {activeEffectDetails.map((eff) => (
              <div key={eff.id} className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: eff.color, boxShadow: `0 0 4px ${eff.color}` }} />
                <span className="text-[11px] font-mono font-bold truncate" style={{ color: eff.color }}>{eff.name}</span>
              </div>
            ))}
            {activeEffectDetails.some(e => e.grantedTags.length > 0) && (
              <div className="mt-1 pt-1 border-t border-border/30">
                <div className="text-[11px] font-mono text-text-muted uppercase tracking-wider mb-0.5">Tags</div>
                <div className="flex flex-wrap gap-0.5">
                  {activeEffectDetails.flatMap(e => e.grantedTags.map(t => ({ tag: t, color: e.color }))).map(({ tag, color }) => (
                    <span key={tag} className="text-[11px] font-mono px-1 py-0 rounded" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}25` }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={addEffect} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
          <Plus className="w-3 h-3" /> Add Effect
        </button>
      </div>

      {/* Selected effect editor */}
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
    </div>
  );
}
