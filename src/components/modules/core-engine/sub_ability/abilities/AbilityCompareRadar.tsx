'use client';

import { useState, useMemo, useCallback } from 'react';
import { Sparkles, GitCompareArrows } from 'lucide-react';
import {
  ACCENT_PURPLE_BOLD, ACCENT_GREEN,
  withOpacity, OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_15, OPACITY_25,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, RadarChart } from '../../unique-tabs/_shared';
import {
  ABILITY_RADAR_AXES, ELEMENT_COLORS,
  type SpellbookAbility, type AbilityElement,
} from '../_shared/data';
import { useSpellbookEntries } from '@/stores/catalogStore';
import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import type { LifecycleState } from '@/lib/catalog/types';
import { useGeneration } from '@/hooks/useGeneration';
import type { GenerationStep } from '@/lib/catalog/recipe';
import { AbilityCompareSelector } from './AbilityCompareSelector';

const DEFAULT_SELECTED = ['off-fire-01', 'off-ice-01', 'off-ltn-01', 'def-phy-03'];
const MAX_COMPARE = 6;
const MIN_COMPARE = 2;

export function AbilityCompareRadar() {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_SELECTED);
  const [primaryIdx, setPrimaryIdx] = useState(0);

  const entries = useSpellbookEntries();
  const abilities = useMemo(() => entries.map((e) => e.data), [entries]);
  const lifecycleById = useMemo(
    () => new Map<string, LifecycleState>(entries.map((e) => [e.id, e.lifecycle])),
    [entries],
  );

  const selectedAbilities = useMemo(
    () => selectedIds
      .map(id => abilities.find(a => a.id === id))
      .filter((a): a is SpellbookAbility => a != null),
    [selectedIds, abilities],
  );

  const handleSelect = useCallback((items: SpellbookAbility[]) => {
    setSelectedIds(items.slice(0, MAX_COMPARE).map(i => i.id));
    setPrimaryIdx(0);
  }, []);

  const primary = selectedAbilities[primaryIdx] ?? selectedAbilities[0];

  // folder-09: dispatch generation for the primary compared ability.
  const primaryEntry = (entries.find((e) => e.id === primary?.id) ?? entries[0])!;
  const gen = useGeneration(primaryEntry);
  const nextStep: GenerationStep =
    primaryEntry?.lifecycle === 'scaffolded' ? 'author-python'
      : primaryEntry?.lifecycle === 'generated' ? 'wire'
        : primaryEntry?.lifecycle === 'wired' ? 'verify'
          : 'scaffold-cpp';

  return (
    <SurfaceCard level={2} className="p-3 relative overflow-hidden">
      <div className="absolute left-0 top-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_5) }} />
      <div className="flex items-center justify-between mb-3">
        <SectionLabel icon={Sparkles} label="Ability Comparison Radar" color={ACCENT_PURPLE_BOLD} />
        <div className="flex items-center gap-2">
        <button
          onClick={() => gen.generate(nextStep)}
          disabled={gen.isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: withOpacity(ACCENT_GREEN, OPACITY_8),
            borderColor: withOpacity(ACCENT_GREEN, OPACITY_25),
            color: ACCENT_GREEN,
          }}
          title={`Generate "${primaryEntry?.name}" into UE — next step: ${nextStep}`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {gen.isRunning ? 'Generating…' : `(Re)generate · ${nextStep}`}
        </button>
        <button
          onClick={() => setSelectorOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer hover:shadow-sm"
          style={{
            backgroundColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_8),
            borderColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_25),
            color: ACCENT_PURPLE_BOLD,
          }}
        >
          <GitCompareArrows className="w-3.5 h-3.5" />
          Compare ({selectedAbilities.length}/{MAX_COMPARE})
        </button>
        </div>
      </div>

      <p className="text-xs font-mono text-text-muted mb-3">
        Select {MIN_COMPARE}–{MAX_COMPARE} abilities from the {abilities.length} available to compare on radar.
      </p>

      {/* Ability cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
        {selectedAbilities.map((ability, i) => {
          const isActive = primaryIdx === i;
          const maxCost = 50;
          const costPct = Math.min((ability.manaCost / maxCost) * 100, 100);
          return (
            <button key={ability.id} onClick={() => setPrimaryIdx(i)}
              className={`relative p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                isActive ? 'shadow-sm' : 'opacity-60 hover:opacity-90'
              }`}
              style={{
                backgroundColor: isActive ? withOpacity(ability.color, OPACITY_8) : withOpacity(ability.color, OPACITY_5),
                borderColor: isActive ? withOpacity(ability.color, OPACITY_25) : 'var(--border)',
                ...(isActive ? { outline: `1px solid ${ability.color}` } : {}),
              }}>
              <div className="flex items-center gap-2">
                {/* Icon circle with initial */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold"
                  style={{ backgroundColor: withOpacity(ability.color, OPACITY_15), color: ability.color, boxShadow: isActive ? `0 0 8px ${withOpacity(ability.color, OPACITY_25)}` : 'none' }}>
                  {ability.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono font-bold truncate" style={{ color: isActive ? ability.color : 'var(--text)' }}>{ability.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {/* Element dot */}
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ELEMENT_COLORS[ability.element as AbilityElement] ?? ability.color }} />
                    <span className="text-2xs font-mono text-text-muted">{ability.element}</span>
                    <LifecycleBadge state={lifecycleById.get(ability.id) ?? 'planned'} />
                  </div>
                </div>
                {/* Cooldown badge */}
                {ability.cooldown > 0 && (
                  <span className="text-2xs font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ backgroundColor: withOpacity(ability.color, OPACITY_10), color: ability.color }}>
                    {ability.cooldown}s
                  </span>
                )}
              </div>
              {/* Mini cost bar */}
              {ability.manaCost > 0 && (
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: withOpacity(ability.color, OPACITY_5) }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${costPct}%`, backgroundColor: withOpacity(ability.color, OPACITY_25) }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Radar chart + legend */}
      {primary && (
        <div className="flex items-center gap-4 justify-center flex-wrap bg-surface-deep/30 rounded-lg p-3">
          <RadarChart
            data={ABILITY_RADAR_AXES.map((axis, i) => ({
              axis,
              value: primary.radar[i],
            }))}
            size={150}
            accent={primary.color}
            overlays={selectedAbilities.filter((_, i) => i !== primaryIdx).map(ab => ({
              data: ABILITY_RADAR_AXES.map((axis, i) => ({ axis, value: ab.radar[i] })),
              color: ab.color,
              label: ab.name,
            }))}
          />
          <div className="flex flex-col gap-2">
            {selectedAbilities.map((ab, i) => (
              <div key={ab.id} className={`flex items-center gap-2 text-sm font-mono ${i === primaryIdx ? '' : 'opacity-50'}`}>
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ab.color }} />
                <span style={{ color: ab.color }}>{ab.name}</span>
                <span className="text-2xs text-text-muted">{ab.category} · {ab.element}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ScalableSelector modal */}
      <AbilityCompareSelector
        abilities={abilities}
        selectedIds={selectedIds}
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleSelect}
      />
    </SurfaceCard>
  );
}
