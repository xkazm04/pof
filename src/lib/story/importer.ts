/**
 * The storygraph importer — the single door an untrusted document walks through.
 *
 * `parseStoryGraph(input)` is the contract other packages call; `importStoryGraph(input)` is the
 * same read plus the report a reader owes the operator: every node/edge/class `kind` outside the
 * closed core set (§4). Those are PRESERVED in the graph exactly as written — never dropped, never
 * coerced — and listed here so a surface can render them as labelled generic nodes.
 *
 * A note on the type: `StoryNode.kind` is the closed union, but at runtime an imported node may
 * carry a kind outside it. Consumers that switch on `kind` must keep a default branch; the
 * `unknownKinds` list is how they learn it happened. (Reported as a counter-proposal: `types.ts`
 * could model this as `StoryNodeKind | UnknownKind` once every consumer has a default branch.)
 */

import type { z } from 'zod';
import type { StoryGraph } from '@/lib/story/types';
import { err, ok, type Result } from '@/types/result';
import { CORE_EDGE_KINDS, CORE_NODE_KINDS, storyGraphSchema } from '@/lib/story/schema';

export interface UnknownKind {
  /** Where the unknown kind was met. */
  where: 'node' | 'edge' | 'nodeClass';
  /** The node, edge or node-class id carrying it. */
  id: string;
  kind: string;
}

export interface StoryImport {
  graph: StoryGraph;
  unknownKinds: UnknownKind[];
}

const NODE_KINDS: ReadonlySet<string> = new Set(CORE_NODE_KINDS);
const EDGE_KINDS: ReadonlySet<string> = new Set(CORE_EDGE_KINDS);
const MAX_ISSUES_SHOWN = 12;

function pathOf(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === 'number') return `${acc}[${seg}]`;
    return acc ? `${acc}.${String(seg)}` : String(seg);
  }, '');
}

/**
 * One readable error string from a zod failure. A failure inside `variables` leads, loudly: the
 * standard forbids a reader from degrading an unreadable declaration block to "unconstrained".
 */
export function formatStoryIssues(error: z.ZodError): string {
  const lines = error.issues.map((i) => `${pathOf(i.path) || '(document)'}: ${i.message}`);
  const shown = lines.slice(0, MAX_ISSUES_SHOWN).join('; ');
  const more = lines.length > MAX_ISSUES_SHOWN ? ` (+${lines.length - MAX_ISSUES_SHOWN} more)` : '';
  const varsFailed = error.issues.some((i) => i.path[0] === 'variables');
  const lead = varsFailed
    ? 'variables block failed to parse — document refused (pof.storygraph/1 §3: never degraded to unconstrained). '
    : 'not a valid pof.storygraph/1 document. ';
  return `${lead}${shown}${more}`;
}

/** Every kind outside the closed core sets, in document order. */
export function findUnknownKinds(graph: StoryGraph): UnknownKind[] {
  const out: UnknownKind[] = [];
  for (const n of graph.nodes) {
    if (!NODE_KINDS.has(n.kind)) out.push({ where: 'node', id: n.id, kind: n.kind });
  }
  for (const e of graph.edges) {
    if (!EDGE_KINDS.has(e.kind)) out.push({ where: 'edge', id: e.id, kind: e.kind });
  }
  for (const c of graph.profile.nodeClasses ?? []) {
    if (!NODE_KINDS.has(c.coreKind)) out.push({ where: 'nodeClass', id: c.id, kind: c.coreKind });
  }
  return out;
}

/** Accepts a parsed object or JSON text. */
export function importStoryGraph(input: unknown): Result<StoryImport, string> {
  let doc = input;
  if (typeof input === 'string') {
    try {
      doc = JSON.parse(input);
    } catch (e) {
      return err(`not JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const parsed = storyGraphSchema.safeParse(doc);
  if (!parsed.success) return err(formatStoryIssues(parsed.error));
  // The schema keeps `kind` open on purpose (see schema.ts); this cast is where the open string
  // meets the closed type, and `unknownKinds` is the honest record of the difference.
  const graph = parsed.data as unknown as StoryGraph;
  return ok({ graph, unknownKinds: findUnknownKinds(graph) });
}

export function parseStoryGraph(input: unknown): Result<StoryGraph, string> {
  const r = importStoryGraph(input);
  return r.ok ? ok(r.data.graph) : r;
}
