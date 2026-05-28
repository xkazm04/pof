import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory DB so the test never touches ~/.pof/pof.db.
vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { getDb } from '@/lib/db';
import {
  ensurePatternLibraryTable,
  upsertPattern,
  authorPattern,
  setPatternVerified,
  setPatternPinned,
  updatePatternMeta,
  suggestPatterns,
  getPatternsByModule,
  getPattern,
} from '@/lib/pattern-library-db';
import type { ImplementationPattern } from '@/types/pattern-library';

function minedPattern(overrides: Partial<ImplementationPattern> = {}): ImplementationPattern {
  return {
    id: 'mined--arpg-character--inheritance',
    title: 'Character: Inheritance',
    moduleId: 'arpg-character' as ImplementationPattern['moduleId'],
    category: 'class-hierarchy',
    tags: ['inheritance'],
    description: 'mined description',
    approach: 'inheritance',
    successRate: 0.9,
    sessionCount: 8,
    projectCount: 2,
    avgDurationMs: 60_000,
    confidence: 'proven',
    involvedClasses: ['ACharacter'],
    pitfalls: ['inheritance trap'],
    firstSeenAt: '2026-05-01T00:00:00Z',
    lastSuccessAt: '2026-05-20T00:00:00Z',
    source: 'mined',
    verified: false,
    pinned: false,
    ...overrides,
  };
}

beforeEach(() => {
  // Wipe the table between tests so the shared in-memory DB stays clean.
  ensurePatternLibraryTable();
  getDb().exec('DELETE FROM pattern_library');
});

describe('pattern-library curation', () => {
  it('migrates legacy schema by adding source/verified/pinned columns', () => {
    ensurePatternLibraryTable();
    const cols = getDb().prepare('PRAGMA table_info(pattern_library)').all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    expect(names).toContain('source');
    expect(names).toContain('verified');
    expect(names).toContain('pinned');
    expect(names).toContain('verified_at');
    expect(names).toContain('verified_by');
    expect(names).toContain('authored_by');
  });

  it('authorPattern saves source=authored + verified=true', () => {
    const p = authorPattern({
      title: 'Hand-authored GAS combo',
      moduleId: 'arpg-gas' as ImplementationPattern['moduleId'],
      category: 'gas-integration',
      description: 'Use montage sections to drive combo branching.',
      approach: 'montage-based',
      tags: ['gas', 'combo'],
      pitfalls: ['Watch for section order'],
      authoredBy: 'mk',
    });

    expect(p.source).toBe('authored');
    expect(p.verified).toBe(true);
    expect(p.pinned).toBe(false);
    expect(p.verifiedAt).toBeTruthy();
    expect(p.authoredBy).toBe('mk');

    const fromDb = getPattern(p.id);
    expect(fromDb?.source).toBe('authored');
    expect(fromDb?.verified).toBe(true);
  });

  it('setPatternVerified + setPatternPinned flip the flags and stamp metadata', () => {
    upsertPattern(minedPattern());

    const verified = setPatternVerified('mined--arpg-character--inheritance', true, 'reviewer');
    expect(verified?.verified).toBe(true);
    expect(verified?.verifiedAt).toBeTruthy();
    expect(verified?.verifiedBy).toBe('reviewer');

    const pinned = setPatternPinned('mined--arpg-character--inheritance', true);
    expect(pinned?.pinned).toBe(true);

    // Unverify clears the timestamp + reviewer
    const cleared = setPatternVerified('mined--arpg-character--inheritance', false);
    expect(cleared?.verified).toBe(false);
    expect(cleared?.verifiedAt).toBeUndefined();
    expect(cleared?.verifiedBy).toBeUndefined();
  });

  it('updatePatternMeta patches description + pitfalls without touching curation flags', () => {
    upsertPattern(minedPattern());
    setPatternVerified('mined--arpg-character--inheritance', true, 'mk');

    const patched = updatePatternMeta('mined--arpg-character--inheritance', {
      description: 'edited description',
      pitfalls: ['new pitfall A', 'new pitfall B'],
    });

    expect(patched?.description).toBe('edited description');
    expect(patched?.pitfalls).toEqual(['new pitfall A', 'new pitfall B']);
    // Curation state preserved
    expect(patched?.verified).toBe(true);
    expect(patched?.verifiedBy).toBe('mk');
  });

  it('re-mining a verified pattern preserves the curated description + pitfalls', () => {
    const p = minedPattern({ description: 'curated', pitfalls: ['curated pitfall'] });
    upsertPattern(p);
    setPatternVerified(p.id, true, 'mk');
    updatePatternMeta(p.id, { description: 'curated', pitfalls: ['curated pitfall'] });

    // Simulate the extractor running again with new (raw) data
    upsertPattern({
      ...p,
      description: 'auto-regenerated noise',
      pitfalls: ['noise'],
      successRate: 0.95,
      sessionCount: 20,
    });

    const after = getPattern(p.id);
    expect(after?.description).toBe('curated');
    expect(after?.pitfalls).toEqual(['curated pitfall']);
    // But raw stats DO refresh
    expect(after?.successRate).toBe(0.95);
    expect(after?.sessionCount).toBe(20);
    expect(after?.verified).toBe(true);
  });

  it('getPatternsByModule lists pinned > verified > mined', () => {
    const mined = minedPattern({ id: 'p-mined', successRate: 0.95, sessionCount: 20 });
    const verified = minedPattern({ id: 'p-verified', successRate: 0.5, sessionCount: 4 });
    const pinned = minedPattern({ id: 'p-pinned', successRate: 0.1, sessionCount: 1 });
    upsertPattern(mined);
    upsertPattern(verified);
    upsertPattern(pinned);
    setPatternVerified('p-verified', true);
    setPatternPinned('p-pinned', true);

    const list = getPatternsByModule(mined.moduleId);
    expect(list.map((p) => p.id)).toEqual(['p-pinned', 'p-verified', 'p-mined']);
  });

  it('suggestPatterns puts pinned + verified patterns above higher-success mined ones', () => {
    const mined = minedPattern({ id: 'mined-strong', successRate: 0.95, sessionCount: 25, projectCount: 3 });
    const verified = minedPattern({ id: 'mined-weak-verified', successRate: 0.3, sessionCount: 3 });
    const pinned = minedPattern({ id: 'mined-weak-pinned', successRate: 0.2, sessionCount: 2 });
    upsertPattern(mined);
    upsertPattern(verified);
    upsertPattern(pinned);
    setPatternVerified('mined-weak-verified', true);
    setPatternPinned('mined-weak-pinned', true);

    const suggestions = suggestPatterns(mined.moduleId);
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    expect(suggestions[0].pattern.id).toBe('mined-weak-pinned');
    expect(suggestions[1].pattern.id).toBe('mined-weak-verified');
    // The strong mined one is still suggested, just below curated entries
    expect(suggestions.find((s) => s.pattern.id === 'mined-strong')).toBeTruthy();
  });
});
