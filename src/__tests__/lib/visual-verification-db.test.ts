import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

// Back the db layer with an in-memory sqlite so the test never touches ~/.pof/pof.db.
const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import {
  recordVisualVerification,
  listVisualVerifications,
} from '@/lib/visual-verification-db';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS visual_verifications');
});

describe('visual-verification-db', () => {
  it('records a verdict and reads it back (round-trip)', () => {
    recordVisualVerification({
      moduleId: 'arpg-ui',
      itemId: 'au-1',
      projectPath: 'C:\\proj',
      screenshotPath: 'C:\\proj\\Saved\\Screenshots\\WindowsEditor\\HighresScreenshot00000.png',
      verdict: 'pass',
      anyEmpty: false,
      elements: ['player health bar (top-left)', 'enemy bar (top-centre)'],
      notes: 'both bars visible',
    });

    const all = listVisualVerifications();
    expect(all).toHaveLength(1);
    expect(all[0].verdict).toBe('pass');
    expect(all[0].anyEmpty).toBe(false);
    expect(all[0].elements).toEqual(['player health bar (top-left)', 'enemy bar (top-centre)']);
  });

  it('filters by moduleId', () => {
    recordVisualVerification({
      moduleId: 'arpg-ui', itemId: 'au-1', screenshotPath: 'a.png',
      verdict: 'fail', anyEmpty: true, elements: [], notes: 'bar reads empty',
    });
    recordVisualVerification({
      moduleId: 'arpg-combat', itemId: 'x', screenshotPath: 'b.png',
      verdict: 'pass', anyEmpty: false, elements: [], notes: '',
    });

    expect(listVisualVerifications('arpg-ui')).toHaveLength(1);
    expect(listVisualVerifications('arpg-ui')[0].verdict).toBe('fail');
    expect(listVisualVerifications()).toHaveLength(2);
  });
});
