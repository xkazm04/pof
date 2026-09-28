import { describe, expect, it } from 'vitest';
import {
  D1_MISSILE_BEHAVIOUR_GRAPHS,
  MISSILE_BEHAVIOUR_GRAPH_FINDINGS,
  auditMissileBehaviourGraphs,
  missileBehaviourGraph,
  missileBehaviourGraphsForSpell,
  resolveMissileKinetics,
} from '@/lib/catalog/reference/missileBehaviourGraphs';
import { SPELL_CAST_LEDGERS } from '@/lib/catalog/reference/spellCastLedger';

describe('missile behaviour graphs', () => {
  it('covers every initial and spawned player-spell missile with structurally valid refs', () => {
    const required = new Set(SPELL_CAST_LEDGERS.flatMap((ledger) => [
      ...ledger.initialMissiles,
      ...ledger.spawnedMissiles,
    ]));
    expect(new Set(D1_MISSILE_BEHAVIOUR_GRAPHS.map((graph) => graph.missile))).toEqual(required);

    for (const graph of D1_MISSILE_BEHAVIOUR_GRAPHS) {
      const stateIds = new Set(graph.states.map((state) => state.id));
      expect(stateIds.has(graph.initialState)).toBe(true);
      for (const state of graph.states) expect(state.refs.length).toBeGreaterThan(0);
      for (const edge of graph.transitions) {
        expect(stateIds.has(edge.from)).toBe(true);
        expect(stateIds.has(edge.nextState)).toBe(true);
        expect(edge.refs.length).toBeGreaterThan(0);
      }
      for (const check of graph.geometryChecks) expect(check.refs.length).toBeGreaterThan(0);
    }
  });

  it('keeps the three audited residual state machines explicit', () => {
    const elemental = missileBehaviourGraph('Elemental')!;
    expect(elemental.transitions.some((edge) => edge.trigger === 'position-reached'
      && edge.nextState === 'retarget-search')).toBe(true);
    expect(elemental.transitions.some((edge) => edge.trigger === 'target-none'
      && edge.effect.includes('caster current facing'))).toBe(true);

    const fireball = missileBehaviourGraph('Fireball')!;
    expect(fireball.geometryChecks.some((check) => check.origin === 'start-position'
      && check.check.includes('blast visibility'))).toBe(true);

    const fireWall = missileBehaviourGraph('FireWallControl')!;
    expect(fireWall.geometryChecks.map((check) => check.origin)).toEqual([
      'clicked-point', 'caster', 'corrected-point',
    ]);
    expect(fireWall.transitions.some((edge) => edge.effect.includes('11 ordinary anchors'))).toBe(true);
  });

  it('evaluates speed in tiles per tick and level-dependent missile lifetimes', () => {
    expect(resolveMissileKinetics('Firebolt', 1, 1)).toMatchObject({
      speed: { tilesPerTick: 1.125 }, lifetime: { ticks: 256, kind: 'maximum' },
    });
    expect(resolveMissileKinetics('Firebolt', 15, 1).speed.tilesPerTick).toBe(2.875);
    expect(resolveMissileKinetics('Lightning', 1, 1).lifetime.ticks).toBe(6);
    expect(resolveMissileKinetics('Lightning', 15, 1).lifetime.ticks).toBe(13);
    expect(resolveMissileKinetics('FireWall', 1, 1).lifetime.ticks).toBe(320);
    expect(resolveMissileKinetics('FireWall', 15, 1).lifetime.ticks).toBe(2560);
    expect(resolveMissileKinetics('FlameWave', 15, 1).lifetime).toMatchObject({
      ticks: null, kind: 'sentinel',
    });
  });

  it('agrees with the older datasets once the W96 findings were corrected (Flame Wave sentinel, Fireball blast trigger)', () => {
    expect(MISSILE_BEHAVIOUR_GRAPH_FINDINGS).toEqual([]);
    const graphs = [missileBehaviourGraph('FlameWave')!, missileBehaviourGraph('Fireball')!];
    expect(auditMissileBehaviourGraphs(
      graphs,
      [{ missileIds: ['FlameWave'], lifetime: '255 is a non-decrementing sentinel', refs: ['synthetic:1'] }],
      [{ spell: 'Fireball', collisionChecks: 'actor collision, wall, or expiry', refs: ['synthetic:2'] }],
    )).toEqual([]);
  });

  it('returns graphs in each spell ledger chain', () => {
    expect(missileBehaviourGraphsForSpell('Guardian').map((graph) => graph.missile)).toEqual([
      'Guardian', 'Firebolt', 'MagmaBallExplosion',
    ]);
    expect(missileBehaviourGraphsForSpell('Resurrect').map((graph) => graph.missile)).toEqual([
      'Resurrect', 'ResurrectBeam',
    ]);
  });
});
