/**
 * Session topology — WHICH CLIENT is on the other end of THIS connection.
 *
 * pof-mcp serves three of them: a live **editor** session (a CLI agent beside a running UE
 * editor), a **headless** engine run (UnrealEditor-Cmd / CI, with no editor to talk to),
 * and the **web** app. A few tools exist only because of the first — `pof_ue_compile` and
 * friends drive the pof-bridge *inside* a live editor and can do nothing without one.
 *
 * That is a property of the SESSION, not of the process. The reflex is to read a spawn
 * marker off `process.env` (`HARNESS_MODE`/`CI`, the shape `e2e/helpers/ci-harness.ts`
 * uses for the e2e lane), and that reading is right in exactly one topology: the one the
 * app spawned itself. Any client that connects another way carries no marker, so an
 * env-keyed gate strips the tool from a session that genuinely HAS an editor — a silent
 * no-op, while the same session's `clientInfo` says the opposite. And one env slot cannot
 * answer for two concurrent sessions of one process.
 *
 * So: resolve from the session's own recorded source (the `clientInfo` of the `initialize`
 * handshake), fall back to the env ONLY when the session declares nothing, and when
 * neither speaks resolve to `unknown` — which advertises the FULL surface. An absent
 * marker is not evidence of "no editor", and gating stays opt-in for the same reason it is
 * in `groups.ts`: a run must never silently lose a capability it had yesterday.
 *
 * This table is the ONE place the client-surface mapping is written. `advertisedTools`
 * and `toolVisibility` both derive from it, so the roster the model is shown and the
 * executor's refusal are one policy evaluated on one session.
 */
import type { ToolDef } from './shared.js';

export type Topology = 'editor' | 'headless' | 'web';
export const TOPOLOGIES: readonly Topology[] = ['editor', 'headless', 'web'];

/** Where the answer came from. Logged on connect, so a wrong roster is traceable. */
export type TopologySource = 'session-declared' | 'session-name' | 'env' | 'unknown';

/** The env fallback, used ONLY when the session declares nothing. */
export const TOPOLOGY_ENV = 'POF_MCP_TOPOLOGY';

/**
 * The client-surface group: tools that exist only because a live UE editor is attached.
 * Each one's own description already says "Needs a live editor" — `pof_ue_status` is
 * deliberately NOT here, it is the reachability probe and reports `connected:false`
 * honestly from any topology.
 */
export const EDITOR_ONLY_TOOLS: readonly string[] = [
  'pof_ue_manifest',
  'pof_ue_compile',
  'pof_ue_run_tests',
  'pof_ue_test_results',
];

/** What a session may state about itself, read off the `initialize` handshake's clientInfo. */
export interface SessionSource {
  /** `clientInfo.name`. */
  name?: string;
  /** An explicit `clientInfo.topology` — the unambiguous declaration, preferred over the name. */
  topology?: unknown;
}

export interface TopologyResolution {
  topology: Topology | 'unknown';
  source: TopologySource;
  /** One line naming what decided, for the connection log. */
  note: string;
}

/** Client names PoF itself ships, for sessions that state no explicit topology. */
const NAME_TOPOLOGY: ReadonlyArray<readonly [RegExp, Topology]> = [
  [/(^|[-_.])(ue-?)?editor([-_.]|$)/i, 'editor'],
  [/headless|unrealeditor-?cmd|ue-?cmd|(^|[-_.])ci([-_.]|$)/i, 'headless'],
  [/(^|[-_.])(web|browser)([-_.]|$)|pof-?app/i, 'web'],
];

function asTopology(v: unknown): Topology | undefined {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return (TOPOLOGIES as readonly string[]).includes(s) ? (s as Topology) : undefined;
}

/** The legacy env-derived path the direction replaces — kept only as a last resort. */
function envTopology(env: Record<string, string | undefined>): Topology | undefined {
  const explicit = asTopology(env[TOPOLOGY_ENV]);
  if (explicit) return explicit;
  if (env.HARNESS_MODE === 'live') return 'editor';
  if (env.HARNESS_MODE === 'ci' || env.CI === 'true' || env.CI === '1') return 'headless';
  return undefined;
}

/** The one resolver. Session first, env only as a fallback, `unknown` rather than a guess. */
export function resolveSessionTopology(
  session: SessionSource | undefined,
  env: Record<string, string | undefined> = process.env,
): TopologyResolution {
  const declared = asTopology(session?.topology);
  if (declared) return { topology: declared, source: 'session-declared', note: `clientInfo.topology="${declared}"` };
  const name = typeof session?.name === 'string' ? session.name : '';
  for (const [re, t] of NAME_TOPOLOGY) {
    if (re.test(name)) return { topology: t, source: 'session-name', note: `clientInfo.name="${name}"` };
  }
  const fromEnv = envTopology(env);
  if (fromEnv) {
    return { topology: fromEnv, source: 'env', note: `env fallback (${TOPOLOGY_ENV}/HARNESS_MODE) — the session declared no topology` };
  }
  return { topology: 'unknown', source: 'unknown', note: 'neither the session nor the env named a topology — the full surface is advertised' };
}

/** Does this topology hold this tool? `unknown` holds everything: absent is not "no editor". */
export function topologyHolds(topology: Topology | 'unknown', toolName: string): boolean {
  if (!EDITOR_ONLY_TOOLS.includes(toolName)) return true;
  return topology === 'editor' || topology === 'unknown';
}

export function topologyFilter(tools: ToolDef[], res: TopologyResolution): ToolDef[] {
  return tools.filter((t) => topologyHolds(res.topology, t.name));
}

/** The default for callers with no session (the docs generator, coverage guards). */
export const UNRESOLVED_TOPOLOGY: TopologyResolution = {
  topology: 'unknown',
  source: 'unknown',
  note: 'no session in scope — the full surface',
};
