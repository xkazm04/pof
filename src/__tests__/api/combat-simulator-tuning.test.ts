/**
 * POST /api/combat-simulator `simulate` — the `tuning` body field.
 *
 * The route spread `body.tuning` over DEFAULT_TUNING unchecked. A non-numeric
 * multiplier (`playerHealthMul: "abc"`) produced NaN health inside the engine and the
 * route answered 200 with a "result" of 0% survival, 120 s fights and a null
 * remaining-health — a fabricated verdict that reads as a lethal encounter. `config`
 * fields were already coerced (`clampInt`); tuning now gets the same trust boundary:
 * a non-finite value for a known multiplier is a 400 naming it, a `null` keeps the
 * default, and unknown keys never reach the engine.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/combat-simulator/route';
import { ENEMY_ARCHETYPES, GEAR_LOADOUTS, PLAYER_ABILITIES, DEFAULT_TUNING } from '@/lib/combat/definitions';

const scenario = {
  name: 's', playerLevel: 5, playerGear: GEAR_LOADOUTS[0], playerAbilities: PLAYER_ABILITIES,
  enemies: [{ archetypeId: ENEMY_ARCHETYPES[0].id, count: 1, level: 1 }],
};

const simulate = (tuning: unknown) =>
  POST(new NextRequest('http://localhost/api/combat-simulator', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'simulate', scenario, tuning, config: { iterations: 20, seed: 1 } }),
  }));

describe('combat-simulator tuning', () => {
  it.each([
    ['playerHealthMul', 'abc'],
    ['enemyDamageMul', '1.5x'],
    ['healingMul', {}],
  ])('refuses a non-numeric %s with 400 naming it', async (key, value) => {
    const res = await simulate({ [key]: value });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain(key);
  });

  it('refuses a non-object tuning with 400', async () => {
    const res = await simulate('hard');
    expect(res.status).toBe(400);
  });

  it('answers a null multiplier and unknown keys with the default run', async () => {
    const base = await (await simulate({})).json();
    const res = await simulate({ enemyDamageMul: null, notATuningKey: 99 });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.result.summary).toEqual(base.data.result.summary);
    expect(Object.keys(json.data.result.tuning).sort()).toEqual(Object.keys(DEFAULT_TUNING).sort());
  });

  it('still applies a numeric multiplier', async () => {
    const res = await simulate({ playerHealthMul: 2 });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.result.tuning.playerHealthMul).toBe(2);
    expect(Number.isFinite(json.data.result.summary.avgPlayerHealthRemaining)).toBe(true);
  });
});
