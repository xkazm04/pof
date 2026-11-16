/**
 * The ONE declaration of what a drain request accepts.
 *
 * `POST /api/pipeline-artifacts/drain` used to narrow its body with an inline cast, so the
 * accepted surface existed only inside the route — and the headless caller (`pof_drain_gates`
 * in `tools/pof-mcp`) advertised a strictly SMALLER schema (single required entityId), which
 * meant the catalog-wide / global / multi-entity drains the route supports were unreachable
 * from an agent. Both sides now key off {@link DRAIN_REQUEST_KEYS}, and a parity test asserts
 * the MCP tool exposes exactly this surface.
 */
import { parseDrainFilter, type DrainFilter } from './drain';

/** Every key the drain POST body honours. Extend HERE (route + MCP schema follow). */
export const DRAIN_REQUEST_KEYS = [
  'tier',
  'catalogId',
  'entityId',
  'entityIds',
  'executor',
  'port',
  'allowSpawn',
  'limit',
  'screenshotPath',
  'visualMode',
  'projectPath',
  'autoCapture',
] as const;

export type DrainRequestKey = (typeof DRAIN_REQUEST_KEYS)[number];

export type DrainVisualMode = 'hud' | 'texture' | 'lighting' | 'character';

/** The normalized, typed drain request — filter (scope) + run options. */
export interface DrainRequest {
  /** tier / catalogId / entityId / entityIds — what to collect. */
  filter: DrainFilter;
  executor: 'bridge' | 'spawn';
  port?: number;
  allowSpawn?: boolean;
  limit?: number;
  screenshotPath?: string;
  visualMode?: DrainVisualMode;
  projectPath?: string;
  autoCapture?: boolean;
}

const VISUAL_MODES: readonly string[] = ['hud', 'texture', 'lighting', 'character'];

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
/** A strictly positive integer, else undefined (a port / run limit of 0, -1 or 1.5 is meaningless). */
function posNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined;
}

/** The numeric run options a request may carry. */
const NUMERIC_RUN_KEYS = ['port', 'limit'] as const;

/**
 * Numeric run options the caller SENT but that are not a positive integer (`limit: -5`,
 * `port: -1`, `limit: "2"`). `parseDrainRequest` drops them, so without this check a typo ran as
 * an unlimited drain (or a default-port probe) under a 200; the route refuses naming the key,
 * the same way it refuses an unparsed scope key. Pure.
 */
export function invalidRunOptions(raw: unknown): string[] {
  const body = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  return NUMERIC_RUN_KEYS.filter((k) => body[k] !== undefined && body[k] !== null && posNum(body[k]) === undefined);
}

/**
 * Normalize an arbitrary JSON body into a {@link DrainRequest}. Unknown keys are ignored;
 * every scope key is parsed by the SAME `parseDrainFilter` the GET route uses, so a batch
 * previewed via GET and run via POST resolve to an identical filter. Pure.
 */
export function parseDrainRequest(raw: unknown): DrainRequest {
  const body = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const filter = parseDrainFilter((k) => body[k]);
  const visualMode = str(body.visualMode);
  return {
    filter,
    executor: body.executor === 'spawn' ? 'spawn' : 'bridge',
    ...(posNum(body.port) !== undefined ? { port: posNum(body.port)! } : {}),
    ...(body.allowSpawn === true ? { allowSpawn: true } : {}),
    ...(posNum(body.limit) !== undefined ? { limit: posNum(body.limit)! } : {}),
    ...(str(body.screenshotPath) ? { screenshotPath: str(body.screenshotPath)! } : {}),
    ...(visualMode && VISUAL_MODES.includes(visualMode) ? { visualMode: visualMode as DrainVisualMode } : {}),
    ...(str(body.projectPath) ? { projectPath: str(body.projectPath)! } : {}),
    ...(body.autoCapture === true ? { autoCapture: true } : {}),
  };
}
