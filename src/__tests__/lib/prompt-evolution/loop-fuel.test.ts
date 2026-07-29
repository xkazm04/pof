import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import {
  seedBaselineVariant,
  createVariant,
  startABTest,
  resolveDispatchVariant,
  recordTrialForServedVariant,
  getVersionHistory,
  getVariantsForItem,
} from '@/lib/prompt-evolution/engine';
import { MIN_TRIALS_PER_VARIANT } from '@/lib/prompt-evolution/ab-testing';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;
const ITEM = 'ac-1';
const STATIC_PROMPT = 'Implement melee hit detection with a TSet dedup and a debug draw.';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS prompt_variants');
  testDb.exec('DROP TABLE IF EXISTS prompt_ab_tests');
});

/** One dispatch of the item, exactly as the CLI path does it: serve → report. */
function dispatchOnce(success: boolean, durationMs = 100) {
  const served = resolveDispatchVariant(MOD, ITEM);
  expect(served).not.toBeNull();
  recordTrialForServedVariant(MOD, ITEM, served!.variant.id, success, durationMs);
  return served!;
}

describe('seedBaselineVariant — the loop gets fuel on a fresh DB', () => {
  it('captures v1 from the exact served prompt and makes it the adopted version', () => {
    // Before: a fresh DB serves nothing, so dispatch falls back to the static prompt.
    expect(resolveDispatchVariant(MOD, ITEM)).toBeNull();

    const seeded = seedBaselineVariant(MOD, ITEM, STATIC_PROMPT);
    expect(seeded).not.toBeNull();
    expect(seeded!.seeded).toBe(true);
    expect(seeded!.variant.origin).toBe('seeded');
    // Byte-identical to what the static path dispatched — the baseline is not a rewrite.
    expect(seeded!.variant.prompt).toBe(STATIC_PROMPT);
    expect(seeded!.variant.active).toBe(true);

    const served = resolveDispatchVariant(MOD, ITEM);
    expect(served!.variant.id).toBe(seeded!.variant.id);
    expect(served!.variant.prompt).toBe(STATIC_PROMPT);
  });

  it('is idempotent — repeated dispatches never fork a second baseline', () => {
    const first = seedBaselineVariant(MOD, ITEM, STATIC_PROMPT)!;
    const again = seedBaselineVariant(MOD, ITEM, STATIC_PROMPT)!;

    expect(again.seeded).toBe(false);
    expect(again.variant.id).toBe(first.variant.id);
    expect(getVariantsForItem(MOD, ITEM)).toHaveLength(1);
  });

  it('never overwrites a user-authored version with a machine baseline', () => {
    const authored = createVariant(MOD, ITEM, 'You MUST implement melee hit detection.', 'user-edit');
    const seeded = seedBaselineVariant(MOD, ITEM, STATIC_PROMPT)!;

    expect(seeded.seeded).toBe(false);
    expect(seeded.variant.id).toBe(authored.id);
    expect(getVariantsForItem(MOD, ITEM)).toHaveLength(1);
  });

  it('refuses to seed an empty prompt (nothing to measure)', () => {
    expect(seedBaselineVariant(MOD, ITEM, '   ')).toBeNull();
    expect(getVariantsForItem(MOD, ITEM)).toHaveLength(0);
  });
});

describe('seeded item → challenger → trials', () => {
  it('records a trial for each dispatch once a challenger is under test', () => {
    const baseline = seedBaselineVariant(MOD, ITEM, STATIC_PROMPT)!.variant;
    const challenger = createVariant(MOD, ITEM, 'Optimized: verify the build compiles after the change.', 'user-edit');
    const test = startABTest(MOD, ITEM, baseline.id, challenger.id);

    // Two dispatches on the seeded item → two booked trials, visible in the history.
    dispatchOnce(true);
    dispatchOnce(true);

    const history = getVersionHistory(MOD, ITEM);
    const totalTrials = history.versions.reduce((n, v) => n + v.stats.trials, 0);
    expect(totalTrials).toBe(2);
    expect(history.versions.every((v) => v.stats.testCount === 1)).toBe(true);
    expect(test.status).toBe('running');
  });

  it('serves the challenger — not just the incumbent — within MIN_TRIALS', () => {
    const baseline = seedBaselineVariant(MOD, ITEM, STATIC_PROMPT)!.variant;
    const challenger = createVariant(MOD, ITEM, 'Optimized: verify the build compiles after the change.', 'user-edit');
    startABTest(MOD, ITEM, baseline.id, challenger.id);

    const servedIds = new Set<string>();
    for (let i = 0; i < MIN_TRIALS_PER_VARIANT * 2; i++) servedIds.add(dispatchOnce(true).variant.id);

    // Epsilon-greedy explores both arms first, so the challenger actually runs.
    expect(servedIds.has(baseline.id)).toBe(true);
    expect(servedIds.has(challenger.id)).toBe(true);
  });
});
