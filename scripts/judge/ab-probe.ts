/**
 * A/B probe — does removing the two harness defects change judged scores?
 *
 * Arm A = today's harness (raw `data`, sibling projection with `includeNested` off).
 * Arm B = fixed (`stripNonContent(data)` + sibling projection with `includeNested` on).
 * Same content, same model/effort, drawn SEQUENTIALLY (parallel draws trip the API rate wall).
 * Records NOTHING to `judge_verdicts` — this is measurement only; the DB is opened readonly.
 *
 *   npx tsx scripts/judge/ab-probe.ts --n 12 --draws 1     # smoke test
 *   npx tsx scripts/judge/ab-probe.ts --n 20 --draws 3     # properly powered (median-of-3/arm)
 *
 * RESUMABLE: every completed cell is appended to `ab-results.json` immediately (not just at the
 * end), keyed on catalog+entity+step. On restart, any cell already present in that file is
 * skipped rather than re-drawn — a session-limit reset costs one cell, not the whole run. If a
 * limit hits mid-run, wait for reset and re-run the identical command.
 */
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildRubricPrompt, parseJudgeResult } from '../../src/lib/judge/rubrics';
import { buildSiblingContext, projectStep } from '../../src/lib/judge/siblingContext';
import { stripNonContent } from '../../src/lib/judge/payload';
import { getStepFact, isSyntheticEntity } from '../../src/lib/status/statusModel';

const N = Number(process.argv[process.argv.indexOf('--n') + 1] ?? 12);
const DRAWS = Number(process.argv[process.argv.indexOf('--draws') + 1] ?? 1);
const RESULTS_PATH = 'ab-results.json';

/** Which defect a sampled cell isolates. 'contaminated' = defect 1 (produceDirection leak);
 *  'blind-siblings' = defect 2 (a sibling arm A cannot see at all, arm B can); 'control' =
 *  neither — the internal-validity check (both arms should score these near-identically). */
type Stratum = 'contaminated' | 'blind-siblings' | 'control';

interface Cell {
  catalogId: string;
  entityId: string;
  step: string;
  data: Record<string, unknown>;
}

/** A cell after stratified sampling has picked it — carries which stratum it was drawn for. */
interface SampledCell extends Cell {
  stratum: Stratum;
}

/** One sampled cell's result. `cell` is the resumability key — it MUST be unique per row, so it
 *  carries entityId (not just catalog+step, which collides across the many entities that share a
 *  step name). */
interface ResultRow {
  cell: string;
  contaminated: boolean;
  stratum: Stratum;
  armA: number | null;
  armB: number | null;
  delta: number | null;
}

interface ArtifactRow {
  catalog_id: string;
  entity_id: string;
  step: string;
  data: string;
}

function cellKey(c: Cell): string {
  return `${c.catalogId}::${c.entityId}::${c.step}`;
}

/** A sibling is "blind" when today's (non-nested) projection sees nothing in it but the fixed
 *  (`includeNested: true`) projection sees content — i.e. arm A cannot cross-reference it at all
 *  and arm B can. Pure. */
function isBlindSibling(sib: Cell): boolean {
  const plain = projectStep(sib.data, 600);
  const nested = projectStep(sib.data, 600, { includeNested: true });
  return plain.trim().length === 0 && nested.trim().length > 0;
}

function load(): { cells: SampledCell[]; siblings: Map<string, Cell[]>; strataSizes: Record<Stratum, number> } {
  // Readonly: the probe is measurement only and must never write to (or lock) the app's DB.
  const db = new Database(join(homedir(), '.pof', 'pof.db'), { readonly: true });
  const rows = db.prepare('SELECT catalog_id,entity_id,step,data FROM pipeline_artifacts').all() as ArtifactRow[];
  db.close();
  const all: Cell[] = rows.map((r) => ({
    catalogId: r.catalog_id,
    entityId: r.entity_id,
    step: r.step,
    data: (() => {
      try {
        return JSON.parse(r.data);
      } catch {
        return {};
      }
    })(),
  }));
  const siblings = new Map<string, Cell[]>();
  for (const c of all) {
    const k = `${c.catalogId}|${c.entityId}`;
    siblings.set(k, [...(siblings.get(k) ?? []), c]);
  }

  // Defect 1 fix — `judge()` below hardcodes the 'text-config' rubric, but `all` contains every
  // artifact regardless of deliverable class. Judging e.g. a 2d-art or ue-runtime artifact under
  // the text rubric produces a meaningless score that pollutes the stratum mean, so the judged
  // population is restricted to cells whose AUDITED deliverable (step-facts.json, via
  // getStepFact — keyed by catalogId+step, not per-entity) is 'text-config'. A step with no fact
  // is excluded rather than assumed text-config.
  //
  // Same filter also excludes fixture entities from test/smoke harnesses (`test-headless*`,
  // `item-mcp-smoke` — `isSyntheticEntity`, the same predicate `buildSwimlane` uses to keep them
  // off the /status map): judging one scores a stub and corrupts the stratum mean. This is a
  // JUDGED-SAMPLE exclusion only — `siblings` above is built from the unfiltered `all`, so a real
  // entity that references a synthetic sibling still sees it as context.
  const textConfig = all.filter(
    (c) => getStepFact(c.catalogId, c.step)?.deliverable === 'text-config' && !isSyntheticEntity(c.entityId),
  );

  // Stratum 1 — contaminated: the cell's own data carries `produceDirection` (defect 1's
  // suspected content leak). Isolates defect 1.
  const contaminated = textConfig.filter((c) => 'produceDirection' in c.data);
  const nonContaminated = textConfig.filter((c) => !('produceDirection' in c.data));

  // Stratum 2 — blind-siblings: NOT contaminated, but at least one sibling (same
  // catalogId+entityId, different step, any deliverable class — siblings are context here, not
  // judged themselves) is blind under today's projection and visible once `includeNested` is on.
  // Isolates defect 2 — arm B can only differ from arm A here.
  const blindSiblings = nonContaminated.filter((c) => {
    const sibs = (siblings.get(`${c.catalogId}|${c.entityId}`) ?? []).filter((s) => s.step !== c.step);
    return sibs.some(isBlindSibling);
  });
  const blindKeys = new Set(blindSiblings.map(cellKey));

  // Stratum 3 — control: neither of the above. The internal-validity check — both arms should
  // score these near-identically.
  const control = nonContaminated.filter((c) => !blindKeys.has(cellKey(c)));

  const strataSizes: Record<Stratum, number> = {
    contaminated: contaminated.length,
    'blind-siblings': blindSiblings.length,
    control: control.length,
  };

  // Independence fix — sibling steps of one entity share content, canon and defects, so filling
  // a stratum in raw DB-row order can draw many cells from a single entity (n=1 dressed up as
  // n=7). This groups a pool by (catalogId, entityId), sorts groups deterministically
  // (catalogId then entityId — never randomized, so the run stays reproducible/resumable), and
  // emits at most one cell per group per round before any group contributes a second — i.e. a
  // full round-robin-across-entities ordering. Because it's a full deterministic ordering,
  // taking its first K elements always yields the same K regardless of what K a later top-up
  // needs.
  function roundRobinOrder(pool: Cell[]): Cell[] {
    const groups = new Map<string, { catalogId: string; entityId: string; cells: Cell[] }>();
    for (const c of pool) {
      const k = `${c.catalogId}\u0000${c.entityId}`;
      const g = groups.get(k);
      if (g) g.cells.push(c);
      else groups.set(k, { catalogId: c.catalogId, entityId: c.entityId, cells: [c] });
    }
    const ordered = [...groups.values()].sort((x, y) =>
      x.catalogId === y.catalogId ? x.entityId.localeCompare(y.entityId) : x.catalogId.localeCompare(y.catalogId),
    );
    const maxLen = ordered.reduce((m, g) => Math.max(m, g.cells.length), 0);
    const result: Cell[] = [];
    for (let round = 0; round < maxLen; round++) {
      for (const g of ordered) {
        if (round < g.cells.length) result.push(g.cells[round]);
      }
    }
    return result;
  }

  // Deterministic fill (never randomized — the run must be reproducible and resumable):
  // ceil(N/3) from stratum 1, then ceil(N/3) from stratum 2, then the remainder from stratum 3,
  // each drawn from that stratum's round-robin-by-entity order; if any stratum is short, top up
  // from whichever still has unused cells left in its own order (tried in stratum order) so the
  // sample reaches N whenever the data allows.
  const target = Math.ceil(N / 3);
  const contamOrder = roundRobinOrder(contaminated);
  const blindOrder = roundRobinOrder(blindSiblings);
  const controlOrder = roundRobinOrder(control);

  const byStratum: Record<Stratum, Cell[]> = {
    contaminated: contamOrder.slice(0, target),
    'blind-siblings': blindOrder.slice(0, target),
    control: [],
  };
  byStratum.control = controlOrder.slice(
    0,
    Math.max(0, N - byStratum.contaminated.length - byStratum['blind-siblings'].length),
  );

  const orders: Array<[Cell[], Stratum]> = [
    [contamOrder, 'contaminated'],
    [blindOrder, 'blind-siblings'],
    [controlOrder, 'control'],
  ];
  let total = byStratum.contaminated.length + byStratum['blind-siblings'].length + byStratum.control.length;
  for (const [order, stratum] of orders) {
    if (total >= N) break;
    const current = byStratum[stratum].length;
    if (current >= order.length) continue; // this stratum's pool is exhausted
    const extra = Math.min(N - total, order.length - current);
    byStratum[stratum] = order.slice(0, current + extra);
    total += extra;
  }

  // Defect 3 fix — a killed run must still be interpretable. The final sample interleaves
  // strata round-robin (contaminated, blind-siblings, control, contaminated, …) instead of
  // running each stratum as a contiguous block, so ANY prefix of the order — including whatever
  // finished before the process was killed — carries a roughly equal mix of all three strata.
  // In particular the control stratum (the internal-validity check) always has data even from a
  // partial run.
  const strataOrder: Stratum[] = ['contaminated', 'blind-siblings', 'control'];
  const cursor: Record<Stratum, number> = { contaminated: 0, 'blind-siblings': 0, control: 0 };
  const pick: SampledCell[] = [];
  let advanced = true;
  while (advanced && pick.length < N) {
    advanced = false;
    for (const s of strataOrder) {
      if (pick.length >= N) break;
      const list = byStratum[s];
      const i = cursor[s];
      if (i < list.length) {
        pick.push({ ...list[i], stratum: s });
        cursor[s] = i + 1;
        advanced = true;
      }
    }
  }

  return { cells: pick, siblings, strataSizes };
}

/** Load a prior partial run, if any. A missing or corrupt file degrades to "start over" —
 *  never a crash — since resumability must never be the thing that breaks the probe. */
function loadPriorRows(): ResultRow[] {
  if (!existsSync(RESULTS_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as { rows?: ResultRow[] };
    return Array.isArray(parsed.rows) ? parsed.rows : [];
  } catch {
    return [];
  }
}

/** Recompute the mean and rewrite `ab-results.json`. Called after EVERY cell (not just once at
 *  the end) so a session-limit reset never costs more than the cell in flight. */
function persist(rows: ResultRow[]): number {
  const deltas = rows.map((r) => r.delta).filter((d): d is number => d != null);
  const mean = deltas.reduce((x, y) => x + y, 0) / (deltas.length || 1);
  writeFileSync(RESULTS_PATH, JSON.stringify({ mean, rows }, null, 2));
  return mean;
}

/** One judge draw for one arm. `fixed` selects arm B (strip + nested); arm A gets the raw
 *  payload and today's (non-nested) sibling projection, from the SAME shared functions — so the
 *  only variable between arms is the fix itself, nothing else about the prompt. */
async function judge(cell: Cell, sibs: Cell[], fixed: boolean): Promise<number | null> {
  const data = fixed ? stripNonContent(cell.data) : cell.data;
  const steps = sibs.filter((s) => s.step !== cell.step).map((s) => ({ step: s.step, data: s.data }));
  const siblingContext = buildSiblingContext(steps, cell.step, { includeNested: fixed }) || undefined;
  const prompt = buildRubricPrompt('text-config', {
    subject: `${cell.catalogId} / ${cell.entityId} / ${cell.step}`,
    payload: '```json\n' + JSON.stringify(data, null, 2) + '\n```',
    siblingContext,
  });
  const { runClaudeJudge } = await import('./abRunner');
  const raw = await runClaudeJudge(prompt);
  return parseJudgeResult(raw)?.score ?? null;
}

async function main() {
  const { cells, siblings } = load();
  const out: ResultRow[] = loadPriorRows();
  const done = new Set(out.map((r) => r.cell));

  for (const c of cells) {
    const key = cellKey(c);
    if (done.has(key)) {
      process.stdout.write(`${key.padEnd(60)} SKIP (already recorded)\n`);
      continue;
    }
    const sibs = siblings.get(`${c.catalogId}|${c.entityId}`) ?? [];
    const a: number[] = [];
    const b: number[] = [];
    // Sequential, arm by arm, draw by draw — no Promise.all. Parallel draws trip the API rate
    // wall, and median-of-N needs every draw to land before it can pick the middle one anyway.
    for (let i = 0; i < DRAWS; i++) {
      const s = await judge(c, sibs, false);
      if (s != null) a.push(s);
    }
    for (let i = 0; i < DRAWS; i++) {
      const s = await judge(c, sibs, true);
      if (s != null) b.push(s);
    }
    const med = (xs: number[]) => (xs.length ? [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)] : null);
    const armA = med(a);
    const armB = med(b);
    const row: ResultRow = {
      cell: key,
      contaminated: 'produceDirection' in c.data,
      stratum: c.stratum,
      armA,
      armB,
      delta: armA != null && armB != null ? armB - armA : null,
    };
    out.push(row);
    process.stdout.write(`${row.cell.padEnd(60)} [${row.stratum}] A=${row.armA} B=${row.armB} Δ=${row.delta}\n`);
    persist(out); // resumable: written after EVERY cell, not just at the end
  }

  const mean = persist(out);
  const deltas = out.map((r) => r.delta).filter((d): d is number => d != null);
  process.stdout.write(`\nmean delta (B - A): ${mean.toFixed(1)} over ${deltas.length} cells\n`);

  // Per-stratum breakdown — the whole point of stratifying: a delta must be attributable to the
  // defect its stratum isolates, not buried in an overall average.
  const strataLabels: Stratum[] = ['contaminated', 'blind-siblings', 'control'];
  for (const s of strataLabels) {
    const sDeltas = out.filter((r) => r.stratum === s).map((r) => r.delta).filter((d): d is number => d != null);
    const sMean = sDeltas.reduce((x, y) => x + y, 0) / (sDeltas.length || 1);
    process.stdout.write(
      `  ${s.padEnd(16)} mean delta (B - A): ${sDeltas.length ? sMean.toFixed(1) : 'n/a'} over ${sDeltas.length} cells\n`,
    );
  }
}
main();
