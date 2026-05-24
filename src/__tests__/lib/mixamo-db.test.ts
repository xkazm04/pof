import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { recordMixamoRun, getLatestMixamoRun } from '@/lib/mixamo-db';

describe('mixamo-db', () => {
  it('returns null when no runs recorded', () => {
    expect(getLatestMixamoRun()).toBeNull();
  });

  it('records runs and returns the most recent', () => {
    recordMixamoRun({ importedCount: 3, importDir: 'C:/inc/a' });
    recordMixamoRun({ importedCount: 7, importDir: 'C:/inc/b' });
    const latest = getLatestMixamoRun();
    expect(latest?.importedCount).toBe(7);
    expect(latest?.importDir).toBe('C:/inc/b');
    expect(typeof latest?.createdAt).toBe('string');
  });
});
