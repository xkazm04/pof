/** catalogId → the §§ of docs/catalog/ARPG-LAWS.md that bind this catalog's proposals. */
export const ARPG_LAWS_MAP: Record<string, string[]> = {
  items:                ['§1 Rarity & Item Level', '§2 Affixes'],
  spellbook:            ['§3 Damage Model (added → increased → more)'],
  'loot-tables':        ['§7 Loot Generation'],
  bestiary:             ['§4 Resistances & Penetration', '§6 Monsters'],
  'status-effects':     ['§5 Ailments / Status'],
  characters:           ['§9 Classes / Attributes'],
  'crafting-recipes':   ['§10 Economy & Crafting'],
  currencies:           ['§10 Economy & Crafting'],
  'progression-curves': ['§11 Endgame & Scaling'],
};

export function arpgLawsRelevantTo(catalogId: string): string[] {
  return [...(ARPG_LAWS_MAP[catalogId] ?? []), '§12 Wiring Laws'];
}
