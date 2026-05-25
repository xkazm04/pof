import { describe, it, expect } from 'vitest';
import { rowToSpec } from '@/lib/ability/ability-spec-db';

describe('rowToSpec', () => {
  it('maps a row + parses effects/tagRules JSON', () => {
    const s = rowToSpec({
      catalog_id: 'spellbook', entity_id: 'off-fire-01',
      effects: '[{"id":"e1","name":"Fire","duration":"instant","durationSec":0,"cooldownSec":3,"color":"#f00","modifiers":[],"grantedTags":[]}]',
      tag_rules: '[{"id":"r1","sourceTag":"A","targetTag":"State.Dead","type":"blocks"}]',
      updated_at: '2026-05-25T00:00:00.000Z',
    });
    expect(s.catalogId).toBe('spellbook');
    expect(s.effects).toHaveLength(1);
    expect(s.effects[0].cooldownSec).toBe(3);
    expect(s.tagRules[0].targetTag).toBe('State.Dead');
    expect(s.updatedAt).toBe('2026-05-25T00:00:00.000Z');
  });
  it('defaults empty arrays + omits null updated_at', () => {
    const s = rowToSpec({ catalog_id: 'spellbook', entity_id: 'x', effects: '[]', tag_rules: '[]', updated_at: null });
    expect(s.effects).toEqual([]);
    expect(s.tagRules).toEqual([]);
    expect(s.updatedAt).toBeUndefined();
  });
});
