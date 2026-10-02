import type { GenerationStep } from '@/lib/catalog/recipe';
import type { ScreenEntry } from '@/lib/catalog/types';
import { nextGenerationStep } from '@/lib/catalog/generationPlan';
import { SCREEN_TO_FLOW } from '@/components/modules/core-engine/sub_ui/_shared/data';

/**
 * The Screen Flow tab's link to its catalog: which screen-flow entity a row
 * drives, and which recipe step it may dispatch next. Pure — no React.
 *
 * Rows are keyed by screen-node ids ('hud-root', 'inventory', …); catalog
 * entities by flow ids (`screen-${FLOW_NODES[i].id}`). SCREEN_TO_FLOW bridges
 * the two; the HUD root row is the one screen node it does not list.
 */

/** The HUD root row's screen-node id and the flow node it stands for. */
export const ROOT_SCREEN_NODE = 'hud-root';
const ROOT_FLOW_NODE = 'HUD';

/** Flow id for a screen-node row id, or undefined for an unknown row. */
export function flowIdForScreenNode(nodeId: string): string | undefined {
  return nodeId === ROOT_SCREEN_NODE ? ROOT_FLOW_NODE : SCREEN_TO_FLOW[nodeId];
}

/** The row a flow-graph node selects: the HUD root for 'HUD', else its first mapped row. */
export function screenNodeForFlow(flowId: string): string | undefined {
  if (flowId === ROOT_FLOW_NODE) return ROOT_SCREEN_NODE;
  return Object.keys(SCREEN_TO_FLOW).find((nodeId) => SCREEN_TO_FLOW[nodeId] === flowId);
}

/** The catalog screen a row drives — undefined (never a different screen) when none matches. */
export function screenEntityFor(nodeId: string, entries: readonly ScreenEntry[]): ScreenEntry | undefined {
  const flowId = flowIdForScreenNode(nodeId);
  return flowId == null ? undefined : entries.find((e) => e.data.id === flowId);
}

/**
 * The recipe step to dispatch next for an entity at `lifecycle`, or null when no
 * step may be dispatched (verified, failed, or no step advances it).
 *
 * The ONE next-step rule lives in `@/lib/catalog/generationPlan`
 * (`nextGenerationStep`, which `useGeneration().nextStep` also reads) — this is that
 * function under the Screen Flow tab's name, so the two can never diverge.
 */
export const nextRecipeStep = nextGenerationStep;

export interface ScreenWorklist {
  total: number;
  verified: number;
  failed: number;
  /** The first actionable screen (failed ones skipped) and its next step. */
  next: { entityId: string; step: GenerationStep } | null;
}

/** Progress over the screen catalog plus the one next action, in entry order. */
export function screenWorklist(
  entries: readonly ScreenEntry[],
  steps: readonly GenerationStep[],
): ScreenWorklist {
  let next: ScreenWorklist['next'] = null;
  for (const e of entries) {
    const step = nextRecipeStep(steps, e.lifecycle);
    if (step) { next = { entityId: e.id, step }; break; }
  }
  return {
    total: entries.length,
    verified: entries.filter((e) => e.lifecycle === 'verified').length,
    failed: entries.filter((e) => e.lifecycle === 'failed').length,
    next,
  };
}

/** Short verb for a step, for "Next: Scaffold HUD". */
export const STEP_VERB: Record<GenerationStep, string> = {
  'scaffold-cpp': 'Scaffold',
  'author-python': 'Author',
  'wire': 'Wire',
  'verify': 'Verify',
};
