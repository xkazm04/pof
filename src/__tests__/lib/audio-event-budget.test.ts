import { describe, it, expect } from 'vitest';
import {
  simulateEventBudget,
  crowdedFightScenario,
  eventVoice,
  type BudgetEvent,
} from '@/lib/audio-event-budget';
import { DEFAULT_EVENTS } from '@/components/modules/content/audio/AudioEventCatalog/constants';

/**
 * The budget stress test applies the three rules the generated event router is
 * told to implement (prompts/audio-events.ts: steal lowest priority when the
 * voice limit binds, oldest-steal on per-event overflow, per-event cooldown).
 * Every figure below is hand-checkable.
 */

function evt(over: Partial<BudgetEvent> & { id: string }): BudgetEvent {
  return { name: over.id, category: 'combat', priority: 'normal', concurrency: 4, cooldownMs: 0, ...over };
}

describe('simulateEventBudget — the three router rules', () => {
  it('cooldown gate: 10 triggers/s against a 200 ms cooldown starts 5 and cools 5', () => {
    const run = simulateEventBudget({
      events: [evt({ id: 'e', cooldownMs: 200, concurrency: 4, priority: 'normal' })],
      voiceLimit: 16,
      voices: { e: { clipMs: 50, loopable: false } },
      scenario: { durationMs: 1000, triggers: { e: { perSecond: 10 } } },
    });
    const row = run.byId.e;
    expect(row.requested).toBe(10);
    expect(row.started).toBe(5);
    expect(row.cooled).toBe(5);
    expect(row.status).toBe('measured');
  });

  it('per-event cap steals the oldest (audio-events.ts oldest-steal rule)', () => {
    const run = simulateEventBudget({
      events: [evt({ id: 'e', concurrency: 2, cooldownMs: 0 })],
      voiceLimit: 16,
      voices: { e: { clipMs: 1000, loopable: false } },
      scenario: { durationMs: 1000, triggers: { e: { at: [0, 10, 20, 30] } } },
    });
    const row = run.byId.e;
    expect(row.started).toBe(4);
    expect(row.cutOldest).toBe(2);
    expect(row.peakVoices).toBe(2);
  });

  it('global limit steals the lowest-priority voice for a higher-priority trigger', () => {
    const run = simulateEventBudget({
      events: [
        evt({ id: 'low', priority: 'low', concurrency: 2 }),
        evt({ id: 'crit', priority: 'critical', concurrency: 1 }),
      ],
      voiceLimit: 2,
      voices: { low: { clipMs: 100, loopable: true }, crit: { clipMs: 100, loopable: false } },
      scenario: { durationMs: 1000, triggers: { low: { at: [0, 1] }, crit: { at: [10] } } },
    });
    expect(run.byId.crit.started).toBe(1);
    expect(run.byId.low.stolen).toBe(1);
    expect(run.byId.crit.dropped).toBe(0);
    expect(run.byId.low.dropped).toBe(0);
  });

  it('global limit drops a lower-priority trigger when every voice outranks it', () => {
    const run = simulateEventBudget({
      events: [
        evt({ id: 'crit', priority: 'critical', concurrency: 2 }),
        evt({ id: 'low', priority: 'low', concurrency: 1 }),
      ],
      voiceLimit: 2,
      voices: { crit: { clipMs: 100, loopable: true }, low: { clipMs: 100, loopable: false } },
      scenario: { durationMs: 1000, triggers: { crit: { at: [0, 1] }, low: { at: [10] } } },
    });
    expect(run.byId.low.dropped).toBe(1);
    expect(run.byId.low.started).toBe(0);
    expect(run.byId.crit.stolen).toBe(0);
  });

  it('unmeasured is not a pass: not triggered / no clip length never count as clean', () => {
    const run = simulateEventBudget({
      events: [
        evt({ id: 'quiet' }),
        evt({ id: 'unbound' }),
        evt({ id: 'zero' }),
        evt({ id: 'ok', concurrency: 1 }),
      ],
      voiceLimit: 16,
      voices: {
        quiet: { clipMs: 100, loopable: false },
        zero: eventVoice({ assetSetId: 's0' }, { s0: { clipMs: 0, loopable: false } }),
        ok: { clipMs: 100, loopable: false },
      },
      scenario: {
        durationMs: 1000,
        triggers: { quiet: { perSecond: 0 }, unbound: { perSecond: 2 }, zero: { perSecond: 2 }, ok: { perSecond: 2 } },
      },
    });
    expect(run.byId.quiet).toMatchObject({ status: 'not-measured', reason: 'not triggered' });
    expect(run.byId.unbound).toMatchObject({ status: 'not-measured', reason: 'no clip length' });
    expect(run.byId.zero).toMatchObject({ status: 'not-measured', reason: 'no clip length' });
    expect(run.byId.ok.status).toBe('measured');
    expect(run.summary).toMatchObject({ measured: 1, notMeasured: 3, clean: 1 });
  });
});

describe('crowdedFightScenario', () => {
  it('states its rates per category: 8 enemies x 1/s combat, 2/s environment, 0.5/s UI, one music change', () => {
    const s = crowdedFightScenario(DEFAULT_EVENTS);
    expect(s.durationMs).toBe(10_000);
    expect(s.triggers['evt-1']).toEqual({ perSecond: 8 });
    expect(s.triggers['evt-5']).toEqual({ perSecond: 2 });
    expect(s.triggers['evt-8']).toEqual({ perSecond: 0.5 });
    expect(s.triggers['evt-11']).toEqual({ at: [0] });
  });

  it('an unbound default catalog is entirely NOT MEASURED, never clean', () => {
    const run = simulateEventBudget({
      events: DEFAULT_EVENTS, voiceLimit: 16, voices: {}, scenario: crowdedFightScenario(DEFAULT_EVENTS),
    });
    expect(run.summary.clean).toBe(0);
    expect(run.summary.notMeasured).toBe(DEFAULT_EVENTS.length);
  });
});
