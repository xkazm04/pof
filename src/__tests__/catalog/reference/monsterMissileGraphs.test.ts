import { describe, expect, it } from 'vitest';
import {
  D1_MONSTER_MISSILE_BEHAVIOUR_GRAPHS,
  MONSTER_MISSILE_BEHAVIOUR_GRAPH_FINDINGS,
  missileBehaviourGraphsForMonsterRoutine,
  withMonsterMissileGraphs,
} from '@/lib/catalog/reference/missileBehaviourGraphs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

function monsterWrapper(ai: string): ReferenceWrapper {
  return {
    wrapperId: `synthetic:${ai}`,
    sourceId: 'synthetic',
    file: 'monsters/monstdat.tsv',
    technique: 'synthetic',
    key: 'MT_SYNTHETIC',
    keyKind: 'column',
    raw: { _monster_id: 'MT_SYNTHETIC', ai },
    rawHash: 'synthetic',
    catalogId: 'bestiary',
    mappingVersion: 'synthetic',
    entity: {
      id: 'd1-MT_SYNTHETIC',
      catalogId: 'bestiary',
      name: 'Synthetic monster',
      categoryPath: [],
      tags: [ai],
      lifecycle: 'planned',
      data: { existing: true },
      provenance: {
        kind: 'ingest', sourceGame: 'Synthetic', sourceProject: 'Synthetic',
        sourceFile: 'monsters/monstdat.tsv', sourceRow: 'MT_SYNTHETIC',
        licenceNote: 'test fixture', ingestedAt: 'test-time',
      },
    },
  };
}

describe('monster missile behaviour graphs', () => {
  it('keeps every state and transition resolved and every behaviour branch referenced', () => {
    expect(D1_MONSTER_MISSILE_BEHAVIOUR_GRAPHS.length).toBe(22);
    for (const graph of D1_MONSTER_MISSILE_BEHAVIOUR_GRAPHS) {
      const stateIds = new Set(graph.states.map((state) => state.id));
      expect(stateIds.has(graph.initialState), graph.missile).toBe(true);
      expect(graph.refs.length, graph.missile).toBeGreaterThan(0);
      expect(graph.kinetics.length, graph.missile).toBeGreaterThan(0);
      expect(graph.damage.length, graph.missile).toBeGreaterThan(0);
      for (const state of graph.states) expect(state.refs.length, `${graph.missile}/${state.id}`).toBeGreaterThan(0);
      for (const edge of graph.transitions) {
        expect(stateIds.has(edge.from), `${graph.missile}/${edge.from}`).toBe(true);
        expect(stateIds.has(edge.nextState), `${graph.missile}/${edge.nextState}`).toBe(true);
        expect(edge.refs.length, `${graph.missile}/${edge.from}->${edge.nextState}`).toBeGreaterThan(0);
      }
      for (const branch of graph.kinetics) {
        expect(branch.refs.length, `${graph.missile}/${branch.source}`).toBeGreaterThan(0);
        expect(branch.speed.refs.length, `${graph.missile}/${branch.source}/speed`).toBeGreaterThan(0);
        expect(branch.lifetime.refs.length, `${graph.missile}/${branch.source}/lifetime`).toBeGreaterThan(0);
      }
      for (const branch of graph.damage) expect(branch.refs.length, `${graph.missile}/${branch.source}/damage`).toBeGreaterThan(0);
    }
  });

  it('reports the complete Acid impact, splat, shifted puddle chain', () => {
    const graphs = missileBehaviourGraphsForMonsterRoutine('Acid');
    expect(graphs.map((graph) => graph.missile)).toEqual(['Acid', 'AcidSplat', 'AcidPuddle']);
    expect(graphs[0].spawns).toEqual(expect.arrayContaining([expect.objectContaining({ missile: 'AcidSplat' })]));
    expect(graphs[1].spawns).toEqual(expect.arrayContaining([expect.objectContaining({ missile: 'AcidPuddle' })]));
    expect(graphs[2]).toMatchObject({
      speed: { evaluation: 'stationary' },
      lifetime: { evaluation: 'acid-puddle-phases' },
      damage: [expect.objectContaining({
        target: 'AcidPuddle', units: 'fixed-point-1/64-hit-point', isDamageShifted: true,
      })],
    });
    expect(graphs[2].damage[0].landedFloor).toContain('64 internal units');
    expect(graphs[2].transitions.some((edge) => edge.from === 'ending-damage'
      && edge.trigger === 'collision')).toBe(true);
  });

  it('uses the unadjusted normal monster columns for MagmaBall and a visual-only child', () => {
    const graphs = missileBehaviourGraphsForMonsterRoutine('Magma');
    expect(graphs.map((graph) => graph.missile)).toEqual(['MagmaBall', 'MagmaBallExplosion']);
    expect(graphs[0]).toMatchObject({
      speed: { evaluation: 'constant-16' },
      lifetime: { evaluation: 'exact-256' },
      damage: [expect.objectContaining({ units: 'whole-hit-points', isDamageShifted: false })],
    });
    expect(graphs[0].damage[0].formula).toContain('monster.minDamage');
    expect(graphs[0].damage[0].formula).not.toContain('-2');
    expect(graphs[1].damage).toEqual([expect.objectContaining({ source: 'none', units: 'none' })]);
  });

  it('records multi-projectile and source-specific shared-missile branches', () => {
    const counselor = missileBehaviourGraphsForMonsterRoutine('Counselor');
    expect(counselor.find((graph) => graph.missile === 'ChargedBolt')).toMatchObject({ projectilesPerAttack: 3 });
    expect(counselor.find((graph) => graph.missile === 'Firebolt')?.kinetics.map((branch) => branch.source))
      .toEqual(['player', 'monster']);
    expect(counselor.find((graph) => graph.missile === 'LightningControl')?.damage)
      .toEqual(expect.arrayContaining([expect.objectContaining({
        source: 'monster', target: 'Lightning', units: 'fixed-point-1/64-hit-point', isDamageShifted: true,
      })]));
    expect(counselor.find((graph) => graph.missile === 'FlashBottom')?.geometryChecks[0].target)
      .toContain('six');
    expect(counselor.find((graph) => graph.missile === 'FlashTop')?.geometryChecks[0].target)
      .toContain('three');
  });

  it('attaches the routine chain without mutating the source wrapper', () => {
    const source = monsterWrapper('Acid');
    const [promoted] = withMonsterMissileGraphs([source]);
    expect((promoted.entity.data.missileGraphs as { missile: string }[]).map((graph) => graph.missile))
      .toEqual(['Acid', 'AcidSplat', 'AcidPuddle']);
    expect(promoted.entity.data.existing).toBe(true);
    expect(source.entity.data.missileGraphs).toBeUndefined();
  });

  it('reports protected-dataset disagreements and the Hellfire scope exclusion', () => {
    expect(MONSTER_MISSILE_BEHAVIOUR_GRAPH_FINDINGS).toEqual(expect.arrayContaining([
      expect.objectContaining({ dataset: 'missileSpecsData', owner: 'Rhino', field: 'lifetime' }),
      expect.objectContaining({ dataset: 'missileSpecsData', owner: 'LightningControl', field: 'spawnedMissiles' }),
      expect.objectContaining({ dataset: 'missileSpecsData', owner: 'ThinLightningControl', field: 'spawnedMissiles' }),
      expect.objectContaining({ dataset: 'monsterMissileDamageData', owner: 'Fireball', field: 'hitCount' }),
      expect.objectContaining({ dataset: 'monsterAttackLedgerData', owner: 'Counselor/Zhar/Lazarus Fireball' }),
      expect.objectContaining({ dataset: 'monsterAttackLedgerData', owner: 'HorkDemon/HorkSpawn', field: 'scope' }),
    ]));
  });
});
