import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_ITEM_ECON_CONFIG, runItemEconomySim } from '@/lib/economy/item-economy-engine';
import { createSession, reduceSession, evidenceLevel } from '@/lib/economy/item-economy-session';
import { useItemEconomySessionStore } from '@/stores/itemEconomySessionStore';
import { buildBalancePrompt } from '@/components/modules/core-engine/sub_inventory/_shared/balance-prompt';

const cfg = { ...DEFAULT_ITEM_ECON_CONFIG, playerCount: 40 };

describe('reduceSession', () => {
  it('start from idle keeps config, retains the previous result, never carries an error', () => {
    const prev = runItemEconomySim(cfg);
    const failed = { ...createSession(cfg), status: 'error' as const, error: 'x', result: prev };
    const s = reduceSession(failed, { type: 'start' });
    expect(s.status).toBe('running');
    expect(s.error).toBeNull();
    expect(s.config).toBe(cfg);
    expect(s.result).toBe(prev);
  });

  it('finish stores the result and increments runId; a stale runId changes nothing', () => {
    const running = reduceSession(createSession(cfg), { type: 'start' });
    const result = runItemEconomySim(cfg);
    const done = reduceSession(running, { type: 'finish', runId: 0, result });
    expect(done.status).toBe('ready');
    expect(done.result).toBe(result);
    expect(done.runId).toBe(1);
    const again = reduceSession(done, { type: 'start' });
    expect(reduceSession(again, { type: 'finish', runId: 0, result })).toBe(again);
    expect(reduceSession(again, { type: 'fail', runId: 0, message: 'late' })).toBe(again);
  });

  it('fail sets error with the message and keeps the previous result readable', () => {
    const result = runItemEconomySim(cfg);
    const ready = reduceSession(reduceSession(createSession(cfg), { type: 'start' }), { type: 'finish', runId: 0, result });
    const err = reduceSession(reduceSession(ready, { type: 'start' }), { type: 'fail', runId: 1, message: 'boom' });
    expect(err.status).toBe('error');
    expect(err.error).toBe('boom');
    expect(err.result).toBe(result);
  });
});

describe('useItemEconomySessionStore', () => {
  beforeEach(() => useItemEconomySessionStore.getState().reset());

  it('extend on an unsampled-endgame config adopts the covering rung and sets extendNote', () => {
    useItemEconomySessionStore.getState().updateConfig('playerCount', 60);
    useItemEconomySessionStore.getState().run();
    expect(useItemEconomySessionStore.getState().config.maxHours).toBe(80);
    useItemEconomySessionStore.getState().extend();
    const s = useItemEconomySessionStore.getState();
    expect(s.status).toBe('ready');
    expect(s.config.maxHours).toBeGreaterThan(80);
    expect(s.result?.config).toEqual(s.config);
    expect(s.extendNote).toMatch(/^extended to \d+ h/);
  });

  it('feeds the advisor prompt: measured with the run basis, UNMEASURED without', () => {
    expect(buildBalancePrompt([], { sim: useItemEconomySessionStore.getState().result })).toContain('UNMEASURED');
    useItemEconomySessionStore.getState().run();
    const sim = useItemEconomySessionStore.getState().result;
    const prompt = buildBalancePrompt([], { sim, level: evidenceLevel(sim) });
    expect(prompt).toContain('seed 42, 500 players, 80 h');
    expect(prompt).not.toContain('Measured: UNMEASURED');
  });
});
