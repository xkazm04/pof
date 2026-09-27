import { describe, expect, it } from 'vitest';
import {
  distributedPackExchange,
  expectedPackSize,
  ordinaryPackSizeDistribution,
  packExchange,
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

  it('averages exact placement branches and groups a unique with its minions', () => {
    expect(expectedPackSize(ordinaryPackSizeDistribution(1))).toBe(1);
    expect(expectedPackSize(ordinaryPackSizeDistribution(2))).toBe(1.75);
    expect(expectedPackSize(ordinaryPackSizeDistribution(3))).toBe(2.5);
    expect(requestedUniquePackSize('None')).toBe(1);
    expect(requestedUniquePackSize('Leashed')).toBe(9);
    expect(distributedPackExchange(ordinaryPackSizeDistribution(3), inventedDuel, 1))
      .toMatchObject({ expectedPackSize: 2.5, expectedDamageTakenPerPack: 5 });
  });
});
