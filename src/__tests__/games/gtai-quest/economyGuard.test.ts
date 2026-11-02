import { describe, expect, it } from 'vitest';
import { assessEconomy } from '@/lib/games/gtai-quest/economyGuard';
import { CLEAN, ctx, mutate } from '@/__tests__/games/gtai-quest/fixtures';
import type { QuestDesign } from '@/lib/games/gtai-quest/types';

const run = (d: QuestDesign) => assessEconomy(d, ctx());
const find = (d: QuestDesign, code: string) => run(d).findings.find((f) => f.code === code);

describe('assessEconomy', () => {
  it('the clean fixture is green; only the info sink-context finding', () => {
    const v = run(CLEAN);
    expect(v.state).toBe('green');
    expect(v.basis).toBe('quest-economy.json r1 (provisional)');
    expect(v.findings.map((f) => [f.code, f.severity])).toEqual([['CASH_VS_SOUL_UPGRADE', 'info']]);
    expect(v.findings[0].message).toContain('0.75 x the cheapest soul-upgrade tier (2000)');
  });

  it('is unmeasured (never green, never red) without a table', () => {
    const v = assessEconomy(CLEAN, ctx({ economy: null }));
    expect(v.state).toBe('unmeasured');
    expect(v.findings).toEqual([]);
  });

  it('CASH_OUT_OF_BAND is warn within 25% of the bound, error beyond', () => {
    expect(find(mutate((d) => { d.reward.cash = 2800; }), 'CASH_OUT_OF_BAND')?.severity).toBe('warn');
    expect(find(mutate((d) => { d.reward.cash = 400; }), 'CASH_OUT_OF_BAND')?.severity).toBe('warn');
    expect(find(mutate((d) => { d.reward.cash = 5000; }), 'CASH_OUT_OF_BAND')?.severity).toBe('error');
    expect(find(mutate((d) => { d.reward.cash = 100; }), 'CASH_OUT_OF_BAND')?.severity).toBe('error');
    expect(find(CLEAN, 'CASH_OUT_OF_BAND')).toBeUndefined();
  });

  const cases: [string, 'error' | 'warn', QuestDesign][] = [
    ['HEAT_OVER_CEILING', 'error', mutate((d) => { d.difficulty.heatPeak = 4; })],
    ['ENEMIES_OVER_BUDGET', 'error', mutate((d) => { d.difficulty.enemyCount = 30; })],
    ['WAVES_OVER_BUDGET', 'error', mutate((d) => { d.difficulty.enemyWaves = 4; })],
    ['TIMER_NOT_ALLOWED', 'error', mutate((d) => { d.act = 'clock-out'; d.reward.cash = 100; })],
    ['MINUTES_OUT_OF_BAND', 'warn', mutate((d) => { d.difficulty.minutes = 30; })],
    ['NO_FAIL_STATE', 'error', mutate((d) => { d.difficulty.failStates = []; })],
    ['SOUL_UNLOCK_WRONG_ACT', 'error', mutate((d) => { d.reward.unlocks.push('soul:sentry'); })],
  ];
  it.each(cases)('%s fires as %s on its mutation and not on the clean fixture', (code, severity, d) => {
    expect(find(d, code)?.severity).toBe(severity);
    expect(find(CLEAN, code)).toBeUndefined();
    expect(run(d).state).toBe(severity === 'error' ? 'red' : 'green');
  });

  it('lets an act unlock its own soul', () => {
    expect(find(mutate((d) => { d.reward.unlocks.push('soul:gearbox'); }), 'SOUL_UNLOCK_WRONG_ACT')).toBeUndefined();
    const act4 = mutate((d) => { d.act = 'act4'; d.reward.cash = 6000; d.reward.unlocks.push('soul:soul-4'); });
    expect(find(act4, 'SOUL_UNLOCK_WRONG_ACT')).toBeUndefined();
  });
});
