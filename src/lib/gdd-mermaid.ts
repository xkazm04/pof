/**
 * GDD Mermaid helpers — bridge the rendered architecture diagram back to the
 * module navigation. The synthesizer's `buildSystemArchitectureDiagram` emits
 * node ids as `moduleId.replace(/-/g, '_')` (e.g. `arpg-enemy-ai` → `arpg_enemy_ai`);
 * mermaid then wraps each node group's DOM id as `flowchart-<nodeId>-<n>`.
 * This reverses that transform so a clicked node can jump to its module.
 */

import { SUB_MODULE_MAP } from './module-registry';
import type { SubModuleId } from '@/types/modules';

/**
 * Reverse a mermaid flowchart node's DOM id back to a known sub-module id, or
 * return null when the node isn't a real module (so non-module nodes never get a
 * clickable affordance that does nothing). Pure — safe to unit test.
 */
export function mermaidNodeIdToModuleId(svgNodeId: string): string | null {
  if (!svgNodeId) return null;
  let raw = svgNodeId;
  if (raw.startsWith('flowchart-')) raw = raw.slice('flowchart-'.length);
  raw = raw.replace(/-\d+$/, ''); // strip mermaid's trailing `-<n>` instance counter
  const moduleId = raw.replace(/_/g, '-');
  return SUB_MODULE_MAP[moduleId as SubModuleId] ? moduleId : null;
}
