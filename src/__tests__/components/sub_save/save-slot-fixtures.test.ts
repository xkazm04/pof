import { describe, it, expect } from 'vitest';
import { SAVE_SLOTS, ENHANCED_SLOTS } from '@/components/modules/core-engine/sub_save/_shared/data';

// The design is 3 manual slots + 1 auto (as-6; ActiveSaveSlot is 0-indexed 0-2).
describe('save slot fixtures', () => {
  it('offers no slot beyond the 3 manual + 1 auto design', () => {
    expect(SAVE_SLOTS.filter((s) => s.isAuto).length).toBe(1);
    expect(SAVE_SLOTS.filter((s) => !s.isAuto).length).toBe(3);
  });

  it('agrees with the slot-management list, field for field', () => {
    expect(SAVE_SLOTS.map((s) => s.id)).toEqual(ENHANCED_SLOTS.map((s) => s.id));
    for (const slot of SAVE_SLOTS) {
      const full = ENHANCED_SLOTS.find((s) => s.id === slot.id);
      expect([slot.level, slot.zone, slot.playtime, slot.ts, slot.integrity])
        .toEqual([full?.level, full?.zone, full?.playtime, full?.lastPlayed, full?.integrity]);
    }
  });
});
