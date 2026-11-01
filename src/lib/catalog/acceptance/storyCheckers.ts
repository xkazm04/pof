/**
 * Story-graph acceptance: `pof.storygraph/1` documents graded by the structural pass
 * (`@/lib/story/validate`, standard §8). Each checker reads ONE artifact field (default
 * `storyGraph`) holding the document as an object or JSON text, and grades a fixed slice of the
 * structural codes — every structural code belongs to exactly one checker:
 *
 *   storyGraphParses        — the document passes the importer (schema + loud variables block)
 *   storyStructurallySound  — DANGLING_EDGE, DUPLICATE_ID, CONTAINMENT_CYCLE, ORPHAN_NODE
 *   storyEndingsAttainable  — ENDING_UNREACHABLE, NO_ENDING_REACHABLE, UNDECLARED_TERMINAL
 *   storyVariablesDeclared  — VAR_* and UNTYPED_CONDITION
 *   storyChoicesReal        — FALSE_CHOICE
 *   storyBudgetsHeld        — TEXT_BUDGET_EXCEEDED
 *
 * `storyGraphAcceptance` composes all six with `allOf` (first non-pass speaks). A finding of
 * severity `error` or `warn` fails its checker; `info` passes and is named in the detail. All
 * tier L0 (data-derived). A pass here is NOT "playable": structural proof is necessary and never
 * sufficient, and the state altitude (the walker) is a separate gate. Not yet registered in any
 * pipeline; the `story-arcs` row adopts them later.
 */

import type { AcceptanceResult, Checker } from './types';
import { allOf } from './combinators';
import { markContentInvariant } from './contentInvariant';
import { tagRequiredFields } from './requiredFields';
import { parseStoryGraph } from '@/lib/story/importer';
import { validateStoryGraph } from '@/lib/story/validate';
import type { StoryFinding, StoryFindingCode, StoryGraph } from '@/lib/story/types';
import type { Result } from '@/types/result';

export const STORY_GRAPH_FIELD = 'storyGraph';
const SHAPE = 'a pof.storygraph/1 document (docs/architecture/storygraph-standard.md): { format, project, graphId, revision, profile, variables, entries, nodes, edges, endings, budgets }';
const MAX_NAMED = 5;

type Graded = Result<{ graph: StoryGraph; findings: StoryFinding[] }, string>;

/** One parse + one structural pass per artifact value, however many checkers read it. */
const cache = new WeakMap<object, Graded>();
function grade(value: unknown): Graded {
  if (value !== null && typeof value === 'object' && cache.has(value)) return cache.get(value)!;
  const parsed = parseStoryGraph(value);
  const out: Graded = parsed.ok ? { ok: true, data: { graph: parsed.data, findings: validateStoryGraph(parsed.data) } } : parsed;
  if (value !== null && typeof value === 'object') cache.set(value, out);
  return out;
}

const absent = (v: unknown) => v === undefined || v === null || v === '';

export function storyGraphParses(field = STORY_GRAPH_FIELD, label = 'Story graph parses'): Checker {
  return tagRequiredFields((data) => {
    const v = data[field];
    if (absent(v)) return { label, tier: 'L0', status: 'pending', detail: 'no story graph', reason: `field "${field}" holds no pof.storygraph/1 document — produce one` };
    const g = grade(v);
    if (!g.ok) return { label, tier: 'L0', status: 'fail', detail: 'not a valid storygraph', reason: g.error };
    const { graph } = g.data;
    return { label, tier: 'L0', status: 'pass', detail: `${graph.graphId} r${graph.revision} · ${graph.nodes.length} nodes · ${graph.edges.length} edges` };
  }, { field, shape: SHAPE });
}

/** A checker over a fixed slice of structural codes. */
function slice(field: string, label: string, codes: readonly StoryFindingCode[], what: string): Checker {
  const own = new Set<string>(codes);
  return markContentInvariant(tagRequiredFields((data): AcceptanceResult => {
    const v = data[field];
    if (absent(v)) return { label, tier: 'L0', status: 'pending', detail: 'no story graph', reason: `field "${field}" holds no pof.storygraph/1 document — produce one` };
    const g = grade(v);
    if (!g.ok) return { label, tier: 'L0', status: 'fail', detail: 'not a valid storygraph', reason: `cannot check ${what}: ${g.error}` };
    const mine = g.data.findings.filter((f) => own.has(f.code));
    const blocking = mine.filter((f) => f.severity !== 'info');
    const info = mine.length - blocking.length;
    if (blocking.length === 0) {
      return { label, tier: 'L0', status: 'pass', detail: `${what}: 0 findings${info ? ` (${info} info)` : ''} · structural only, not a playability claim` };
    }
    const byCode = new Map<string, number>();
    for (const f of blocking) byCode.set(f.code, (byCode.get(f.code) ?? 0) + 1);
    const counts = [...byCode].map(([c, n]) => `${c} ×${n}`).join(', ');
    const named = blocking.slice(0, MAX_NAMED).map((f) => `${f.code}: ${f.detail}`).join(' | ');
    const more = blocking.length > MAX_NAMED ? ` (+${blocking.length - MAX_NAMED} more)` : '';
    return { label, tier: 'L0', status: 'fail', detail: `${blocking.length} finding(s): ${counts}`, reason: `${named}${more}` };
  }, { field, shape: SHAPE }));
}

export const storyStructurallySound = (field = STORY_GRAPH_FIELD, label = 'Story graph structurally sound') =>
  slice(field, label, ['DANGLING_EDGE', 'DUPLICATE_ID', 'CONTAINMENT_CYCLE', 'ORPHAN_NODE'], 'graph integrity and forward reachability');

export const storyEndingsAttainable = (field = STORY_GRAPH_FIELD, label = 'Story endings attainable') =>
  slice(field, label, ['ENDING_UNREACHABLE', 'NO_ENDING_REACHABLE', 'UNDECLARED_TERMINAL'], 'endings and co-reachability');

export const storyVariablesDeclared = (field = STORY_GRAPH_FIELD, label = 'Story variables declared') =>
  slice(
    field,
    label,
    ['VAR_UNDECLARED', 'VAR_NO_REACHING_WRITE', 'VAR_DOMAIN_VIOLATION', 'VAR_WRITER_NOT_OWNER', 'VAR_SINGLETON', 'UNTYPED_CONDITION'],
    'the variable contract',
  );

export const storyChoicesReal = (field = STORY_GRAPH_FIELD, label = 'Story choices real') =>
  slice(field, label, ['FALSE_CHOICE'], 'choices');

export const storyBudgetsHeld = (field = STORY_GRAPH_FIELD, label = 'Story text budgets held') =>
  slice(field, label, ['TEXT_BUDGET_EXCEEDED'], 'text budgets');

/** All six, parse first — the step-level verdict a `story-arcs` row will use. */
export function storyGraphAcceptance(field = STORY_GRAPH_FIELD): Checker {
  return allOf(
    storyGraphParses(field),
    storyStructurallySound(field),
    storyEndingsAttainable(field),
    storyVariablesDeclared(field),
    storyChoicesReal(field),
    storyBudgetsHeld(field),
  );
}
