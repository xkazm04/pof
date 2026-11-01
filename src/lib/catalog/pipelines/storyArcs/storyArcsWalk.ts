/**
 * The story-arcs row's deterministic Produce bodies and its Impact Walk freshness checker.
 *
 * Starter graph: `generateStoryGraph` (structurally clean by construction, `@/lib/story/fixtures`)
 * seeded from the entity id, so the same entity always yields the same document. Its prose is
 * filler and says so in `source.note`; the live CLI produce authors the real arc. The operator's
 * direction steers its size (`nodes N`, clamped).
 *
 * Impact Walk: `sampleGraph` (`@/lib/story/walker`, pof-walker@1) at a small fixed sample count,
 * summarised as `{engine, seed, samples, graphHash, gradeable, leadCounts}`. The summary is BOUND
 * to the graph it walked by `graphHash`; the checker compares that to the CURRENT Story Graph
 * sibling and, when they differ, grades a fresh walk of the current graph instead. Walker findings
 * are LEADS: counted, never failing.
 *
 * Limitation and its answer: `StepSpec.produce(entity, direction)` cannot read sibling artifacts, so
 * the walk Produce re-derives the STARTER graph rather than reading the stored one. A graph authored
 * by the live CLI (or resized with a different `nodes N`) therefore makes the STORED record stale, and
 * re-producing cannot refresh it. The VERDICT does not depend on the record being fresh: when the hash
 * differs the checker walks the CURRENT graph itself (the walker is pure and fast, memoised per graph
 * object) and grades that, saying plainly that the stored record is old. A stale record is never the
 * thing that passes — a walk of the current graph is.
 */
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { AcceptanceResult, Checker } from '@/lib/catalog/acceptance/types';
import { tagRequiredFields } from '@/lib/catalog/acceptance/requiredFields';
import { generateStoryGraph } from '@/lib/story/fixtures';
import { parseStoryGraph } from '@/lib/story/importer';
import { sampleGraph } from '@/lib/story/walker';
import type { StoryGraph } from '@/lib/story/types';
import { storyContentHashSync } from './storyArcsHash';

export const STORY_GRAPH_STEP = 'Story Graph';
export const WALK_FIELD = 'walk';
export const WALK_SAMPLES = 64;
const DEFAULT_NODES = 14;
const MIN_NODES = 4;
const MAX_NODES = 64;

export interface WalkSummary {
  engine: string;
  seed: number;
  samples: number;
  graphHash: string;
  gradeable: boolean;
  /** Lead code -> count. A code with no lead is absent (never a measured 0). */
  leadCounts: Record<string, number>;
}

const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'arc';
const intIn = (dir: string | undefined, key: string): number | null => {
  const m = new RegExp(`\\b${key}\\s*[:=]?\\s*(\\d+)`, 'i').exec(dir ?? '');
  return m ? Number(m[1]) : null;
};
const seedOf = (id: string) => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) || 1;

/** `nodes N` in the direction sets the starter's size (clamped); otherwise the default. */
export function starterNodes(direction?: string): number {
  const n = intIn(direction, 'nodes?');
  return n == null ? DEFAULT_NODES : Math.min(MAX_NODES, Math.max(MIN_NODES, n));
}

/** The deterministic starter `pof.storygraph/1` document for an entity. */
export function starterStoryGraph(entity: LabEntity, direction?: string): StoryGraph {
  const nodes = starterNodes(direction);
  const g = generateStoryGraph({ nodes, seed: seedOf(entity.id), project: 'pof', graphId: `arc-${slug(entity.name)}` });
  return {
    ...g,
    source: { ...g.source, entity: entity.id, note: `Starter topology for "${entity.name}" (${nodes} nodes). Prose is filler, not writing — author the arc through the live produce.` },
  };
}

/** Walk a graph and summarise it. `seed N` in the direction picks the walk seed (default 1). */
export function walkSummary(graph: StoryGraph, direction?: string): WalkSummary {
  const seed = intIn(direction, 'seed') ?? 1;
  const parsed = parseStoryGraph(graph);
  if (!parsed.ok) throw new Error(`story-arcs walk: starter graph does not parse — ${parsed.error}`);
  const graphHash = storyContentHashSync(parsed.data);
  const report = sampleGraph(parsed.data, { seed, samples: WALK_SAMPLES, graphHash });
  const leadCounts: Record<string, number> = {};
  for (const f of report.findings) leadCounts[f.code] = (leadCounts[f.code] ?? 0) + 1;
  return { engine: report.engine, seed, samples: report.samples, graphHash, gradeable: report.gradeable, leadCounts };
}

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const isCountMap = (v: unknown) =>
  v != null && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((n) => Number.isInteger(n) && (n as number) > 0);

function shapeError(w: unknown): string | null {
  if (w == null || typeof w !== 'object') return 'walk summary is not an object';
  const s = w as Partial<WalkSummary>;
  if (typeof s.engine !== 'string' || !s.engine) return 'walk.engine missing';
  if (!Number.isInteger(s.seed)) return 'walk.seed is not an integer';
  if (!Number.isInteger(s.samples) || (s.samples as number) < 1) return 'walk.samples must be a positive integer';
  if (typeof s.graphHash !== 'string' || !HASH_RE.test(s.graphHash)) return 'walk.graphHash is not a sha256:<64 hex> content hash';
  if (typeof s.gradeable !== 'boolean') return 'walk.gradeable missing';
  if (!isCountMap(s.leadCounts)) return 'walk.leadCounts must map lead codes to positive counts (absent = none)';
  return null;
}

const hashOfStored = new WeakMap<object, string | null>();
function currentHash(value: unknown): string | null {
  if (value !== null && typeof value === 'object' && hashOfStored.has(value)) return hashOfStored.get(value)!;
  const parsed = parseStoryGraph(value);
  const out = parsed.ok ? storyContentHashSync(parsed.data) : null;
  if (value !== null && typeof value === 'object') hashOfStored.set(value, out);
  return out;
}

const recomputed = new WeakMap<object, WalkSummary>();
/** One walk of the CURRENT graph per graph object, however many renders / graders read it. */
function currentWalk(value: unknown, graph: StoryGraph, seed: number): WalkSummary {
  if (value !== null && typeof value === 'object' && recomputed.has(value)) return recomputed.get(value)!;
  const out = walkSummary(graph, `seed ${seed}`);
  if (value !== null && typeof value === 'object') recomputed.set(value, out);
  return out;
}

const leadText = (c: Record<string, number>) => {
  const e = Object.entries(c);
  return e.length ? `LEADS (not defects): ${e.map(([k, n]) => `${k} ×${n}`).join(', ')}` : 'no leads';
};

/**
 * Pass when a well-formed summary exists AND the current Story Graph walks: if the summary's
 * `graphHash` equals the current content hash it is graded as stored; if not, the CURRENT graph is
 * walked here and that walk is graded (the stale record is named, never the thing that passes). A
 * current graph that does not parse fails. No graph yet -> pending. With no CheckerContext at all
 * (a rollup path) freshness cannot be checked: the shape grades and the detail SAYS it was not
 * checked, per the CheckerContext contract that absence must not regress a satisfied step.
 */
export function storyWalkFresh(label = 'Impact walk bound to the current graph'): Checker {
  return tagRequiredFields((data, ctx): AcceptanceResult => {
    const w = data[WALK_FIELD];
    if (w == null) return { label, tier: 'L0', status: 'pending', detail: 'no walk summary', reason: `field "${WALK_FIELD}" holds no walk summary — produce one` };
    const bad = shapeError(w);
    if (bad) return { label, tier: 'L0', status: 'fail', detail: 'malformed walk summary', reason: bad };
    const s = w as WalkSummary;
    const head = `${s.engine} · seed ${s.seed} · ${s.samples} walks${s.gradeable ? '' : ' · NOT gradeable (expr guards)'} · ${leadText(s.leadCounts)}`;
    if (!ctx) return { label, tier: 'L0', status: 'pass', detail: `${head} · freshness NOT checked (no sibling context)` };
    const graph = ctx.siblings?.[STORY_GRAPH_STEP]?.storyGraph;
    if (graph == null || graph === '') {
      return { label, tier: 'L0', status: 'pending', detail: 'no story graph yet', reason: `produce "${STORY_GRAPH_STEP}" first — a walk binds to a graph` };
    }
    const now = currentHash(graph);
    if (now == null) return { label, tier: 'L0', status: 'fail', detail: 'current story graph does not parse', reason: `the "${STORY_GRAPH_STEP}" document is not a valid pof.storygraph/1 — fix it, then re-walk` };
    if (now !== s.graphHash) {
      // The stored record is for an older graph. Grade a walk of the CURRENT graph, not the record.
      const parsed = parseStoryGraph(graph);
      if (!parsed.ok) return { label, tier: 'L0', status: 'fail', detail: 'current story graph does not parse', reason: parsed.error };
      const cur = currentWalk(graph, parsed.data, s.seed);
      const curHead = `${cur.engine} · seed ${cur.seed} · ${cur.samples} walks${cur.gradeable ? '' : ' · NOT gradeable (expr guards)'} · ${leadText(cur.leadCounts)}`;
      return {
        label, tier: 'L0', status: 'pass',
        detail: `${curHead} · walked the CURRENT graph ${now.slice(0, 19)}… — the stored record (${s.graphHash.slice(0, 19)}…) is for an older graph`,
      };
    }
    return { label, tier: 'L0', status: 'pass', detail: `${head} · bound to ${now.slice(0, 19)}…` };
  }, { field: WALK_FIELD, shape: '{ engine, seed, samples, graphHash: "sha256:<hex> of the current Story Graph", gradeable, leadCounts: { <LEAD_CODE>: count } }' });
}
