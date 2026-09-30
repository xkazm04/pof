/**
 * scan-sweep --challenge (module-topology-graph/B): the Dependencies tab paints a
 * red pill per DIRECT blocker, but what is actually buildable can sit several
 * modules upstream (Hit detection -> Anim Notify classes -> ... ->
 * AARPGCharacterBase). These cases pin the pure build frontier, the unblock
 * preview and the global critical unblocker (pinned to impact-scorer).
 *
 * Each case imports the module lazily so a missing module fails the case, not the file.
 */
import { describe, it, expect } from 'vitest';
import { buildDependencyMap } from '@/lib/feature-definitions';
import { computeImpactScores } from '@/lib/implementation-planner/impact-scorer';
import { isFeatureDone } from '@/lib/constellation/layout';
import type { FeatureStatus } from '@/types/feature-matrix';

const load = () => import('@/lib/topology/unblockFrontier');

/** Independent argmax over computeImpactScores: ready + unbuilt, most direct unblocks, ties by key. */
function scorerArgmax(statusMap: Map<string, string>): string | null {
  const depMap = buildDependencyMap();
  const done = (k: string) => isFeatureDone((statusMap.get(k) ?? 'unknown') as FeatureStatus);
  const doneKeys = new Set([...depMap.keys()].filter(done));
  let best: { key: string; n: number } | null = null;
  for (const [key, score] of computeImpactScores(doneKeys)) {
    if (done(key) || !depMap.get(key)!.deps.every((d) => done(d.key))) continue;
    if (!best || score.directUnblocks > best.n || (score.directUnblocks === best.n && key < best.key)) {
      best = { key, n: score.directUnblocks };
    }
  }
  return best?.key ?? null;
}

describe('unblockFrontier — what to build first', () => {
  it('WASD movement: the not-done prerequisites whose own prerequisites are all done, sorted', async () => {
    const { unblockFrontier } = await load();
    expect(unblockFrontier(new Map(), 'arpg-character::WASD movement')).toEqual([
      'arpg-character::AARPGCharacterBase',
      'arpg-character::Enhanced Input actions',
    ]);
  });

  it('Hit detection: the frontier crosses two module boundaries to AARPGCharacterBase', async () => {
    const { unblockFrontier } = await load();
    // Today's pill names only the direct blocker, two modules away from what is buildable.
    expect(buildDependencyMap().get('arpg-combat::Hit detection')!.deps.map((d) => d.key))
      .toEqual(['arpg-animation::Anim Notify classes']);
    expect(unblockFrontier(new Map(), 'arpg-combat::Hit detection')).toEqual(['arpg-character::AARPGCharacterBase']);
  });

  it('done target -> []; ready unbuilt target -> [target]; an improved prerequisite counts as done', async () => {
    const { unblockFrontier } = await load();
    const base = 'arpg-character::AARPGCharacterBase';
    const player = 'arpg-character::AARPGPlayerCharacter';
    expect(unblockFrontier(new Map([[base, 'implemented']]), base)).toEqual([]);
    expect(unblockFrontier(new Map([[base, 'improved']]), base)).toEqual([]);
    expect(unblockFrontier(new Map(), base)).toEqual([base]);
    expect(unblockFrontier(new Map([[base, 'improved']]), player)).toEqual([player]);
    expect(unblockFrontier(new Map([[base, 'partial']]), player)).toEqual([base]);
  });
});

describe('previewUnblock — what building one feature clears', () => {
  it('AARPGCharacterBase on a fresh project: 180 -> 177 blocked, three features across three modules become ready', async () => {
    const { previewUnblock } = await load();
    expect(previewUnblock(new Map(), 'arpg-character::AARPGCharacterBase')).toEqual({
      blockedBefore: 180,
      blockedAfter: 177,
      newlyReady: [
        'arpg-animation::UARPGAnimInstance',
        'arpg-character::AARPGPlayerCharacter',
        'arpg-gas::AbilitySystemComponent',
      ],
    });
  });
});

describe('clearedEdgeIds — the edges a Build preview lights', () => {
  it('AARPGCharacterBase on a fresh project clears exactly the character -> animation / gas / enemy-ai edges', async () => {
    const { clearedEdgeIds } = await load();
    expect([...clearedEdgeIds(new Map(), 'arpg-character::AARPGCharacterBase')].sort()).toEqual([
      'arpg-character->arpg-animation',
      'arpg-character->arpg-enemy-ai',
      'arpg-character->arpg-gas',
    ]);
    // Combat's edge from character stays blocked: its dependency is another character feature.
    expect(clearedEdgeIds(new Map(), 'arpg-character::AARPGCharacterBase').has('arpg-character->arpg-combat')).toBe(false);
  });
});

describe('criticalUnblocker — the global best next build', () => {
  it('equals the impact-scorer argmax (ready, unbuilt, most direct unblocks, ties by key) and is deterministic', async () => {
    const { criticalUnblocker } = await load();
    const empty = new Map<string, string>();
    expect(criticalUnblocker(empty)).toBe('animations::Custom AnimInstance base');
    expect(criticalUnblocker(empty)).toBe(scorerArgmax(empty));
    expect(criticalUnblocker(empty)).toBe(criticalUnblocker(new Map()));

    // Not a constant: once it is built the pick moves, still tracking the scorer.
    const after = new Map([['animations::Custom AnimInstance base', 'implemented']]);
    expect(criticalUnblocker(after)).not.toBe('animations::Custom AnimInstance base');
    expect(criticalUnblocker(after)).toBe(scorerArgmax(after));
  });
});

describe('unblockFrontier guard', () => {
  it('[guard] a cyclic synthetic depMap terminates and yields [] (visited-set walk)', async () => {
    const { unblockFrontier } = await load();
    const depMap = new Map([
      ['m::a', { deps: [{ key: 'm::b' }] }],
      ['m::b', { deps: [{ key: 'm::a' }] }],
    ]);
    expect(unblockFrontier(new Map(), 'm::a', depMap)).toEqual([]);
  });
});
