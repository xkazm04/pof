import { describe, it, expect } from 'vitest';
import {
  layoutModuleConstellation,
  pickNextFeature,
  isFeatureDone,
  DEFAULT_LAYOUT_OPTIONS,
  type ConstellationNode,
} from '@/lib/constellation/layout';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';

const CHAR = 'arpg-character' as const;

function emptyStatus() {
  return new Map<string, string>();
}

describe('isFeatureDone', () => {
  it('treats implemented and improved as done, others as not done', () => {
    expect(isFeatureDone('implemented')).toBe(true);
    expect(isFeatureDone('improved')).toBe(true);
    expect(isFeatureDone('partial')).toBe(false);
    expect(isFeatureDone('missing')).toBe(false);
    expect(isFeatureDone('unknown')).toBe(false);
  });
});

describe('layoutModuleConstellation', () => {
  it('produces one node per feature in the module', () => {
    const layout = layoutModuleConstellation(CHAR, emptyStatus());
    expect(layout.nodes.length).toBe(MODULE_FEATURE_DEFINITIONS[CHAR]!.length);
  });

  it('returns an empty layout for a module with no feature definitions', () => {
    // 'game-design-doc' has no MODULE_FEATURE_DEFINITIONS entry
    const layout = layoutModuleConstellation('game-design-doc' as never, emptyStatus());
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.layerCount).toBe(0);
    expect(layout.nextKey).toBeNull();
  });

  it('places features with no intra-module deps in layer 0', () => {
    const layout = layoutModuleConstellation(CHAR, emptyStatus());
    const base = layout.nodes.find((n) => n.featureName === 'AARPGCharacterBase');
    expect(base?.layer).toBe(0);
  });

  it('layers a dependent feature deeper than its prerequisite', () => {
    const layout = layoutModuleConstellation(CHAR, emptyStatus());
    const byName = (name: string) => layout.nodes.find((n) => n.featureName === name)!;
    // AARPGPlayerCharacter depends on AARPGCharacterBase
    expect(byName('AARPGPlayerCharacter').layer).toBeGreaterThan(byName('AARPGCharacterBase').layer);
    // WASD movement depends on AARPGPlayerController + Isometric camera (deeper still)
    expect(byName('WASD movement').layer).toBeGreaterThan(byName('AARPGPlayerCharacter').layer);
  });

  it('x position increases with layer; layerCount = max layer + 1', () => {
    const layout = layoutModuleConstellation(CHAR, emptyStatus());
    const maxLayer = Math.max(...layout.nodes.map((n) => n.layer));
    expect(layout.layerCount).toBe(maxLayer + 1);
    for (const n of layout.nodes) {
      const expectedX = DEFAULT_LAYOUT_OPTIONS.padX + DEFAULT_LAYOUT_OPTIONS.nodeW / 2 + n.layer * DEFAULT_LAYOUT_OPTIONS.colGap;
      expect(n.x).toBe(expectedX);
    }
  });

  it('carries the verified matrix status onto each node', () => {
    const status = new Map<string, string>([
      ['arpg-character::AARPGCharacterBase', 'implemented'],
      ['arpg-character::AARPGPlayerCharacter', 'partial'],
    ]);
    const layout = layoutModuleConstellation(CHAR, status);
    expect(layout.nodes.find((n) => n.featureName === 'AARPGCharacterBase')?.status).toBe('implemented');
    expect(layout.nodes.find((n) => n.featureName === 'AARPGPlayerCharacter')?.status).toBe('partial');
    expect(layout.nodes.find((n) => n.featureName === 'UARPGGameInstance')?.status).toBe('unknown');
  });

  it('separates intra-module deps from cross-module deps', () => {
    // arpg-combat features depend on cross-module features (gas/animation)
    const layout = layoutModuleConstellation('arpg-combat', emptyStatus());
    const melee = layout.nodes.find((n) => n.featureName === 'Melee attack ability')!;
    expect(melee.externalDeps.length).toBeGreaterThan(0);
    expect(melee.externalDeps.every((d) => d.moduleId !== 'arpg-combat')).toBe(true);
    expect(melee.deps.every((d) => d.moduleId === 'arpg-combat')).toBe(true);
  });

  it('emits only intra-module edges, pointing prerequisite → dependent', () => {
    const layout = layoutModuleConstellation(CHAR, emptyStatus());
    const moduleKeys = new Set(layout.nodes.map((n) => n.key));
    for (const e of layout.edges) {
      expect(moduleKeys.has(e.fromKey)).toBe(true);
      expect(moduleKeys.has(e.toKey)).toBe(true);
    }
    // The Base → PlayerCharacter edge exists
    expect(
      layout.edges.some(
        (e) => e.fromKey === 'arpg-character::AARPGCharacterBase' && e.toKey === 'arpg-character::AARPGPlayerCharacter',
      ),
    ).toBe(true);
  });

  it('marks an edge blocked when its prerequisite is not done', () => {
    const blockedLayout = layoutModuleConstellation(CHAR, emptyStatus());
    const baseEdge = blockedLayout.edges.find((e) => e.fromKey === 'arpg-character::AARPGCharacterBase')!;
    expect(baseEdge.blocked).toBe(true);

    const doneLayout = layoutModuleConstellation(
      CHAR,
      new Map([['arpg-character::AARPGCharacterBase', 'implemented']]),
    );
    const doneEdge = doneLayout.edges.find((e) => e.fromKey === 'arpg-character::AARPGCharacterBase')!;
    expect(doneEdge.blocked).toBe(false);
  });

  it('flags a node blocked when a prerequisite is unimplemented and unblocked when satisfied', () => {
    const blocked = layoutModuleConstellation(CHAR, emptyStatus());
    expect(blocked.nodes.find((n) => n.featureName === 'AARPGPlayerCharacter')?.isBlocked).toBe(true);

    const ok = layoutModuleConstellation(
      CHAR,
      new Map([['arpg-character::AARPGCharacterBase', 'implemented']]),
    );
    expect(ok.nodes.find((n) => n.featureName === 'AARPGPlayerCharacter')?.isBlocked).toBe(false);
  });

  it('counts local dependents (fan-out) per node', () => {
    const layout = layoutModuleConstellation(CHAR, emptyStatus());
    // AARPGCharacterBase is a prerequisite of AARPGPlayerCharacter (at least one dependent)
    const base = layout.nodes.find((n) => n.featureName === 'AARPGCharacterBase')!;
    expect(base.dependentCount).toBeGreaterThanOrEqual(1);
  });

  it('produces deterministic output across runs', () => {
    const a = layoutModuleConstellation(CHAR, emptyStatus());
    const b = layoutModuleConstellation(CHAR, emptyStatus());
    expect(JSON.stringify(a.nodes)).toBe(JSON.stringify(b.nodes));
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
  });

  it('does not throw for every module that has feature definitions', () => {
    for (const moduleId of Object.keys(MODULE_FEATURE_DEFINITIONS)) {
      expect(() => layoutModuleConstellation(moduleId as never, emptyStatus())).not.toThrow();
    }
  });
});

describe('pickNextFeature', () => {
  it('returns null when there are no candidates', () => {
    expect(pickNextFeature([])).toBeNull();
  });

  it('picks the highest-fan-out, unblocked, unbuilt feature', () => {
    const nodes = [
      mkNode('m::a', { status: 'missing', isBlocked: false, dependentCount: 3, layer: 0 }),
      mkNode('m::b', { status: 'missing', isBlocked: false, dependentCount: 1, layer: 0 }),
      mkNode('m::c', { status: 'missing', isBlocked: true, dependentCount: 9, layer: 1 }), // blocked → ineligible
      mkNode('m::d', { status: 'implemented', isBlocked: false, dependentCount: 9, layer: 0 }), // done → ineligible
    ];
    expect(pickNextFeature(nodes)).toBe('m::a');
  });

  it('on a fresh module recommends a foundational (layer 0) feature', () => {
    const layout = layoutModuleConstellation(CHAR, emptyStatus());
    const next = layout.nodes.find((n) => n.key === layout.nextKey);
    expect(next).toBeDefined();
    expect(next!.layer).toBe(0);
    expect(next!.isBlocked).toBe(false);
  });
});

// ── test helpers ─────────────────────────────────────────────────────────────

function mkNode(key: string, over: Partial<ConstellationNode>): ConstellationNode {
  return {
    key,
    featureName: key.split('::')[1] ?? key,
    category: 'Test',
    description: '',
    status: 'unknown',
    layer: 0,
    row: 0,
    x: 0,
    y: 0,
    deps: [],
    externalDeps: [],
    blockers: [],
    isBlocked: false,
    dependentCount: 0,
    ...over,
  };
}
