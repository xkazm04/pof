import { describe, expect, it } from 'vitest';
import {
  distributedPackExchange,
  distributedPackSpellAreaExchange,
  expectedPackSize,
  expectedSpellPackCoverage,
  ordinaryPackSizeDistribution,
  packExchange,
  rangedPackApproachExchange,
  requestedUniquePackSize,
} from '@/lib/catalog/reference/packMath';

describe('simultaneous pack arithmetic', () => {
  const inventedDuel = {
    secondsToKill: 10,
    expectedDamageTaken: 2,
    expectedGotHitInterruptions: 0,
    hitRecoverySeconds: 0.25,
    ranged: false,
  };

  it('sums a hand-computed three-monster pack over the alive attackers', () => {
    const result = packExchange({ ...inventedDuel, packSize: 3, adjacentSlots: 8 });

    expect(result.phases.map((phase) => phase.engagedAttackers)).toEqual([3, 2, 1]);
    expect(result.seconds).toBe(30);
    expect(result.expectedDamageTaken).toBe(2 * (3 + 2 + 1));
  });

  it('makes one adjacent slot equal the same number of sequential duels', () => {
    const pack = packExchange({ ...inventedDuel, packSize: 3, adjacentSlots: 1 });
    const oneDuel = packExchange({ ...inventedDuel, packSize: 1, adjacentSlots: 1 });

    expect(pack.seconds).toBe(3 * oneDuel.seconds);
    expect(pack.expectedDamageTaken).toBe(3 * oneDuel.expectedDamageTaken);
  });

  it('caps melee at the two-slot corridor while ranged survivors ignore melee slots', () => {
    const corridor = packExchange({ ...inventedDuel, packSize: 3, adjacentSlots: 2 });
    const ranged = packExchange({ ...inventedDuel, packSize: 3, adjacentSlots: 1, ranged: true });

    expect(corridor.phases.map((phase) => phase.engagedAttackers)).toEqual([2, 2, 1]);
    expect(ranged.phases.map((phase) => phase.engagedAttackers)).toEqual([3, 2, 1]);
  });

  it('integrates qualifying-hit recovery with the documented closed form', () => {
    const result = packExchange({
      ...inventedDuel,
      packSize: 1,
      expectedGotHitInterruptions: 0.5,
      hitRecoverySeconds: 4,
    });

    // Recovery load = .5*4/10=.2, so T=10/(1-.2), D=2/(1-.2), I=.5/(1-.2).
    expect(result.seconds).toBe(12.5);
    expect(result.expectedDamageTaken).toBe(2.5);
    expect(result.expectedGotHitInterruptions).toBe(0.625);
  });

  it('focuses closing members at their current distances and removes pre-contact kills', () => {
    const result = rangedPackApproachExchange({
      packSize: 3,
      contactDuel: inventedDuel,
      contactPlayerActionsToKill: 2,
      engagementDistance: 5,
      approachTilesPerSecond: 1,
      playerActionSeconds: 1,
      expectedActionsToKillAtDistance: () => 2,
    });

    expect(result.approach).toMatchObject({
      seconds: 4,
      playerActions: 4,
      membersKilled: 2,
      survivingMembers: 1,
      shotDistances: [4, 3, 2, 1],
    });
    expect(result.contact?.packSize).toBe(1);
    expect(result.seconds).toBe(14);
    expect(result.expectedDamageTaken).toBe(2);
  });

  it('charges named retreat-step time while melee members still approach', () => {
    const result = rangedPackApproachExchange({
      packSize: 1,
      contactDuel: inventedDuel,
      contactPlayerActionsToKill: 1,
      engagementDistance: 3,
      approachTilesPerSecond: 1,
      playerActionSeconds: 0.5,
      expectedActionsToKillAtDistance: () => 2,
      kite: 'step-back-after-action',
      kiteStepSeconds: 0.25,
      kiteStepTiles: 1,
    });

    expect(result.approach.retreatSteps).toBe(1);
    expect(result.approach.retreatSeconds).toBe(0.25);
    expect(result.approach.membersKilled).toBe(1);
    expect(result.contact).toBeNull();
    expect(result.seconds).toBe(1.25);
  });

  it('starts a homogeneous ranged pack exchange at t=0 instead of granting an approach', () => {
    const result = rangedPackApproachExchange({
      packSize: 2,
      contactDuel: { ...inventedDuel, ranged: true },
      contactPlayerActionsToKill: 1,
      engagementDistance: 4,
      approachTilesPerSecond: null,
      playerActionSeconds: 1,
      expectedActionsToKillAtDistance: () => 1,
    });

    expect(result.approach).toMatchObject({ seconds: 0, playerActions: 0, survivingMembers: 2 });
    expect(result.contact?.phases.map((phase) => phase.engagedAttackers)).toEqual([2, 1]);
  });

  it('averages exact placement branches and groups a unique with its minions', () => {
    expect(expectedPackSize(ordinaryPackSizeDistribution(1))).toBe(1);
    expect(expectedPackSize(ordinaryPackSizeDistribution(2))).toBe(1.75);
    expect(expectedPackSize(ordinaryPackSizeDistribution(3))).toBe(2.5);
    expect(requestedUniquePackSize('None')).toBe(1);
    expect(requestedUniquePackSize('Leashed')).toBe(9);
    expect(distributedPackExchange(ordinaryPackSizeDistribution(3), inventedDuel, 1))
      .toMatchObject({ expectedPackSize: 2.5, expectedDamageTakenPerPack: 5 });
  });

  it('names compact-ring line, blast, wave, and full-ring coverage', () => {
    expect(expectedSpellPackCoverage('aimed-line', 1, 5, 8).expectedTargetsAffected).toBe(1 + 4 / 7);
    expect(expectedSpellPackCoverage('impact-3x3', 1, 5, 8).expectedTargetsAffected).toBe(1 + 8 / 7);
    expect(expectedSpellPackCoverage('widening-wave', 1, 5, 8).expectedTargetsAffected).toBe(1 + 16 / 7);
    expect(expectedSpellPackCoverage('seeking-radius', 1, 5, 8).expectedTargetsAffected).toBe(5);
    expect(expectedSpellPackCoverage('seeking-radius', 1, 5, 2).expectedTargetsAffected).toBe(2);
  });

  it('advances every covered member and suppresses pack attacks during monster GotHit', () => {
    const result = distributedPackSpellAreaExchange([{ size: 3, probability: 1 }], {
      ...inventedDuel,
      expectedDamageTaken: 0,
      spellArea: {
        spell: 'ChainLightning',
        spellLevel: 1,
        geometry: 'seeking-radius',
        expectedPrimaryDamagePerCast: 10,
        expectedSecondaryDamagePerCast: 5,
        primaryCollisionChecksPerCast: 12,
        secondaryCollisionChecksPerCast: 6,
        expectedPrimaryActionsToKill: 10,
        expectedPrimaryRecoveryStartsBeforeKill: 10,
        expectedSecondaryRecoveryStartsPerCast: 1,
        monsterRecoverySeconds: 1,
        baseDamageTakenPerSecond: 2,
        baseGotHitInterruptionsPerSecond: 0.4,
        manaPerCast: 4,
      },
    });

    // Focus work is 10 + 5 + 2.5 casts because each sought secondary gets half primary damage.
    expect(result.expectedCastsPerPack).toBe(17.5);
    expect(result.secondsPerPack).toBeCloseTo(17.5 / (1 - 0.4 * inventedDuel.hitRecoverySeconds), 12);
    expect(result.expectedDamageTakenPerPack).toBeCloseTo(2 * result.secondsPerPack, 12);
    expect(result.expectedAttackersSuppressedPerCast).toBeGreaterThan(1);
    expect(result.expectedTargetsAffectedPerCast).toBeGreaterThan(2);
  });
});
