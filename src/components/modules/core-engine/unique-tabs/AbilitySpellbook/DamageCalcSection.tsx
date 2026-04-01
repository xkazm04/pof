'use client';

import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_RED, ACCENT_ORANGE, ACCENT_PURPLE_BOLD,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from '../_design';

export function DamageCalcSection() {
  const [baseDamage, setBaseDamage] = useState(50);
  const [attackerPower, setAttackerPower] = useState(100);
  const [targetArmor, setTargetArmor] = useState(50);
  const [critChance, setCritChance] = useState(15);
  const [critMultiplier, setCritMultiplier] = useState(1.5);

  const calc = useMemo(() => {
    const scaledDamage = baseDamage * (1 + attackerPower / 100);
    const armorReduction = targetArmor / (targetArmor + 100);
    const afterArmor = scaledDamage * (1 - armorReduction);
    const expectedCritMulti = 1 + (critChance / 100) * (critMultiplier - 1);
    const finalDamage = afterArmor * expectedCritMulti;
    const critDamage = afterArmor * critMultiplier;
    return { scaledDamage, armorReduction, afterArmor, expectedCritMulti, finalDamage, critDamage };
  }, [baseDamage, attackerPower, targetArmor, critChance, critMultiplier]);

  return (
    <div className="space-y-4">
      <BlueprintPanel color={ACCENT_ORANGE} className="p-3">
        <SectionHeader icon={Calculator} label="Damage Formula Sandbox" color={ACCENT_ORANGE} />
        <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-4">
          Adjust parameters to explore how the GAS damage formula works.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sliders */}
          <div className="space-y-4">
            <SliderParam label="Base Damage" value={baseDamage} min={10} max={100} onChange={setBaseDamage} color={ACCENT_RED} />
            <SliderParam label="Attacker Power" value={attackerPower} min={1} max={200} onChange={setAttackerPower} color={ACCENT_ORANGE} />
            <SliderParam label="Target Armor" value={targetArmor} min={0} max={200} onChange={setTargetArmor} color={MODULE_COLORS.core} />
            <SliderParam label="Crit Chance" value={critChance} min={0} max={100} onChange={setCritChance} unit="%" color={ACCENT_PURPLE_BOLD} />
            <SliderParam label="Crit Multiplier" value={critMultiplier} min={1.0} max={3.0} step={0.1} onChange={setCritMultiplier} unit="x" color={MODULE_COLORS.content} />
          </div>

          {/* Results */}
          <div className="space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted mb-2">Formula Steps</div>

            <FormulaStep step={1} label="Scaled Damage"
              formula={`${baseDamage} x (1 + ${attackerPower}/100)`}
              result={calc.scaledDamage} color={ACCENT_RED} />
            <FormulaStep step={2} label="Armor Reduction"
              formula={`${targetArmor} / (${targetArmor} + 100)`}
              result={calc.armorReduction} unit="%" isPercent color={MODULE_COLORS.core} />
            <FormulaStep step={3} label="After Armor"
              formula={`${calc.scaledDamage.toFixed(1)} x (1 - ${(calc.armorReduction * 100).toFixed(1)}%)`}
              result={calc.afterArmor} color={ACCENT_ORANGE} />
            <FormulaStep step={4} label="Expected Crit"
              formula={`1 + (${critChance}% x (${critMultiplier} - 1))`}
              result={calc.expectedCritMulti} unit="x" color={ACCENT_PURPLE_BOLD} />

            {/* Final damage display */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <GlowStat label="Expected Damage" value={calc.finalDamage.toFixed(1)} color={ACCENT_ORANGE} delay={0.3} />
              <GlowStat label="On Crit" value={calc.critDamage.toFixed(1)} color={ACCENT_PURPLE_BOLD} delay={0.4} />
            </div>
          </div>
        </div>
      </BlueprintPanel>
    </div>
  );
}

/* ── Slider + Formula helpers ─────────────────────────────────────────── */

function SliderParam({ label, value, min, max, step = 1, onChange, unit, color }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string; color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{label}</span>
        <span className="text-sm font-mono font-bold" style={{ color, textShadow: `0 0 12px ${color}40` }}>
          {step < 1 ? value.toFixed(1) : value}{unit ?? ''}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 100%)`,
        }}
      />
    </div>
  );
}

function FormulaStep({ step, label, formula, result, unit, isPercent, color }: {
  step: number; label: string; formula: string; result: number;
  unit?: string; isPercent?: boolean; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: step * 0.08 }}
      className="flex items-center gap-2 text-xs p-2 rounded-lg border"
      style={{ borderColor: `${color}25`, backgroundColor: `${color}08` }}
    >
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {step}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-mono font-bold text-text truncate">{label}</div>
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted truncate">{formula}</div>
      </div>
      <span className="font-mono font-bold flex-shrink-0" style={{ color, textShadow: `0 0 12px ${color}40` }}>
        {isPercent ? `${(result * 100).toFixed(1)}%` : `${result.toFixed(1)}${unit ?? ''}`}
      </span>
    </motion.div>
  );
}
