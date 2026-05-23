import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { recordScatterRun, getLatestScatterRun } from '@/lib/scatter-db';

describe('scatter-db', () => {
  it('returns null when no runs recorded', () => {
    expect(getLatestScatterRun()).toBeNull();
  });

  it('records runs and returns the most recent', () => {
    recordScatterRun({ instanceCount: 40, seed: 7 });
    recordScatterRun({ instanceCount: 73, seed: 9 });
    const latest = getLatestScatterRun();
    expect(latest?.instanceCount).toBe(73);
    expect(latest?.seed).toBe(9);
    expect(typeof latest?.createdAt).toBe('string');
  });
});
