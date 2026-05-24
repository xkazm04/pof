import type { ItemData, ItemAffix } from './data';

/* ── Rarity order for sort comparison ────────────────────────────────────── */

export const RARITY_ORDER: Record<string, number> = {
  Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4,
};

/* ── Internal stat builders ──────────────────────────────────────────────── */

const RM: Record<string, number> = { Common: 1, Uncommon: 1.5, Rare: 2.2, Epic: 3.2, Legendary: 4.5 };

const AFFIX_POOL: ItemAffix[] = [
  { name: 'of Power', stat: '+15% Atk', category: 'offensive' },
  { name: 'of Fortitude', stat: '+200 HP', category: 'defensive' },
  { name: 'Blazing', stat: '+Fire Dmg', category: 'offensive' },
  { name: 'Vampiric', stat: '+8% Leech', category: 'offensive' },
  { name: 'of Evasion', stat: '+12% Dodge', category: 'defensive' },
  { name: 'Swift', stat: '+5% Speed', category: 'utility' },
  { name: 'of Legends', stat: '+2 Skills', category: 'utility' },
  { name: 'of the Bear', stat: '+5% HP', category: 'defensive' },
  { name: 'Frozen', stat: '+Cold Dmg', category: 'offensive' },
  { name: 'of Resilience', stat: '+10% Resist', category: 'defensive' },
  { name: 'Thundering', stat: '+Lightning', category: 'offensive' },
  { name: 'of Wisdom', stat: '+15% Mana', category: 'utility' },
];

function pickAffixes(i: number, r: string): ItemAffix[] | undefined {
  const base = { Common: 0, Uncommon: 0, Rare: 1, Epic: 2, Legendary: 3 }[r] ?? 0;
  const n = r === 'Uncommon' && i % 3 === 0 ? 1 : base;
  if (n === 0) return undefined;
  const res: ItemAffix[] = [];
  const seen = new Set<string>();
  for (let j = 0; j < n; j++) {
    const a = AFFIX_POOL[(i * 3 + j * 7) % AFFIX_POOL.length];
    if (!seen.has(a.name)) { res.push(a); seen.add(a.name); }
  }
  return res.length > 0 ? res : undefined;
}

/* ── Stat generators ─────────────────────────────────────────────────────── */

type Stats = ItemData['stats'];
const WB: Record<string, number> = { Sword: 14, Bow: 12, Staff: 10, Dagger: 9, Axe: 16, Mace: 14, Polearm: 13, Baton: 8 };
const WSp: Record<string, number> = { Sword: 1.3, Bow: 1.5, Staff: 1.8, Dagger: 0.9, Axe: 1.7, Mace: 1.5, Polearm: 1.6, Baton: 1.1 };
const ArB: Record<string, number> = { Chestplate: 30, Helm: 15, Greaves: 20, Boots: 12, Shield: 25, Gauntlets: 10 };

function weaponStats(sub: string, r: string): Stats {
  const m = RM[r] ?? 1, d = Math.round((WB[sub] ?? 12) * m), sp = WSp[sub] ?? 1.4;
  return [
    { label: 'Damage', value: `${Math.round(d * .8)}-${Math.round(d * 1.2)}`, numericValue: d, maxValue: 60 },
    { label: 'Speed', value: `${sp.toFixed(1)}s`, numericValue: Math.round(100 - sp * 40), maxValue: 100 },
  ];
}
function armorStats(sub: string, r: string): Stats {
  const m = RM[r] ?? 1, a = Math.round((ArB[sub] ?? 15) * m);
  return [
    { label: 'Armor', value: `${a}`, numericValue: a, maxValue: 150 },
    { label: 'Weight', value: a > 50 ? 'Heavy' : a > 25 ? 'Medium' : 'Light', numericValue: Math.min(Math.round(a * 1.5), 100), maxValue: 100 },
  ];
}
function accessoryStats(sub: string, r: string): Stats {
  const m = RM[r] ?? 1, p = Math.round(5 * m), s = Math.round(3 * m);
  const L: Record<string, [string, string, string, string]> = {
    Ring: ['Crit %', '%', 'Mana', ''], Amulet: ['Max HP', '', 'Regen', '/s'],
    Belt: ['Carry', '', 'Stamina', ''], Cape: ['Evasion', '%', 'Stealth', '%'],
    Trinket: ['Luck', '%', 'Find %', '%'],
  };
  const [l1, u1, l2, u2] = L[sub] ?? ['Bonus', '', 'Dur', ''];
  return [
    { label: l1, value: `+${p}${u1}`, numericValue: p, maxValue: 25 },
    { label: l2, value: `+${s}${u2}`, numericValue: s, maxValue: 15 },
  ];
}
function consumableStats(r: string): Stats {
  const m = RM[r] ?? 1, v = Math.round(50 * m);
  return [
    { label: 'Effect', value: `${v}`, numericValue: v, maxValue: 250 },
    { label: 'Uses', value: `${Math.max(1, Math.round(4 / m))}`, numericValue: Math.round(100 / m), maxValue: 100 },
  ];
}
function questStats(): Stats {
  return [{ label: 'Quest', value: 'Unique', numericValue: 100, maxValue: 100 }];
}
function materialStats(r: string): Stats {
  const m = RM[r] ?? 1, q = Math.round(20 * m);
  return [
    { label: 'Quality', value: `${q}`, numericValue: q, maxValue: 100 },
    { label: 'Stack', value: `${Math.max(1, Math.round(99 / m))}`, numericValue: Math.round(100 / m), maxValue: 100 },
  ];
}

/* ── Builder ─────────────────────────────────────────────────────────────── */

type Def = [string, string, string, string, string?]; // [name, subtype, rarity, desc, effect?]

function buildItems(defs: Def[], type: ItemData['type'], base: number): ItemData[] {
  return defs.map(([name, subtype, rarity, desc, effect], i) => {
    const idx = base + i;
    let stats: Stats;
    switch (type) {
      case 'Weapon': stats = weaponStats(subtype, rarity); break;
      case 'Armor': stats = armorStats(subtype, rarity); break;
      case 'Accessory': stats = accessoryStats(subtype, rarity); break;
      case 'Consumable': stats = consumableStats(rarity); break;
      case 'Quest': stats = questStats(); break;
      case 'Material': stats = materialStats(rarity); break;
    }
    return { id: `item-${idx}`, name, type, subtype, rarity, stats, description: desc, effect, affixes: pickAffixes(idx, rarity) };
  });
}

/* ── Item definitions ────────────────────────────────────────────────────── */

const WEAPONS: Def[] = [
  ['Rusty Shortsword', 'Sword', 'Common', 'A corroded blade barely fit for practice.'],
  ['Militia Blade', 'Sword', 'Common', 'Standard issue for Republic footsoldiers.'],
  ['Durasteel Saber', 'Sword', 'Uncommon', 'Reinforced edge holds against cortosis-weave.'],
  ['Mandalorian War Sword', 'Sword', 'Uncommon', 'Beskar-edged for penetrating armor.'],
  ['Krayt Fang Blade', 'Sword', 'Rare', 'Carved from a greater krayt dragon fang.'],
  ['Sith War Blade', 'Sword', 'Rare', 'Alchemically treated for dark side resonance.'],
  ['Rakata Force-Edge', 'Sword', 'Epic', 'Ancient Rakata tech amplifies kinetic energy.', '+10% Force damage on strike'],
  ['Star Forge Greatsword', 'Sword', 'Legendary', 'Forged in the heart of the Star Forge itself.', 'Regen 2 HP/hit, +20% vs Force users'],
  ['Hunting Bowcaster', 'Bow', 'Common', 'Simple Kashyyyk bowcaster for small game.'],
  ['Wookiee War Bow', 'Bow', 'Uncommon', 'Heavy draw weight requires exceptional strength.'],
  ['Czerka Compound Bow', 'Bow', 'Rare', 'Corporate-engineered for maximum penetration.', 'Ignores 10% armor'],
  ['Shadow Stalker Bow', 'Bow', 'Epic', 'Dampened string produces no sound.', '+25% stealth attack damage'],
  ['Mandalorian Ripper', 'Bow', 'Legendary', 'Fires superheated bolts through any material.', 'Pierce all armor, +15% fire damage'],
  ['Apprentice Focus Rod', 'Staff', 'Common', 'Helps channel Force energy for beginners.'],
  ['Jedi Training Staff', 'Staff', 'Uncommon', 'Weighted for combat form practice.'],
  ['Force Amplifier Staff', 'Staff', 'Rare', 'Crystal-tipped staff magnifies Force output.', '+15% Force ability damage'],
  ['Holocron Staff', 'Staff', 'Epic', 'Contains fragments of ancient Jedi knowledge.', '+20% Force regen'],
  ['Staff of the Ancients', 'Staff', 'Legendary', 'Pre-Republic artifact of immense power.', 'All Force costs -30%, +3 Wisdom'],
  ['Utility Knife', 'Dagger', 'Common', 'Multi-purpose tool, serviceable in combat.'],
  ['Assassin Stiletto', 'Dagger', 'Uncommon', 'Thin blade designed for gaps in armor.'],
  ['Echani Ritual Dagger', 'Dagger', 'Rare', 'Ceremonial blade still lethally sharp.', '+5% critical chance'],
  ['Shadow Fang', 'Dagger', 'Epic', 'Blade phases partially into shadow dimension.', '20% chance to bypass shields'],
  ['Night Whisper', 'Dagger', 'Legendary', 'Undetectable by any scanning device.', 'Always stealth, +30% crit damage'],
  ['Woodcutter Hatchet', 'Axe', 'Common', 'Heavy but effective at close range.'],
  ['Wookiee Ryyk Blade', 'Axe', 'Uncommon', 'Kashyyyk war blade with serrated edge.'],
  ['Mandalorian Battle Axe', 'Axe', 'Rare', 'Beskar construction ensures durability.', '+10% armor penetration'],
  ['Berserker Fury', 'Axe', 'Epic', 'Grows stronger as the wielder takes damage.', '+2% dmg per 10% missing HP'],
  ['Training Cudgel', 'Mace', 'Common', 'Blunt weapon for subduing targets.'],
  ['Republic War Hammer', 'Mace', 'Uncommon', 'Durasteel head shatters bones.'],
  ['Sith Crusher', 'Mace', 'Rare', 'Dark energy pulses through the head.', 'Stun chance +15%'],
  ['Guard Pike', 'Polearm', 'Common', 'Standard garrison defense weapon.'],
  ['Force Pike', 'Polearm', 'Uncommon', 'Electrified tip delivers stunning charges.'],
  ['Sith Glaive', 'Polearm', 'Rare', 'Long reach with dark-side enchanted blade.', '+8% area damage on swing'],
];

const ARMOR_DEFS: Def[] = [
  ['Leather Vest', 'Chestplate', 'Common', 'Basic protection against glancing blows.'],
  ['Scout Armor', 'Chestplate', 'Uncommon', 'Lightweight plating for mobile fighters.'],
  ['Mandalorian Breastplate', 'Chestplate', 'Rare', 'Beskar alloy absorbs blaster fire.'],
  ['Echani Light Plate', 'Chestplate', 'Epic', 'Artisan craft allows full mobility.', '+10% dodge chance'],
  ['Star Forge Cuirass', 'Chestplate', 'Legendary', 'Self-repairing nano-armor.', 'Regen 1% armor/second'],
  ['Padded Cap', 'Helm', 'Common', 'Cushions against minor head trauma.'],
  ['Combat Visor', 'Helm', 'Uncommon', 'Heads-up display with threat detection.'],
  ['Mandalorian Helmet', 'Helm', 'Rare', 'Full T-visor with integrated comms.'],
  ['Sith Lord Mask', 'Helm', 'Epic', 'Dark aura inspires fear in enemies.', '-15% enemy morale'],
  ['Crown of the Force', 'Helm', 'Legendary', 'Circlet channels raw Force.', '+25% Force power'],
  ['Cloth Leggings', 'Greaves', 'Common', 'Minimal protection, maximum comfort.'],
  ['Plated Greaves', 'Greaves', 'Uncommon', 'Thigh and shin guards of durasteel.'],
  ['War Greaves', 'Greaves', 'Rare', 'Full leg protection for frontline combat.'],
  ['Shadowweave Trousers', 'Greaves', 'Epic', 'Force-enhanced fabric absorbs impacts.', '+8% movement speed'],
  ['Traveler Sandals', 'Boots', 'Common', 'Worn but reliable footwear.'],
  ['Scout Boots', 'Boots', 'Uncommon', 'Grip soles for any terrain.'],
  ['Mandalorian Boots', 'Boots', 'Rare', 'Magnetic locks for zero-G combat.'],
  ['Swiftstrider Boots', 'Boots', 'Epic', 'Force-lightened for incredible speed.', '+15% movement speed'],
  ['Wooden Buckler', 'Shield', 'Common', 'Small arm shield of layered wood.'],
  ['Energy Shield Generator', 'Shield', 'Uncommon', 'Projects a small energy barrier.'],
  ['Mandalorian Tower Shield', 'Shield', 'Rare', 'Full-body beskar shield.'],
  ['Padded Gloves', 'Gauntlets', 'Common', 'Basic hand protection.'],
  ['Tech Gauntlets', 'Gauntlets', 'Uncommon', 'Integrated wrist-mounted tools.'],
];

const ACCESSORY_DEFS: Def[] = [
  ['Copper Band', 'Ring', 'Common', 'Simple decoration with minor resonance.'],
  ['Ring of Focus', 'Ring', 'Uncommon', 'Helps maintain concentration in battle.'],
  ['Meditation Band', 'Ring', 'Uncommon', 'Calms the mind during Force channeling.'],
  ['Signet of the Republic', 'Ring', 'Rare', 'Official seal grants authority.'],
  ['Ring of Dark Power', 'Ring', 'Epic', 'Pulses with dark side energy.', '+10% dark side damage'],
  ['Band of Infinite Stars', 'Ring', 'Legendary', 'Contains a pocket dimension of starlight.', '+5 to all attributes'],
  ['Glass Pendant', 'Amulet', 'Common', 'Pretty but fragile ornament.'],
  ['Krayt Pearl Necklace', 'Amulet', 'Uncommon', 'Rare pearl radiates calming energy.'],
  ['Jedi Talisman', 'Amulet', 'Rare', 'Imbued with Light Side protection.'],
  ['Heart of the Force', 'Amulet', 'Epic', 'Crystallized Force energy on a chain.', '+20% Force regen'],
  ['Amulet of the Builders', 'Amulet', 'Legendary', 'Rakata artifact of unfathomable power.', 'All stats +3, Force immunity'],
  ['Leather Belt', 'Belt', 'Common', 'Standard utility belt.'],
  ['Military Belt', 'Belt', 'Uncommon', 'Extra pouches for supplies.'],
  ['Mandalorian War Belt', 'Belt', 'Rare', 'Hidden compartments and micro-missiles.'],
  ['Sash of the Exile', 'Belt', 'Epic', 'Worn by the Jedi Exile herself.', '+15% XP gain'],
  ['Travel Cloak', 'Cape', 'Common', 'Protection from the elements.'],
  ['Echani Silk Cape', 'Cape', 'Uncommon', 'Billowing fabric aids in misdirection.'],
  ['Jedi Master Mantle', 'Cape', 'Rare', 'Symbol of mastery and authority.'],
  ['Lucky Pazaak Card', 'Trinket', 'Common', 'A +/- 1 card kept as a good luck charm.'],
  ['Holocron Fragment', 'Trinket', 'Rare', 'Incomplete but still radiates knowledge.'],
];

const CONSUMABLE_DEFS: Def[] = [
  ['Minor Medpac', 'Potion', 'Common', 'Basic first aid supplies.'],
  ['Standard Medpac', 'Potion', 'Uncommon', 'Military-grade healing compound.'],
  ['Advanced Medpac', 'Potion', 'Rare', 'Cutting-edge Republic medical tech.'],
  ['Kolto Injection', 'Potion', 'Epic', 'Pure Manaan kolto in concentrated form.', 'Full heal over 5s'],
  ['Bacta Tank Dose', 'Potion', 'Legendary', 'Portable bacta immersion therapy.', 'Full heal + cure all'],
  ['Skill Datapad', 'Scroll', 'Common', 'Contains basic training routines.'],
  ['Sith Manuscript', 'Scroll', 'Uncommon', 'Dark knowledge inscribed on flimsi.'],
  ['Force Technique Scroll', 'Scroll', 'Rare', 'Teaches an advanced Force technique.'],
  ['Ancient Jedi Text', 'Scroll', 'Epic', 'Pre-Republic era Force wisdom.', 'Learn a rare Force power'],
  ['Ration Pack', 'Food', 'Common', 'Standard military rations.'],
  ['Tarisian Ale', 'Food', 'Uncommon', 'Fine brew boosts morale.', '+5% all stats for 300s'],
  ['Kashyyyk Wroshyr Sap', 'Food', 'Rare', 'Sacred Wookiee tonic.', '+10% all stats for 600s'],
  ['Basic Stimulant', 'Elixir', 'Common', 'Mild combat performance enhancer.'],
  ['Battle Stimulant', 'Elixir', 'Uncommon', 'Significant combat enhancement.'],
  ['Echani Focus Brew', 'Elixir', 'Rare', 'Heightens reflexes beyond limits.', '+20% crit chance for 120s'],
];

const QUEST_DEFS: Def[] = [
  ['Sith Academy Pass', 'Key', 'Common', 'Grants entry to the Korriban academy.'],
  ['Republic Clearance Code', 'Key', 'Common', 'Military-grade access credentials.'],
  ['Enclave Basement Key', 'Key', 'Uncommon', 'Opens the sealed Dantooine sub-level.'],
  ['Star Map Alpha', 'Fragment', 'Uncommon', 'First piece of the ancient star map.'],
  ['Star Map Beta', 'Fragment', 'Uncommon', 'Second piece of the ancient star map.'],
  ['Star Map Gamma', 'Fragment', 'Rare', 'Third piece with additional coordinates.'],
  ['Rakata Mind Prison', 'Relic', 'Rare', 'Contains the consciousness of an ancient being.'],
  ['Jedi Council Token', 'Token', 'Epic', 'Proof of the Council authorization.'],
  ['Infinite Engine Core', 'Relic', 'Epic', 'Power source of the Star Forge.'],
  ['Star Forge Master Key', 'Key', 'Legendary', 'Unlocks full control of the Star Forge.'],
];

const MATERIAL_DEFS: Def[] = [
  ['Iron Ore', 'Ore', 'Common', 'Basic metalworking material.'],
  ['Durasteel Ingot', 'Ore', 'Uncommon', 'Standard construction alloy.'],
  ['Cortosis Fragment', 'Ore', 'Rare', 'Lightsaber-resistant mineral.'],
  ['Phrik Alloy', 'Ore', 'Epic', 'Near-indestructible metallic compound.'],
  ['Kyber Crystal Shard', 'Crystal', 'Common', 'Impure but resonant crystal fragment.'],
  ['Adegan Crystal', 'Crystal', 'Uncommon', 'Traditional lightsaber focusing crystal.'],
  ['Solari Crystal', 'Crystal', 'Rare', 'Light-side aligned, radiates warmth.'],
  ['Force Essence Vial', 'Essence', 'Uncommon', 'Bottled ambient Force energy.'],
  ['Dark Side Fragment', 'Essence', 'Rare', 'Solidified dark side emanation.'],
  ['Living Force Essence', 'Essence', 'Epic', 'Pure crystallized life force.', 'Required for legendary crafts'],
  ['Kashyyyk Bark Strip', 'Herb', 'Common', 'Aromatic wroshyr tree bark.'],
  ['Manaan Kolto Kelp', 'Herb', 'Uncommon', 'Sea plant with healing properties.'],
  ['Krayt Dragon Scale', 'Hide', 'Rare', 'Nearly impenetrable natural armor.'],
  ['Terentatek Hide', 'Hide', 'Epic', 'Force-resistant monster skin.'],
  ['Star Forge Matter', 'Ore', 'Legendary', 'Raw matter from the creation engine.'],
];

/* ── Export ───────────────────────────────────────────────────────────────── */

export const EXPANDED_ITEMS: ItemData[] = [
  ...buildItems(WEAPONS, 'Weapon', 100),
  ...buildItems(ARMOR_DEFS, 'Armor', 200),
  ...buildItems(ACCESSORY_DEFS, 'Accessory', 300),
  ...buildItems(CONSUMABLE_DEFS, 'Consumable', 400),
  ...buildItems(QUEST_DEFS, 'Quest', 500),
  ...buildItems(MATERIAL_DEFS, 'Material', 600),
];
