import { describe, it, expect } from 'vitest';
import { rowToRule } from '@/lib/project-rules-db';

describe('rowToRule', () => {
  it('maps a full row correctly', () => {
    const rule = rowToRule({
      id: 'game-genre',
      category: 'game',
      scope: 'global',
      title: 'Genre',
      body: 'PoF is a single-player Action RPG (ARPG) built in UE5.7.',
      refs: '["doc-a","doc-b"]',
      updated_at: '2026-05-26T00:00:00.000Z',
    });
    expect(rule).toEqual({
      id: 'game-genre',
      category: 'game',
      scope: 'global',
      title: 'Genre',
      body: 'PoF is a single-player Action RPG (ARPG) built in UE5.7.',
      refs: ['doc-a', 'doc-b'],
      updatedAt: '2026-05-26T00:00:00.000Z',
    });
  });

  it('omits updatedAt when updated_at is null', () => {
    const rule = rowToRule({
      id: 'art-icons',
      category: 'art',
      scope: 'global',
      title: 'Icon style',
      body: '256px, 3/4 view',
      refs: '[]',
      updated_at: null,
    });
    expect(rule.updatedAt).toBeUndefined();
    expect(rule.refs).toEqual([]);
  });

  it('defaults refs to empty array when refs is empty string', () => {
    const rule = rowToRule({
      id: 'proj-naming',
      category: 'project',
      scope: 'global',
      title: 'Asset naming',
      body: 'UE prefixes: T_ texture',
      refs: '',
      updated_at: null,
    });
    expect(rule.refs).toEqual([]);
  });
});
