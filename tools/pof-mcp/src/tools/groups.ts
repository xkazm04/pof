/**
 * Tool groups — the family taxonomy, made load-bearing.
 *
 * pof-mcp advertises its whole surface on every `tools/list`. The five families already
 * existed twice (the order of `TOOLS` in `index.ts`, the `FAMILIES` table in
 * `scripts/gen-tools-reference.mjs`) but neither was reachable at runtime, so a session
 * that only ever drives the catalog loop still pays for the simulation, design and UE
 * families in every single assistant turn.
 *
 * Grouping buys three things (MCP for Unity's `manage_tools`, which ships 47 tools and
 * enables ~30 by default, states the same three): prompt economy — every advertised tool
 * is tokens on every call; routing clarity — the wrong-tool rate rises with the size of
 * the menu; and reachability hygiene — several UE families need a live editor and are
 * dead weight in a session that has none.
 *
 * **Gating is opt-in and static.** With `POF_MCP_TOOL_GROUPS` unset every group is on, so
 * the autonomous harness cannot lose a capability it had yesterday. An operator trims the
 * surface per client in `.mcp.json` (`"env": { "POF_MCP_TOOL_GROUPS": "pipeline,ue" }`).
 * There is deliberately no in-session `activate`: that needs `tools/listChanged`, which
 * clients honour unevenly, and a capability an agent cannot get back mid-run is worse than
 * a long tool list. What the agent gets instead is `pof_tool_groups` — always visible, so a
 * trimmed session can SEE and NAME what it is missing instead of silently lacking it.
 */
import type { ToolDef } from './shared.js';
import { PIPELINE_TOOLS } from './pipeline.js';
import { HARNESS_TOOLS } from './harness.js';
import { SIM_TOOLS } from './sims.js';
import { UE_TOOLS } from './ue.js';
import { DESIGN_TOOLS } from './design.js';

/** The env var an operator sets per client to trim the advertised surface. */
export const GROUPS_ENV = 'POF_MCP_TOOL_GROUPS';

export interface ToolGroup {
  name: string;
  /** One line an agent reads to decide whether it needs the group. */
  description: string;
  tools: ToolDef[];
}

/**
 * The five families, in the order `TOOLS` has always listed them. `meta` is not here: the
 * group tool itself is always visible, which is the whole point of it.
 */
export const TOOL_GROUPS: ToolGroup[] = [
  { name: 'pipeline', description: 'Catalog pipeline loop — list catalogs/entities, read a step, submit an artifact, read acceptance, drain gates.', tools: PIPELINE_TOOLS },
  { name: 'harness', description: 'Autonomous harness loop — start/control a run, read plan, status, run history and diffs.', tools: HARNESS_TOOLS },
  { name: 'sims', description: 'Simulation & balance — combat and economy simulation, sweeps, baselines, ability specs. No editor needed.', tools: SIM_TOOLS },
  { name: 'ue', description: 'UE truth & growth — bridge status, automation tests, disk scans, builds, packaging. Several need a live editor.', tools: UE_TOOLS },
  { name: 'design', description: 'Design truth & quality signals — feature matrix, GDD compliance, project health, crash/regression reads.', tools: DESIGN_TOOLS },
];

export const GROUP_NAMES: string[] = TOOL_GROUPS.map((g) => g.name);

export interface GroupResolution {
  enabled: string[];
  /** Names in the env var that match no group — reported, never silently dropped. */
  unknown: string[];
  /** True when no gating was requested, i.e. the whole surface is advertised. */
  all: boolean;
}

/**
 * Resolve which groups are advertised. Unset/blank/`all` → every group.
 *
 * An env var that names ONLY unknown groups resolves to every group rather than to none:
 * a typo must not silently strip an autonomous run of its entire tool surface. The unknown
 * names are carried out so `pof_tool_groups` can say so out loud.
 */
export function resolveEnabledGroups(raw: string | undefined): GroupResolution {
  const spec = (raw ?? '').trim();
  if (spec === '' || spec.toLowerCase() === 'all') return { enabled: [...GROUP_NAMES], unknown: [], all: true };
  const asked = spec.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
  const enabled = GROUP_NAMES.filter((g) => asked.includes(g));
  const unknown = asked.filter((a) => !GROUP_NAMES.includes(a));
  if (enabled.length === 0) return { enabled: [...GROUP_NAMES], unknown, all: true };
  return { enabled, unknown, all: enabled.length === GROUP_NAMES.length };
}

/** Which group a tool belongs to, or `meta` for the always-visible group tool. */
export function groupOf(toolName: string): string {
  for (const g of TOOL_GROUPS) if (g.tools.some((t) => t.name === toolName)) return g.name;
  return 'meta';
}

/** The report `pof_tool_groups` returns — the discovery surface for a trimmed session. */
export function groupReport(raw: string | undefined) {
  const res = resolveEnabledGroups(raw);
  const groups = TOOL_GROUPS.map((g) => ({
    group: g.name,
    enabled: res.enabled.includes(g.name),
    toolCount: g.tools.length,
    description: g.description,
    tools: g.tools.map((t) => t.name),
  }));
  const hidden = groups.filter((g) => !g.enabled);
  return {
    groups,
    enabledGroups: res.enabled,
    hiddenGroups: hidden.map((g) => g.group),
    hiddenToolCount: hidden.reduce((n, g) => n + g.toolCount, 0),
    envVar: GROUPS_ENV,
    note: res.all
      ? `Every group is advertised (${GROUPS_ENV} is unset or lists no known group). Set ${GROUPS_ENV} to a comma-separated subset of [${GROUP_NAMES.join(', ')}] in this server's MCP client config to trim the surface.`
      : `${hidden.length} group(s) are hidden from tools/list this session and CANNOT be called. Their tools are listed here so you can name what you are missing: change ${GROUPS_ENV} in the MCP client config and reconnect to get them back.`,
    ...(res.unknown.length
      ? { unknownGroupsInEnv: res.unknown, unknownNote: `${GROUPS_ENV} named ${res.unknown.length} group(s) that do not exist — they were ignored.` }
      : {}),
  };
}

/**
 * The group meta-tool. Always advertised, in every configuration — a session that cannot
 * see it cannot find out what it cannot see.
 */
export const GROUPS_TOOL: ToolDef = {
  name: 'pof_tool_groups',
  description:
    "List pof-mcp's tool groups and which are advertised this session. pof-mcp's surface is split into families (pipeline, harness, sims, ue, design) and an operator may trim it per client via the POF_MCP_TOOL_GROUPS env var. Call this when a tool you expected is absent: it names every hidden group and the tools inside it, so you can say what you are missing instead of assuming the capability does not exist. Gating is static — hidden tools return an explicit error rather than silently missing.",
  inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  example: { args: {}, note: 'Read-only; reports the group table for the running server.' },
  handler: async () => groupReport(process.env[GROUPS_ENV]),
};
