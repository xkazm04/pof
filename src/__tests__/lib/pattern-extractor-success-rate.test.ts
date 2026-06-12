import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory DB so the test never touches ~/.pof/pof.db.
vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { getDb } from '@/lib/db';
import { extractPatterns } from '@/lib/pattern-extractor';
import { getPatternsByModule } from '@/lib/pattern-library-db';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-gas' as SubModuleId;

function seed(prompt: string, success: 0 | 1, n: number, startIdx: number) {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO session_analytics (module_id, prompt, success, duration_ms, completed_at) VALUES (?, ?, ?, ?, ?)',
  );
  for (let i = 0; i < n; i++) {
    stmt.run(MODULE, prompt, success, 1000, `2026-06-10T00:00:${String(startIdx + i).padStart(2, '0')}Z`);
  }
}

beforeEach(() => {
  const db = getDb();
  db.exec('DROP TABLE IF EXISTS session_analytics');
  db.exec(`CREATE TABLE session_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT NOT NULL, prompt TEXT NOT NULL, success INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL, completed_at TEXT NOT NULL
  )`);
  db.exec('DROP TABLE IF EXISTS pattern_library');
});

describe('extractPatterns success rate is per-approach, not module-wide', () => {
  it('stores a mostly-failing approach with its own low rate, not the blended module rate', () => {
    // composition: 3/3 success.  inheritance: 2 success + 6 fail = 2/8 = 25%.
    // Module-wide blend would be 5/11 ≈ 45% — the old (wrong) value.
    seed('Add an ActorComponent modular component for the ability system', 1, 3, 0);
    seed('Subclass the base class and override the virtual activation', 1, 2, 10);
    seed('Subclass the base class and override the virtual activation', 0, 6, 20);

    extractPatterns();

    const patterns = getPatternsByModule(MODULE);
    const inheritance = patterns.find((p) => p.approach === 'inheritance');
    expect(inheritance).toBeTruthy();
    // Per-approach rate (2/8), not the module-wide blend (5/11).
    expect(inheritance!.successRate).toBeCloseTo(0.25, 2);
    expect(inheritance!.successRate).toBeLessThan(0.4);

    const composition = patterns.find((p) => p.approach === 'composition');
    expect(composition!.successRate).toBeCloseTo(1.0, 2);
  });
});
