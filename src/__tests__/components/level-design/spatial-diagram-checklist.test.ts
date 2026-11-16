/**
 * The empty-state "Level Systems" diagram reads and WRITES level-design
 * checklist progress by node id (useChecklistCLI marks `checklistProgress
 * ['level-design'][node.id]` done on a confirmed run). So a node's id must be
 * the checklist item that names the same system, or running one system ticks
 * another system's roadmap item.
 */
import { describe, it, expect } from 'vitest';
import { NODES, DEPENDENCY_ARROWS } from '@/components/modules/content/level-design/LevelDesignSpatialDiagram/constants';
import { getModuleChecklist } from '@/lib/module-registry';

const checklist = getModuleChecklist('level-design');
const labelOf = (id: string) => checklist.find((c) => c.id === id)?.label ?? '';
const nodeByLabel = (label: string) => NODES.find((n) => n.label === label)!;

describe('spatial diagram node ids are the checklist items of the same system', () => {
  it.each([
    ['Level Streaming', /stream/i],
    ['Spawn System', /spawn/i],
  ])('%s ticks a checklist item about it', (label, pattern) => {
    expect(labelOf(nodeByLabel(label).id)).toMatch(pattern);
  });

  it('every node id and dependency is a real checklist item', () => {
    for (const n of NODES) {
      expect(labelOf(n.id)).not.toBe('');
      for (const d of n.dependencies) expect(NODES.some((m) => m.id === d)).toBe(true);
    }
  });

  it('the arrows are exactly the declared dependencies (one list, not two)', () => {
    const fromDeps = NODES.flatMap((n) => n.dependencies.map((d) => `${d}->${n.id}`)).sort();
    expect(DEPENDENCY_ARROWS.map((a) => `${a.from}->${a.to}`).sort()).toEqual(fromDeps);
  });
});
