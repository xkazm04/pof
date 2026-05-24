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
