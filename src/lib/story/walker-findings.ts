/**
 * The walker's findings: §8's state-altitude codes, every one a LEAD — `altitude: 'state'`, a
 * `lead: {seed, engine, samples, state, path}`, and wording that never claims a proven defect.
 *
 *   SOFTLOCK_LEAD         a reached (node, state) whose outgoing guards all fail (chance read as
 *                         possible). Structural dead ends are WP2's UNDECLARED_TERMINAL, not this.
 *   GUARD_UNSATISFIABLE   a guard no state within the declared domains satisfies (`satisfiability.ts`).
 *                         Domain-wide, so its `lead.state` is empty and its path is a structural witness.
 *   OPTION_NEVER_OFFERED  an option at a choice the walks DID reach that no reached state offered.
 *   NODE_NEVER_REACHED    structurally reachable (so not WP2's ORPHAN_NODE / ENDING_UNREACHABLE),
 *                         reached by no walk of any cohort. Only when samples > 0.
 *   ENDING_BELOW_FLOOR    an ending's arrivals under its floor (`WalkerOptions.floors`, or a numeric
 *                         `endings[].floor`), per cohort.
 * Pure.
 */

import type { Cond, StoryFinding, StoryFindingCode, StoryLead, WalkerCohort, WalkerCohortOutcome } from '@/lib/story/types';
import { STORY_FINDING_CODES } from '@/lib/story/types';
import { bfsTree, isReached, pathTo } from '@/lib/story/reachability';
import { walkCond } from '@/lib/story/variables';
import { guardSatisfiability, type SatContext } from '@/lib/story/satisfiability';
import { initialState, type VarState } from '@/lib/story/walker-state';
import type { Site, WalkModel } from '@/lib/story/walker-model';

export interface Snapshot {
  state: VarState;
  path: string[];
  cohort: string;
  sample: number;
}

export interface WalkStats {
  ids: readonly string[];
  /** Per cohort, per node index: walks that reached it. */
  reach: Uint32Array[];
  /** Display id of the stall -> its site, stalls per cohort, the first stall's snapshot. */
  stalls: Map<string, { site: Site; byCohort: Record<string, number>; first: Snapshot }>;
  /**
   * Per reached choice: visits, visits at which each option (by `Site.optionKeys` index) was
   * offered, and the first visit at which some option was NOT offered.
   */
  choices: Map<string, { visits: number; offered: Uint32Array; partial?: Snapshot }>;
}

export interface FindingContext {
  seed: number;
  samples: number;
  cohorts: readonly WalkerCohort[];
  engine: string;
  floors?: Readonly<Record<string, number>>;
  outcomes: Readonly<Record<string, WalkerCohortOutcome>>;
}

export const STATE_SEVERITY: Readonly<Partial<Record<StoryFindingCode, StoryFinding['severity']>>> = {
  SOFTLOCK_LEAD: 'warn',
  GUARD_UNSATISFIABLE: 'warn',
  OPTION_NEVER_OFFERED: 'warn',
  NODE_NEVER_REACHED: 'info',
  ENDING_BELOW_FLOOR: 'warn',
};

const LEAD = 'A lead to reproduce, not a proven defect.';
const ORDER = new Map<string, number>(STORY_FINDING_CODES.map((c, i) => [c, i]));

function readVars(conds: readonly (Cond | undefined)[], defs?: Readonly<Record<string, Cond>>): string[] {
  const out = new Set<string>();
  for (const c of conds) walkCond(c, (a) => { if ('var' in a && typeof a.var === 'string') out.add(a.var); }, defs);
  return [...out].sort();
}

export function buildWalkerFindings(model: WalkModel, stats: WalkStats, ctx: FindingContext): StoryFinding[] {
  const { topo, graph } = model;
  const out: StoryFinding[] = [];
  const lead = (state: VarState, path: readonly string[]): StoryLead => ({ seed: ctx.seed, engine: ctx.engine, samples: ctx.samples, state, path });
  const state = (code: StoryFindingCode, nodes: string[], detail: string, l: StoryLead, variables?: string[]) => {
    const f: StoryFinding = { code, altitude: 'state', severity: STATE_SEVERITY[code] ?? 'warn', nodes, detail, lead: l };
    if (variables && variables.length > 0) f.variables = variables;
    out.push(f);
  };
  let tree: Map<string, string | null> | undefined;
  const witness = (id: string) => {
    tree ??= bfsTree(topo.roots, topo.arcsFrom, () => true);
    return tree.has(id) ? pathTo(tree, id) : [];
  };
  const walks = ctx.samples * ctx.cohorts.length;
  const defs = graph.definitions;

  for (const [d, s] of stats.stalls) {
    const site = s.site;
    const n = Object.values(s.byCohort).reduce((a, b) => a + b, 0);
    const by = Object.entries(s.byCohort).map(([c, k]) => `${c} ${k}`).join(', ');
    state('SOFTLOCK_LEAD', [d], `${n} of ${walks} walks (${by}) stopped at ${d}: ${site.authored.length} outgoing traversal edge(s), none of whose guards holds in the reached state. ${LEAD}`,
      lead(s.first.state, s.first.path), readVars(site.guards, defs));
  }

  const sat: SatContext = { variables: model.vars, setVars: model.setVars, axis: graph.profile?.axis, definitions: defs };
  const deadEndings = new Set<string>();
  for (const e of graph.endings) {
    if (!e.when || !topo.nodeById.has(e.node) || topo.excluded.has(e.node)) continue;
    if (guardSatisfiability(e.when, sat) !== 'unsat') continue;
    deadEndings.add(e.node);
    state('GUARD_UNSATISFIABLE', [e.node], `ending ${e.node}'s own when cannot hold in any state within the declared domains. ${LEAD}`, lead({}, witness(e.node)), readVars([e.when], defs));
  }
  for (const a of topo.arcs) {
    if (!a.edge || deadEndings.has(a.to)) continue;
    const site = model.site(a.from);
    const g = site.guards[site.authored.indexOf(a)];
    if (!g || guardSatisfiability(g, sat) !== 'unsat') continue;
    const withEnding = model.endingByNode.get(a.to)?.when ? ` (with ending ${a.to}'s own when)` : '';
    state('GUARD_UNSATISFIABLE', [a.edge.from], `guard on edge ${a.edge.id} (${a.edge.from} -> ${a.edge.to})${withEnding} cannot hold in any state within the declared domains. ${LEAD}`,
      lead({}, witness(a.edge.from)), readVars([g], defs));
  }

  for (const [pos, ch] of stats.choices) {
    const site = model.site(pos);
    site.optionKeys.forEach((key, k) => {
      if (ch.offered[k] > 0) return;
      const snap = ch.partial!;
      const guards = site.byKey[k].map((i) => site.guards[i]);
      state('OPTION_NEVER_OFFERED', [pos], `option "${key}" at ${pos} was offered at none of ${ch.visits} visits over ${walks} walks: no sampled reachable state satisfied its guard. ${LEAD}`,
        lead(snap.state, snap.path), readVars(guards, defs));
    });
  }

  if (ctx.samples > 0) {
    const start = initialState(model.vars, model.setVars);
    stats.ids.forEach((id, idx) => {
      if (topo.excluded.has(id) || !isReached(topo, id) || stats.reach.some((r) => r[idx] > 0)) return;
      state('NODE_NEVER_REACHED', [id], `${id} is structurally reachable but no walk reached it (0 of ${walks}). The path is a structural witness; the state is the declared start. ${LEAD}`,
        lead(start, witness(id)));
    });
    for (const e of graph.endings) {
      const declared = (e as { floor?: unknown }).floor;
      const floor = ctx.floors?.[e.node] ?? (typeof declared === 'number' ? declared : undefined);
      if (floor === undefined) continue;
      for (const co of ctx.cohorts) {
        const got = ((ctx.outcomes[co.id]?.endings[e.node] ?? 0) * 100) / ctx.samples;
        if (got >= floor) continue;
        state('ENDING_BELOW_FLOOR', [e.node], `ending ${e.node} reached by ${Math.round(got * 100) / 100}% of ${co.id} walks (${ctx.samples}), under its floor ${floor}%. ${LEAD}`,
          lead({}, witness(e.node)));
      }
    }
  }

  const key = (f: StoryFinding) => `${f.nodes[0] ?? ''}\u0000${f.detail}`;
  return out.sort((a, b) => (ORDER.get(a.code)! - ORDER.get(b.code)!) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
