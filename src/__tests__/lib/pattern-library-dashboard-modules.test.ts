/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): getPatternDashboard sliced the module facet to
 * 10 entries, and the Patterns tab's module filter is built from it, so patterns of an 11th module
 * could not be filtered to (the category facet is uncapped).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { getDb } from '@/lib/db';
import { ensurePatternLibraryTable, upsertPattern, getPatternDashboard } from '@/lib/pattern-library-db';
import type { ImplementationPattern } from '@/types/pattern-library';

const MODULES = [
  'arpg-character', 'arpg-combat', 'arpg-loot', 'arpg-gas', 'arpg-inventory', 'arpg-enemy-ai',
  'arpg-ui', 'arpg-progression', 'arpg-world', 'arpg-animation', 'arpg-save',
];

function pattern(moduleId: string, n: number): ImplementationPattern {
  return {
    id: `mined--${moduleId}--${n}`,
    title: `${moduleId} ${n}`,
    moduleId: moduleId as ImplementationPattern['moduleId'],
    category: 'class-hierarchy',
    tags: [],
    description: 'd',
    approach: `a${n}`,
    successRate: 0.9,
    sessionCount: 3,
    projectCount: 1,
    avgDurationMs: 1000,
    confidence: 'proven',
    involvedClasses: [],
    pitfalls: [],
    firstSeenAt: '2026-05-01T00:00:00Z',
    lastSuccessAt: '2026-05-20T00:00:00Z',
    source: 'mined',
    verified: false,
    pinned: false,
  };
}

beforeEach(() => {
  ensurePatternLibraryTable();
  getDb().exec('DELETE FROM pattern_library');
});

describe('getPatternDashboard - module facet', () => {
  it('lists every module that has patterns, most populated first', () => {
    MODULES.forEach((m, i) => {
      // earlier modules get more patterns so the ranking is deterministic
      for (let n = 0; n < MODULES.length - i; n++) upsertPattern(pattern(m, n));
    });
    const { topModules } = getPatternDashboard();
    expect(topModules).toHaveLength(MODULES.length);
    expect(topModules.map((m) => m.moduleId)).toEqual(MODULES);
    expect(topModules[MODULES.length - 1].patternCount).toBe(1);
  });
});
