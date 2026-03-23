'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wrench } from 'lucide-react';
import { ACCENT_PURPLE_BOLD, STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { ABILITY_POOL, BT_PRESETS, ELITE_MODIFIERS, applyModifiers } from './data';

export function ArchetypeBuilder() {
  const [builderName, setBuilderName] = useState('Custom Enemy');
  const [builderStats, setBuilderStats] = useState({ HP: 50, Damage: 50, Speed: 50, Range: 50 });
  const [builderAbilities, setBuilderAbilities] = useState<string[]>([]);
  const [builderBT, setBuilderBT] = useState<typeof BT_PRESETS[number]>('Aggressive');
  const [builderModifiers, setBuilderModifiers] = useState<string[]>([]);

  const toggleBuilderModifier = useCallback((modId: string) => {
    setBuilderModifiers(prev => {
      const mod = ELITE_MODIFIERS.find(m => m.id === modId);
      if (prev.includes(modId)) return prev.filter(id => id !== modId);
      const excluded = mod?.excludes ?? [];
      return [...prev.filter(id => !excluded.includes(id)), modId];
    });
  }, []);

  return (
    <BlueprintPanel color={ACCENT_PURPLE_BOLD} className="p-3">
      <SectionHeader icon={Wrench} label="Archetype Builder" color={ACCENT_PURPLE_BOLD} />
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted block mb-1">Name</label>
            <input type="text" value={builderName} onChange={e => setBuilderName(e.target.value)}
              className="w-full bg-surface-deep border border-border/40 rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-purple-500/50 transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted block mb-1.5">Stats</label>
            <div className="space-y-3">
              {(Object.keys(builderStats) as (keyof typeof builderStats)[]).map(stat => (
                <div key={stat} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-12 text-right flex-shrink-0">{stat}</span>
                  <input type="range" min={0} max={100} value={builderStats[stat]}
                    onChange={e => setBuilderStats(prev => ({ ...prev, [stat]: parseInt(e.target.value) }))}
                    className="flex-1 h-1.5 accent-purple-500" />
                  <span className="text-xs font-mono font-bold text-text w-6 text-right">{builderStats[stat]}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted block mb-1.5">Abilities</label>
            <div className="flex flex-wrap gap-1.5">
              {ABILITY_POOL.map(ab => (
                <label key={ab} className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={builderAbilities.includes(ab)}
                    onChange={() => setBuilderAbilities(prev => prev.includes(ab) ? prev.filter(a => a !== ab) : [...prev, ab])}
                    className="rounded border-border accent-purple-500 w-3 h-3" />
                  <span className="text-xs text-text-muted font-medium">{ab}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted block mb-1">Behavior Tree</label>
            <select value={builderBT} onChange={e => setBuilderBT(e.target.value as typeof BT_PRESETS[number])}
              className="w-full bg-surface-deep border border-border/40 rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-purple-500/50 transition-colors">
              {BT_PRESETS.map(bt => <option key={bt} value={bt}>{bt}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted block mb-1.5">Elite Modifiers</label>
            <div className="flex flex-wrap gap-1.5">
              {ELITE_MODIFIERS.map(mod => {
                const isActive = builderModifiers.includes(mod.id);
                const isExcluded = !isActive && mod.excludes?.some(ex => builderModifiers.includes(ex));
                return (
                  <button key={mod.id} onClick={() => !isExcluded && toggleBuilderModifier(mod.id)}
                    disabled={isExcluded}
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded border transition-all inline-flex items-center gap-1 ${
                      isActive ? '' : isExcluded ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-125 cursor-pointer'
                    }`}
                    style={{
                      backgroundColor: isActive ? `${mod.color}20` : 'var(--surface-deep)',
                      borderColor: isActive ? `${mod.color}60` : 'var(--border)',
                      color: isActive ? mod.color : 'var(--text-muted)',
                    }} title={mod.description}>
                    <span>{mod.icon}</span>{mod.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preview card */}
        <BuilderPreview
          name={builderName}
          stats={builderStats}
          abilities={builderAbilities}
          bt={builderBT}
          modifiers={builderModifiers}
        />
      </div>
    </BlueprintPanel>
  );
}

/* ── Preview Card ────────────────────────────────────────────────────── */

function BuilderPreview({ name, stats, abilities, bt, modifiers }: {
  name: string;
  stats: Record<string, number>;
  abilities: string[];
  bt: string;
  modifiers: string[];
}) {
  const activeMods = ELITE_MODIFIERS.filter(m => modifiers.includes(m.id));

  return (
    <div className="bg-surface-deep rounded-xl border-2 border-purple-500/30 p-4 space-y-3 relative overflow-hidden"
      style={{ boxShadow: '0 0 20px -5px rgba(168,85,247,0.3), inset 0 0 20px -10px rgba(168,85,247,0.15)' }}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-2xl rounded-full pointer-events-none" />
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Preview</div>
      <div className="text-sm font-bold text-text">{name || 'Unnamed'}</div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-purple-400 uppercase tracking-wider">BT: {bt}</span>
        {activeMods.map(mod => (
          <span key={mod.id} className="text-[11px] font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-0.5"
            style={{ backgroundColor: `${mod.color}15`, borderColor: `${mod.color}40`, color: mod.color }}>
            {mod.icon} {mod.name}
          </span>
        ))}
      </div>
      <div className="space-y-1.5">
        {Object.entries(stats).map(([stat, value]) => {
          const effective = activeMods.length > 0 ? applyModifiers(value, stat, activeMods) : value;
          const diff = effective - value;
          return (
            <div key={stat} className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-10 flex-shrink-0 text-right">{stat}</span>
              <div className="flex-1">
                <NeonBar
                  pct={effective}
                  color={diff > 0 ? STATUS_SUCCESS : diff < 0 ? STATUS_ERROR : ACCENT_PURPLE_BOLD}
                  glow={diff !== 0}
                />
              </div>
              <span className={`text-2xs font-mono font-bold w-6 text-right ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-text'}`}>{effective}</span>
              {diff !== 0 && (
                <span className={`text-[10px] font-mono font-bold w-8 ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {diff > 0 ? '+' : ''}{diff}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {abilities.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {abilities.map(ab => (
            <span key={ab} className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-surface text-text"
              style={{ borderColor: 'rgba(168,85,247,0.4)' }}>{ab}</span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted italic">No abilities selected</p>
      )}
    </div>
  );
}
