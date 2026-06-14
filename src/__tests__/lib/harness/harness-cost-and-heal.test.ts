import { describe, it, expect } from 'vitest';
import {
  emptyCost, projectedSpend, avgSessionCost, budgetWouldOverflow,
  budgetWouldOverflowReserved, sessionCostEstimate,
  pickHealVerifyCommand,
} from '@/lib/harness/orchestrator';

describe('cost governor helpers', () => {
  it('emptyCost reflects the configured cap', () => {
    expect(emptyCost(5)).toEqual({ spentUsd: 0, byArea: {}, sessions: 0, budgetUsd: 5, paused: false });
    expect(emptyCost(null).budgetUsd).toBeNull();
  });

  it('avgSessionCost is 0 when no sessions have run', () => {
    expect(avgSessionCost(emptyCost(10))).toBe(0);
  });

  it('avgSessionCost divides spend by session count', () => {
    expect(avgSessionCost({ spentUsd: 6, sessions: 3, byArea: {}, budgetUsd: null, paused: false })).toBe(2);
  });

  it('budgetWouldOverflow returns false when no cap is configured', () => {
    expect(budgetWouldOverflow({ spentUsd: 100, sessions: 10, byArea: {}, budgetUsd: null, paused: false }, null)).toBe(false);
  });

  it('budgetWouldOverflow trips when already at or past the cap', () => {
    expect(budgetWouldOverflow({ spentUsd: 10, sessions: 1, byArea: {}, budgetUsd: 10, paused: false }, 10)).toBe(true);
  });

  it('budgetWouldOverflow trips when the projected next session would cross the cap', () => {
    // Avg = 3/3 = 1; projected = 9 + 1 = 10 → 10 > 9.5 → overflow.
    const totals = { spentUsd: 9, sessions: 3, byArea: {}, budgetUsd: 9.5, paused: false };
    expect(budgetWouldOverflow(totals, 9.5)).toBe(true);
  });

  it('budgetWouldOverflow stays false with safe headroom', () => {
    const totals = { spentUsd: 2, sessions: 4, byArea: {}, budgetUsd: 10, paused: false };
    // Avg = 0.5; projected = 2.5 → under 10 → no overflow.
    expect(budgetWouldOverflow(totals, 10)).toBe(false);
  });

  it('projectedSpend simply adds the estimate', () => {
    expect(projectedSpend(emptyCost(null), 1.5)).toBe(1.5);
    expect(projectedSpend({ spentUsd: 3, sessions: 1, byArea: {}, budgetUsd: null, paused: false }, 2)).toBe(5);
  });
});

describe('in-flight reservation governor', () => {
  it('sessionCostEstimate uses the running average once a session has settled', () => {
    expect(sessionCostEstimate({ spentUsd: 6, sessions: 3, byArea: {}, budgetUsd: null, paused: false }, 0.5)).toBe(2);
  });

  it('sessionCostEstimate falls back to the fixed estimate before any session settles', () => {
    expect(sessionCostEstimate(emptyCost(10), 0.5)).toBe(0.5);
  });

  it('budgetWouldOverflowReserved is false when no cap is configured', () => {
    expect(budgetWouldOverflowReserved(emptyCost(null), 99, 99, null)).toBe(false);
  });

  it('blocks the (maxConcurrent − 1) overshoot: settled spend low, but in-flight reservations fill the cap', () => {
    // $5 cap, $0 settled, but 4 sessions already launched at ~$1.50 reserved each = $6 in flight.
    // The pre-fix governor (settled spend only) would green-light this launch; the reserved one blocks it.
    const totals = { spentUsd: 0, sessions: 0, byArea: {}, budgetUsd: 5, paused: false };
    expect(budgetWouldOverflow(totals, 5)).toBe(false);           // old behavior: would launch (overshoot)
    expect(budgetWouldOverflowReserved(totals, 6, 1.5, 5)).toBe(true); // new behavior: blocked
  });

  it('still launches while committed + reserved + next estimate stays under the cap', () => {
    const totals = { spentUsd: 2, sessions: 4, byArea: {}, budgetUsd: 10, paused: false };
    // committed 2 + reserved 1 + next 0.5 = 3.5 ≤ 10 → ok to launch.
    expect(budgetWouldOverflowReserved(totals, 1, 0.5, 10)).toBe(false);
  });

  it('trips when committed + reserved already meets the cap even with a zero next estimate', () => {
    const totals = { spentUsd: 4, sessions: 2, byArea: {}, budgetUsd: 6, paused: false };
    expect(budgetWouldOverflowReserved(totals, 2, 0, 6)).toBe(true);
  });
});

describe('pickHealVerifyCommand', () => {
  const gates = [
    { name: 'typecheck', type: 'typecheck', command: 'npx tsc --noEmit' },
    { name: 'build', type: 'build', command: 'npx next build' },
    { name: 'visual', type: 'visual' }, // no command
  ];

  it('returns the failing gate\'s own command when available', () => {
    const failing = [{ name: 'build', command: 'npx next build' }];
    expect(pickHealVerifyCommand(failing, gates)).toBe('npx next build');
  });

  it('falls back to the typecheck gate when failing gates have no command', () => {
    const failing = [{ name: 'visual' }];
    expect(pickHealVerifyCommand(failing, gates)).toBe('npx tsc --noEmit');
  });

  it('returns null when no failing gate has a command and no typecheck/build is configured', () => {
    const failing = [{ name: 'custom' }];
    expect(pickHealVerifyCommand(failing, [{ name: 'lint', type: 'lint' }])).toBeNull();
  });

  it('does NOT hardcode `npx tsc --noEmit` for UE5 trees (the failing-gate regression we are fixing)', () => {
    const ue5Gates = [{ name: 'source-exists', type: 'custom', command: 'ls Source/' }];
    const failing = [{ name: 'source-exists', command: 'ls Source/' }];
    const cmd = pickHealVerifyCommand(failing, ue5Gates);
    expect(cmd).toBe('ls Source/');
    expect(cmd).not.toContain('tsc');
  });
});
