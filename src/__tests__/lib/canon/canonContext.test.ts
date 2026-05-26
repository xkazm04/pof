import { describe, it, expect } from 'vitest';
import { selectRules, canonContextFor } from '@/lib/catalog/canon/canonContext';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import type { ProjectRule } from '@/lib/catalog/canon/types';

const RULES: ProjectRule[] = [
  { id: 'g1', category: 'game', scope: 'global', title: 'Genre', body: 'ARPG' },
  { id: 'a1', category: 'art', scope: 'global', title: 'Art style', body: 'Painterly' },
  { id: 'p1', category: 'project', scope: 'global', title: 'Naming', body: 'PascalCase' },
  { id: 'c1', category: 'game', scope: 'spellbook', title: 'Spellbook rule', body: 'Only magic items' },
  { id: 'c2', category: 'art', scope: 'bestiary', title: 'Bestiary art', body: 'Grimdark' },
];

describe('selectRules', () => {
  it('includes global rules regardless of catalogId', () => {
    const result = selectRules(RULES);
    expect(result.map((r) => r.id)).toContain('g1');
    expect(result.map((r) => r.id)).toContain('a1');
    expect(result.map((r) => r.id)).toContain('p1');
  });

  it('excludes catalog-scoped rules when no catalogId provided', () => {
    const result = selectRules(RULES);
    expect(result.map((r) => r.id)).not.toContain('c1');
    expect(result.map((r) => r.id)).not.toContain('c2');
  });

  it('includes catalog-scoped rule only for the matching catalogId', () => {
    const forSpellbook = selectRules(RULES, 'spellbook');
    expect(forSpellbook.map((r) => r.id)).toContain('c1');
    expect(forSpellbook.map((r) => r.id)).not.toContain('c2');

    const forBestiary = selectRules(RULES, 'bestiary');
    expect(forBestiary.map((r) => r.id)).toContain('c2');
    expect(forBestiary.map((r) => r.id)).not.toContain('c1');
  });

  it('filters by category when categories provided', () => {
    const result = selectRules(RULES, undefined, ['game']);
    expect(result.every((r) => r.category === 'game')).toBe(true);
    expect(result.map((r) => r.id)).toContain('g1');
    expect(result.map((r) => r.id)).not.toContain('a1');
  });

  it('returns empty array when no rules match category filter', () => {
    const result = selectRules(RULES, undefined, ['project']);
    expect(result.map((r) => r.id)).toEqual(['p1']);
  });
});

describe('canonContextFor', () => {
  it('returns empty string when no rules are in scope', () => {
    const result = canonContextFor([], 'anything');
    expect(result).toBe('');
  });

  it('returns empty string when category filter excludes all', () => {
    // Only 'game' rules in RULES, filter to 'project' scoped-only — no global project rule in this subset
    const gameOnly = RULES.filter((r) => r.category === 'game');
    const result = canonContextFor(gameOnly, undefined, ['art']);
    expect(result).toBe('');
  });

  it('includes the PROJECT CANON header when rules are in scope', () => {
    const result = canonContextFor(RULES);
    expect(result).toContain('# PROJECT CANON (follow these)');
  });

  it('includes a seeded rule title and body in the output', () => {
    const result = canonContextFor(CANON_SEED);
    expect(result).toContain('Genre');
    expect(result).toContain('PoF is a single-player Action RPG (ARPG) built in UE5.7.');
  });

  it('groups rules by category with uppercase category headers', () => {
    const result = canonContextFor(RULES);
    expect(result).toContain('## GAME CANON');
    expect(result).toContain('## ART CANON');
    expect(result).toContain('## PROJECT CANON');
  });

  it('includes refs when present', () => {
    const rulesWithRefs: ProjectRule[] = [
      { id: 'r1', category: 'game', scope: 'global', title: 'With ref', body: 'Body text', refs: ['doc-1', 'doc-2'] },
    ];
    const result = canonContextFor(rulesWithRefs);
    expect(result).toContain('(refs: doc-1, doc-2)');
  });

  it('does not include refs suffix when refs are absent', () => {
    const result = canonContextFor([CANON_SEED[0]]);
    expect(result).not.toContain('(refs:');
  });
});
