import type { PofClient } from '../pofClient.js';

/**
 * MCP tool annotations (spec 2025-03-26 `ToolAnnotations`): the blast radius a host uses
 * to sort tools into consent tiers — auto-approve the harmless, always confirm the
 * irreversible. They are CLAIMS this server makes about itself, not a security property:
 * a host may relax friction on a trusted server's read-only tools; it must never treat
 * the hint as proof. Published honestly and pinned to behaviour by annotations.test.ts,
 * which drives every read-only tool against a recording client and refuses a POST to
 * any route not allow-listed (with a reason) in `coverage.ts` → READ_ONLY_POST.
 */
export interface ToolAnnotations {
  title: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

/** A tool that changes nothing on the backend, the editor, or disk — safe to repeat. */
export function readOnly(title: string): ToolAnnotations {
  return { title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
}

/**
 * A tool that writes, spawns, or spends. `destructive` = it can overwrite or flip state
 * that is not additive (verdicts, a UE project's code); `idempotent` = repeating the same
 * call with the same arguments has no further effect; `openWorld` = it reaches beyond the
 * local backend/editor (an autonomous Claude session that spends API budget).
 */
export function writes(
  title: string,
  opts: { destructive?: boolean; idempotent?: boolean; openWorld?: boolean } = {},
): ToolAnnotations {
  return {
    title,
    readOnlyHint: false,
    destructiveHint: opts.destructive ?? false,
    idempotentHint: opts.idempotent ?? false,
    openWorldHint: opts.openWorld ?? false,
  };
}

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  inputSchema: Record<string, unknown>;
  /** Behaviour hints advertised on `tools/list`. Required: a tool without a verdict on its own blast radius cannot register. */
  annotations: ToolAnnotations;
  handler: (args: Record<string, unknown>, pof: PofClient) => Promise<unknown>;
  /**
   * A safe, read-only example invocation. The contract test records it to
   * `examples/<tool>.json` (→ TOOLS-REFERENCE.md) and asserts its shape. Omit for
   * write/expensive/live tools — those get bespoke recorded cases or an EXAMPLE_SKIP reason.
   */
  example?: { args: Record<string, unknown>; note?: string };
}

export function reqStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || v.length === 0) throw new Error(`"${key}" (non-empty string) is required`);
  return v;
}
export function optStr(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' && v.length ? v : undefined;
}
export function optNum(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  return typeof v === 'number' ? v : undefined;
}
export function reqObj(args: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = args[key];
  if (v == null || typeof v !== 'object' || Array.isArray(v)) throw new Error(`"${key}" (object) is required`);
  return v as Record<string, unknown>;
}
export function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * The `projectPath` parameter every project-scoped tool declares.
 *
 * PoF scopes its project-owned tables with ONE own-plus-legacy rule
 * (`src/lib/project-id.ts` → `projectScopeSql`): a NAMED project sees its own rows
 * plus the unattributed legacy rows (`project_id = ''`), and an UNSCOPED caller sees
 * ONLY the legacy set — it does NOT silently get everything. A tool that declares no
 * project at all cannot be scoped even deliberately, which is how four headless tools
 * came to answer "0 of 165" after wave 16 attributed every row to a project.
 *
 * Stated EXPLICITLY by the caller and forwarded verbatim — never inferred server-side.
 */
export const PROJECT_PATH = {
  type: 'string',
  description:
    "Absolute UE project path (or the normalized projectId) to scope this read to — that project's rows PLUS the unattributed legacy rows. Stated EXPLICITLY, never inferred server-side. Omit only when you deliberately want the legacy/unattributed view; the response always says which view you got.",
} as const;

/** What a project-scoped read could and could NOT see, carried in the tool's own response. */
export interface ScopeDisclosure {
  projectPath: string | null;
  scoped: boolean;
  note: string;
  counts?: unknown;
}

/**
 * Build the disclosure block. `subject` names the rows in the agent's own vocabulary
 * ("features", "builds"), and `unscopedNote` overrides the default legacy-only text for
 * the routes whose unscoped read is genuinely global (the GDD synthesis).
 *
 * `counts` is always the BACKEND's own scope report — never recomputed here, so the
 * disclosure cannot disagree with the read it describes. A missing/failed report is
 * reported in place rather than swallowed: an agent must never read "0 rows" as
 * "nothing exists" when the truth is "another project owns them".
 */
export function scopedRead(
  projectPath: string | undefined,
  subject: string,
  opts: { unscopedNote?: string; counts?: unknown } = {},
): ScopeDisclosure {
  const note = projectPath
    ? `Scoped to project "${projectPath}": this read sees that project's ${subject} PLUS the unattributed legacy rows (project_id = '').`
    : opts.unscopedNote
      ?? `UNSCOPED — no projectPath was given, so this read sees ONLY the unattributed legacy rows (project_id = ''), NOT every ${subject}. Rows owned by a named project are excluded. Pass projectPath to see a project's own ${subject}.`;
  return { projectPath: projectPath ?? null, scoped: !!projectPath, note, counts: opts.counts };
}

/** Pull the backend's own `scope` block out of a route payload, saying so when it has none. */
export function backendScope(result: unknown): unknown {
  if (result && typeof result === 'object' && 'scope' in result) return (result as { scope: unknown }).scope;
  return { error: 'the backend returned no scope report for this read — its row counts per project are unknown' };
}

export const STR = { type: 'string' } as const;
export const NUM = { type: 'number' } as const;
export const BOOL = { type: 'boolean' } as const;
export const OBJ = { type: 'object' } as const;

export function obj(properties: Record<string, unknown>, required: string[] = []) {
  return { type: 'object', properties, required, additionalProperties: false };
}
