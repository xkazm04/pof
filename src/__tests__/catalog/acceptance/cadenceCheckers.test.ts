// /diablo W12 (D4): a cooldown is optional when a RESOURCE gates the ability (Diablo I has none — mana and the cast
// animation limit casting), and Balance's hit rate comes from the limiter that binds, not a quoted cooldown.
import { describe, it, expect } from 'vitest';
import { cooldownOrResourceGate, hitRateFromLimiter } from '@/lib/catalog/acceptance/cadenceCheckers';
import { arithmeticReconciles } from '@/lib/catalog/acceptance/invariants';
import { requiredFieldsOf } from '@/lib/catalog/acceptance/requiredFields';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

const gate = cooldownOrResourceGate('effect', 'Cast gate');
const rate = hitRateFromLimiter('balance', 'hitDPS from the binding limiter');

describe('cooldownOrResourceGate', () => {
  it('passes a cooldown ability exactly as before', () => {
    expect(gate({ effect: { cooldown: 3, manaCost: 20 } }).status).toBe('pass');
  });
  it('passes a resource-gated ability that declares it', () => {
    expect(gate({ effect: { manaCost: 6, gatedBy: 'resource' } }).status).toBe('pass');
    expect(gate({ effect: { cooldown: 0, manaCost: 6, gatedBy: 'resource' } }).status).toBe('pass');
  });
  it('holds a FORGOTTEN cooldown — no declaration, no pass, even with a mana cost', () => {
    const r = gate({ effect: { manaCost: 6 } });
    expect(r.status).toBe('pending');
    expect(r.reason).toMatch(/missing: cooldown/);
  });
  it('holds a resource gate with no cost, a declared-gap cooldown, and a non-positive cooldown', () => {
    expect(gate({ effect: { gatedBy: 'resource' } }).status).toBe('pending');
    expect(gate({ effect: { cooldown: REFERENCE_GAP, manaCost: 6 } }).status).toBe('pending');
    expect(gate({ effect: { cooldown: -1, manaCost: 6 } }).status).toBe('pending');
  });
  it('tells the producer both ways', () => {
    const shape = requiredFieldsOf(gate).find((r) => r.field === 'effect')?.shape ?? '';
    expect(shape).toMatch(/gatedBy/);
  });
});

describe('hitRateFromLimiter', () => {
  const fireball = { balance: { baseDamage: 35, cooldown: 3, hitDPS: 11.667 } };
  it('grades a cooldown-only artifact exactly as hitDPS = baseDamage / cooldown did', () => {
    const old = arithmeticReconciles('balance', { result: 'hitDPS', op: 'quotient', operands: ['baseDamage', 'cooldown'] }, 'old');
    expect(rate(fireball).status).toBe('pass');
    expect(old(fireball).status).toBe('pass');
    const wrong = { balance: { ...fireball.balance, hitDPS: 20 } };
    expect(rate(wrong).status).toBe('fail');
    expect(old(wrong).status).toBe('fail');
  });
  it('uses the mana sustain interval when it binds, not the cast time', () => {
    // 6 mana / 2 per s = 3 s between casts; a 0.45 s cast animation does not bind.
    const b = { baseDamage: 12, castTime: 0.45, manaCost: 6, manaRegenPerSec: 2 };
    expect(rate({ balance: { ...b, hitDPS: 4 } }).status).toBe('pass');
    const quoted = rate({ balance: { ...b, hitDPS: 26.667 } }); // 12 / 0.45 — the constant, not the mechanism
    expect(quoted.status).toBe('fail');
    expect(quoted.reason).toMatch(/manaCost 6 \/ regen 2/);
  });
  it('holds the declared limiter to the one that binds', () => {
    const r = rate({ balance: { baseDamage: 12, castTime: 0.45, manaCost: 6, manaRegenPerSec: 2, hitDPS: 4, limiter: 'castTime' } });
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/limiter says "castTime"/);
  });
  it('holds an artifact with no limiter at all', () => {
    expect(rate({ balance: { baseDamage: 12, hitDPS: 4 } }).status).toBe('pending');
  });
});
