import { seedSpellbookEntries } from './seed-spellbook';
import type { CatalogLink, CharacterEntry } from './types';

/**
 * Characters catalog seed. The starter (`char-captain-vael`) is the Catalog
 * Pipeline target asset for the Game-Assets / Character row — designed here
 * end-to-end so the design `data` is the single source the UE artifacts
 * (AARPGNPCActor config + DT_AttributeDefaults row + VSCharacterVaelTest) mirror.
 *
 * Ability names resolve to real `spellbook` ids (case-insensitive, like
 * seed-bestiary.ts) so a missing ability is dropped rather than faked.
 */
function buildSpellbookNameIndex(): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of seedSpellbookEntries()) map.set(e.data.name.toLowerCase(), e.id);
  return map;
}
const SPELLBOOK_BY_NAME = buildSpellbookNameIndex();

function abilityLinks(abilityNames: string[]): CatalogLink[] {
  const links: CatalogLink[] = [];
  for (const name of abilityNames) {
    const id = SPELLBOOK_BY_NAME.get(name.toLowerCase());
    if (id) links.push({ catalogId: 'spellbook', entityId: id, role: 'ability' });
  }
  return links;
}

const CAPTAIN_VAEL: CharacterEntry = {
  id: 'char-captain-vael',
  catalogId: 'characters',
  name: 'Captain Vael',
  categoryPath: ['NPC'],
  tags: ['named', 'quest-giver'],
  lifecycle: 'planned',
  data: {
    description:
      'A veteran human officer who anchors the early-game hub as a quest-giver — ' +
      'plate-armored, martially capable, but a talker first.',
    npcId: 'CaptainVael',
    role: 'QuestGiver',
    archetype: 'human-officer',
    facePlayerInDialogue: true,
    attributeRowName: 'CaptainVael',
    // Canonical stats — kept identical to VSCharacterVaelTest's asserted values.
    attributes: {
      health: 220, maxHealth: 220, mana: 60, maxMana: 60,
      strength: 16, dexterity: 12, intelligence: 11,
      armor: 30, attackPower: 24, criticalChance: 0.08, criticalDamage: 1.6,
      characterLevel: 5,
    },
    abilities: ['Melee Attack', 'Heavy Attack'],
    bodyMesh: {
      skeletalMesh: '/MoverTests/Characters/Mannequins/Meshes/SKM_Manny',
      animClass: '/MoverTests/Characters/Mannequins/Animations/ABP_Manny.ABP_Manny_C',
    },
  },
  // spellbook ability links resolved below; dialogue is a planned cross-catalog
  // dependency on `dialog-trees` (owned by that row) — see plan.md Session Findings.
  links: abilityLinks(['Melee Attack', 'Heavy Attack']),
};

/** Seed the characters catalog (currently the single designed target asset). */
export function seedCharacterEntries(): CharacterEntry[] {
  return [CAPTAIN_VAEL];
}
