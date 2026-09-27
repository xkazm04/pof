/**
 * scan-sweep --challenge (module-topology-graph/A): ONE pure module-topology
 * projection. The Dependencies and Nexus views drew 34 modules on a 12-slot
 * table, so the 22 modules without a hand-placed cell all stacked on
 * arpg-character's (0,0) cell; three hooks each rebuilt the same per-module
 * counts and cross-module edges with a done rule (`!== 'implemented'`) that
 * contradicts the constellation's isFeatureDone.
 *
 * Each case imports the projection lazily so a missing module fails the case,
 * not the file (the fitness case stands on its own).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { layoutModuleConstellation, isFeatureDone } from '@/lib/constellation/layout';
import type { FeatureStatus } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

const load = () => import('@/lib/topology/moduleGraph');

/** The 21 edges the pre-refactor useDependencyGraph edge builder yields on an empty status map. */
const EDGE_FIXTURE = [
  { from: 'arpg-character', to: 'arpg-animation', count: 1, hasBlockers: true },
  { from: 'arpg-character', to: 'arpg-gas', count: 1, hasBlockers: true },
  { from: 'arpg-gas', to: 'arpg-combat', count: 4, hasBlockers: true },
  { from: 'arpg-animation', to: 'arpg-combat', count: 6, hasBlockers: true },
  { from: 'arpg-character', to: 'arpg-combat', count: 1, hasBlockers: true },
  { from: 'arpg-character', to: 'arpg-enemy-ai', count: 1, hasBlockers: true },
  { from: 'arpg-gas', to: 'arpg-enemy-ai', count: 3, hasBlockers: true },
  { from: 'arpg-gas', to: 'arpg-inventory', count: 2, hasBlockers: true },
  { from: 'arpg-inventory', to: 'arpg-loot', count: 3, hasBlockers: true },
  { from: 'arpg-combat', to: 'arpg-loot', count: 1, hasBlockers: true },
  { from: 'arpg-gas', to: 'arpg-ui', count: 4, hasBlockers: true },
  { from: 'arpg-enemy-ai', to: 'arpg-ui', count: 1, hasBlockers: true },
  { from: 'arpg-inventory', to: 'arpg-ui', count: 2, hasBlockers: true },
  { from: 'arpg-combat', to: 'arpg-ui', count: 1, hasBlockers: true },
  { from: 'arpg-gas', to: 'arpg-progression', count: 3, hasBlockers: true },
  { from: 'arpg-combat', to: 'arpg-progression', count: 1, hasBlockers: true },
  { from: 'arpg-enemy-ai', to: 'arpg-world', count: 2, hasBlockers: true },
  { from: 'arpg-ui', to: 'arpg-world', count: 1, hasBlockers: true },
  { from: 'arpg-gas', to: 'arpg-world', count: 1, hasBlockers: true },
  { from: 'arpg-inventory', to: 'arpg-save', count: 2, hasBlockers: true },
  { from: 'arpg-gas', to: 'arpg-save', count: 1, hasBlockers: true },
];

/** The curated 4x3 cells the core-engine modules had before the projection existed. */
const CURATED_CELLS: Record<string, { col: number; row: number }> = {
  'arpg-character': { col: 0, row: 0 },
  'arpg-animation': { col: 1, row: 0 },
  'arpg-gas': { col: 2, row: 0 },
  'arpg-combat': { col: 3, row: 0 },
  'arpg-enemy-ai': { col: 0, row: 1 },
  'arpg-inventory': { col: 1, row: 1 },
  'arpg-loot': { col: 2, row: 1 },
  'arpg-ui': { col: 3, row: 1 },
  'arpg-progression': { col: 0, row: 2 },
  'arpg-world': { col: 1, row: 2 },
  'arpg-save': { col: 2, row: 2 },
  'arpg-polish': { col: 3, row: 2 },
};

describe('buildModuleTopology — placement', () => {
  it('gives every module its own centre (models no longer sits on arpg-character)', async () => {
    const { buildModuleTopology, getNodeCenter, TOPOLOGY_COMPACT } = await load();
    const a = getNodeCenter('models', TOPOLOGY_COMPACT);
    const b = getNodeCenter('arpg-character', TOPOLOGY_COMPACT);
    expect(a).not.toEqual(b);

    const { nodes } = buildModuleTopology(new Map());
    const moduleIds = Object.keys(MODULE_FEATURE_DEFINITIONS);
    expect(moduleIds).toHaveLength(34);
    expect(nodes.map((n) => n.moduleId).sort()).toEqual([...moduleIds].sort());
    expect(new Set(nodes.map((n) => `${n.cx},${n.cy}`)).size).toBe(34);
  });

  it('sizes the viewport from the placed cells so every node rect lies inside it', async () => {
    const { buildModuleTopology, TOPOLOGY_COMPACT, TOPOLOGY_ROOMY } = await load();
    for (const layout of [TOPOLOGY_COMPACT, TOPOLOGY_ROOMY]) {
      const { nodes, width, height } = buildModuleTopology(new Map(), layout);
      for (const n of nodes) {
        expect(n.cx - layout.nodeW / 2).toBeGreaterThanOrEqual(0);
        expect(n.cy - layout.nodeH / 2).toBeGreaterThanOrEqual(0);
        expect(n.cx + layout.nodeW / 2).toBeLessThanOrEqual(width);
        expect(n.cy + layout.nodeH / 2).toBeLessThanOrEqual(height);
      }
      // Derived, not the fixed 4x3 formula: the far edge is exactly one pad past the last cell.
      const maxRight = Math.max(...nodes.map((n) => n.cx + layout.nodeW / 2));
      const maxBottom = Math.max(...nodes.map((n) => n.cy + layout.nodeH / 2));
      expect(width).toBe(maxRight + layout.padX);
      expect(height).toBe(maxBottom + layout.padY);
      expect(height).toBeGreaterThan(layout.padY * 2 + 2 * layout.rowHeight + layout.nodeH);
    }
  });

  it('[guard] keeps the 12 curated core-engine cells and bands the rest by category', async () => {
    const { buildModuleTopology } = await load();
    const { nodes } = buildModuleTopology(new Map());
    const byId = new Map(nodes.map((n) => [n.moduleId, n]));
    for (const [id, cell] of Object.entries(CURATED_CELLS)) {
      expect({ col: byId.get(id as SubModuleId)!.col, row: byId.get(id as SubModuleId)!.row }).toEqual(cell);
    }
    // Every other module sits below the curated grid, and each category occupies its own rows.
    const rowsByCategory = new Map<string, Set<number>>();
    for (const n of nodes) {
      if (n.moduleId in CURATED_CELLS) continue;
      expect(n.row).toBeGreaterThan(2);
      expect(n.categoryId).toBe(SUB_MODULE_MAP[n.moduleId]?.categoryId);
      const rows = rowsByCategory.get(n.categoryId) ?? new Set<number>();
      rows.add(n.row);
      rowsByCategory.set(n.categoryId, rows);
    }
    const bands = [...rowsByCategory.values()];
    for (let i = 0; i < bands.length; i++) {
      for (let j = i + 1; j < bands.length; j++) {
        for (const r of bands[i]) expect(bands[j].has(r)).toBe(false);
      }
    }
  });
});

describe('buildModuleTopology — projection', () => {
  it('[guard] yields exactly the pre-refactor cross-module edges', async () => {
    const { buildModuleTopology } = await load();
    expect(buildModuleTopology(new Map()).edges).toEqual(EDGE_FIXTURE);
  });

  it("counts an 'improved' feature as done, matching the constellation", async () => {
    const { buildModuleTopology } = await load();
    const features = MODULE_FEATURE_DEFINITIONS['arpg-character']!;
    expect(features).toHaveLength(10);
    const statusMap = new Map<string, string>(
      features.map((f) => [`arpg-character::${f.featureName}`, 'improved']),
    );
    const node = buildModuleTopology(statusMap).nodes.find((n) => n.moduleId === 'arpg-character')!;
    const constellationDone = layoutModuleConstellation('arpg-character', statusMap)
      .nodes.filter((n) => isFeatureDone(n.status as FeatureStatus)).length;
    expect(node.implementedCount).toBe(10);
    expect(node.blockedCount).toBe(0);
    expect(node.implementedCount).toBe(constellationDone);
  });
});

describe('fitness — the projection is not re-derived in the evaluator views', () => {
  it('has no hand-rolled edge key and no `!== implemented` done rule under evaluator/', () => {
    const root = resolve(__dirname, '../../../components/modules/evaluator');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(name)) {
          const src = readFileSync(p, 'utf8');
          if (src.includes('${dep.moduleId}->')) hits.push(`${p}: edge key`);
          if (src.includes("status !== 'implemented'")) hits.push(`${p}: done rule`);
        }
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
