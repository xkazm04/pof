/**
 * Combo goal-seek tuner (ECW Phase 10-C — idea 0545ec6c AI combat auto-tuner).
 * Since dps = totalDamage / time, reaching a target DPS has two exact levers:
 * retime the combo (same damage) or scale per-hit damage (same timing). Pure;
 * presents both so the designer picks the one that fits the weapon's feel.
 */

import { comboMetrics, type ComboLike } from './combo-analysis';

export interface ComboTuneProposal {
  targetDps: number;
  currentDps: number;
  /** New total time (s) that hits the target at the current total damage. */
  retimeSec: number;
  /** Per-hit damage scale factor that hits the target at the current timing. */
  damageScale: number;
  reachable: boolean;
  note: string;
}

export function tuneComboToTargetDps(combo: ComboLike, targetDps: number): ComboTuneProposal {
  const m = comboMetrics(combo);
  const reachable = targetDps > 0 && m.timeSec > 0 && m.totalDamage > 0 && m.dps > 0;

  const retimeSec = reachable ? m.totalDamage / targetDps : m.timeSec;
  const damageScale = reachable ? targetDps / m.dps : 1;

  const note = reachable
    ? `Hit ${targetDps} DPS by retiming to ${retimeSec.toFixed(2)}s (same damage) or scaling per-hit damage ×${damageScale.toFixed(2)} (same timing).`
    : 'Need a positive target and a finite combo duration to tune.';

  return { targetDps, currentDps: m.dps, retimeSec, damageScale, reachable, note };
}
