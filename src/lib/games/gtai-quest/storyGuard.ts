/**
 * Story guard: does this quest compose with the GTAI campaign without breaking it?
 *
 * Two layers (registry `content-pipeline/branching-narrative-graph-validation`):
 *  1. Direct contract checks on the design's story hook and cast (protected canon, owner-owned
 *     arc variables, undeclared names, reads of state that only a later act writes, cast continuity).
 *  2. A COMPOSITION DIFF: the campaign graph (`pof.storygraph/1`) is built from the ledger without
 *     and then with the design merged in, and the structural validator runs on both. Every
 *     error-severity finding that is new in "with" is reported as `GRAPH_<code>`. A graph finding
 *     on a variable layer 1 already flagged is not repeated (one code per fact).
 *
 * The variable contract is the registry's state-variable declaration contract: every variable is
 * declared with type, domain, initial value and owning writers. Quest-scoped variables are the
 * `q_` namespace; they are declared from the quests that use them, with `initial: null` and
 * `requiresWrite`, so a quest reading a `q_` flag nobody writes earlier is a reaching-write defect.
 * Pure: no I/O.
 */

import { validateStoryGraph } from '@/lib/story/validate';
import type { Cond, StoryEdge, StoryFinding, StoryGraph, StoryNode, StoryVariable, StoryVarType } from '@/lib/story/types';
import {
  BASELINE_VARIABLES,
  ENDING_NODE,
  GTAI_ARC,
  GTAI_CAST,
  PROTECTED_VAR_NAMES,
  firstWriterAct,
} from '@/lib/games/gtai-quest/campaignBaseline';
import { ACT_IDS } from '@/lib/games/gtai-quest/types';
import type { ActId, GuardFinding, GuardVerdict, QuestDesign, QuestGuardContext } from '@/lib/games/gtai-quest/types';

/** Variables only the owner may set; no quest may write them (protected unknowns). */
export const PROTECTED_VARS: readonly string[] = PROTECTED_VAR_NAMES;

/** The prefix of quest-scoped variables a quest may declare for itself. */
export const QUEST_VAR_PREFIX = 'q_';

const BASELINE = new Map(BASELINE_VARIABLES.map((v) => [v.name, v]));
const actIndex = (a: ActId): number => ACT_IDS.indexOf(a);
const questNodeId = (id: string): string => `quest.${id}`;
const BEATS = new Map(GTAI_ARC.flatMap((a) => a.beats.map((b) => [b.id, { ...b, act: a.act }] as const)));

/** Beats whose realisation would resolve open canon (who betrays; what the 4th soul is). Claimable only
 *  after the owner decides, by removing the id here in the same change that records the decision. */
export const OPEN_CANON_BEATS: readonly string[] = ['act3.betrayal'];

/** Arc beats a quest may realise (`claimsBeat`): beats that write campaign state, none of it protected,
 *  and none whose realisation would resolve open canon. */
export function claimableBeats(): { id: string; act: ActId; title: string; writes: readonly string[] }[] {
  return [...BEATS.values()]
    .filter((b) => b.writes.length > 0 && !b.writes.some((v) => (PROTECTED_VAR_NAMES as readonly string[]).includes(v)) && !OPEN_CANON_BEATS.includes(b.id))
    .map((b) => ({ id: b.id, act: b.act, title: b.title, writes: b.writes }));
}

const claimable = (beatId: string | undefined, act: ActId) => {
  const b = beatId ? BEATS.get(beatId) : undefined;
  return b && b.act === act && claimableBeats().some((c) => c.id === b.id) ? b : undefined;
};

interface MergeItem {
  id: string;
  design: QuestDesign;
}

/**
 * Merge order: by act, then by id — except that inside one act a quest that reads a `q_` variable
 * another same-act quest writes is placed after it (a stable topological pass). A dependency cycle
 * falls back to id order, and the validator then reports the read with no reaching write.
 */
function sortItems(items: readonly MergeItem[]): MergeItem[] {
  const byId = [...items].sort((a, b) => actIndex(a.design.act) - actIndex(b.design.act) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: MergeItem[] = [];
  for (const act of ACT_IDS) {
    const pending = byId.filter((i) => i.design.act === act);
    const writes = (i: MergeItem, v: string) => i.design.story.writes.some((w) => w.var === v);
    while (pending.length) {
      const ready = pending.findIndex((i) =>
        !i.design.story.reads.some((r) => !writes(i, r) && pending.some((o) => o !== i && writes(o, r))));
      out.push(pending.splice(ready === -1 ? 0 : ready, 1)[0]);
    }
  }
  return out;
}

function inferType(value: unknown): StoryVarType {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  if (typeof value === 'string') return 'enum';
  return 'bool';
}

/** Declare every `q_` variable the items touch: type from the first write, writers = writing quests. */
function questVariables(items: readonly MergeItem[]): StoryVariable[] {
  const vars = new Map<string, StoryVariable & { values: unknown[] }>();
  const touch = (name: string) => {
    let v = vars.get(name);
    if (!v) {
      v = { name, type: 'bool', domain: {}, initial: null, requiresWrite: true, writers: [], scope: 'quest', external: false, values: [] };
      vars.set(name, v);
    }
    return v;
  };
  const typed = new Set<string>();
  for (const { id, design } of items) {
    for (const w of design.story.writes) {
      if (!w.var.startsWith(QUEST_VAR_PREFIX)) continue;
      const v = touch(w.var);
      if (!typed.has(w.var)) { v.type = inferType(w.value); typed.add(w.var); }
      if (typeof w.value === 'string' && !v.values.includes(w.value)) v.values.push(w.value);
      if (!v.writers.includes(questNodeId(id))) v.writers = [...v.writers, questNodeId(id)];
    }
    for (const r of design.story.reads) if (r.startsWith(QUEST_VAR_PREFIX)) touch(r);
  }
  return [...vars.values()].map(({ values, ...v }) => ({ ...v, domain: v.type === 'enum' ? { values } : {} }));
}

function readGuard(design: QuestDesign, types: ReadonlyMap<string, StoryVarType>): Cond | undefined {
  const own = new Set(design.story.writes.map((w) => w.var));
  const atoms: Cond[] = design.story.reads
    .filter((r) => !own.has(r))
    .map((r) => (types.get(r) === 'bool' ? { var: r, op: '==', value: true } : { var: r, op: '!=', value: null }));
  if (atoms.length === 0) return undefined;
  return atoms.length === 1 ? atoms[0] : { all: atoms };
}

function buildGraph(rawItems: readonly MergeItem[]): StoryGraph {
  const items = sortItems(rawItems);
  // A claimed beat is realised by its quest: the beat node leaves the chain and its variables'
  // writer becomes the quest node. The first claimant wins; a second is reported by assessStory.
  const claimedBy = new Map<string, string>();
  for (const { id, design } of items) {
    const b = claimable(design.claimsBeat, design.act);
    if (b && !claimedBy.has(b.id)) claimedBy.set(b.id, questNodeId(id));
  }
  const variables: StoryVariable[] = [
    ...BASELINE_VARIABLES.map((b): StoryVariable => ({
      name: b.name, type: b.type, domain: b.values ? { values: b.values } : {}, initial: b.initial,
      writers: b.writers.map((w) => claimedBy.get(w) ?? w), scope: 'playthrough', external: false, doc: b.doc,
    })),
    ...questVariables(items),
  ];
  const types = new Map(variables.map((v) => [v.name, v.type]));
  const nodes: StoryNode[] = [{ id: 'start', kind: 'entry', class: 'start', title: 'Plant 9', axis: 0, lanes: ['prologue'] }];
  const edges: StoryEdge[] = [];
  const edge = (e: Omit<StoryEdge, 'id' | 'kind'>) => edges.push({ id: `e${edges.length}`, kind: 'then', ...e });

  let prevAct = 'start';
  for (const arc of GTAI_ARC) {
    const ax = actIndex(arc.act);
    const lanes = [arc.act];
    nodes.push({ id: arc.act, kind: 'container', class: 'act', title: arc.title, axis: ax, lanes });
    edge({ from: prevAct, to: arc.act });
    prevAct = arc.act;
    // Chain: owner beats -> this act's ledger quests -> the act's close (or the ending in the finale).
    let prev: { id: string; writes?: StoryEdge['writes'] } | null = null;
    const step = (id: string, when?: Cond) => {
      if (prev) edge({ from: prev.id, to: id, ...(when ? { when } : {}), ...(prev.writes?.length ? { writes: prev.writes } : {}) });
    };
    for (const b of arc.beats) {
      if (claimedBy.has(b.id)) continue;
      const proposal = b.tag === '[proposal]';
      nodes.push({ id: b.id, kind: 'event', class: 'beat', title: b.title, axis: ax, lanes, parent: arc.act, status: b.tag, authoring: proposal ? 'proposal' : 'authored' });
      step(b.id);
      prev = { id: b.id, writes: b.writes.map((v) => ({ var: v, op: 'set' as const, value: true })) };
    }
    for (const { id, design } of items.filter((i) => i.design.act === arc.act)) {
      const nid = questNodeId(id);
      nodes.push({
        id: nid, kind: 'container', class: 'contract', title: design.title, axis: ax, lanes, parent: arc.act,
        realises: [{ catalogId: 'contracts', entityId: id }], authoring: 'generated', source: `games/gtai/quests/${id}/quest.json`,
      });
      step(nid);
      // The quest's reads guard its own entry edge (container -> its play node), never the edge that
      // carries the predecessor's writes: a guard is evaluated before that edge's writes land.
      const play = `${nid}.play`;
      nodes.push({ id: play, kind: 'event', class: 'quest-play', title: design.logline, axis: ax, lanes, parent: nid });
      const when = readGuard(design, types);
      edge({ from: nid, to: play, ...(when ? { when } : {}) });
      prev = { id: nid, writes: design.story.writes.map((w) => ({ var: w.var, op: 'set' as const, value: w.value })) };
    }
    const closeId = arc.act === 'finale' ? ENDING_NODE : `${arc.act}.close`;
    nodes.push(arc.act === 'finale'
      ? { id: closeId, kind: 'ending', class: 'finale', title: 'Ending (punchline [open])', axis: ax, lanes, parent: arc.act, status: '[owner]', authoring: 'authored' }
      : { id: closeId, kind: 'event', class: 'act-close', title: `${arc.title} closes`, axis: ax, lanes, parent: arc.act });
    step(closeId);
  }

  return {
    format: 'pof.storygraph/1',
    project: 'gtai',
    graphId: 'gtai-campaign',
    revision: 1,
    producer: { tool: 'pof/games/gtai-quest/storyGuard', version: '1', generatedAt: '2026-11-02T00:00:00.000Z' },
    source: { pitch: 'games/gtai/pitch.md (baseline v1)', ledgerQuests: items.map((i) => i.id) },
    profile: {
      axis: { name: 'act', unit: 'act ordinal (ACT_IDS)', min: 0, max: ACT_IDS.length - 1 },
      lanes: GTAI_ARC.map((a) => ({ id: a.act, label: a.title })),
      nodeClasses: [
        { id: 'start', coreKind: 'entry', label: 'Start' },
        { id: 'act', coreKind: 'container', label: 'Act' },
        { id: 'beat', coreKind: 'event', label: 'Owner beat' },
        { id: 'contract', coreKind: 'container', label: 'Quest' },
        { id: 'quest-play', coreKind: 'event', label: 'Quest play' },
        { id: 'act-close', coreKind: 'event', label: 'Act close' },
        { id: 'finale', coreKind: 'ending', label: 'Ending' },
      ],
      languages: ['en'],
    },
    variables,
    entries: ['start'],
    nodes,
    edges,
    endings: [{ node: ENDING_NODE, label: 'Pentagon raid ending (punchline [open])' }],
    budgets: { unit: 'words', basis: 'no text is budgeted in the campaign graph (titles only)', perClass: {} },
  };
}

/** The GTAI campaign baseline (pitch.md §2) as `pof.storygraph/1`, project `gtai`, with every
 *  ledger quest merged in as a `container` of class `contract` inside its act, ordered by act then id. */
export function buildCampaignGraph(ledger: QuestGuardContext['ledger']): StoryGraph {
  return buildGraph(ledger.map((p) => ({ id: p.id, design: p })));
}

const findingKey = (f: StoryFinding): string => `${f.code}|${[...f.nodes].sort().join(',')}|${[...(f.variables ?? [])].sort().join(',')}`;

export function assessStory(subject: string, design: QuestDesign, ctx: QuestGuardContext): GuardVerdict {
  const findings: GuardFinding[] = [];
  const flaggedVars = new Set<string>();
  const others = ctx.ledger.filter((p) => p.id !== subject);
  const myAct = actIndex(design.act);
  const isProtected = (v: string) => PROTECTED_VARS.includes(v);
  const isQuestVar = (v: string) => v.startsWith(QUEST_VAR_PREFIX);

  const claim = claimable(design.claimsBeat, design.act);
  const rival = claim ? others.find((p) => p.claimsBeat === claim.id) : undefined;
  if (design.claimsBeat) {
    const beat = BEATS.get(design.claimsBeat);
    if (!beat) {
      findings.push({ code: 'BEAT_UNKNOWN', severity: 'error', ref: design.claimsBeat, message: `claims ${design.claimsBeat}, which is not an arc beat` });
    } else if (beat.act !== design.act) {
      findings.push({ code: 'BEAT_WRONG_ACT', severity: 'error', ref: beat.id, message: `claims ${beat.id} (${beat.act}) from a ${design.act} quest` });
    } else if (!claim) {
      const why = OPEN_CANON_BEATS.includes(beat.id) ? ' until the owner resolves its open canon' : '';
      findings.push({ code: 'BEAT_NOT_CLAIMABLE', severity: 'error', ref: beat.id, message: `${beat.id} cannot be realised by a quest${why}` });
    } else {
      if (rival) findings.push({ code: 'BEAT_ALREADY_CLAIMED', severity: 'error', ref: beat.id, message: `${beat.id} is already realised by quest ${rival.id}` });
      for (const v of beat.writes) {
        if (!design.story.writes.some((w) => w.var === v)) {
          findings.push({ code: 'BEAT_CLAIM_UNWRITTEN', severity: 'error', ref: v, message: `claims ${beat.id} but never writes ${v}` });
          flaggedVars.add(v);
        }
      }
    }
  }

  for (const w of design.story.writes) {
    if (claim && !rival && claim.writes.includes(w.var)) continue;
    if (rival && claim?.writes.includes(w.var)) { flaggedVars.add(w.var); continue; }
    if (isProtected(w.var)) {
      findings.push({ code: 'PROTECTED_VAR_WRITE', severity: 'error', ref: w.var, message: `writes ${w.var}: open canon, owner-only` });
    } else if (BASELINE.has(w.var)) {
      findings.push({ code: 'ARC_VAR_NOT_OWNED', severity: 'error', ref: w.var, message: `writes ${w.var}: only its owner beat (${BASELINE.get(w.var)!.writers.join(', ')}) may write it; a quest realising that beat declares claimsBeat` });
    } else if (!isQuestVar(w.var)) {
      findings.push({ code: 'UNKNOWN_VAR', severity: 'error', ref: w.var, message: `writes undeclared ${w.var}: declare quest state as ${QUEST_VAR_PREFIX}<name>` });
    } else continue;
    flaggedVars.add(w.var);
  }

  for (const r of design.story.reads) {
    let writerAct: number | null = null;
    if (BASELINE.has(r)) {
      const a = firstWriterAct(r);
      writerAct = a === null ? null : actIndex(a);
    } else if (isQuestVar(r)) {
      const acts = [...others.filter((p) => p.story.writes.some((w) => w.var === r)).map((p) => actIndex(p.act)),
        ...(design.story.writes.some((w) => w.var === r) ? [myAct] : [])];
      writerAct = acts.length ? Math.min(...acts) : null;
    } else {
      findings.push({ code: 'UNKNOWN_VAR', severity: 'error', ref: r, message: `reads undeclared ${r}` });
      flaggedVars.add(r);
      continue;
    }
    if (writerAct !== null && writerAct > myAct) {
      findings.push({ code: 'READS_FUTURE_STATE', severity: 'error', ref: r, message: `reads ${r}, first written in ${ACT_IDS[writerAct]} (after ${design.act})` });
      flaggedVars.add(r);
    }
  }

  // A re-scored package's own new characters are in `ctx.cast` (the loader adds every ledger
  // package's cast); they collide only when the baseline or ANOTHER quest also has the id.
  const ownOnly = (id: string) =>
    ctx.ledger.some((p) => p.id === subject && p.characters.some((c) => c.id === id)) &&
    !GTAI_CAST.some((c) => c.id === id) && !others.some((p) => p.characters.some((c) => c.id === id));
  for (const c of design.characters) {
    if (c.status === 'existing' && !ctx.cast.has(c.id)) {
      findings.push({ code: 'UNKNOWN_EXISTING_CHARACTER', severity: 'error', ref: c.id, message: `${c.id} is marked existing but is not in the cast` });
    } else if (c.status === 'new' && ctx.cast.has(c.id) && !ownOnly(c.id)) {
      findings.push({ code: 'NEW_CHARACTER_COLLIDES', severity: 'error', ref: c.id, message: `${c.id} is marked new but the cast already has that id` });
    }
    if (c.status === 'new' && !c.designNote?.trim()) {
      findings.push({ code: 'NEW_CHARACTER_NO_DESIGN', severity: 'warn', ref: c.id, message: `new character ${c.id} has no designNote for the art pass` });
    }
  }

  const base = others.map((p) => ({ id: p.id, design: p as QuestDesign }));
  const before = new Set(validateStoryGraph(buildGraph(base)).filter((f) => f.severity === 'error').map(findingKey));
  for (const f of validateStoryGraph(buildGraph([...base, { id: subject, design }]))) {
    if (f.severity !== 'error' || before.has(findingKey(f))) continue;
    if ((f.variables ?? []).some((v) => flaggedVars.has(v))) continue;
    findings.push({ code: `GRAPH_${f.code}`, severity: 'error', ref: f.variables?.[0] ?? f.nodes[0], message: f.detail });
  }

  return {
    guard: 'story',
    state: findings.some((f) => f.severity === 'error') ? 'red' : 'green',
    basis: `gtai-campaign baseline + ${others.length} ledger quests`,
    findings,
  };
}
