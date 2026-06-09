import { describe, it, expect, vi, beforeEach } from 'vitest';

// The simulation engine's only side-effect surface is the game-director DB layer.
// Mock it so the engine can be exercised in isolation (the point of extracting it
// out of the API route).
vi.mock('@/lib/game-director-db', () => ({
  updateSessionStatus: vi.fn(),
  updateSessionSummary: vi.fn(),
  addFinding: vi.fn(),
  addEvent: vi.fn(),
}));

import { simulatePlaytest, generateFindingsForCategory } from '@/lib/game-director-sim';
import {
  updateSessionStatus,
  updateSessionSummary,
  addFinding,
} from '@/lib/game-director-db';
import type { PlaytestConfig } from '@/types/game-director';

describe('generateFindingsForCategory', () => {
  it('returns the templated findings for a known category, fully triage-initialized', () => {
    const findings = generateFindingsForCategory('sess-1', 'combat');
    expect(findings).toHaveLength(3);
    for (const f of findings) {
      expect(f.sessionId).toBe('sess-1');
      expect(f.triageStatus).toBe('active');
      expect(f.triageNote).toBe('');
      expect(f.snoozedUntil).toBeNull();
      expect(f.fixDispatchedAt).toBeNull();
    }
  });

  it('surfaces the critical save-load defect in the save-load category', () => {
    const findings = generateFindingsForCategory('sess-1', 'save-load');
    expect(findings.some(f => f.severity === 'critical')).toBe(true);
  });

  it('returns an empty array for an unknown category', () => {
    expect(generateFindingsForCategory('sess-1', 'no-such-category')).toEqual([]);
  });
});

describe('simulatePlaytest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const config: PlaytestConfig = {
    testCategories: ['combat', 'save-load'],
    maxPlaytimeMinutes: 5,
    screenshotIntervalSeconds: 10,
    aggressiveMode: false,
    prioritySystems: [],
  };

  it('drives the launching → playing → analyzing status transitions', async () => {
    await simulatePlaytest('sess-99', config);
    const statuses = (updateSessionStatus as ReturnType<typeof vi.fn>).mock.calls.map(c => c[1]);
    expect(statuses).toEqual(['launching', 'playing', 'analyzing']);
  });

  it('records every generated finding and writes a single summary', async () => {
    await simulatePlaytest('sess-99', config);
    // combat (3) + save-load (2) findings.
    expect((addFinding as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(5);
    expect((updateSessionSummary as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    const [, summary, , systemsTestedCount, findingsCount] =
      (updateSessionSummary as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(summary.systemsTested).toEqual(['combat', 'save-load']);
    expect(systemsTestedCount).toBe(2);
    expect(findingsCount).toBe(5);
  });
});
