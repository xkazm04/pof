import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
testDb.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
  return {
    getDb: () => testDb,
    getSetting: (key: string) => {
      const row = testDb.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },
    setSetting: (key: string, value: string) => {
      testDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    },
    __esModule: true,
    default: actual,
  };
});

import {
  getSchedule,
  setSchedule,
  getScheduleState,
  setScheduleState,
  isRunning,
  setRunning,
} from '@/lib/packaging/build-schedule-store';
import { DEFAULT_SCHEDULE } from '@/lib/packaging/build-scheduler';

beforeEach(() => {
  testDb.exec('DELETE FROM settings');
  setRunning(false);
});

describe('schedule config', () => {
  it('returns the default schedule when nothing is stored', () => {
    expect(getSchedule()).toEqual(DEFAULT_SCHEDULE);
  });

  it('persists and merges partial updates', () => {
    setSchedule({ enabled: true, time: '03:30', profileId: 'p-1' });
    const s = getSchedule();
    expect(s.enabled).toBe(true);
    expect(s.time).toBe('03:30');
    expect(s.profileId).toBe('p-1');
    // unset fields keep their defaults
    expect(s.skipIfUnchanged).toBe(true);
    expect(s.days).toEqual([]);
  });

  it('round-trips through a fresh read', () => {
    setSchedule({ days: [1, 3, 5], projectPath: 'C:\\proj' });
    expect(getSchedule().days).toEqual([1, 3, 5]);
    expect(getSchedule().projectPath).toBe('C:\\proj');
  });
});

describe('schedule state', () => {
  it('defaults to an empty state', () => {
    const st = getScheduleState();
    expect(st.lastRunAt).toBeNull();
    expect(st.lastOutcome).toBeNull();
  });

  it('persists and merges patches', () => {
    setScheduleState({ lastRunAt: '2026-05-27T02:00:00.000Z', lastOutcome: 'success', lastCommit: 'abc' });
    setScheduleState({ lastBuildId: 42 });
    const st = getScheduleState();
    expect(st.lastOutcome).toBe('success');
    expect(st.lastCommit).toBe('abc');
    expect(st.lastBuildId).toBe(42);
    expect(st.lastRunAt).toBe('2026-05-27T02:00:00.000Z');
  });
});

describe('running guard', () => {
  it('tracks the in-memory single-flight flag', () => {
    expect(isRunning()).toBe(false);
    setRunning(true);
    expect(isRunning()).toBe(true);
    setRunning(false);
    expect(isRunning()).toBe(false);
  });
});
