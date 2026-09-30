/**
 * One registry-bound diagram model (`src/lib/checklist-diagram.ts`).
 *
 * The Models "Asset Pipeline" tab drew six hand-written stages
 * (`pipeline-source` … `pipeline-collision`) with their own prompt strings — a
 * second, hand-maintained copy of the `mod-*` checklist vocabulary. Every one of
 * those keys resolves `unknown` in `resolveProgressKey`, which
 * `POST /api/checklist/complete` refuses with 400, so no stage could ever complete.
 * Audio (`layerFrom`) and Materials (`nodeFrom`) had each been fixed by hand to the
 * same registry-resolve rule; this module is that rule, written once.
 *
 * RED before this change: the module and `MODELS_PIPELINE_SPEC` did not exist.
 */
import { describe, it, expect } from 'vitest';

import { resolveDiagramNodes, deriveDiagramNodeStates } from '@/lib/checklist-diagram';
import { MODELS_PIPELINE_SPEC } from '@/components/modules/content/models/AssetPipelineDiagram';
import { getModuleChecklist } from '@/lib/module-registry';
import { resolveProgressKey } from '@/lib/checklist-progress-keys';

const CHECKLIST = getModuleChecklist('models');
const itemOf = (id: string) => CHECKLIST.find((i) => i.id === id)!;

describe('resolveDiagramNodes — models', () => {
  it('draws 6 registry items, each carrying the registry prompt (no parallel copy)', () => {
    const nodes = resolveDiagramNodes('models', MODELS_PIPELINE_SPEC);
    expect(nodes).toHaveLength(6);
    const declared = new Set(CHECKLIST.map((i) => i.id));
    for (const node of nodes) {
      expect(declared.has(node.id)).toBe(true);
      expect(node.prompt).toBe(itemOf(node.id).prompt);
      expect(node.label).toBe(itemOf(node.id).label);
      expect(node.missing).toBe(false);
    }
  });

  it('every stage id is a key the completion route accepts', () => {
    for (const spec of MODELS_PIPELINE_SPEC) {
      expect(resolveProgressKey('models', spec.id).kind).toBe('checklist');
    }
  });

  it('an unresolved id is a loud, undispatchable drift node that derives locked', () => {
    const [node] = resolveDiagramNodes('models', [{ id: 'mod-99', prerequisites: [] }]);
    expect(node.missing).toBe(true);
    expect(node.prompt).toBe('');
    expect(node.description).toMatch(/mod-99/);
    expect(node.description).toMatch(/drifted/);

    const { nodes } = deriveDiagramNodeStates([node], {}, null);
    expect(nodes[0].locked).toBe(true);
  });
});

describe('deriveDiagramNodeStates', () => {
  it('completing the first stage unlocks only its direct successor', () => {
    const modelsNodes = resolveDiagramNodes('models', MODELS_PIPELINE_SPEC);
    const { nodes, completedCount } = deriveDiagramNodeStates(modelsNodes, { 'mod-1': true }, null);

    expect(completedCount).toBe(1);
    const first = nodes.find((n) => n.id === 'mod-1')!;
    expect(first.completed).toBe(true);

    const idx = nodes.indexOf(first);
    const successor = nodes[idx + 1];
    expect(successor.prerequisites).toEqual(['mod-1']);
    expect(successor.locked).toBe(false);
    expect(successor.unmetDeps).toEqual([]);

    for (let i = idx + 2; i < nodes.length; i++) {
      const stage = nodes[i];
      expect(stage.locked).toBe(true);
      expect(stage.unmetDeps).toEqual([nodes[i - 1].label]);
    }
  });

  it('marks the active item and names the next buildable node', () => {
    const modelsNodes = resolveDiagramNodes('models', MODELS_PIPELINE_SPEC);
    const { nodes, nextBuildable } = deriveDiagramNodeStates(modelsNodes, { 'mod-1': true }, 'mod-4');
    expect(nodes.find((n) => n.id === 'mod-4')!.isActive).toBe(true);
    expect(nextBuildable?.id).toBe(nodes[1].id);
  });
});
