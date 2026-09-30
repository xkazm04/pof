import type { Checker } from './types';
import { tagRequiredFields } from './requiredFields';
import { isDeclaredGap } from './markers';

/**
 * Rarity is fixed for an AUTHORED item and rolled per drop for a BASE TYPE (/diablo W11, D4). Registry
 * arpg-systems-canon · rarity-is-an-affix-budget: rarity buys the affix count of a DROPPED instance — UE rolls it per drop
 * (UARPGItemInstance::RolledRarity) — so a base type has none to state. `field.rarity` (a real value) or
 * `field.rarityRolled === true` satisfies the step; a declared gap or neither does not.
 */
export function rarityOrRolled(field: string, label: string): Checker {
  const shape = `either "${field}.rarity" names the item's FIXED rarity (an authored unique, set or legendary item), or — for a BASE TYPE whose rarity is rolled per drop — "${field}.rarityRolled: true"`;
  return tagRequiredFields((data) => {
    const obj = (data[field] ?? {}) as Record<string, unknown>;
    const fixed = obj.rarity != null && obj.rarity !== '' && !isDeclaredGap(obj.rarity);
    const rolled = obj.rarityRolled === true;
    const ok = fixed || rolled;
    return {
      label, tier: 'L0', status: ok ? 'pass' : 'pending',
      detail: fixed ? `fixed: ${String(obj.rarity)}` : rolled ? 'rolled per drop' : 'no rarity',
      ...(ok ? {} : { reason: `field "${field}": ${shape}` }),
    };
  }, { field, shape });
}
