'use client';

import { useState, useMemo, useCallback } from 'react';
import { Swords, ArrowUp, ArrowDown, Crosshair } from 'lucide-react';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import { ACCENT } from '../_shared/data';
import { WEAPONS, COMBO_SEQUENCES } from '../_shared/data-metrics';
import type { WeaponCategory } from '../_shared/data-metrics';
import {
  MATCHUP_TARGETS, DUMMY_TARGET, rankForTarget, outOfBand, severityTone,
} from '@/lib/combat/weapon-matchup';
import { FIGHT_LENGTH_CUTS, type FightLengthBand } from '@/lib/balance/encounter-bands';
import { withOpacity, OPACITY_10, OPACITY_30 } from '@/lib/chart-colors';

const MAX_COMPARE = 4;
const WEAPON_CATEGORIES: WeaponCategory[] = ['Sword', 'Axe', 'Mace', 'Bow', 'Staff', 'Dagger', 'Polearm'];
const WEAPONS_BY_CATEGORY = WEAPON_CATEGORIES.map(cat => ({
  category: cat,
  weapons: WEAPONS.filter(w => w.category === cat),
}));
/** Band strip order: the problems first. */
const STRIP_BANDS: FightLengthBand[] = ['stall', 'long', 'instant', 'healthy'];
const RELATED_COMBOS_SHOWN = 8;

/**
 * Weapon comparison against a named target: time-to-kill on the one weapon-DPS
 * law (target armour on canon's curve), graded by the fight-length band law.
 * The dummy target is the no-armour DPS view. The selection survives a target switch.
 */
export function WeaponMatchupPanel() {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState(DUMMY_TARGET.id);
  const target = MATCHUP_TARGETS.find(t => t.id === targetId) ?? DUMMY_TARGET;
  const ranking = useMemo(() => rankForTarget(WEAPONS, target), [target]);
  const rowById = useMemo(() => new Map(ranking.rows.map(r => [r.id, r])), [ranking]);
  const flagged = useMemo(() => outOfBand(ranking.rows, MAX_COMPARE), [ranking]);
  const hasTtk = target.hp !== null;
  const dpsMax = ranking.rows[0]?.dps || 1;

  const toggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }, []);

  const compared = useMemo(
    () => compareIds.flatMap(id => rowById.get(id) ?? []).sort((a, b) => a.rank - b.rank),
    [compareIds, rowById],
  );

  const comparedCombos = useMemo(() => {
    if (compared.length === 0) return [];
    const cats = new Set(compared.map(r => r.weapon.category));
    return COMBO_SEQUENCES.filter(c => cats.has(c.weaponCategory));
  }, [compared]);
  const shownCombos = comparedCombos.slice(0, RELATED_COMBOS_SHOWN);
  const comboDpsMax = shownCombos.reduce((m, c) => Math.max(m, c.dps), 0) || 1;

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <div data-testid="weapon-matchup-panel">
        <SectionHeader label={`Weapon Comparison vs ${target.name} (${compareIds.length}/${MAX_COMPARE})`} color={ACCENT} icon={Swords} />
        <div className="flex flex-wrap items-center gap-1 mb-2" role="group" aria-label="Target">
          <Crosshair className="w-3.5 h-3.5 text-text-muted" aria-hidden />
          {MATCHUP_TARGETS.map(t => {
            const on = t.id === target.id;
            return (
              <button key={t.id} type="button" aria-pressed={on} onClick={() => setTargetId(t.id)}
                className="px-2 py-1 rounded border text-xs font-mono transition-colors cursor-pointer hover:brightness-110"
                style={{ borderColor: on ? withOpacity(ACCENT, OPACITY_30) : 'var(--border)', backgroundColor: on ? withOpacity(ACCENT, OPACITY_10) : 'transparent', color: on ? ACCENT : 'var(--text-muted)' }}>
                <span className="font-bold">{t.name}</span>
                <span className="text-2xs ml-1">{t.hp === null ? 'no armour' : `${t.hp} HP · ${t.armour} arm`}</span>
              </button>
            );
          })}
        </div>
        {hasTtk ? (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div data-testid="matchup-band-strip" className="flex flex-wrap gap-2 text-xs font-mono">
              {STRIP_BANDS.filter(b => ranking.bandCounts[b]).map(b => {
                const tone = severityTone(ranking.rows.find(r => r.band === b)?.severity ?? null);
                return <span key={b} className="font-bold" style={{ color: tone }}>{ranking.bandCounts[b]} {b}</span>;
              })}
            </div>
            <button type="button" disabled={flagged.length === 0} onClick={() => setCompareIds(flagged)}
              className="ml-auto px-2 py-1 rounded border border-border text-xs font-mono text-text cursor-pointer hover:bg-surface-hover/40 disabled:opacity-30 disabled:cursor-not-allowed">
              Compare out-of-band ({flagged.length})
            </button>
          </div>
        ) : null}
        <p className="text-xs text-text-muted font-mono mb-2">
          {hasTtk
            ? `Time-to-kill = ${target.hp} HP / DPS after ${target.armour} armour (canon curve), graded by the fight-length band law. Elemental weapons resolve as physical: armour reduces them too (no resist model yet).`
            : 'No target: DPS only (no armour, no time-to-kill). Pick an enemy to read time-to-kill and its band. Select 2-4 weapons to compare.'}
        </p>
        <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-2">
          {WEAPONS_BY_CATEGORY.map(({ category, weapons }) => (
            <div key={category}>
              <div className="text-2xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1 sticky top-0 bg-surface-deep/80 backdrop-blur-sm py-0.5 px-1">{category} ({weapons.length})</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1">
                {weapons.map(w => {
                  const sel = compareIds.includes(w.id);
                  const row = rowById.get(w.id);
                  return (
                    <button key={w.id} type="button" onClick={() => toggleCompare(w.id)}
                      disabled={!sel && compareIds.length >= MAX_COMPARE}
                      className="px-2 py-1.5 rounded border text-xs font-mono text-left transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                      style={{ borderColor: sel ? withOpacity(w.color, OPACITY_30) : 'var(--border)', backgroundColor: sel ? withOpacity(w.color, OPACITY_10) : 'transparent', color: sel ? w.color : 'var(--text-muted)' }}>
                      <div className="truncate font-bold" style={{ color: sel ? w.color : 'var(--text)' }}>{w.name}</div>
                      <div className="text-2xs">
                        {w.tier}
                        {row?.ttkSec != null && <span style={{ color: severityTone(row.severity) }}> · {row.ttkSec.toFixed(1)}s</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {compared.length >= 2 && (
          <div data-testid="weapon-compare-rows" className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
            {compared.map(r => {
              const tone = severityTone(r.severity);
              return (
                <div key={r.id} className="flex items-center gap-2 px-1 py-0.5">
                  <span className="text-xs font-mono text-text w-[140px] flex-shrink-0 truncate">{r.name}</span>
                  <div className="flex-1">
                    {r.ttkSec !== null
                      ? <NeonBar pct={(r.ttkSec / FIGHT_LENGTH_CUTS.stall) * 100} color={tone} />
                      : <NeonBar pct={(r.dps / dpsMax) * 100} color={r.weapon.color} />}
                  </div>
                  {r.ttkSec !== null && r.band ? (
                    <>
                      {r.rankDelta !== 0 && (
                        <span className="text-2xs font-mono text-text-muted flex items-center w-[28px]" title={`${r.rankDelta > 0 ? 'Up' : 'Down'} ${Math.abs(r.rankDelta)} places vs no armour`}>
                          {r.rankDelta > 0 ? <ArrowUp className="w-3 h-3" aria-hidden /> : <ArrowDown className="w-3 h-3" aria-hidden />}{Math.abs(r.rankDelta)}
                        </span>
                      )}
                      <span className="text-2xs font-mono text-text-muted w-[56px] text-right">{r.dps.toFixed(1)} DPS</span>
                      <span className="text-xs font-mono font-bold w-[52px] text-right" style={{ color: tone }}>{r.ttkSec.toFixed(1)} s</span>
                      <span className="text-2xs font-mono px-1.5 rounded border" style={{ color: tone, borderColor: withOpacity(tone, OPACITY_30) }}>{r.band}</span>
                    </>
                  ) : (
                    <span className="text-xs font-mono font-bold w-[60px] text-right" style={{ color: r.weapon.color }}>{r.dps.toFixed(0)} DPS</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {comparedCombos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2 block">Related Combos ({comparedCombos.length}) · authored DPS</span>
            <div className="space-y-1">
              {shownCombos.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-xs font-mono px-1 py-0.5">
                  <span className="text-text w-[130px] truncate">{c.name}</span>
                  <span className="text-text-muted w-[60px]">{c.weaponCategory}</span>
                  <span className="text-text-muted w-[40px]">{c.hits}h</span>
                  <div className="flex-1"><NeonBar pct={(c.dps / comboDpsMax) * 100} color={ACCENT} /></div>
                  <span className="font-bold w-[55px] text-right" style={{ color: ACCENT }} title="Authored value, not derived from the weapon table">{c.dps} DPS</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BlueprintPanel>
  );
}
