/**
 * One registry-bound diagram model for the module views that draw a checklist as
 * a diagram (Audio pipeline, Materials hierarchy, Models asset pipeline).
 *
 * A diagram declares only its SHAPE — which checklist item ids it draws and how
 * they depend on each other. Labels, descriptions and, critically, prompts come
 * from `module-registry`, never from a parallel copy in the component: every
 * diagram that kept its own ids (`au-*`, `mt-*`, `pipeline-*`) wrote progress keys
 * `POST /api/checklist/complete` refuses, so its nodes could never complete.
 *
 * A spec whose id no longer exists resolves to a loud, undispatchable drift node
 * (`missing: true`, empty prompt, a description naming the drift) rather than
 * vanishing — a silently-dropped node is how those divergences survived.
 */
import { getModuleChecklist } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';

/** The diagram's shape for one node: a checklist item id and its in-diagram prerequisites. */
export interface DiagramNodeSpec {
  id: string;
  prerequisites: readonly string[];
}

export type DiagramNode<S extends DiagramNodeSpec = DiagramNodeSpec> = S & {
  label: string;
  description: string;
  prompt: string;
  /** True when `id` resolves to no registry checklist item — surfaced, not hidden. */
  missing: boolean;
};

export type DiagramNodeState<N extends DiagramNode = DiagramNode> = N & {
  completed: boolean;
  /** Not runnable: a drift node, or a node whose prerequisites are unmet (unless already done). */
  locked: boolean;
  isActive: boolean;
  /** Labels of the prerequisites still outstanding, in declaration order. */
  unmetDeps: string[];
};

export interface DiagramStates<N extends DiagramNode> {
  nodes: DiagramNodeState<N>[];
  completedCount: number;
  /**
   * The runnable, not-yet-complete node earliest in build order (fewest
   * prerequisites; ties by declaration order), or `null` when none is.
   */
  nextBuildable: DiagramNodeState<N> | null;
}

/** Resolve every spec against the module's registry checklist. */
export function resolveDiagramNodes<S extends DiagramNodeSpec>(
  moduleId: SubModuleId,
  specs: readonly S[],
): DiagramNode<S>[] {
  const checklist = getModuleChecklist(moduleId);
  return specs.map((spec) => {
    const item = checklist.find((i) => i.id === spec.id);
    return {
      ...spec,
      label: item?.label ?? spec.id,
      description:
        item?.description ??
        `No "${spec.id}" item exists in the ${moduleId} checklist — this diagram and the registry have drifted.`,
      prompt: item?.prompt ?? '',
      missing: !item,
    };
  });
}

/** Derive completion / lock / active state from the module's checklist progress. */
export function deriveDiagramNodeStates<N extends DiagramNode>(
  nodes: readonly N[],
  progress: Readonly<Record<string, boolean>>,
  activeItemId: string | null,
): DiagramStates<N> {
  const labelOf = new Map(nodes.map((n) => [n.id, n.label]));
  const states = nodes.map((node): DiagramNodeState<N> => {
    const completed = !!progress[node.id];
    const unmet = node.prerequisites.filter((p) => !progress[p]);
    return {
      ...node,
      completed,
      // A drift node has no registry prompt behind it, so it is never runnable.
      locked: node.missing || (unmet.length > 0 && !completed),
      isActive: activeItemId === node.id,
      unmetDeps: unmet.map((p) => labelOf.get(p) ?? p),
    };
  });

  let nextBuildable: DiagramNodeState<N> | null = null;
  for (const s of states) {
    if (s.completed || s.locked) continue;
    if (!nextBuildable || s.prerequisites.length < nextBuildable.prerequisites.length) nextBuildable = s;
  }

  return {
    nodes: states,
    completedCount: states.filter((s) => s.completed).length,
    nextBuildable,
  };
}
