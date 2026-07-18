import { describe, it, expect } from 'vitest';
import { seedCharacterEntries } from '@/lib/catalog/seed-characters';

describe('seedCharacterEntries — Captain Vael target asset', () => {
  const entries = seedCharacterEntries();
  const vael = entries.find((e) => e.id === 'char-captain-vael');

  it('seeds Captain Vael as a planned QuestGiver NPC', () => {
    expect(vael).toBeDefined();
    expect(vael!.catalogId).toBe('characters');
    expect(vael!.lifecycle).toBe('planned');
    expect(vael!.data.role).toBe('QuestGiver');
    expect(vael!.data.npcId).toBe('CaptainVael');
    expect(vael!.categoryPath).toEqual(['NPC']);
  });

  it('matches the UE VSCharacterVaelTest canonical attribute contract', () => {
    // Single source of truth: the UE DT_AttributeDefaults row + VSCharacterVaelTest.cpp
    // mirror these values. criticalDamage was corrected to the canon ×2.5 base multiplier
    // (arpg-damage-model) app-side first; the UE row + test expectation (250) are flagged
    // for the next UE session in .claude/green-loop/UE-FOLLOWUP.md.
    expect(vael!.data.attributes).toMatchObject({
      maxHealth: 220, health: 220,
      maxMana: 60, mana: 60,
      strength: 16, dexterity: 12, intelligence: 11,
      armor: 30, attackPower: 24, criticalChance: 0.08, criticalDamage: 2.5,
      characterLevel: 5,
    });
    // Spawns at full vitals; crit values are well-formed.
    expect(vael!.data.attributes.health).toBe(vael!.data.attributes.maxHealth);
    expect(vael!.data.attributes.criticalChance).toBeGreaterThanOrEqual(0);
    expect(vael!.data.attributes.criticalChance).toBeLessThanOrEqual(1);
    expect(vael!.data.attributes.criticalDamage).toBeGreaterThanOrEqual(1);
  });

  it('resolves ability names to real spellbook links (no fabricated ids)', () => {
    const abilityLinks = (vael!.links ?? []).filter((l) => l.catalogId === 'spellbook');
    // Both 'Melee Attack' (off-phy-01) and 'Heavy Attack' (off-phy-02) exist.
    expect(abilityLinks.map((l) => l.entityId).sort()).toEqual(['off-phy-01', 'off-phy-02']);
    for (const link of abilityLinks) expect(link.role).toBe('ability');
  });
});
