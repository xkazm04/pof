'use client';

import { useState, useMemo, useCallback } from 'react';
import { Swords, Shield, Target, Zap, Activity } from 'lucide-react';
import {
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_GREEN, ACCENT_CYAN,
  ACCENT_VIOLET, ACCENT_PINK, STATUS_ERROR, STATUS_INFO, STATUS_WARNING,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import type { CharacterGenome } from '@/types/character-genome';
import { STANDARD_ENEMY_HP, ASSUMED_ENEMY_DPS } from './field-data';
import { computeSimMetrics } from './sim-engine';
import { HeroMetric, SimStatLine } from './SimWidgets';

/* ── Live DPS/EHP Simulation Dashboard ─────────────────────────────────── */

export function LiveSimDashboard({ genome, compareGenome }: {
  genome: CharacterGenome;
  compareGenome?: CharacterGenome;
}) {
  const [level, setLevel] = useState(1);

  const sim = useMemo(() => computeSimMetrics(genome, level), [genome, level]);
  const cmp = useMemo(() => compareGenome ? computeSimMetrics(compareGenome, level) : undefined, [compareGenome, level]);

  const fmtN = useCallback((v: number, decimals = 1) => {
    if (!isFinite(v)) return '\u221E';
    if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(1)}k`;
    return v.toFixed(decimals);
  }, []);

  const delta = useCallback((a: number, b: number | undefined, fmt: (v: number) => string): { display: string; raw: number } | undefined => {
    if (b == null) return undefined;
    const d = a - b;
    return { display: fmt(d), raw: d };
  }, []);

  return (
    <BlueprintPanel color={ACCENT_ORANGE} className="p-3">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader icon={Activity} label="Live Simulation Dashboard" color={ACCENT_ORANGE} />
          {compareGenome && (
            <span className="text-xs font-mono font-bold" style={{ color: compareGenome.color }}>vs {compareGenome.name}</span>
          )}
        </div>

        {/* Level Slider */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-deep/50 border" style={{ borderColor: `${ACCENT_ORANGE}25` }}>
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-10">Lv.</span>
          <div className="flex-1 relative h-5 flex items-center">
            <div className="absolute inset-x-0 h-1.5 bg-surface rounded-full" />
            <NeonBar pct={((level - 1) / 49) * 100} color={ACCENT_ORANGE} height={6} glow />
            <input type="range" min={1} max={50} step={1} value={level}
              onChange={(e) => setLevel(parseInt(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer" />
            <div className="absolute w-3 h-3 rounded-full border-2 border-surface shadow-md pointer-events-none"
              style={{ left: `calc(${((level - 1) / 49) * 100}% - 6px)`, backgroundColor: ACCENT_ORANGE }} />
          </div>
          <input type="number" min={1} max={50} value={level}
            onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1 && v <= 50) setLevel(v); }}
            className="w-12 text-xs font-mono font-bold text-center bg-surface border border-border/40 rounded px-1 py-0.5 text-text focus:outline-none focus:border-blue-500/50" />
          <span className="text-xs font-mono text-text-muted/50">/ 50</span>
        </div>

        {/* Hero Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <HeroMetric label="DPS" value={sim.effectiveDps} unit="dmg/s" icon={Swords} color={STATUS_ERROR} compareValue={cmp?.effectiveDps} />
          <HeroMetric label="EHP" value={sim.ehp} unit={`Lv.${level} effective HP`} icon={Shield} color={ACCENT_EMERALD} compareValue={cmp?.ehp} />
          <HeroMetric label="TTK" value={sim.ttk} unit={`vs ${STANDARD_ENEMY_HP}HP`} icon={Target} color={ACCENT_ORANGE} compareValue={cmp?.ttk} lowerIsBetter />
          <HeroMetric label="I-Frame" value={sim.iframeUptime} unit="% uptime" icon={Zap} color={ACCENT_CYAN} compareValue={cmp?.iframeUptime} />
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Offense */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 pb-1 border-b" style={{ borderColor: `${STATUS_ERROR}25` }}>
              <Swords className="w-3 h-3" style={{ color: STATUS_ERROR, filter: `drop-shadow(0 0 3px ${STATUS_ERROR}80)` }} />
              <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: STATUS_ERROR }}>Offense</span>
            </div>
            <SimStatLine label="Raw DPS" value={`${fmtN(sim.rawDps)} dmg/s`} formula="baseDmg \u00D7 atkSpd" color={STATUS_ERROR}
              barPct={(sim.rawDps / 200) * 100} delta={delta(sim.rawDps, cmp?.rawDps, (v) => fmtN(v))} />
            <SimStatLine label="Crit Contribution" value={`+${fmtN(sim.critContribution)} dmg/s`} formula="rawDPS \u00D7 (critChance \u00D7 (critMult \u2212 1))" color={ACCENT_ORANGE}
              barPct={(sim.critContribution / 100) * 100} delta={delta(sim.critContribution, cmp?.critContribution, (v) => fmtN(v))} />
            <SimStatLine label="Effective DPS" value={`${fmtN(sim.effectiveDps)} dmg/s`} formula="baseDmg \u00D7 atkSpd \u00D7 (1 + crit% \u00D7 (critMult \u2212 1))" color={STATUS_ERROR}
              barPct={(sim.effectiveDps / 200) * 100} delta={delta(sim.effectiveDps, cmp?.effectiveDps, (v) => fmtN(v))} />
            <SimStatLine label="3s Burst" value={`${fmtN(sim.burst3s, 0)} dmg`} formula="effectiveDPS \u00D7 3s" color={ACCENT_PINK}
              barPct={(sim.burst3s / 600) * 100} delta={delta(sim.burst3s, cmp?.burst3s, (v) => fmtN(v, 0))} />
            <SimStatLine label="Cleave Area" value={sim.cleaveArea >= 1000 ? `${fmtN(sim.cleaveArea / 1000)}k cm\u00B2` : `${fmtN(sim.cleaveArea, 0)} cm\u00B2`}
              formula="\u03C0 \u00D7 range\u00B2 \u00D7 cleaveAngle/360" color={STATUS_WARNING} barPct={(sim.cleaveArea / 500000) * 100}
              delta={delta(sim.cleaveArea, cmp?.cleaveArea, (v) => v >= 1000 ? `${fmtN(v / 1000)}k` : fmtN(v, 0))} />
            <SimStatLine label="Time to Kill" value={isFinite(sim.ttk) ? `${sim.ttk.toFixed(1)}s` : '\u221E'}
              formula={`${STANDARD_ENEMY_HP}HP \u00F7 effectiveDPS`} color={ACCENT_ORANGE}
              barPct={isFinite(sim.ttk) ? Math.max((1 - sim.ttk / 60) * 100, 5) : 0}
              delta={cmp && isFinite(sim.ttk) && isFinite(cmp.ttk) ? { display: `${(sim.ttk - cmp.ttk).toFixed(1)}s`, raw: sim.ttk - cmp.ttk } : undefined}
              lowerIsBetter />
          </div>

          {/* Defense */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 pb-1 border-b" style={{ borderColor: `${ACCENT_EMERALD}25` }}>
              <Shield className="w-3 h-3" style={{ color: ACCENT_EMERALD, filter: `drop-shadow(0 0 3px ${ACCENT_EMERALD}80)` }} />
              <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: ACCENT_EMERALD }}>Defense</span>
            </div>
            <SimStatLine label={`HP (Lv.${level})`} value={fmtN(sim.hp, 0)} formula={`baseHP + hpPerLvl \u00D7 ${level - 1}`} color={ACCENT_GREEN}
              barPct={(sim.hp / 5000) * 100} delta={delta(sim.hp, cmp?.hp, (v) => fmtN(v, 0))} />
            <SimStatLine label={`Armor (Lv.${level})`} value={fmtN(sim.armor, 0)} formula={`baseArmor + armorPerLvl \u00D7 ${level - 1}`} color={ACCENT_CYAN}
              barPct={(sim.armor / 200) * 100} delta={delta(sim.armor, cmp?.armor, (v) => fmtN(v, 0))} />
            <SimStatLine label="Armor Mitigation" value={`+${fmtN(sim.armorMitigation, 0)} eHP`} formula={`armor \u00D7 ${5}`} color={ACCENT_CYAN}
              barPct={(sim.armorMitigation / 1000) * 100} delta={delta(sim.armorMitigation, cmp?.armorMitigation, (v) => fmtN(v, 0))} />
            <SimStatLine label="Effective HP" value={`${fmtN(sim.ehp, 0)} eHP`} formula="HP + armor \u00D7 5" color={ACCENT_EMERALD}
              barPct={(sim.ehp / 3000) * 100} delta={delta(sim.ehp, cmp?.ehp, (v) => fmtN(v, 0))} />
            <SimStatLine label="I-Frame Uptime" value={`${sim.iframeUptime.toFixed(1)}%`} formula="iFrameDur \u00F7 (cooldown + dodgeDur) \u00D7 100" color={ACCENT_VIOLET}
              barPct={sim.iframeUptime * 2} delta={delta(sim.iframeUptime, cmp?.iframeUptime, (v) => `${v.toFixed(1)}%`)} />
            <SimStatLine label={`Survival (vs ${ASSUMED_ENEMY_DPS}dps)`} value={isFinite(sim.survivalTime) ? `${sim.survivalTime.toFixed(1)}s` : '\u221E'}
              formula={`eHP \u00F7 ${ASSUMED_ENEMY_DPS} assumed enemy DPS`} color={ACCENT_EMERALD}
              barPct={isFinite(sim.survivalTime) ? Math.min((sim.survivalTime / 60) * 100, 100) : 100}
              delta={delta(sim.survivalTime, cmp?.survivalTime, (v) => `${v.toFixed(1)}s`)} />
          </div>

          {/* Stamina Economy */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 pb-1 border-b" style={{ borderColor: `${ACCENT_CYAN}25` }}>
              <Zap className="w-3 h-3" style={{ color: ACCENT_CYAN, filter: `drop-shadow(0 0 3px ${ACCENT_CYAN}80)` }} />
              <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: ACCENT_CYAN }}>Stamina Economy</span>
            </div>
            <SimStatLine label={`Stamina (Lv.${level})`} value={fmtN(sim.stamina, 0)} formula={`baseStam + stamPerLvl \u00D7 ${level - 1}`} color={ACCENT_CYAN}
              barPct={(sim.stamina / 300) * 100} delta={delta(sim.stamina, cmp?.stamina, (v) => fmtN(v, 0))} />
            <SimStatLine label="Dodge Cost" value={`${genome.dodge.staminaCost} stam`} formula="flat stamina cost per dodge" color={ACCENT_ORANGE}
              barPct={(genome.dodge.staminaCost / 100) * 100}
              delta={compareGenome ? { display: `${genome.dodge.staminaCost - compareGenome.dodge.staminaCost}`, raw: genome.dodge.staminaCost - compareGenome.dodge.staminaCost } : undefined}
              lowerIsBetter />
            <SimStatLine label="Burst Dodges" value={sim.staminaBudget >= 99 ? '\u221E' : `${sim.staminaBudget} dodges`} formula="stamina \u00F7 dodgeCost" color={ACCENT_CYAN}
              barPct={(Math.min(sim.staminaBudget, 20) / 20) * 100} delta={delta(sim.staminaBudget, cmp?.staminaBudget, (v) => String(Math.round(v)))} />
            <SimStatLine label="Regen" value={`${genome.attributes.staminaRegenPerSec}/s`} formula="staminaRegenPerSec" color={ACCENT_GREEN}
              barPct={(genome.attributes.staminaRegenPerSec / 50) * 100} />
            <SimStatLine label="Net Stamina/s" value={`${sim.staminaNetPerSec >= 0 ? '+' : ''}${sim.staminaNetPerSec.toFixed(1)}/s`}
              formula="staminaRegen \u2212 (dodgeCost \u00F7 dodgeCycle)" color={sim.staminaNetPerSec >= 0 ? ACCENT_GREEN : STATUS_ERROR}
              barPct={(Math.abs(sim.staminaNetPerSec) / 30) * 100}
              delta={delta(sim.staminaNetPerSec, cmp?.staminaNetPerSec, (v) => `${v.toFixed(1)}/s`)} />
            <SimStatLine label="Sustained Dodges" value={`${sim.sustainedDodgesPerMin.toFixed(1)}/min`} formula="min(dodgesPerMin, regenRate \u00F7 cost \u00D7 60)" color={ACCENT_VIOLET}
              barPct={(sim.sustainedDodgesPerMin / 100) * 100} delta={delta(sim.sustainedDodgesPerMin, cmp?.sustainedDodgesPerMin, (v) => `${v.toFixed(1)}/min`)} />
            <SimStatLine label="Full Recovery" value={isFinite(sim.fullRecovery) ? `${sim.fullRecovery.toFixed(1)}s` : '\u221E'}
              formula="stamina \u00F7 regenPerSec" color={ACCENT_CYAN}
              barPct={isFinite(sim.fullRecovery) ? Math.max((1 - sim.fullRecovery / 30) * 100, 5) : 0} lowerIsBetter
              delta={delta(sim.fullRecovery, cmp?.fullRecovery, (v) => `${v.toFixed(1)}s`)} />
          </div>

          {/* Mobility */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 pb-1 border-b" style={{ borderColor: `${ACCENT_VIOLET}25` }}>
              <Activity className="w-3 h-3" style={{ color: ACCENT_VIOLET, filter: `drop-shadow(0 0 3px ${ACCENT_VIOLET}80)` }} />
              <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: ACCENT_VIOLET }}>Mobility</span>
            </div>
            <SimStatLine label="Sprint Ratio" value={`${sim.sprintRatio.toFixed(2)}\u00D7`} formula="sprintSpeed \u00F7 walkSpeed" color={ACCENT_VIOLET}
              barPct={(sim.sprintRatio / 3) * 100} delta={delta(sim.sprintRatio, cmp?.sprintRatio, (v) => `${v.toFixed(2)}\u00D7`)} />
            <SimStatLine label="Dodge Velocity" value={`${fmtN(sim.dodgeVelocity, 0)} cm/s`} formula="dodgeDist \u00F7 dodgeDur" color={ACCENT_ORANGE}
              barPct={(sim.dodgeVelocity / 2000) * 100} delta={delta(sim.dodgeVelocity, cmp?.dodgeVelocity, (v) => `${fmtN(v, 0)}`)} />
            <SimStatLine label="Dodges/min" value={fmtN(sim.dodgesPerMin)} formula="60 \u00F7 (cooldown + dodgeDur)" color={ACCENT_CYAN}
              barPct={(sim.dodgesPerMin / 100) * 100} delta={delta(sim.dodgesPerMin, cmp?.dodgesPerMin, (v) => fmtN(v))} />
            <SimStatLine label="Jump Height" value={`${fmtN(sim.jumpHeight, 0)} cm`} formula="v\u00B2 \u00F7 (2 \u00D7 980 \u00D7 gravScale)" color={ACCENT_EMERALD}
              barPct={(sim.jumpHeight / 300) * 100} delta={delta(sim.jumpHeight, cmp?.jumpHeight, (v) => fmtN(v, 0))} />
            {sim.mana > 0 && (
              <SimStatLine label={`Mana (Lv.${level})`} value={fmtN(sim.mana, 0)} formula={`baseMana + manaPerLvl \u00D7 ${level - 1}`} color={STATUS_INFO}
                barPct={(sim.mana / 500) * 100} delta={delta(sim.mana, cmp?.mana, (v) => fmtN(v, 0))} />
            )}
            {isFinite(sim.manaPool) && (
              <SimStatLine label="Mana Pool Time" value={`${sim.manaPool.toFixed(1)}s`} formula="mana \u00F7 manaRegen" color={STATUS_INFO}
                barPct={Math.min((sim.manaPool / 60) * 100, 100)}
                delta={cmp && isFinite(cmp.manaPool) ? delta(sim.manaPool, cmp.manaPool, (v) => `${v.toFixed(1)}s`) : undefined} />
            )}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
