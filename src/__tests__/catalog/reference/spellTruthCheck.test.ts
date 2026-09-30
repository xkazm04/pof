import { describe, expect, it } from 'vitest';

import {
  spellTruthCheck,
  type SpellTruthCheckData,
} from '@/lib/catalog/reference/spellTruthCheck';
import type { SpellCastLedger } from '@/lib/catalog/reference/spellCastLedger';
import type { MissileBehaviourSpecData } from '@/lib/catalog/reference/missileSpecs';
import type { PlayerSpellHitSource } from '@/lib/catalog/reference/playerSpellHits';

const ref = '.reference/synthetic/engine.cpp:10-20';

const ledger: SpellCastLedger = {
  spell: 'SyntheticTruth',
  expansion: 'diablo',
  initialMissiles: ['SyntheticCarrier'],
  spawnedMissiles: [],
  manaCost: {
    formula: 'Q*13+7',
    engineFormula: 'Q*13+7',
    symbols: { Q: 'synthetic rank' },
    refs: [ref],
  },
  durationRule: '37',
  sourceRules: [],
  steps: [
    { phase: 'check', what: 'Synthetic request gate.', refs: [ref] },
    {
      phase: 'add',
      what: 'AddMissile creates the carrier within radius 11 before payment.',
      branches: [{
        condition: 'The initial AddMissile returns null because the synthetic pool is full.',
        outcome: 'Payment is skipped.',
        resource: 'free',
        setsSpellFizzled: true,
        refs: [ref],
      }],
      refs: [ref],
    },
    { phase: 'consume', what: 'Consume the resource after AddMissile succeeds.', refs: [ref] },
    { phase: 'process', what: 'The carrier harms either side, persists, and rechecks its tile.', hitResult: 'persists-and-rechecks', refs: [ref] },
    { phase: 'end', what: 'The carrier ends at duration zero.', refs: [ref] },
  ],
  refs: [ref],
};

const missile: MissileBehaviourSpecData = {
  addFn: 'AddSyntheticCarrier',
  processFn: 'ProcessSyntheticCarrier',
  missileIds: ['SyntheticCarrier'],
  movement: 'Stationary.',
  speed: 'No velocity.',
  lifetime: '37 ticks maximum.',
  collision: 'Blockable; requires line of sight within radius 11.',
  damageSource: 'Q+13 damage.',
  refs: [ref],
};

const hits: PlayerSpellHitSource = {
  spell: 'SyntheticTruth',
  kind: 'wall-segment',
  collisionChecks: '2*Q+13',
  damageRoll: 'once-per-segment',
  collisionDamage: 'already-shifted-fixed-point',
  hitResult: 'persists-and-rechecks',
  stationaryGeometry: 'One synthetic tile.',
  refs: [ref],
};

const data: SpellTruthCheckData = {
  ledgers: [ledger],
  missileSpecs: [missile],
  hitSources: [hits],
  fizzleBranches: [],
  damageUnitsLaws: [],
};

function verdicts(artifact: unknown) {
  return spellTruthCheck('d1-SyntheticTruth', artifact, data);
}

describe('spellTruthCheck', () => {
  it('decides supported synthetic field semantics from structured rows', () => {
    const checks = verdicts({
      manaCost: 'Q*13+7',
      paymentRule: 'Initial missile creation happens before resource payment.',
      allocationFailure: 'If the initial missile allocation returns null, payment is skipped and the cast is free.',
      failureBranch: {
        condition: 'The initial AddMissile returns null because the synthetic pool is full.',
        resource: 'free',
      },
      damageFormula: 'Q+13 damage',
      lifetime: '37 ticks maximum',
      damageRoll: 'once-per-segment',
      collisionDamage: 'already-shifted-fixed-point',
      hitResult: 'persists-and-rechecks',
      blockable: true,
      requiresLoS: true,
      searchRadius: 11,
      targetFactionEligibility: 'either side',
    });

    const decided = checks.filter((check) => check.verdict !== 'undecidable');
    expect(decided.length).toBeGreaterThanOrEqual(10);
    expect(decided.every((check) => check.verdict === 'agrees')).toBe(true);
    expect(decided.every((check) => check.ref === ref)).toBe(true);
  });

  it('contradicts explicit synthetic values that oppose the engine rows', () => {
    const checks = verdicts({
      manaRule: 'The cast always pays a fixed 5 mana.',
      failureRule: 'Initial missile allocation returns null, but mana is consumed.',
      lifetime: '99 ticks maximum',
      damageRoll: 'The segment rerolls its damage every tick.',
      collisionDamage: 'whole hit points',
      blockable: false,
      requiresLoS: false,
      searchRadius: 3,
    });

    const fields = new Set(checks.filter((check) => check.verdict === 'contradicts').map((check) => check.field));
    expect([...fields]).toEqual(expect.arrayContaining([
      'manaCost.rule',
      'fizzle.resource',
      'duration.rule',
      'hits.damageRoll',
      'damage.units',
      'damage.blockable',
      'targeting.requiresLineOfSight',
      'targeting.range',
    ]));
  });

  it('keeps unmatched fields and unknown spell entities undecidable', () => {
    expect(verdicts({ loreMood: 'mysterious' })).toEqual([
      expect.objectContaining({ field: 'loreMood', verdict: 'undecidable' }),
    ]);
    expect(spellTruthCheck('d1-UnknownSynthetic', { manaCost: 4 }, data)).toEqual([
      expect.objectContaining({ field: 'manaCost', verdict: 'undecidable', engine: '(no spell cast ledger)' }),
    ]);
  });

  it('uses the injected damage-units law when no per-hit row exists', () => {
    const lawOnlyData: SpellTruthCheckData = {
      ...data,
      hitSources: [],
      damageUnitsLaws: [{
        body: 'SyntheticTruth moving carriers deal whole HP and are blockable.',
        refs: [ref],
      }],
    };
    expect(spellTruthCheck('SyntheticTruth', { damageUnits: 'whole hit points' }, lawOnlyData)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'damage.units', verdict: 'agrees', ref }),
    ]));
    expect(spellTruthCheck('SyntheticTruth', {
      rounding: 'Fractional outcomes remain representable after the whole hit enters internal fixed-point.',
    }, lawOnlyData).every((check) => check.verdict === 'undecidable')).toBe(true);
  });
});
