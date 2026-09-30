import { describe, it, expect } from 'vitest';
import { entityDrainOutcome } from '@/components/layout-lab/entityDrainOutcome';
import type { DrainSummary } from '@/lib/test-gate-runner/types';

const steps = ['Concept', 'Test Gate'];
const summary = (over: Partial<DrainSummary> = {}): DrainSummary => ({
  ran: 0, passed: 0, failed: 0, deferred: 0, skipped: 0, screenshots: [], results: [], ...over,
});
const job = (step: string) => ({ catalogId: 'c', entityId: 'e1', step, tier: 'L3' as const });

describe('entityDrainOutcome — the per-entity coach drain reports what happened', () => {
  it('ok: a failed gate carries its own reason and the jump index in THIS entity\'s step list', () => {
    const out = entityDrainOutcome(steps, {
      kind: 'ok',
      summary: summary({ ran: 1, failed: 1, results: [{ job: job('Test Gate'), verdict: { status: 'fail', detail: 'X' } }] }),
    });
    expect(out).toMatchObject({ state: 'ran', failed: 1, fails: [{ step: 'Test Gate', index: 1, reason: 'X' }] });
  });

  it('ok but nothing ran (ran 0, skipped > 0): names the UE bridge / running editor, never "0 passed · 0 failed"', () => {
    const out = entityDrainOutcome(steps, { kind: 'ok', summary: summary({ skipped: 2 }) });
    expect(out.state).toBe('ran-nothing');
    expect(out.message).toMatch(/UE editor/);
    expect(out.message).toMatch(/bridge/);
    expect(out.message).not.toMatch(/0 passed/);
    expect(out.retryable).toBe(true);
  });

  it('locked (409): refused, quoting the server\'s own reason, retryable', () => {
    const reason = 'drain already in flight for items/item-3 — refusing to overlap';
    const out = entityDrainOutcome(steps, { kind: 'locked', reason });
    expect(out.state).toBe('refused');
    expect(out.message).toContain(reason);
    expect(out.retryable).toBe(true);
  });

  it('error: the reason is shown, retryable', () => {
    const out = entityDrainOutcome(steps, { kind: 'error', reason: 'boom' });
    expect(out.state).toBe('error');
    expect(out.message).toContain('boom');
    expect(out.retryable).toBe(true);
  });

  it('ok with screenshots: the frames are carried verbatim for DrainFrameLinks', () => {
    const out = entityDrainOutcome(steps, {
      kind: 'ok',
      summary: summary({ ran: 1, passed: 1, screenshots: ['gate-a.png'], results: [{ job: job('Test Gate'), verdict: { status: 'pass', detail: 'ok' } }] }),
    });
    expect(out.frames).toEqual(['gate-a.png']);
  });

  it('a missing response (a mocked client resolving null/undefined) maps to an error, never a throw', () => {
    expect(entityDrainOutcome(steps, null).state).toBe('error');
    expect(entityDrainOutcome(steps, undefined).state).toBe('error');
  });
});
