import { describe, it, expect } from 'vitest';
import { DUMMY_ITEMS, SLOT_SUBTYPES, LOADOUT_SLOTS, LOADOUT_SLOT_POSITIONS } from '@/components/modules/core-engine/sub_inventory/_shared/data';

describe('wearable item subtypes have an equipment slot', () => {
  it('every Weapon/Armor/Accessory subtype is accepted by some slot (derived from the items)', () => {
    const slotted = new Set(Object.values(SLOT_SUBTYPES).flat());
    const wearableSubtypes = new Set(
      DUMMY_ITEMS.filter((i) => ['Weapon', 'Armor', 'Accessory'].includes(i.type)).map((i) => i.subtype),
    );
    expect([...wearableSubtypes].filter((s) => !slotted.has(s))).toEqual([]);
  });

  it('every loadout slot has a diagram position and a subtype list', () => {
    for (const s of LOADOUT_SLOTS) {
      expect(LOADOUT_SLOT_POSITIONS[s.slotId], s.slotId).toBeDefined();
      expect(SLOT_SUBTYPES[s.slotId], s.slotId).toBeDefined();
    }
  });
});
