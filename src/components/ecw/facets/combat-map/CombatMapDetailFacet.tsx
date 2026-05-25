'use client';

import { Swords, ChevronRight, Map, Skull, Flame, Shield, Trophy, Skull as SkullIcon } from 'lucide-react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { ComboSequence } from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';
import { isArenaSlice } from '@/lib/catalog/arena-slice';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Combat Map detail facet — Phase 7b. The `combat-map` catalog holds two shapes:
 * weapon combos (`ComboSequence`) and tactical arena slices (`ArenaSliceSpec`).
 * Branch on the discriminator: arena slices render their waves/cover/win-loss,
 * combos render the weapon chain.
 */
export function CombatMapDetailFacet({ entity }: Props) {
  if (isArenaSlice(entity.data)) {
    const a = entity.data;
    return (
      <div className="px-4 py-3 space-y-4">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <Map className="w-4 h-4 text-text-muted" />
          <span className="font-mono uppercase tracking-wider text-text-muted">{a.position}</span>
          <span className="text-text">·</span>
          <span className="font-mono text-text">{a.waves.length} waves</span>
          <span className="text-text">·</span>
          <span className="font-mono text-text">{a.cover.length} cover</span>
          {a.hazards.length > 0 && (
            <>
              <span className="text-text">·</span>
              <span className="flex items-center gap-1 font-mono text-orange-500">
                <Flame className="w-3 h-3" />{a.hazards.length} hazard{a.hazards.length > 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>

        <p className="text-xs text-text-muted/80 italic">{a.theme}</p>

        <section>
          <h3 className="text-2xs font-mono uppercase tracking-wider text-text-muted mb-2">Waves</h3>
          <div className="space-y-1.5">
            {a.waves.map((w, i) => (
              <div key={`${w.enemyArchetype}-${i}`} className="flex items-center gap-2 text-2xs font-mono">
                <Skull className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="text-text font-semibold">{w.enemyArchetype}</span>
                <span className="text-text-muted">×{w.count}</span>
                {w.difficultyMultiplier > 1 && (
                  <span className="text-amber-500">×{w.difficultyMultiplier.toFixed(2)} diff</span>
                )}
                {w.delayBeforeWaveSec > 0 && <span className="text-text-muted/60">+{w.delayBeforeWaveSec}s</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center gap-4 text-2xs font-mono">
          <span className="flex items-center gap-1.5 text-emerald-500">
            <Trophy className="w-3.5 h-3.5" />{a.winCondition}
            {a.winCondition === 'survive-duration' && a.survivalSeconds ? ` (${a.survivalSeconds}s)` : ''}
          </span>
          <span className="flex items-center gap-1.5 text-rose-500">
            <SkullIcon className="w-3.5 h-3.5" />{a.lossCondition}
          </span>
        </section>

        <section className="flex items-center gap-2 text-2xs font-mono text-text-muted">
          <Shield className="w-3.5 h-3.5" />
          <span>base lvl {a.baseDifficultyLevel} · scale {a.difficultyScalePerLevel}/lvl · cap ×{a.maxDifficultyMultiplier}</span>
        </section>
      </div>
    );
  }

  const data = entity.data as ComboSequence | undefined;

  if (!data || typeof data !== 'object' || !('weaponCategory' in data)) {
    return (
      <div className="px-4 py-3 text-xs text-text-muted/70 italic">
        No combo data for this entity.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <Swords className="w-4 h-4 text-text-muted" />
        <span className="font-mono uppercase tracking-wider text-text-muted">{data.weaponCategory}</span>
        <span className="text-text">·</span>
        <span className="font-mono text-text">{data.hits} hits</span>
        <span className="text-text">·</span>
        <span className="font-mono text-text">{data.totalTime}</span>
        <span className="text-text">·</span>
        <span className="font-mono text-emerald-500">{data.dps} DPS</span>
      </div>

      <section>
        <h3 className="text-2xs font-mono uppercase tracking-wider text-text-muted mb-2">Chain</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {data.chain.map((step, i) => (
            <span key={`${step}-${i}`} className="flex items-center gap-1.5">
              <span
                data-testid="combat-chain-step"
                className="text-2xs font-mono px-2 py-1 rounded bg-surface text-text border border-border/40"
              >
                {step}
              </span>
              {i < data.chain.length - 1 && (
                <ChevronRight className="w-3 h-3 text-text-muted/60" />
              )}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

registerFacet('combat-map', { id: 'detail', label: 'Detail', Component: CombatMapDetailFacet });
