'use client';

import { useState, useCallback } from 'react';
import { Wrench } from 'lucide-react';
import { ACCENT_PURPLE_BOLD, ACCENT_EMERALD, ACCENT_RED, STATUS_SUCCESS, STATUS_ERROR, ACCENT_PURPLE,
  withOpacity, OPACITY_12, OPACITY_37, OPACITY_10, OPACITY_25, OPACITY_30,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../_design';
import { ABILITY_POOL, BT_PRESETS, ELITE_MODIFIERS, applyModifiers } from '../data';

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
            <label className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-1">Name</label>
            <input type="text" value={builderName} onChange={e => setBuilderName(e.target.value)}
              className="w-full bg-surface-deep border border-border/40 rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-[var(--accent)] transition-colors" />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-1.5">Stats</label>
            <div className="space-y-3">
              {(Object.keys(builderStats) as (keyof typeof builderStats)[]).map(stat => (
                <div key={stat} className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-12 text-right flex-shrink-0">{stat}</span>
                  <input type="range" min={0} max={100} value={builderStats[stat]}
                    onChange={e => setBuilderStats(prev => ({ ...prev, [stat]: parseInt(e.target.value) }))}
                    className="flex-1 h-1.5"
                    style={{ accentColor: ACCENT_PURPLE }} />
                  <span className="text-xs font-mono font-bold text-text w-6 text-right">{builderStats[stat]}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-1.5">Abilities</label>
            <div className="flex flex-wrap gap-1.5">
              {ABILITY_POOL.map(ab => (
                <label key={ab} className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={builderAbilities.includes(ab)}
                    onChange={() => setBuilderAbilities(prev => prev.includes(ab) ? prev.filter(a => a !== ab) : [...prev, ab])}
                    className="rounded border-border w-3 h-3"
                    style={{ accentColor: ACCENT_PURPLE }} />
                  <span className="text-xs text-text-muted font-medium">{ab}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-1">Behavior Tree</label>
            <select value={builderBT} onChange={e => setBuilderBT(e.target.value as typeof BT_PRESETS[number])}
              className="w-full bg-surface-deep border border-border/40 rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-[var(--accent)] transition-colors">
              {BT_PRESETS.map(bt => <option key={bt} value={bt}>{bt}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-1.5">Elite Modifiers</label>
            <div className="flex flex-wrap gap-1.5">
              {ELITE_MODIFIERS.map(mod => {
                const isActive = builderModifiers.includes(mod.id);
                const isExcluded = !isActive && mod.excludes?.some(ex => builderModifiers.includes(ex));
                return (
                  <button key={mod.id} onClick={() => !isExcluded && toggleBuilderModifier(mod.id)}
                    disabled={isExcluded}
                    className={`text-xs font-bold px-1.5 py-0.5 rounded border transition-all inline-flex items-center gap-1 ${
                      isActive ? '' : isExcluded ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-125 cursor-pointer'
                    }`}
                    style={{
                      backgroundColor: isActive ? `${withOpacity(mod.color, OPACITY_12)}` : 'var(--surface-deep)',
                      borderColor: isActive ? `${withOpacity(mod.color, OPACITY_37)}` : 'var(--border)',
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
    <div className="bg-surface-deep rounded-xl border-2 p-4 space-y-3 relative overflow-hidden"
      style={{ borderColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_30), boxShadow: `0 0 20px -5px ${withOpacity(ACCENT_PURPLE_BOLD, OPACITY_25)}, inset 0 0 20px -10px ${withOpacity(ACCENT_PURPLE_BOLD, OPACITY_12)}` }}>
      <div className="absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full pointer-events-none" style={{ backgroundColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_10) }} />
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Preview</div>
      <div className="text-sm font-bold text-text">{name || 'Unnamed'}</div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: ACCENT_PURPLE_BOLD }}>BT: {bt}</span>
        {activeMods.map(mod => (
          <span key={mod.id} className="text-xs font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-0.5"
            style={{ backgroundColor: `${withOpacity(mod.color, OPACITY_10)}`, borderColor: `${withOpacity(mod.color, OPACITY_25)}`, color: mod.color }}>
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
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-10 flex-shrink-0 text-right">{stat}</span>
              <div className="flex-1">
                <NeonBar
                  pct={effective}
                  color={diff > 0 ? STATUS_SUCCESS : diff < 0 ? STATUS_ERROR : ACCENT_PURPLE_BOLD}
                  glow={diff !== 0}
                />
              </div>
              <span className="text-2xs font-mono font-bold w-6 text-right"
                style={{ color: diff > 0 ? ACCENT_EMERALD : diff < 0 ? ACCENT_RED : 'var(--text)' }}>{effective}</span>
              {diff !== 0 && (
                <span className="text-xs font-mono font-bold w-8"
                  style={{ color: diff > 0 ? ACCENT_EMERALD : ACCENT_RED }}>
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
            <span key={ab} className="text-xs font-bold px-1.5 py-0.5 rounded border bg-surface text-text"
              style={{ borderColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_37) }}>{ab}</span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted italic">No abilities selected</p>
      )}
    </div>
  );
}
