import { COMBO_ABILITY_MAP } from '@/components/modules/core-engine/unique-tabs/AbilitySpellbook.data';

export const TIMELINE_PX_PER_SEC = 160;

export function computeComboStats(abilityIds: string[]) {
  let totalDamage = 0;
  let totalMana = 0;
  let totalDuration = 0;
  let maxCooldown = 0;
  const cooldownMap = new Map<string, number>();

  abilityIds.forEach((id, i) => {
    const ab = COMBO_ABILITY_MAP.get(id);
    if (!ab) return;
    const multiplier = i === 0 ? 1.0 : ab.comboMultiplier;
    totalDamage += ab.damage * multiplier;
    totalMana += ab.manaCost;
    totalDuration += ab.animDuration;
    if (ab.cooldown > 0) {
      cooldownMap.set(ab.id, Math.max(cooldownMap.get(ab.id) ?? 0, ab.cooldown));
    }
  });

  cooldownMap.forEach(cd => { maxCooldown = Math.max(maxCooldown, cd); });
  const dps = totalDuration > 0 ? totalDamage / totalDuration : 0;

  return {
    totalDamage: Math.round(totalDamage),
    totalMana,
    totalDuration,
    maxCooldown,
    dps: Math.round(dps),
  };
}
