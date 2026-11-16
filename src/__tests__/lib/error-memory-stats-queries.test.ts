/**
 * scan-sweep (cross-module-features/B): getErrorMemoryStats ran a fifth SELECT
 * (topPatterns) that no consumer reads. It now issues 4 SELECTs and returns no
 * `topPatterns` key.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { getDb } from '@/lib/db';
import { recordError, getErrorMemoryStats } from '@/lib/error-memory-db';

describe('getErrorMemoryStats', () => {
  it('runs 4 SELECTs against error_memory and returns only the keys a consumer reads', () => {
    recordError({
      moduleId: 'arpg-combat', fingerprint: 'f1', category: 'syntax', errorCode: null,
      pattern: 'p', message: 'm', file: null, fixDescription: 'fix',
    });
    getErrorMemoryStats(); // warm: schema bootstrap runs once per process
    const db = getDb();
    const real = db.prepare.bind(db);
    const selects: string[] = [];
    const spy = vi.spyOn(db, 'prepare').mockImplementation(((sql: string) => {
      if (/^\s*SELECT/i.test(sql)) selects.push(sql);
      return real(sql);
    }) as typeof db.prepare);
    const stats = getErrorMemoryStats();
    spy.mockRestore();
    expect(selects).toHaveLength(4);
    expect(Object.keys(stats).sort()).toEqual(
      ['topCategories', 'totalErrors', 'uniqueFingerprints', 'unresolvedCount'],
    );
    expect(stats.totalErrors).toBe(1);
  });
});
