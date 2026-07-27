import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import {
  createVariant,
  mutateVariant,
  startABTest,
  concludeTest,
  resolveDispatchVariant,
  recordTrialForServedVariant,
  getVersionHistory,
} from '@/lib/prompt-evolution/engine';
import { MIN_TRIALS_PER_VARIANT } from '@/lib/prompt-evolution/ab-testing';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;
const ITEM = 'ac-1';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS prompt_variants');
  testDb.exec('DROP TABLE IF EXISTS prompt_ab_tests');
});

/** Serve a variant, then report the run's outcome exactly as the callback POST does. */
function runOnce(success: boolean, durationMs = 100) {
  const served = resolveDispatchVariant(MOD, ITEM);
  expect(served).not.toBeNull();
  recordTrialForServedVariant(MOD, ITEM, served!.variant.id, success, durationMs);
  return served!;
}

describe('A/B loop — serve → record → conclude', () => {
  it('serves the adopted variant and books no trial when no test is running', () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');

    const served = resolveDispatchVariant(MOD, ITEM);
    expect(served!.variant.id).toBe(a.id);
    expect(served!.testId).toBeNull();
    expect(served!.slot).toBeNull();

    // Nothing under test → nothing to measure (a normal outcome, not an error).
    expect(recordTrialForServedVariant(MOD, ITEM, a.id, true, 100)).toBeNull();
    expect(getVersionHistory(MOD, ITEM).versions[0].stats.trials).toBe(0);
  });

  it('returns null for an item that has never had a variant authored', () => {
    expect(resolveDispatchVariant(MOD, 'never-touched')).toBeNull();
  });

  it('serves both arms of a running test and each run earns that arm a trial', () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = mutateVariant(a.id, 'imperative-rewrite')!;
    const test = startABTest(MOD, ITEM, a.id, b.id);

    const servedIds: string[] = [];
    for (let i = 0; i < 8; i++) servedIds.push(runOnce(true).variant.id);

    // Every serve came from the test (never the adopted-version fallback)…
    for (const id of servedIds) expect([a.id, b.id]).toContain(id);
    // …and both arms were actually explored.
    expect(servedIds).toContain(a.id);
    expect(servedIds).toContain(b.id);

    const history = getVersionHistory(MOD, ITEM);
    const statsA = history.versions.find((v) => v.variant.id === a.id)!.stats;
    const statsB = history.versions.find((v) => v.variant.id === b.id)!.stats;
    expect(statsA.trials + statsB.trials).toBe(8);
    expect(statsA.successes + statsB.successes).toBe(8);

    const servedIsTrial = servedIds.every((id) => id === a.id || id === b.id);
    expect(servedIsTrial).toBe(true);
    expect(test.status).toBe('running');
  });

  it('records failures as trials without successes', () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = mutateVariant(a.id, 'shorten')!;
    startABTest(MOD, ITEM, a.id, b.id);

    runOnce(false); // slot A (explore phase serves A first)
    const history = getVersionHistory(MOD, ITEM);
    const statsA = history.versions.find((v) => v.variant.id === a.id)!.stats;
    expect(statsA.trials).toBe(1);
    expect(statsA.successes).toBe(0);
    expect(statsA.successRate).toBe(0);
    void b;
  });

  it('refuses to crown a winner below the minimum-trials floor, and says why', () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = mutateVariant(a.id, 'add-verification')!;
    const test = startABTest(MOD, ITEM, a.id, b.id);

    const zeroTrials = concludeTest(test.id);
    expect(zeroTrials.ok).toBe(false);
    if (!zeroTrials.ok) {
      expect(zeroTrials.error).toContain(String(MIN_TRIALS_PER_VARIANT));
      expect(zeroTrials.error).toContain('A has 0');
      expect(zeroTrials.error).toContain('B has 0');
    }

    // Only one arm served enough → still refused, and only the short arm is named.
    for (let i = 0; i < MIN_TRIALS_PER_VARIANT; i++) {
      recordTrialForServedVariant(MOD, ITEM, a.id, true, 100);
    }
    const oneArm = concludeTest(test.id);
    expect(oneArm.ok).toBe(false);
    if (!oneArm.ok) {
      expect(oneArm.error).not.toContain('A has');
      expect(oneArm.error).toContain('B has 0');
    }
  });

  it('concludes once both arms clear the floor, crowning the higher success rate', () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = mutateVariant(a.id, 'add-verification')!;
    const test = startABTest(MOD, ITEM, a.id, b.id);

    for (let i = 0; i < MIN_TRIALS_PER_VARIANT; i++) {
      recordTrialForServedVariant(MOD, ITEM, a.id, false, 100);
      recordTrialForServedVariant(MOD, ITEM, b.id, true, 100);
    }

    const result = concludeTest(test.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('concluded');
      expect(result.data.winnerId).toBe(b.id);
      expect(result.data.concludedAt).not.toBeNull();
    }

    // The verdict is persisted, and the winner's history reflects the win.
    const statsB = getVersionHistory(MOD, ITEM).versions.find((v) => v.variant.id === b.id)!.stats;
    expect(statsB.wins).toBe(1);
    expect(statsB.trials).toBe(MIN_TRIALS_PER_VARIANT);
  });

  it('stops serving from a concluded test and falls back to the adopted version', () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = mutateVariant(a.id, 'shorten')!;
    const test = startABTest(MOD, ITEM, a.id, b.id);
    for (let i = 0; i < MIN_TRIALS_PER_VARIANT; i++) {
      recordTrialForServedVariant(MOD, ITEM, a.id, true, 10);
      recordTrialForServedVariant(MOD, ITEM, b.id, true, 10);
    }
    expect(concludeTest(test.id).ok).toBe(true);

    const served = resolveDispatchVariant(MOD, ITEM);
    expect(served!.variant.id).toBe(a.id); // `a` is still the adopted version
    expect(served!.testId).toBeNull();
    expect(recordTrialForServedVariant(MOD, ITEM, b.id, true, 10)).toBeNull();
  });

  it('reports a missing test rather than silently doing nothing', () => {
    const result = concludeTest('nope');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Test not found');
  });
});
