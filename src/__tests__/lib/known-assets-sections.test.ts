import { describe, it, expect } from 'vitest';
import { knownAssetDomainsForModule, formatKnownAssets } from '@/lib/knowledge/ue-known-assets';

describe('known assets — items/loot', () => {
  it('maps inventory + loot modules to their domains', () => {
    expect(knownAssetDomainsForModule('arpg-inventory')).toEqual(['items']);
    expect(knownAssetDomainsForModule('arpg-loot')).toEqual(['loot']);
  });
  it('formats item/loot base-class known assets', () => {
    expect(formatKnownAssets(['items'])).toContain('UARPGItemDefinition');
    expect(formatKnownAssets(['loot'])).toContain('UARPGLootTable');
  });
  it('leaves unrelated modules empty', () => {
    expect(knownAssetDomainsForModule('arpg-polish')).toEqual([]);
  });
});

describe('known assets — bestiary/combat/screen/zone/anim', () => {
  it('maps each remaining module to its domain', () => {
    expect(knownAssetDomainsForModule('arpg-combat')).toEqual(['combat']);
    expect(knownAssetDomainsForModule('arpg-ui')).toEqual(['ui']);
    expect(knownAssetDomainsForModule('arpg-world')).toEqual(['world']);
    expect(knownAssetDomainsForModule('arpg-enemy-ai')).toEqual(expect.arrayContaining(['bestiary']));
    expect(knownAssetDomainsForModule('arpg-animation')).toEqual(expect.arrayContaining(['state-graph']));
  });
  it('formats the 5 new base-class known assets', () => {
    expect(formatKnownAssets(['bestiary'])).toContain('AARPGEnemyCharacter');
    expect(formatKnownAssets(['combat'])).toContain('UARPGDamageExecution');
    expect(formatKnownAssets(['ui'])).toContain('UARPGCodeWidgetBase');
    expect(formatKnownAssets(['world'])).toContain('/Game/Maps/');
    expect(formatKnownAssets(['state-graph'])).toContain('SK_Mannequin');
  });
});
