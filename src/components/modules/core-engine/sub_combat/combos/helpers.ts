import { scheduleCombo } from './schedule';

export const TIMELINE_PX_PER_SEC = 160;

/**
 * Rounded one-pass (burst) stats for a chain. Delegates to the cooldown-legal
 * schedule, so the duration includes every cooldown wait and the DPS is legal.
 */
export function computeComboStats(abilityIds: string[]) {
  const s = scheduleCombo(abilityIds);
  return {
    totalDamage: Math.round(s.totalDamage),
    totalMana: s.totalMana,
    totalDuration: s.totalDuration,
    maxCooldown: s.maxCooldown,
    dps: Math.round(s.dps),
  };
}
