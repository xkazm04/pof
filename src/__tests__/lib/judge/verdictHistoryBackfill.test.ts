import { describe, it, expect, vi } from 'vitest';

// Fresh in-memory DB. This file gets its own module registry, so the `ensureTable` latch has
// not fired yet — which is exactly what the one-time migration under test needs.
vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  // A DB as it looked BEFORE the history log existed: verdicts on record, no log.
  db.exec(`
    CREATE TABLE judge_verdicts (
      catalog_id TEXT NOT NULL, entity_id TEXT NOT NULL, step TEXT NOT NULL, judge TEXT NOT NULL,
      verdict TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, findings TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '', judged_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id, step, judge)
    );
    INSERT INTO judge_verdicts (catalog_id, entity_id, step, judge, verdict, score, findings, model, judged_at)
    VALUES ('items', 'sword', 'Economy', 'llm-panel', 'fail', 44, 'legacy finding', 'sonnet', '2026-07-01 08:00:00');
  `);
  return { getDb: () => db };
});

import { listVerdictHistory, listVerdicts, upsertVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * MIGRATION LATCH — the verdicts already on record ARE the first point of every trend.
 *
 * Without the one-time seed the log would start empty on an existing database: a step judged
 * through a whole campaign would read as "judged once" the next time it ran, and the campaign's
 * own record would be invisible. The seed is additive, runs only when the log table did not
 * exist, and never re-inserts.
 */
describe('judge verdict history — one-time seed from the verdicts already on record', () => {
  it('seeds the existing verdict as the first trend point, then appends normally', () => {
    // First read creates the log and seeds it from `judge_verdicts` (legacy columns and all).
    const seeded = listVerdictHistory('items', 'sword', 'Economy', 'llm-panel');
    expect(seeded).toHaveLength(1);
    expect(seeded[0].score).toBe(44);
    expect(seeded[0].findings).toBe('legacy finding');
    expect(seeded[0].judgedAt).toBe('2026-07-01 08:00:00');

    upsertVerdict({
      catalogId: 'items', entityId: 'sword', step: 'Economy', judge: 'llm-panel',
      verdict: 'pass', score: 81, findings: 'reconciled after the fix', model: 'opus',
    });

    expect(listVerdictHistory('items', 'sword', 'Economy', 'llm-panel').map((h) => h.score)).toEqual([44, 81]);
    expect(listVerdicts('items')).toHaveLength(1);          // acceptance still sees one row…
    expect(listVerdicts('items')[0].score).toBe(81);        // …the current one
  });

  it('does not re-seed on subsequent calls', () => {
    listVerdictHistory('items', 'sword', 'Economy');
    listVerdictHistory('items', 'sword', 'Economy');
    expect(listVerdictHistory('items', 'sword', 'Economy', 'llm-panel')).toHaveLength(2);
  });
});
