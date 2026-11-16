/**
 * getEvents orders the timeline by instant, not by the raw TEXT spelling:
 * default-stamped rows are 'YYYY-MM-DD HH:MM:SS', ingest-stamped rows are ISO
 * 'YYYY-MM-DDTHH:MM:SS.sssZ', and 'T' sorts after ' ' as text.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-events-order-${process.pid}.db`;
});

import { createSession, addEvent, getEvents } from '@/lib/game-director-db';
import type { PlaytestConfig } from '@/types/game-director';

const config: PlaytestConfig = {
  testCategories: ['combat'],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};

describe('getEvents chronology', () => {
  it('puts the later instant first across the two timestamp spellings', () => {
    createSession('ev-order', 'Events', '/build', config);
    addEvent({ id: 'iso-earlier', sessionId: 'ev-order', timestamp: '2026-11-08T10:00:00.000Z', type: 'observation', message: 'iso' });
    addEvent({ id: 'sqlite-later', sessionId: 'ev-order', timestamp: '2026-11-08 10:00:01', type: 'observation', message: 'sqlite' });

    expect(getEvents('ev-order').map((e) => e.id)).toEqual(['sqlite-later', 'iso-earlier']);
  });
});
