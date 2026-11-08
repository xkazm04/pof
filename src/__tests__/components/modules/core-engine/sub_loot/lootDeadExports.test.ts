import { describe, it, expect } from 'vitest';
import * as lootData from '@/components/modules/core-engine/sub_loot/_shared/data';
import * as lootRoot from '@/components/modules/core-engine/sub_loot';

// Zero-consumer exports removed 2026-11-08 (git grep over src/, e2e/, scripts/ found no
// importer). Pinned so a duplicate lookup does not grow back beside the one in use:
// WorldItemPreview owns the item lookup, EXPANDED_ENTRIES is the editor's seed.
describe('loot module exports carry no zero-consumer duplicates', () => {
  it('the module root no longer re-exports a private item lookup', () => {
    expect('itemMap' in lootRoot).toBe(false);
  });

  it('data.ts no longer aliases EXPANDED_ENTRIES as DEFAULT_EDITOR_ENTRIES', () => {
    expect('DEFAULT_EDITOR_ENTRIES' in lootData).toBe(false);
    expect(lootData.EXPANDED_ENTRIES.length).toBeGreaterThan(0);
  });
});
