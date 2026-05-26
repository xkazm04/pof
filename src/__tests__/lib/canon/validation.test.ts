import { describe, it, expect } from 'vitest';
import { ruleUpsertSchema } from '@/lib/catalog/canon/validation';

const VALID_RULE = {
  id: 'game-genre',
  category: 'game' as const,
  scope: 'global',
  title: 'Genre',
  body: 'PoF is a single-player Action RPG (ARPG) built in UE5.7.',
  refs: ['doc-1'],
};

describe('ruleUpsertSchema', () => {
  it('accepts a fully valid rule', () => {
    const result = ruleUpsertSchema.safeParse(VALID_RULE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('game-genre');
      expect(result.data.category).toBe('game');
      expect(result.data.refs).toEqual(['doc-1']);
    }
  });

  it('accepts all valid categories', () => {
    for (const category of ['art', 'game', 'project'] as const) {
      const result = ruleUpsertSchema.safeParse({ ...VALID_RULE, category });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an invalid category', () => {
    const result = ruleUpsertSchema.safeParse({ ...VALID_RULE, category: 'lore' });
    expect(result.success).toBe(false);
  });

  it('defaults refs to [] when omitted', () => {
    const { refs: _refs, ...withoutRefs } = VALID_RULE;
    const result = ruleUpsertSchema.safeParse(withoutRefs);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.refs).toEqual([]);
    }
  });

  it('rejects a rule with empty id', () => {
    const result = ruleUpsertSchema.safeParse({ ...VALID_RULE, id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a rule with empty body', () => {
    const result = ruleUpsertSchema.safeParse({ ...VALID_RULE, body: '' });
    expect(result.success).toBe(false);
  });
});
