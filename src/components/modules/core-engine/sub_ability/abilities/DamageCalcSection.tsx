'use client';

import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_RED, ACCENT_ORANGE, ACCENT_PURPLE_BOLD, ACCENT_CYAN, STATUS_WARNING,
  OVERLAY_WHITE, withOpacity, OPACITY_5, OPACITY_10, OPACITY_12, OPACITY_15, OPACITY_25,
} from '@/lib/chart-colors';
import { explainAbilityHit, rankAbilitiesVsTarget } from '@/lib/ability/ability-hit-preview';
import { useSpellbookEntries } from '@/stores/catalogStore';
import { BlueprintPanel, SectionHeader, GlowStat } from '../../unique-tabs/_design';
import { AbilityHitRanking } from './AbilityHitRanking';

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * Spellbook damage sandbox. Every number is the canon kernel via
 * `explainAbilityHit` (@/lib/ability/damage-formula) — the retired
 * `armor/(armor+100)` curve must never render here.
 */
export function DamageCalcSection() {
  const entries = useSpellbookEntries();
  const [abilityId, setAbilityId] = useState('');
  const [baseDamage, setBaseDamage] = useState(50);
  const [element, setElement] = useState('Physical');
  const [attackerPower, setAttackerPower] = useState(100);
  const [targetArmor, setTargetArmor] = useState(50);
  const [targetResistPct, setTargetResistPct] = useState(0);
  const [critChance, setCritChance] = useState(15);
  const [critMultiplier, setCritMultiplier] = useState(1.5);

  const attacker = useMemo(
    () => ({ power: attackerPower, critChancePct: critChance, critMult: critMultiplier }),
    [attackerPower, critChance, critMultiplier],
  );
  const target = useMemo(() => ({ armor: targetArmor, resist: targetResistPct / 100 }), [targetArmor, targetResistPct]);
  const hit = useMemo(
    () => explainAbilityHit({ base: baseDamage, element, ...target, ...attacker }),
    [baseDamage, element, target, attacker],
  );
  const ranking = useMemo(() => rankAbilitiesVsTarget(entries, target, attacker), [entries, target, attacker]);
  const maxBase = useMemo(() => Math.max(300, ...entries.map((e) => e.data.damage)), [entries]);

  const pickAbility = (id: string) => {
    setAbilityId(id);
    const picked = entries.find((e) => e.id === id)?.data;
    if (!picked) return;
    setBaseDamage(picked.damage);
    setElement(picked.element);
  };
  const editBase = (v: number) => { setBaseDamage(v); setAbilityId(''); };

  const mitigationLabel = hit.armorApplied ? 'Armour soft-cap' : `${hit.canonType} resist`;
  const mitigationFormula = hit.armorApplied
    ? `${targetArmor} / (${targetArmor} + 5 x ${hit.raw.toFixed(1)})  · on crit ${pct(hit.critMitigation)}`
    : `min(${targetResistPct}%, 75%)${hit.resistCapped ? ' · capped' : ''} · armour ignored`;
  const typeFormula = hit.typeFallback
    ? `${element} has no canon type — falls back to Physical`
    : hit.mappedFrom ? `${hit.mappedFrom} → ${hit.canonType}` : hit.canonType;

  return (
    <div className="space-y-4">
      <BlueprintPanel color={ACCENT_ORANGE} className="p-3">
        <SectionHeader icon={Calculator} label="Damage Formula Sandbox" color={ACCENT_ORANGE} />
        <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-4">
          Pick a catalog ability and a target — every step below is the canon damage kernel.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Ability</span>
              <select aria-label="Ability" value={abilityId} onChange={(e) => pickAbility(e.target.value)}
                className="mt-1 w-full rounded-md border bg-surface px-2 py-1 text-xs font-mono text-text"
                style={{ borderColor: withOpacity(ACCENT_ORANGE, OPACITY_25) }}>
                <option value="">Custom hit</option>
                {entries.map((e) => (
                  <option key={e.id} value={e.id}>{e.data.name} · {e.data.element} · {e.data.damage}</option>
                ))}
              </select>
            </label>
            <SliderParam label="Base Damage" value={baseDamage} min={0} max={maxBase} onChange={editBase} color={ACCENT_RED} />
            <SliderParam label="Attacker Power" value={attackerPower} min={1} max={200} onChange={setAttackerPower} color={ACCENT_ORANGE} />
            <SliderParam label="Target Armor" value={targetArmor} min={0} max={200} onChange={setTargetArmor} color={MODULE_COLORS.core} />
            <SliderParam label="Target Resist" value={targetResistPct} min={0} max={100} onChange={setTargetResistPct} unit="%" color={ACCENT_CYAN} />
            <SliderParam label="Crit Chance" value={critChance} min={0} max={100} onChange={setCritChance} unit="%" color={ACCENT_PURPLE_BOLD} />
            <SliderParam label="Crit Multiplier" value={critMultiplier} min={1.0} max={3.0} step={0.1} onChange={setCritMultiplier} unit="x" color={MODULE_COLORS.content} />
          </div>

          <div className="space-y-3" data-testid="formula-steps">
            <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">Formula Steps</div>
            <FormulaStep step={1} label="Raw Hit" formula={`${baseDamage} x (1 + ${attackerPower}/100)`}
              display={hit.raw.toFixed(1)} color={ACCENT_RED} />
            <FormulaStep step={2} label="Damage Type" formula={typeFormula} display={hit.canonType}
              color={hit.typeFallback ? STATUS_WARNING : ACCENT_CYAN} />
            <FormulaStep step={3} label={mitigationLabel} formula={mitigationFormula}
              display={pct(hit.nonCritMitigation)} color={MODULE_COLORS.core} />
            <FormulaStep step={4} label="Crit Chance" formula={`min(${critChance}%, 95%) · crit hit x${critMultiplier.toFixed(1)}`}
              display={pct(hit.critChanceApplied)} color={ACCENT_PURPLE_BOLD}
              marker={hit.critCapped ? (
                <span data-testid="crit-cap-marker" className="ml-1 px-1 rounded font-bold"
                  style={{ color: STATUS_WARNING, backgroundColor: withOpacity(STATUS_WARNING, OPACITY_12) }}>95% cap</span>
              ) : null} />
            <FormulaStep step={5} label="Expected Hit"
              formula={`${hit.nonCrit.toFixed(1)} x ${pct(1 - hit.critChanceApplied)} + ${hit.onCrit.toFixed(1)} x ${pct(hit.critChanceApplied)}`}
              display={hit.expected.toFixed(1)} color={ACCENT_ORANGE} />

            <div className="grid grid-cols-2 gap-3 mt-3">
              <GlowStat label="Expected Damage" value={hit.expected.toFixed(1)} color={ACCENT_ORANGE} delay={0.3} />
              <GlowStat label="On Crit" value={hit.onCrit.toFixed(1)} color={ACCENT_PURPLE_BOLD} delay={0.4} />
            </div>
          </div>
        </div>

        <AbilityHitRanking rows={ranking.rows} excluded={ranking.excluded} selectedId={abilityId} onPick={pickAbility} />
      </BlueprintPanel>
    </div>
  );
}

/* ── Slider + Formula helpers ─────────────────────────────────────────── */

function SliderParam({ label, value, min, max, step = 1, onChange, unit, color }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string; color: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{label}</span>
        <span className="text-sm font-mono font-bold" style={{ color, textShadow: `0 0 12px ${withOpacity(color, OPACITY_25)}` }}>
          {step < 1 ? value.toFixed(1) : value}{unit ?? ''}
        </span>
      </div>
      <input
        type="range" aria-label={label} min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${fill}%, ${withOpacity(OVERLAY_WHITE, OPACITY_10)} ${fill}%, ${withOpacity(OVERLAY_WHITE, OPACITY_10)} 100%)`,
        }}
      />
    </div>
  );
}

function FormulaStep({ step, label, formula, display, color, marker }: {
  step: number; label: string; formula: string; display: string; color: string; marker?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: step * 0.08 }}
      className="flex items-center gap-2 text-xs p-2 rounded-lg border"
      style={{ borderColor: withOpacity(color, OPACITY_15), backgroundColor: withOpacity(color, OPACITY_5) }}
    >
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: withOpacity(color, OPACITY_12), color }}
      >
        {step}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-mono font-bold text-text truncate">{label}{marker}</div>
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted truncate" title={formula}>{formula}</div>
      </div>
      <span className="font-mono font-bold flex-shrink-0" style={{ color, textShadow: `0 0 12px ${withOpacity(color, OPACITY_25)}` }}>
        {display}
      </span>
    </motion.div>
  );
}
