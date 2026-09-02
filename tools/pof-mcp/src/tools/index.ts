import type { ToolDef } from './shared.js';
import { PIPELINE_TOOLS } from './pipeline.js';
import { HARNESS_TOOLS } from './harness.js';
import { SIM_TOOLS } from './sims.js';
import { UE_TOOLS } from './ue.js';
import { DESIGN_TOOLS } from './design.js';
import { GROUPS_TOOL, TOOL_GROUPS, resolveEnabledGroups, groupOf, GROUPS_ENV } from './groups.js';

export type { ToolDef } from './shared.js';
export { TOOL_GROUPS, GROUP_NAMES, GROUPS_ENV, resolveEnabledGroups, groupReport, groupOf } from './groups.js';

/**
 * The full pof-mcp tool surface, in family order. This stays the registry of record —
 * the docs generator, the schema/example-coverage guards and `CallTool` all resolve
 * against it. What a session ADVERTISES is `advertisedTools()`, which may be a subset.
 */
export const TOOLS: ToolDef[] = [
  ...PIPELINE_TOOLS,
  ...HARNESS_TOOLS,
  ...SIM_TOOLS,
  ...UE_TOOLS,
  ...DESIGN_TOOLS,
  GROUPS_TOOL,
];

/**
 * The tools advertised on `tools/list` for the given group spec (default: `POF_MCP_TOOL_GROUPS`).
 * The group meta-tool is always included — see `groups.ts` for why gating is static.
 */
export function advertisedTools(raw: string | undefined = process.env[GROUPS_ENV]): ToolDef[] {
  const { enabled } = resolveEnabledGroups(raw);
  const out: ToolDef[] = [];
  for (const g of TOOL_GROUPS) if (enabled.includes(g.name)) out.push(...g.tools);
  out.push(GROUPS_TOOL);
  return out;
}

/**
 * Is this tool callable this session? A hidden tool is refused with a message naming its
 * group — a decorative gate that hides a tool from the list but still runs it teaches the
 * agent that the list is a lie, and a bare "Unknown tool" teaches it the capability does
 * not exist.
 */
export function toolVisibility(
  name: string,
  raw: string | undefined = process.env[GROUPS_ENV],
): { known: boolean; visible: boolean; group: string } {
  const known = TOOLS.some((t) => t.name === name);
  const group = groupOf(name);
  if (!known) return { known: false, visible: false, group };
  if (group === 'meta') return { known: true, visible: true, group };
  return { known: true, visible: resolveEnabledGroups(raw).enabled.includes(group), group };
}
