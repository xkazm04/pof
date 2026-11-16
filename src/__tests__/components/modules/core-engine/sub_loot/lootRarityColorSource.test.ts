import { describe, it, expect } from 'vitest';
import { RARITY_COLOR_MAP } from '@/lib/economy/definitions';
import { rarityColorFor, EXPANDED_ENTRIES, TREEMAP_DATA, BEACON_CONFIGS } from '@/components/modules/core-engine/sub_loot/_shared/data';
import { rarityColor } from '@/components/modules/core-engine/sub_loot/_shared/rarityBadge';

// Two rarity-colour resolvers lived side by side: rarityColorFor (data.ts, exact-case,
// orange ACCENT fallback) and rarityColor (rarityBadge.tsx, case-insensitive, muted
// fallback) - plus a private RARITY_TO_COLOR copy of RARITY_COLOR_MAP. One rule now.
describe('loot rarity colour has one source', () => {
  it.each(['Common', 'legendary', 'EPIC', 'Mythic', ''])('rarityColorFor(%j) agrees with rarityColor', (r) => {
    expect(rarityColorFor(r)).toBe(rarityColor(r));
  });

  it('every seeded editor entry, treemap tier and beacon reads RARITY_COLOR_MAP', () => {
    for (const e of EXPANDED_ENTRIES) expect(e.color).toBe(RARITY_COLOR_MAP[e.rarity]);
    for (const t of TREEMAP_DATA) expect(t.color).toBe(RARITY_COLOR_MAP[t.name]);
    for (const b of BEACON_CONFIGS) expect(b.color).toBe(RARITY_COLOR_MAP[b.rarity]);
  });
});
