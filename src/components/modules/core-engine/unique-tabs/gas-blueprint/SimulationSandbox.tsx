'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Play, Pause, RotateCcw, StepForward, Plus, Trash2,
  Activity, ChevronDown, FlaskConical,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE,
  OPACITY_15, OPACITY_20, MODULE_COLORS,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

/* ══════════════════════════════════════════════════════════════════════════
   TYPES — re-declared locally to avoid circular imports from parent
   ══════════════════════════════════════════════════════════════════════════ */

type AttrCategory = 'meta' | 'vital' | 'primary' | 'combat' | 'progression';

interface EditorAttribute {
  id: string;
  name: string;
  category: AttrCategory;
  defaultValue: number;
  clampMin?: number;
  clampMax?: string;
}

interface AttrRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'scale' | 'clamp' | 'regen';
  formula: string;
}

type EffectDuration = 'instant' | 'duration' | 'infinite';

interface EditorEffect {
  id: string;
  name: string;
  duration: EffectDuration;
  durationSec: number;
  cooldownSec: number;
  color: string;
  modifiers: { attribute: string; operation: 'add' | 'multiply'; magnitude: number }[];
  grantedTags: string[];
}

/* ── Simulation-specific types ─────────────────────────────────────────── */

interface QueuedEffect {
  id: string;
  effectId: string;
  triggerTime: number; // seconds
}

interface SimSnapshot {
  time: number;
  values: Record<string, number>; // attrName → value
  activeTags: string[];
  events: string[]; // short labels like "GE_Damage applied"
}

interface SimulationSandboxProps {
  attributes: EditorAttribute[];
  effects: EditorEffect[];
  relationships: AttrRelationship[];
  accent: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION ENGINE (pure functions)
   ══════════════════════════════════════════════════════════════════════════ */

const SIM_STEP = 0.25; // seconds per tick
const SIM_MAX_TIME = 30; // max simulation length

function resolveClampMax(attr: EditorAttribute, values: Record<string, number>): number | undefined {
  if (attr.clampMax == null) return undefined;
  const num = Number(attr.clampMax);
  if (!isNaN(num)) return num;
  // It's an attribute name reference like "MaxHealth"
  return values[attr.clampMax];
}

function clampValue(val: number, attr: EditorAttribute, values: Record<string, number>): number {
  let v = val;
  if (attr.clampMin != null) v = Math.max(v, attr.clampMin);
  const max = resolveClampMax(attr, values);
  if (max != null) v = Math.min(v, max);
  return v;
}

function runSimulation(
  attributes: EditorAttribute[],
  effects: EditorEffect[],
  relationships: AttrRelationship[],
  queue: QueuedEffect[],
  overrides: Record<string, number>,
  duration: number,
): SimSnapshot[] {
  const snapshots: SimSnapshot[] = [];
  const attrMap = new Map(attributes.map(a => [a.name, a]));

  // Initialize values from defaults + overrides
  const values: Record<string, number> = {};
  for (const attr of attributes) {
    values[attr.name] = overrides[attr.name] ?? attr.defaultValue;
  }

  // Apply relationship-based initial scaling (e.g., MaxMana += Intelligence * 5)
  for (const rel of relationships) {
    if (rel.type === 'scale') {
      const src = attributes.find(a => a.id === rel.sourceId);
      const tgt = attributes.find(a => a.id === rel.targetId);
      if (src && tgt) {
        // Extract multiplier from formula like "AttackPower += Strength * 2"
        const mulMatch = rel.formula.match(/\*\s*([0-9.]+)/);
        if (mulMatch) {
          values[tgt.name] += values[src.name] * parseFloat(mulMatch[1]);
        }
      }
    }
  }

  // Clamp initial values
  for (const attr of attributes) {
    values[attr.name] = clampValue(values[attr.name], attr, values);
  }

  // Track active duration-based effects: { effectId, expiresAt }
  const activeEffects: { effectId: string; expiresAt: number; nextTickAt: number }[] = [];

  // Sort queue by trigger time
  const sorted = [...queue].sort((a, b) => a.triggerTime - b.triggerTime);
  let queueIdx = 0;

  // Initial snapshot
  snapshots.push({ time: 0, values: { ...values }, activeTags: [], events: ['Simulation start'] });

  for (let t = SIM_STEP; t <= duration + 0.001; t = Math.round((t + SIM_STEP) * 100) / 100) {
    const events: string[] = [];

    // 1. Trigger queued effects that fire at or before this time
    while (queueIdx < sorted.length && sorted[queueIdx].triggerTime <= t + 0.001) {
      const qe = sorted[queueIdx];
      const eff = effects.find(e => e.id === qe.effectId);
      if (eff) {
        // Apply instant modifiers
        for (const mod of eff.modifiers) {
          if (mod.operation === 'add') {
            values[mod.attribute] = (values[mod.attribute] ?? 0) + mod.magnitude;
          } else {
            values[mod.attribute] = (values[mod.attribute] ?? 0) * mod.magnitude;
          }
        }

        if (eff.duration === 'duration' || eff.duration === 'infinite') {
          activeEffects.push({
            effectId: eff.id,
            expiresAt: eff.duration === 'infinite' ? Infinity : t + eff.durationSec,
            nextTickAt: eff.cooldownSec > 0 ? t + eff.cooldownSec : Infinity,
          });
        }

        events.push(`${eff.name} applied`);
      }
      queueIdx++;
    }

    // 2. Tick active periodic effects
    for (const ae of activeEffects) {
      if (t > ae.expiresAt) continue;
      const eff = effects.find(e => e.id === ae.effectId);
      if (!eff || eff.cooldownSec <= 0) continue;

      if (t >= ae.nextTickAt - 0.001) {
        for (const mod of eff.modifiers) {
          if (mod.operation === 'add') {
            values[mod.attribute] = (values[mod.attribute] ?? 0) + mod.magnitude;
          } else {
            values[mod.attribute] = (values[mod.attribute] ?? 0) * mod.magnitude;
          }
        }
        ae.nextTickAt = t + eff.cooldownSec;
        events.push(`${eff.name} tick`);
      }
    }

    // 3. Remove expired effects
    for (let i = activeEffects.length - 1; i >= 0; i--) {
      if (t > activeEffects[i].expiresAt) {
        const eff = effects.find(e => e.id === activeEffects[i].effectId);
        if (eff) events.push(`${eff.name} expired`);
        activeEffects.splice(i, 1);
      }
    }

    // 4. Apply clamps
    for (const attr of attributes) {
      values[attr.name] = clampValue(values[attr.name], attr, values);
    }

    // 5. Collect active tags
    const activeTags: string[] = [];
    for (const ae of activeEffects) {
      const eff = effects.find(e => e.id === ae.effectId);
      if (eff) activeTags.push(...eff.grantedTags);
    }

    snapshots.push({
      time: Math.round(t * 100) / 100,
      values: { ...values },
      activeTags: [...new Set(activeTags)],
      events,
    });
  }

  return snapshots;
}

/* ══════════════════════════════════════════════════════════════════════════
   SVG SPARKLINE
   ══════════════════════════════════════════════════════════════════════════ */

function Sparkline({ data, color, width = 200, height = 40, label, currentIdx }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  label: string;
  currentIdx: number | null;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const currentVal = currentIdx != null ? data[currentIdx] : data[data.length - 1];
  const startVal = data[0];
  const delta = currentVal - startVal;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-mono font-bold truncate" style={{ color }}>{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono font-bold" style={{ color }}>
              {currentVal % 1 === 0 ? currentVal : currentVal.toFixed(1)}
            </span>
            {delta !== 0 && (
              <span
                className="text-xs font-mono"
                style={{ color: delta > 0 ? STATUS_SUCCESS : STATUS_ERROR }}
              >
                {delta > 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible block">
          {/* Fill area */}
          <polygon
            points={`0,${height} ${points} ${width},${height}`}
            fill={`${color}15`}
          />
          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {/* Current position dot */}
          {currentIdx != null && (() => {
            const x = (currentIdx / (data.length - 1)) * width;
            const y = height - ((data[currentIdx] - min) / range) * (height - 4) - 2;
            return (
              <circle cx={x} cy={y} r={3} fill={color} stroke="var(--surface)" strokeWidth={1.5}>
                <animate attributeName="r" values="3;4;3" dur="1.5s" repeatCount="indefinite" />
              </circle>
            );
          })()}
          {/* Min/max labels */}
          <text x={width + 2} y={4} fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">
            {max % 1 === 0 ? max : max.toFixed(1)}
          </text>
          <text x={width + 2} y={height} fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">
            {min % 1 === 0 ? min : min.toFixed(1)}
          </text>
        </svg>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */

const CAT_COLORS: Record<AttrCategory, string> = {
  meta: ACCENT_CYAN,
  vital: STATUS_SUCCESS,
  primary: ACCENT_VIOLET,
  combat: ACCENT_ORANGE,
  progression: MODULE_COLORS.core,
};

export function SimulationSandbox({ attributes, effects, relationships, accent }: SimulationSandboxProps) {
  // Effect queue
  const [queue, setQueue] = useState<QueuedEffect[]>(() => {
    // Pre-populate with a sample scenario
    const dmg = effects.find(e => e.name.includes('Damage'));
    const heal = effects.find(e => e.name.includes('Heal'));
    const regen = effects.find(e => e.name.includes('Regen'));
    const init: QueuedEffect[] = [];
    if (regen) init.push({ id: 'q-0', effectId: regen.id, triggerTime: 0 });
    if (dmg) init.push({ id: 'q-1', effectId: dmg.id, triggerTime: 2 });
    if (dmg) init.push({ id: 'q-2', effectId: dmg.id, triggerTime: 5 });
    if (heal) init.push({ id: 'q-3', effectId: heal.id, triggerTime: 7 });
    return init;
  });

  // Attribute overrides
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  // Simulation state
  const [simDuration, setSimDuration] = useState(15);
  const [snapshots, setSnapshots] = useState<SimSnapshot[]>([]);
  const [playbackIdx, setPlaybackIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedAttrs, setExpandedAttrs] = useState(true);

  // Tracked attributes for sparklines (user can toggle)
  const trackableAttrs = useMemo(() =>
    attributes.filter(a => a.category === 'vital' || a.category === 'combat' || a.category === 'primary'),
    [attributes],
  );
  const [trackedAttrNames, setTrackedAttrNames] = useState<Set<string>>(() =>
    new Set(attributes.filter(a => a.category === 'vital').map(a => a.name)),
  );

  // Run simulation
  const runSim = useCallback(() => {
    const result = runSimulation(attributes, effects, relationships, queue, overrides, simDuration);
    setSnapshots(result);
    setPlaybackIdx(null);
    setIsPlaying(false);
    if (playRef.current) clearInterval(playRef.current);
  }, [attributes, effects, relationships, queue, overrides, simDuration]);

  // Auto-run on first mount
  useEffect(() => { runSim(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Playback
  useEffect(() => {
    if (isPlaying && snapshots.length > 0) {
      const startIdx = playbackIdx ?? 0;
      let idx = startIdx;
      playRef.current = setInterval(() => {
        idx++;
        if (idx >= snapshots.length) {
          setIsPlaying(false);
          setPlaybackIdx(snapshots.length - 1);
          if (playRef.current) clearInterval(playRef.current);
          return;
        }
        setPlaybackIdx(idx);
      }, 80);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [isPlaying, snapshots.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add effect to queue
  const addQueueItem = useCallback(() => {
    if (effects.length === 0) return;
    setQueue(q => [...q, {
      id: `q-${Date.now()}`,
      effectId: effects[0].id,
      triggerTime: 0,
    }]);
  }, [effects]);

  const removeQueueItem = useCallback((id: string) => {
    setQueue(q => q.filter(item => item.id !== id));
  }, []);

  const updateQueueItem = useCallback((id: string, updates: Partial<QueuedEffect>) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  // Current snapshot
  const currentSnap = playbackIdx != null ? snapshots[playbackIdx] : snapshots[snapshots.length - 1];
  const currentTime = currentSnap?.time ?? 0;

  // Event log (last N events up to playback position)
  const eventLog = useMemo(() => {
    const maxIdx = playbackIdx ?? snapshots.length - 1;
    const entries: { time: number; event: string }[] = [];
    for (let i = 0; i <= maxIdx && i < snapshots.length; i++) {
      for (const ev of snapshots[i].events) {
        entries.push({ time: snapshots[i].time, event: ev });
      }
    }
    return entries.slice(-20);
  }, [snapshots, playbackIdx]);

  // Sparkline data extraction
  const sparklineData = useMemo(() => {
    const maxIdx = playbackIdx ?? snapshots.length - 1;
    const sliced = snapshots.slice(0, maxIdx + 1);
    const result: Record<string, number[]> = {};
    for (const name of trackedAttrNames) {
      result[name] = sliced.map(s => s.values[name] ?? 0);
    }
    return result;
  }, [snapshots, playbackIdx, trackedAttrNames]);

  const toggleTrack = useCallback((name: string) => {
    setTrackedAttrNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  return (
    <div className="space-y-3">
      {/* ── Controls Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={runSim}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={{ backgroundColor: `${STATUS_SUCCESS}20`, color: STATUS_SUCCESS, border: `1px solid ${STATUS_SUCCESS}40` }}
        >
          <FlaskConical className="w-3.5 h-3.5" /> Run Simulation
        </button>

        <div className="flex items-center gap-1 border border-border/40 rounded-lg overflow-hidden">
          <button
            onClick={() => {
              if (isPlaying) {
                setIsPlaying(false);
              } else {
                if (playbackIdx != null && playbackIdx >= snapshots.length - 1) {
                  setPlaybackIdx(0);
                }
                setIsPlaying(true);
              }
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium hover:bg-white/5 transition-colors"
            style={{ color: isPlaying ? STATUS_WARNING : accent }}
            disabled={snapshots.length === 0}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => setPlaybackIdx(prev => Math.min((prev ?? 0) + 1, snapshots.length - 1))}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-text-muted hover:bg-white/5 transition-colors border-l border-border/40"
            disabled={snapshots.length === 0}
          >
            <StepForward className="w-3.5 h-3.5" /> Step
          </button>
          <button
            onClick={() => { setPlaybackIdx(null); setIsPlaying(false); }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-text-muted hover:bg-white/5 transition-colors border-l border-border/40"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-auto text-2xs font-mono text-text-muted">
          <span>Duration</span>
          <input
            type="number" value={simDuration} min={1} max={SIM_MAX_TIME} step={1}
            onChange={(e) => setSimDuration(Math.max(1, Math.min(SIM_MAX_TIME, Number(e.target.value))))}
            className="w-12 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-text focus:outline-none text-center"
          />
          <span>sec</span>
        </div>

        {currentSnap && (
          <div className="text-xs font-mono px-2 py-0.5 rounded-md" style={{ backgroundColor: `${accent}${OPACITY_15}`, color: accent, border: `1px solid ${accent}${OPACITY_20}` }}>
            t = {currentTime.toFixed(2)}s
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* ── Left: Effect Queue + Attribute Overrides ────────────────── */}
        <div className="space-y-3">
          {/* Effect Queue */}
          <SurfaceCard level={3} className="p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Effect Queue</span>
              <button
                onClick={addQueueItem}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
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

        {/* ── Center: Sparkline Graphs ────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Attribute toggle pills */}
          <div className="flex flex-wrap gap-1">
            {trackableAttrs.map(attr => {
              const isTracked = trackedAttrNames.has(attr.name);
              const color = CAT_COLORS[attr.category];
              return (
                <button
                  key={attr.id}
                  onClick={() => toggleTrack(attr.name)}
                  className="px-2 py-0.5 rounded-full text-xs font-mono font-medium transition-all"
                  style={{
                    backgroundColor: isTracked ? `${color}20` : 'transparent',
                    color: isTracked ? color : 'var(--text-muted)',
                    border: `1px solid ${isTracked ? `${color}50` : 'var(--border)'}`,
                    opacity: isTracked ? 1 : 0.5,
                  }}
                >
                  {attr.name}
                </button>
              );
            })}
          </div>

          {/* Sparklines */}
          <SurfaceCard level={3} className="p-3">
            {snapshots.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-text-muted text-xs">
                <Activity className="w-4 h-4 mr-2 opacity-50" />
                Press &quot;Run Simulation&quot; to see attribute changes over time
              </div>
            ) : (
              <div className="space-y-3">
                {[...trackedAttrNames].map(name => {
                  const data = sparklineData[name];
                  const attr = attributes.find(a => a.name === name);
                  if (!data || !attr) return null;
                  const color = CAT_COLORS[attr.category];
                  return (
                    <Sparkline
                      key={name}
                      data={data}
                      color={color}
                      label={name}
                      currentIdx={playbackIdx}
                      width={400}
                      height={36}
                    />
                  );
                })}
                {trackedAttrNames.size === 0 && (
                  <div className="text-xs text-text-muted italic text-center py-4">
                    Select attributes above to track their changes
                  </div>
                )}
              </div>
            )}
          </SurfaceCard>

          {/* Event Log + Active Tags */}
          <div className="grid grid-cols-2 gap-3">
            <SurfaceCard level={3} className="p-2.5">
              <span className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1.5">Event Log</span>
              <div className="space-y-0.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                {eventLog.length === 0 && (
                  <div className="text-xs text-text-muted italic">No events yet</div>
                )}
                {eventLog.map((entry, i) => {
                  const isApply = entry.event.includes('applied');
                  const isTick = entry.event.includes('tick');
                  const isExpired = entry.event.includes('expired');
                  const color = isApply ? STATUS_SUCCESS : isTick ? ACCENT_CYAN : isExpired ? STATUS_WARNING : 'var(--text-muted)';
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-text-muted w-10 text-right flex-shrink-0">{entry.time.toFixed(1)}s</span>
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span style={{ color }}>{entry.event}</span>
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>

            <SurfaceCard level={3} className="p-2.5">
              <span className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1.5">Active Tags</span>
              <div className="flex flex-wrap gap-1">
                {(!currentSnap || currentSnap.activeTags.length === 0) && (
                  <div className="text-xs text-text-muted italic">No active tags</div>
                )}
                {currentSnap?.activeTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-mono px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${accent}15`, color: accent, border: `1px solid ${accent}25` }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Quick attribute snapshot */}
              {currentSnap && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <span className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1">Snapshot</span>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {attributes.filter(a => a.category === 'vital' || a.category === 'combat').map(attr => {
                      const val = currentSnap.values[attr.name] ?? 0;
                      const initial = overrides[attr.name] ?? attr.defaultValue;
                      const delta = val - initial;
                      return (
                        <div key={attr.id} className="flex items-center justify-between text-xs font-mono">
                          <span className="text-text-muted truncate">{attr.name}</span>
                          <span className="flex items-center gap-1">
                            <span style={{ color: CAT_COLORS[attr.category] }}>
                              {val % 1 === 0 ? val : val.toFixed(1)}
                            </span>
                            {delta !== 0 && (
                              <span style={{ color: delta > 0 ? STATUS_SUCCESS : STATUS_ERROR, fontSize: 10 }}>
                                {delta > 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(1)}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </SurfaceCard>
          </div>
        </div>
      </div>
    </div>
  );
}
