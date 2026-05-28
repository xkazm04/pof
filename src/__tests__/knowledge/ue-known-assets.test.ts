import { describe, it, expect } from 'vitest';
import {
  UE_KNOWN_ASSETS,
  formatKnownAssets,
  knownAssetDomainsForModule,
} from '@/lib/knowledge/ue-known-assets';

describe('UE_KNOWN_ASSETS data integrity', () => {
  it('has the seeded mannequin assets', () => {
    expect(UE_KNOWN_ASSETS.length).toBeGreaterThanOrEqual(6);
  });

  it('every asset has non-empty fields and >=1 domain', () => {
    for (const a of UE_KNOWN_ASSETS) {
      expect(a.id, 'id').toBeTruthy();
      expect(a.path, `path for ${a.id}`).toBeTruthy();
      expect(a.type, `type for ${a.id}`).toBeTruthy();
      expect(a.description, `description for ${a.id}`).toBeTruthy();
      expect(a.source, `source for ${a.id}`).toBeTruthy();
      expect(a.domains.length, `domains for ${a.id}`).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    const ids = UE_KNOWN_ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes the MoverTests mannequin + M_EnemyRed paths', () => {
    const paths = UE_KNOWN_ASSETS.map((a) => a.path);
    expect(paths).toContain('/MoverTests/Characters/Mannequins/Meshes/SKM_Manny');
    expect(paths).toContain('/MoverTests/Characters/Mannequins/Animations/ABP_Manny');
    expect(paths).toContain('/Game/VerticalSlice/M_EnemyRed');
  });
});

describe('formatKnownAssets', () => {
  it('renders a block for character with a MoverTests path', () => {
    const out = formatKnownAssets(['character']);
    expect(out).toContain('## Known Project Assets');
    expect(out).toContain('/MoverTests/Characters/Mannequins/Meshes/SKM_Manny');
  });

  it('returns empty string for no domains', () => {
    expect(formatKnownAssets([])).toBe('');
  });

  it('returns empty string for a non-matching domain', () => {
    expect(formatKnownAssets(['materials'])).toBe('');
  });

  it('snapshot of the character block', () => {
    expect(formatKnownAssets(['character'])).toMatchSnapshot();
  });
});

describe('knownAssetDomainsForModule', () => {
  it('maps character + animation modules', () => {
    expect(knownAssetDomainsForModule('arpg-character')).toContain('character');
    expect(knownAssetDomainsForModule('arpg-animation')).toContain('animation');
  });

  it('maps the enemy module to character assets', () => {
    expect(knownAssetDomainsForModule('arpg-enemy-ai')).toContain('character');
  });

  it('maps gameplay modules to their known-asset domains', () => {
    expect(knownAssetDomainsForModule('arpg-loot')).toEqual(['loot']);
    expect(knownAssetDomainsForModule('arpg-inventory')).toEqual(['items']);
  });

  it('returns [] for modules with no known assets', () => {
    expect(knownAssetDomainsForModule('materials')).toEqual([]);
    expect(knownAssetDomainsForModule('arpg-progression')).toEqual([]);
  });
});
