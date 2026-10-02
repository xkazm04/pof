/**
 * scan-sweep --challenge (module-topology-graph/B): a cross-module overlap is a pair
 * of feature TWINS, each carrying its own feature-matrix status. `classifyTwin` reads
 * both statuses through the one done rule (`isFeatureDone`) and says whether the twins
 * agree, and which one to review when they do not. `orderTwins` puts divergence first.
 * `analyzeOverlaps` stops reporting a declared dependency edge as a duplicate.
 */
import { describe, it, expect } from 'vitest';
import { classifyTwin, orderTwins, type TwinRow } from '@/lib/evaluator/overlap-twins';
import { analyzeOverlaps, type OverlapPair } from '@/lib/overlap-detection';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

const PAIR = {
  moduleA: 'arpg-animation', featureA: 'Animation state machine',
  moduleB: 'animations', featureB: 'Animation state machine',
};
const KEY_A = 'arpg-animation::Animation state machine';
const KEY_B = 'animations::Animation state machine';

function overlap(moduleA: string, moduleB: string, featureName: string, similarity: number): OverlapPair {
  return {
    moduleA, moduleB, featureA: featureName, featureB: featureName,
    descriptionA: '', descriptionB: '', similarity, reason: 'name_match',
    suggestedOwner: moduleA, ownershipReason: '',
  };
}

describe('classifyTwin', () => {
  it('one twin done, the other not -> diverged, review the lagging twin', () => {
    const twin = classifyTwin(PAIR, new Map([[KEY_A, 'implemented']]));
    expect(twin).toMatchObject({ kind: 'diverged', leadingKey: KEY_A, reviewKeys: [KEY_B] });
  });

  it('both twins done (implemented + improved) -> agreed-done, nothing to review', () => {
    const twin = classifyTwin(PAIR, new Map([[KEY_A, 'implemented'], [KEY_B, 'improved']]));
    expect(twin).toMatchObject({ kind: 'agreed-done', reviewKeys: [] });
  });

  it('neither twin has a status -> unreviewed, review both (sorted)', () => {
    const twin = classifyTwin(PAIR, new Map());
    expect(twin).toMatchObject({ kind: 'unreviewed', reviewKeys: [KEY_A, KEY_B].sort() });
  });

  it('both reviewed, neither done (partial + missing) -> agreed-open, nothing to reconcile', () => {
    const twin = classifyTwin(PAIR, new Map([[KEY_A, 'partial'], [KEY_B, 'missing']]));
    expect(twin).toMatchObject({ kind: 'agreed-open', reviewKeys: [] });
  });
});

describe('orderTwins', () => {
  it('divergence first, then unreviewed, then agreed; similarity desc within a kind', () => {
    const done = overlap('arpg-save', 'save-load', 'Save versioning', 1.0);
    const diverged = overlap('arpg-animation', 'animations', 'Animation state machine', 0.4);
    const unreviewed = overlap('arpg-ui', 'ui-hud', 'Inventory screen', 0.9);
    const rows: TwinRow[] = [
      { overlap: done, twin: classifyTwin(done, new Map([['arpg-save::Save versioning', 'implemented'], ['save-load::Save versioning', 'implemented']])) },
      { overlap: diverged, twin: classifyTwin(diverged, new Map([[KEY_A, 'implemented']])) },
      { overlap: unreviewed, twin: classifyTwin(unreviewed, new Map()) },
    ];
    expect(orderTwins(rows).map((r) => r.twin?.kind)).toEqual(['diverged', 'unreviewed', 'agreed-done']);
  });
});

describe('analyzeOverlaps', () => {
  it('never reports a pair where one feature directly depends on the other', () => {
    const deps = (moduleId: string, featureName: string) =>
      MODULE_FEATURE_DEFINITIONS[moduleId as SubModuleId]?.find((f) => f.featureName === featureName)?.dependsOn ?? [];
    const linked = analyzeOverlaps().overlaps.filter((o) =>
      deps(o.moduleA, o.featureA).includes(`${o.moduleB}::${o.featureB}`)
      || deps(o.moduleB, o.featureB).includes(`${o.moduleA}::${o.featureA}`));
    expect(linked.map((o) => `${o.moduleA}::${o.featureA} <-> ${o.moduleB}::${o.featureB}`)).toEqual([]);
  });
});
