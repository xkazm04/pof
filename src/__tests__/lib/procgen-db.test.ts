import { describe, it, expect, vi } from 'vitest';

// In-memory DB so the test never touches ~/.pof/pof.db.
vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { recordProcgenRun, getLatestProcgenRun } from '@/lib/procgen-db';

describe('procgen-db', () => {
  it('returns null when no runs recorded', () => {
    expect(getLatestProcgenRun()).toBeNull();
  });

  it('records runs and returns the most recent', () => {
    recordProcgenRun({ roomCount: 6, seed: 1337 });
    recordProcgenRun({ roomCount: 8, seed: 99 });
    const latest = getLatestProcgenRun();
    expect(latest?.roomCount).toBe(8);
    expect(latest?.seed).toBe(99);
    expect(typeof latest?.createdAt).toBe('string');
  });
});
