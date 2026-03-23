'use client';

import { Code } from 'lucide-react';
import { STATUS_WARNING } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import type { ArchetypeConfig, EliteModifier } from './data';
import { ELITE_MODIFIERS } from './data';

interface ExpandedDetailsProps {
  archetype: ArchetypeConfig;
  activeModifiers: string[];
  appliedMods: EliteModifier[];
  onToggleModifier: (modId: string) => void;
  onViewCodegen: (mod: EliteModifier) => void;
  sc: { dot: string; label: string };
  row: FeatureRow | undefined;
}

export function ExpandedDetails({
  archetype, activeModifiers, appliedMods, onToggleModifier, onViewCodegen, sc, row,
}: ExpandedDetailsProps) {
  return (
    <div className="px-4 pb-4 border-t border-[rgba(255,255,255,0.05)] pt-3 bg-surface/30 space-y-4 backdrop-blur-sm">
      {/* Abilities */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">Signature Abilities</div>
        <div className="flex flex-wrap gap-1.5">
          {archetype.abilities.map(ab => (
            <span key={ab} className="text-xs font-bold px-2 py-1 rounded-md border shadow-sm bg-surface text-text"
              style={{ borderColor: `${archetype.color}40` }}>
              {ab}
            </span>
          ))}
        </div>
      </div>

      {/* BT States */}
      <div className="bg-surface-deep p-3 rounded-xl border" style={{ borderColor: `${archetype.color}30` }}>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">Behavior Tree Matrix</div>
        <div className="space-y-1.5">
          {Object.entries(archetype.btSummary).map(([state, desc]) => (
            <div key={state} className="flex items-center gap-3 text-xs">
              <span className="font-mono font-bold flex-shrink-0 w-16 text-right" style={{ color: archetype.color }}>{state}</span>
              <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: `${archetype.color}50` }} />
              <span className="text-text-muted truncate font-medium" title={desc}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Elite Modifiers */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">Elite Modifiers</div>
        <div className="flex flex-wrap gap-1.5">
          {ELITE_MODIFIERS.map(mod => {
            const isActive = activeModifiers.includes(mod.id);
            const isExcluded = !isActive && mod.excludes?.some(ex => activeModifiers.includes(ex));
            return (
              <button key={mod.id}
                onClick={(e) => { e.stopPropagation(); if (!isExcluded) onToggleModifier(mod.id); }}
                disabled={isExcluded}
                className={`text-[11px] font-bold px-2 py-1 rounded-md border transition-all inline-flex items-center gap-1 ${
                  isActive ? 'shadow-sm' : isExcluded ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-125 cursor-pointer'
                }`}
                style={{
                  backgroundColor: isActive ? `${mod.color}20` : 'var(--surface)',
                  borderColor: isActive ? `${mod.color}60` : `${mod.color}30`,
                  color: isActive ? mod.color : 'var(--text-muted)',
                  boxShadow: isActive ? `0 0 8px ${mod.color}30` : 'none',
                }}
                title={`${mod.name} (${mod.tier}): ${mod.statMods.map(s => s.label).join(', ')}`}
              >
                <span>{mod.icon}</span>
                {mod.name}
                <span className="text-[9px] uppercase opacity-60 ml-0.5">{mod.tier[0]}</span>
              </button>
            );
          })}
        </div>
        {appliedMods.length > 0 && (
          <div className="mt-2 bg-surface-deep rounded-lg border border-border/30 p-2 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Modifier Effects</div>
            {appliedMods.map(mod => (
              <div key={mod.id} className="flex items-center gap-2 text-xs">
                <span style={{ color: mod.color }}>{mod.icon} {mod.name}</span>
                <span className="text-text-muted">&mdash;</span>
                <span className="text-text-muted font-mono">{mod.statMods.map(s => s.label).join(', ')}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onViewCodegen(mod); }}
                  className="ml-auto text-text-muted hover:text-text transition-colors p-0.5"
                  title="View UE5 GameplayEffect code"
                >
                  <Code className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Dev Status</span>
        <span className="text-xs px-2 py-0.5 rounded uppercase font-bold border shadow-sm flex items-center gap-1.5 bg-surface"
          style={{ color: sc.dot, borderColor: `${sc.dot}40` }}>
          <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
          {sc.label}
        </span>
      </div>
      {row?.nextSteps && (
        <p className="text-xs p-2 bg-surface border-l-2 rounded font-medium shadow-inner"
          style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}10` }}>
          Next: {row.nextSteps}
        </p>
      )}
    </div>
  );
}
