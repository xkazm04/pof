import { register } from './registry';

register('items', {
  dimensions: ['rarity', 'type', 'subtype'],
  expectedShare: {
    rarity:  { Common: 0.40, Uncommon: 0.30, Rare: 0.18, Epic: 0.08, Legendary: 0.04 },
    type:    { Weapon: 0.35, Armor: 0.30, Accessory: 0.15, Consumable: 0.12, Quest: 0.05, Material: 0.03 },
  },
  summarize: (data: unknown): string => {
    const d = data as { name?: string; type?: string; subtype?: string; rarity?: string; level?: number };
    const bits = [d.rarity, d.subtype ?? d.type, d.level != null ? `Lv${d.level}` : null].filter(Boolean);
    return bits.join(' · ');
  },
});
