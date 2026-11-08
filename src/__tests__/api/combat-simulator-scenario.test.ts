/**
 * POST /api/combat-simulator `simulate` — the player half of `scenario`.
 *
 * The route validated `scenario.enemies` only. A scripted/MCP caller that omitted `playerGear`
 * crashed the engine (`scenario.playerGear.bonuses`) and got a 500; a non-numeric `playerLevel`
 * also reached the engine. The player fields are now checked at the same boundary as enemies:
 * gear must be an object whose `bonuses` are finite numbers, abilities an array, and the level
 * is clamped like every other numeric input. Each refusal is a 400 naming the field.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/combat-simulator/route';
import { ENEMY_ARCHETYPES, GEAR_LOADOUTS, PLAYER_ABILITIES } from '@/lib/combat/definitions';

const base = {
  name: 's', playerLevel: 5, playerGear: GEAR_LOADOUTS[0], playerAbilities: PLAYER_ABILITIES,
  enemies: [{ archetypeId: ENEMY_ARCHETYPES[0].id, count: 1, level: 1 }],
};

const simulate = (scenario: unknown) =>
  POST(new NextRequest('http://localhost/api/combat-simulator', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'simulate', scenario, config: { iterations: 10, seed: 1 } }),
  }));

describe('combat-simulator scenario (player fields)', () => {
  it.each([
    ['playerGear', { ...base, playerGear: undefined }],
    ['playerGear', { ...base, playerGear: 'sword' }],
    ['playerGear', { ...base, playerGear: { id: 'g', name: 'g' } }],
    ['playerGear', { ...base, playerGear: { id: 'g', name: 'g', bonuses: { armor: 'lots' } } }],
    ['playerAbilities', { ...base, playerAbilities: undefined }],
    ['playerAbilities', { ...base, playerAbilities: 'slash' }],
  ])('refuses a malformed %s with 400 naming it', async (field, scenario) => {
    const res = await simulate(scenario);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(field);
  });

  it('coerces a non-numeric playerLevel instead of running the engine on it', async () => {
    const res = await simulate({ ...base, playerLevel: 'x' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.result.scenario.playerLevel).toBe(1);
    expect(Number.isFinite(json.data.result.summary.avgPlayerHealthRemaining)).toBe(true);
  });

  it('clamps an out-of-range playerLevel', async () => {
    const res = await simulate({ ...base, playerLevel: 1e9 });
    expect(res.status).toBe(200);
    expect((await res.json()).data.result.scenario.playerLevel).toBe(50);
  });

  it('runs a well-formed scenario unchanged', async () => {
    const res = await simulate(base);
    expect(res.status).toBe(200);
    expect((await res.json()).data.result.scenario.playerLevel).toBe(5);
  });
});
